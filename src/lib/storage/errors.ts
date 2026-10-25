export class StorageError extends Error {}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function storageFailure(operation: string, error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  if (!(error instanceof Error)) throw error;
  return new StorageError(`${operation}: ${error.message}`, { cause: error });
}
