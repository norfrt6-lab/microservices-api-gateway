import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { ServiceUnavailableError } from '../utils/errors';
import { circuitBreakerState as circuitBreakerGauge } from '../telemetry/meter';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold: number;   // failures before opening circuit
  recoveryTimeout: number;    // ms before trying half-open
  halfOpenMaxRequests: number; // max requests in half-open state
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  recoveryTimeout: 30000,
  halfOpenMaxRequests: 3,
};

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  halfOpenRequests: number;
  successCount: number;
}

class CircuitBreaker {
  private circuits: Map<string, CircuitBreakerState> = new Map();
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  private getCircuit(service: string): CircuitBreakerState {
    if (!this.circuits.has(service)) {
      this.circuits.set(service, {
        state: CircuitState.CLOSED,
        failureCount: 0,
        lastFailureTime: 0,
        halfOpenRequests: 0,
        successCount: 0,
      });
    }
    return this.circuits.get(service)!;
  }

  /**
   * Check if a request to this service should be allowed.
   */
  canRequest(service: string): boolean {
    const circuit = this.getCircuit(service);

    switch (circuit.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN: {
        const elapsed = Date.now() - circuit.lastFailureTime;
        if (elapsed >= this.options.recoveryTimeout) {
          // Transition to half-open
          circuit.state = CircuitState.HALF_OPEN;
          circuit.halfOpenRequests = 0;
          circuit.successCount = 0;
          circuitBreakerGauge.set({ service }, 2); // 2 = HALF_OPEN
          logger.info({ service, state: CircuitState.HALF_OPEN }, 'Circuit breaker → HALF_OPEN');
          return true;
        }
        return false;
      }

      case CircuitState.HALF_OPEN:
        return circuit.halfOpenRequests < this.options.halfOpenMaxRequests;
    }
  }

  /**
   * Record a successful request.
   */
  recordSuccess(service: string): void {
    const circuit = this.getCircuit(service);

    if (circuit.state === CircuitState.HALF_OPEN) {
      circuit.successCount++;
      circuit.halfOpenRequests++;

      if (circuit.successCount >= this.options.halfOpenMaxRequests) {
        // All half-open requests succeeded — close the circuit
        circuit.state = CircuitState.CLOSED;
        circuit.failureCount = 0;
        circuit.halfOpenRequests = 0;
        circuit.successCount = 0;
        circuitBreakerGauge.set({ service }, 0); // 0 = CLOSED
        logger.info({ service, state: CircuitState.CLOSED }, 'Circuit breaker → CLOSED');
      }
    } else if (circuit.state === CircuitState.CLOSED) {
      // Reset failure count on success
      circuit.failureCount = 0;
    }
  }

  /**
   * Record a failed request.
   */
  recordFailure(service: string): void {
    const circuit = this.getCircuit(service);

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open re-opens the circuit
      circuit.state = CircuitState.OPEN;
      circuit.lastFailureTime = Date.now();
      circuit.halfOpenRequests = 0;
      circuit.successCount = 0;
      circuitBreakerGauge.set({ service }, 1); // 1 = OPEN
      logger.warn({ service, state: CircuitState.OPEN }, 'Circuit breaker → OPEN (half-open failure)');
    } else if (circuit.state === CircuitState.CLOSED) {
      circuit.failureCount++;
      circuit.lastFailureTime = Date.now();

      if (circuit.failureCount >= this.options.failureThreshold) {
        circuit.state = CircuitState.OPEN;
        circuitBreakerGauge.set({ service }, 1); // 1 = OPEN
        logger.warn(
          { service, state: CircuitState.OPEN, failures: circuit.failureCount },
          'Circuit breaker → OPEN (threshold reached)',
        );
      }
    }
  }

  /**
   * Get the current state of all circuits (for health endpoint).
   */
  getStates(): Record<string, { state: CircuitState; failureCount: number }> {
    const states: Record<string, { state: CircuitState; failureCount: number }> = {};
    for (const [service, circuit] of this.circuits) {
      states[service] = {
        state: circuit.state,
        failureCount: circuit.failureCount,
      };
    }
    return states;
  }

  /**
   * Get the state of a specific circuit.
   */
  getState(service: string): CircuitState {
    return this.getCircuit(service).state;
  }
}

// Singleton instance
export const circuitBreaker = new CircuitBreaker();

/**
 * Express middleware that wraps the proxy with circuit breaker logic.
 * Extracts the service name from the route config target URL.
 */
export function circuitBreakerMiddleware(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!circuitBreaker.canRequest(serviceName)) {
      logger.warn(
        { correlationId: req.correlationId, service: serviceName },
        'Circuit breaker OPEN — request rejected',
      );
      return next(new ServiceUnavailableError(serviceName));
    }

    // Track if half-open
    const circuit = circuitBreaker.getState(serviceName);
    if (circuit === CircuitState.HALF_OPEN) {
      // Increment half-open request counter by recording we're attempting
      logger.debug({ service: serviceName }, 'Circuit breaker HALF_OPEN — allowing probe request');
    }

    // Intercept response to record success/failure
    const originalEnd = res.end.bind(res);
    res.end = ((...args: any[]) => {
      if (res.statusCode >= 500) {
        circuitBreaker.recordFailure(serviceName);
      } else {
        circuitBreaker.recordSuccess(serviceName);
      }
      return originalEnd(...args);
    }) as typeof res.end;

    next();
  };
}
