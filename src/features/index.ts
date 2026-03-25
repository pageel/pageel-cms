/**
 * Features Barrel Export
 * 
 * All feature modules exported here for easy importing:
 * import { useNavigation, IAuthProvider, useSettingsStore, Collection } from './features';
 */

export * from './auth';
export * from './settings';
export * from './navigation';
export * from './app';
export * from './collections';
export { withSyncLock } from './app/syncLock'; // WF-06
