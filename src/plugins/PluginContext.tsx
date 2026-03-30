/**
 * PluginContext — React Context for plugin configuration
 *
 * Provides plugin config from .pageelrc.json to the component tree.
 * Components can read: usePluginConfig().plugins?.editor
 */

import { createContext, useContext, type ReactNode } from 'react';

// ── Plugin Config Interface ──
export interface PluginConfig {
  plugins?: {
    editor?: string;   // "@pageel/plugin-mdx"
    toolbar?: string;  // future
    preview?: string;  // future
  };
}

// ── Context ──
const PluginConfigContext = createContext<PluginConfig>({});

// ── Provider ──
interface PluginConfigProviderProps {
  config: PluginConfig;
  children: ReactNode;
}

export function PluginConfigProvider({ config, children }: PluginConfigProviderProps) {
  return (
    <PluginConfigContext.Provider value={config}>
      {children}
    </PluginConfigContext.Provider>
  );
}

// ── Hook ──
export function usePluginConfig(): PluginConfig {
  return useContext(PluginConfigContext);
}
