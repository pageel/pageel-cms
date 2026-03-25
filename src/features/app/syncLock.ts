/**
 * Sync Lock Wrapper
 * 
 * WF-06: Utility to wrap Git operations with sync locking to prevent
 * concurrent operations and show sync progress to users.
 */

import { useAppStore } from '../app/store';

/**
 * Wraps an async Git operation with sync lock
 * @param operation - The async operation to execute
 * @param message - Optional message to display during sync
 * @returns Promise with the result of the operation
 */
export async function withSyncLock<T>(
  operation: () => Promise<T>,
  message?: string
): Promise<T> {
  const { isSyncing, startSync, endSync } = useAppStore.getState();
  
  // Prevent concurrent sync operations
  if (isSyncing) {
    throw new Error('Another sync operation is in progress. Please wait.');
  }
  
  try {
    startSync(message);
    const result = await operation();
    return result;
  } finally {
    endSync();
  }
}
