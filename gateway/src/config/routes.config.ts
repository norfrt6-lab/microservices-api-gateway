import { config } from './index';

export interface RouteConfig {
  prefix: string;
  target: string;
  serviceName: string;
  auth: boolean;
  adminOnly?: boolean;
}

export const routeMap: Record<string, RouteConfig[]> = {
  v1: [
    // Auth routes (no auth required)
    { prefix: '/auth', target: config.services.user, serviceName: 'user-service', auth: false },

    // User routes
    { prefix: '/users', target: config.services.user, serviceName: 'user-service', auth: true },

    // Product routes (mixed auth — handled per-method at service level)
    { prefix: '/products', target: config.services.product, serviceName: 'product-service', auth: false },

    // Order routes (auth required)
    { prefix: '/orders', target: config.services.order, serviceName: 'order-service', auth: true },
  ],
};

export function getRouteConfig(version: string, path: string): RouteConfig | undefined {
  const routes = routeMap[version];
  if (!routes) return undefined;

  return routes.find((route) => path.startsWith(route.prefix));
}
