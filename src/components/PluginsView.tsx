

import React, { useState, Component, type ReactNode } from 'react';
import type { IGitService, GithubRepo } from '../types';
import type { PluginConfig } from '../plugins';
import { SUPPORTED_PLUGINS } from '../plugins/registry';
import { PuzzleIcon } from './icons/PuzzleIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { ErrorMessages, ErrorCodes } from '../lib/errors';

interface PluginsViewProps {
  gitService: IGitService;
  repo: GithubRepo;
  pluginConfig: PluginConfig;
  setPluginConfig: (config: PluginConfig) => void;
}

// ── Dynamic Form Schema Definitions ──
const SCHEMAS: Record<string, { properties: Record<string, { type: string; default: any; label: string; options?: string[] }> }> = {
  '@pageel/plugin-mdx': {
    properties: {
      theme: { type: 'string', default: 'light', label: 'Editor Theme', options: ['light', 'dark'] },
      fontSize: { type: 'number', default: 14, label: 'Font Size (px)' },
    },
  },
  '@pageel/plugin-easymde': {
    properties: {
      autosave: { type: 'boolean', default: true, label: 'Enable Autosave' },
      spellChecker: { type: 'boolean', default: false, label: 'Enable Spell Checker' },
    },
  },
};

// ── Emergency Error Boundary for Modal ──
// @para-doc [#csa-plugins-view-exclusive-toggle-boundary]
interface ModalErrorBoundaryProps {
  fallback: (reset: () => void) => ReactNode;
  children: ReactNode;
}

interface ModalErrorBoundaryState {
  hasError: boolean;
}

class ModalErrorBoundary extends Component<ModalErrorBoundaryProps, ModalErrorBoundaryState> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[PluginsView] Modal Component crashed:', error.message);
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.reset);
    }
    return this.props.children;
  }
}

// @para-doc [#csa-plugins-view-layout]
export const PluginsView: React.FC<PluginsViewProps> = ({
  gitService,
  repo,
  pluginConfig,
  setPluginConfig,
}) => {
  const activeEditor = pluginConfig?.plugins?.editor;
  const activeSettings = pluginConfig?.plugins?.settings || {};

  // UI States
  const [syncingPluginId, setSyncingPluginId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'loading' | 'success' | 'error'; message: string } | null>(null);
  const [configuringPlugin, setConfiguringPlugin] = useState<string | null>(null);
  const [tempSettings, setTempSettings] = useState<Record<string, any>>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // @para-doc [#csa-plugins-view-exclusive-toggle]
  // @para-doc [#csa-plugins-conflict-resolution]
  // @para-doc [#csa-plugins-ui-dev-guard]
  const handleToggleActivation = async (pluginId: string, currentlyActive: boolean) => {
    const targetPlugin = SUPPORTED_PLUGINS.find(p => p.id === pluginId);
    const isTestProd = (typeof globalThis !== 'undefined' && (globalThis as any).__TEST_PROD_MODE__);
    const isDevMode = (import.meta.env.DEV || (typeof window !== 'undefined' && (window as any).__CMS_DEBUG__)) && !isTestProd;
    const isDevRestricted = targetPlugin?.status === 'dev' && !isDevMode;
    if (isDevRestricted && !currentlyActive) {
      console.warn(`[pageel] Activation of dev plugin "${pluginId}" blocked in production environment.`);
      return;
    }



    const prevEditor = activeEditor;
    const nextEditor = currentlyActive ? null : pluginId;


    // 1. Optimistic Update
    setPluginConfig({
      plugins: {
        ...pluginConfig?.plugins,
        editor: nextEditor || undefined,
      },
    });

    setSyncingPluginId(pluginId);
    setToast({ type: 'loading', message: 'Đang đồng bộ cấu hình lên Git...' });

    // 2. Network Request with Timeout (15s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch('/api/settings/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editor: nextEditor }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        setToast({ type: 'success', message: 'Đồng bộ cấu hình thành công!' });
        setTimeout(() => setToast(null), 2500);
      } else {
        throw new Error(ErrorMessages[ErrorCodes.PLUGINS_SAVE_FAILED]);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[PluginsView] Sync failed:', err.message);

      // 3. Rollback State
      setPluginConfig({
        plugins: {
          ...pluginConfig?.plugins,
          editor: prevEditor || undefined,
        },
      });

      setToast({
        type: 'error',
        message: err.name === 'AbortError'
          ? 'Đồng bộ quá hạn (Timeout). Vui lòng thử lại.'
          : ErrorMessages[ErrorCodes.PLUGINS_SAVE_FAILED],
      });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSyncingPluginId(null);
    }
  };

  // @para-doc [#csa-plugins-view-config-modal]
  const handleOpenConfigure = (pluginId: string) => {
    const schema = SCHEMAS[pluginId];
    const initial: Record<string, any> = {};
    if (schema) {
      Object.keys(schema.properties).forEach((key) => {
        initial[key] = activeSettings[key] !== undefined ? activeSettings[key] : schema.properties[key].default;
      });
    }
    setTempSettings(initial);
    setConfiguringPlugin(pluginId);
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setToast({ type: 'loading', message: 'Đang lưu cấu hình plugin...' });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch('/api/settings/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editor: activeEditor, settings: tempSettings }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        setPluginConfig({
          plugins: {
            ...pluginConfig?.plugins,
            settings: tempSettings,
          },
        });
        setToast({ type: 'success', message: 'Cấu hình đã lưu thành công!' });
        setConfiguringPlugin(null);
        setTimeout(() => setToast(null), 2500);
      } else {
        throw new Error(ErrorMessages[ErrorCodes.PLUGINS_SAVE_FAILED]);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      setToast({
        type: 'error',
        message: err.name === 'AbortError'
          ? 'Lưu cấu hình quá hạn (Timeout). Vui lòng thử lại.'
          : ErrorMessages[ErrorCodes.PLUGINS_SAVE_FAILED],
      });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeactivateQuick = () => {
    if (configuringPlugin) {
      handleToggleActivation(configuringPlugin, true);
      setConfiguringPlugin(null);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Alert Banner */}
      {toast && (
        <div className="fixed bottom-24 right-6 z-50 animate-fade-in">
          <div
            className={`flex items-center gap-2.5 px-5 py-3 rounded-md shadow-lg border text-sm font-medium ${
              toast.type === 'loading'
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : toast.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {toast.type === 'loading' && <SpinnerIcon className="w-4 h-4 animate-spin" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-b border-notion-border pb-4">
        <div>
          <h2 className="text-lg font-semibold text-notion-text">Available Plugins</h2>
          <p className="text-sm text-notion-muted">
            Manage your editor extensions and layout components.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {SUPPORTED_PLUGINS.map((plugin) => {
          const isActive = activeEditor === plugin.id;
          const isProcessing = syncingPluginId === plugin.id;

          return (
            <div
              key={plugin.id}
              className={`border rounded-md p-6 bg-white transition-all shadow-sm flex flex-col justify-between hover:shadow-md ${
                isActive ? 'border-notion-blue bg-blue-50/5' : 'border-notion-border'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-sm ${isActive ? 'bg-blue-100 text-notion-blue' : 'bg-gray-100 text-notion-muted'}`}>
                      <PuzzleIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-notion-text">{plugin.name}</h3>
                      <span className="text-xs text-notion-muted font-mono">v{plugin.version} • By {plugin.author}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {plugin.status === 'dev' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                        🚧 Dev Mode
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-sm text-notion-muted leading-relaxed">
                  {plugin.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-notion-border flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleOpenConfigure(plugin.id)}
                  className="px-3.5 py-1.5 border border-notion-border hover:bg-notion-hover text-xs font-medium rounded-sm shadow-sm transition-colors text-notion-text"
                >
                  Configure
                </button>
                {(() => {
                  const isTestProd = (typeof globalThis !== 'undefined' && (globalThis as any).__TEST_PROD_MODE__);
                  const isDevMode = (import.meta.env.DEV || (typeof window !== 'undefined' && (window as any).__CMS_DEBUG__)) && !isTestProd;
                  const isDevRestricted = plugin.status === 'dev' && !isDevMode;
                  return (
                    <button

                      type="button"
                      disabled={isProcessing || (isDevRestricted && !isActive)}
                      title={isDevRestricted && !isActive ? "Plugin đang ở chế độ Dev Mode, chỉ cho phép kích hoạt khi CMS_DEBUG=true" : undefined}
                      onClick={() => handleToggleActivation(plugin.id, isActive)}
                      className={`px-4 py-1.5 text-xs font-medium rounded-sm shadow-sm transition-colors flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                          : isDevRestricted
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                          : 'bg-notion-blue hover:bg-blue-600 text-white'
                      }`}
                    >
                      {isProcessing && <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />}
                      {isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  );
                })()}

              </div>

            </div>
          );
        })}
      </div>

      {/* Dynamic Configure Modal */}
      {configuringPlugin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-notion-border rounded-md shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-notion-border flex items-center justify-between bg-notion-sidebar">
              <h3 className="font-semibold text-notion-text">
                Configure: {SUPPORTED_PLUGINS.find((p) => p.id === configuringPlugin)?.name}
              </h3>
              <button
                type="button"
                onClick={() => setConfiguringPlugin(null)}
                className="text-notion-muted hover:text-notion-text text-lg font-medium"
              >
                &times;
              </button>
            </div>

            <div className="p-6 flex-grow space-y-4 max-h-[60vh] overflow-y-auto">
              <ModalErrorBoundary
                fallback={(reset) => (
                  <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700 space-y-3">
                    <p className="font-medium">⚠️ Giao diện cấu hình plugin bị lỗi crash.</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={reset}
                        className="px-3 py-1 bg-white border border-red-200 rounded text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Reset cấu hình
                      </button>
                      <button
                        type="button"
                        onClick={handleDeactivateQuick}
                        className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700"
                      >
                        Vô hiệu hóa nhanh
                      </button>
                    </div>
                  </div>
                )}
              >
                {/* Dynamically Render Form Elements */}
                {(() => {
                  const schema = SCHEMAS[configuringPlugin];
                  if (!schema) return <p className="text-sm text-notion-muted">No custom configuration schema found.</p>;

                  return Object.entries(schema.properties).map(([key, prop]) => {
                    const value = tempSettings[key];

                    return (
                      <div key={key} className="space-y-1.5">
                        <label className="text-xs font-medium text-notion-text block">{prop.label}</label>
                        {prop.type === 'boolean' && (
                          <input
                            type="checkbox"
                            checked={!!value}
                            onChange={(e) => setTempSettings({ ...tempSettings, [key]: e.target.checked })}
                            className="rounded border-gray-300 text-notion-blue focus:ring-notion-blue h-4 w-4"
                          />
                        )}
                        {prop.type === 'string' && prop.options && (
                          <select
                            value={value}
                            onChange={(e) => setTempSettings({ ...tempSettings, [key]: e.target.value })}
                            className="w-full px-3 py-1.5 text-sm border border-notion-border rounded focus:outline-none focus:ring-1 focus:ring-notion-blue"
                          >
                            {prop.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}
                        {prop.type === 'number' && (
                          <input
                            type="number"
                            value={value}
                            onChange={(e) => setTempSettings({ ...tempSettings, [key]: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-1.5 text-sm border border-notion-border rounded focus:outline-none focus:ring-1 focus:ring-notion-blue"
                          />
                        )}
                      </div>
                    );
                  });
                })()}
              </ModalErrorBoundary>
            </div>

            <div className="px-6 py-4 border-t border-notion-border bg-notion-sidebar flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfiguringPlugin(null)}
                className="px-3.5 py-1.5 border border-notion-border hover:bg-notion-hover text-xs font-medium rounded-sm text-notion-text"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingSettings}
                onClick={handleSaveSettings}
                className="px-4 py-1.5 bg-notion-blue hover:bg-blue-600 text-white text-xs font-medium rounded-sm shadow-sm transition-colors flex items-center gap-1.5"
              >
                {isSavingSettings && <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />}
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

