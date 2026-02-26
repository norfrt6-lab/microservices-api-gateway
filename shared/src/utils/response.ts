import { ApiResponse } from '../types';

export function successResponse<T>(
  data: T,
  meta?: ApiResponse['meta'],
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta,
  };
}

export function errorResponse(
  code: string,
  message: string,
  details?: unknown,
  meta?: ApiResponse['meta'],
): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta,
  };
}
