/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

export function errorMessageOf(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
    return error.message;
  return '';
}

export function errorField(error: unknown, field: 'code' | 'name' | 'status'): unknown {
  return error && typeof error === 'object' && field in error ? (error as Record<string, unknown>)[field] : undefined;
}
