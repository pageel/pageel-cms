/**
 * Navigation Feature Types
 */

export type ViewType = 'dashboard' | 'workflows' | 'images' | 'template' | 'backup' | 'settings';

export interface NavigationState {
  currentView: ViewType;
  history: ViewType[];
}
