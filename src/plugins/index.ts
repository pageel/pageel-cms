/**
 * Plugin system barrel export
 */

export { SlotRenderer } from './SlotRenderer';
export { PluginConfigProvider, usePluginConfig, type PluginConfig } from './PluginContext';
export { createEditorGitService } from './EditorGitService';
export { resolveSlotComponent, isValidPluginName, getPluginInfo } from './registry';
