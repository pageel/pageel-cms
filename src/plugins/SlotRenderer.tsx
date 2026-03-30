/**
 * SlotRenderer — Lazy load plugin component with ErrorBoundary
 *
 * Features:
 * - Lazy load plugin từ registry (static import map)
 * - ErrorBoundary: plugin crash → fallback UI (không crash CMS)
 * - Suspense: loading indicator while plugin loads
 * - No plugin installed → render fallback directly
 */

import {
  Suspense,
  Component,
  type ReactNode,
  type ComponentType,
} from 'react';
import { resolveSlotComponent } from './registry';
import type { PageelPlugin } from '@pageel/plugin-types';

// ── Error Boundary ──
interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class PluginErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[pageel] Plugin crashed:', error.message);
    console.error('[pageel] Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <>
          {this.props.fallback}
          <div
            style={{
              padding: '8px 12px',
              marginTop: '8px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#991b1b',
            }}
          >
            ⚠️ Plugin crashed: {this.state.error?.message || 'Unknown error'}
          </div>
        </>
      );
    }
    return this.props.children;
  }
}

// ── Loading Indicator ──
function DefaultLoadingIndicator() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        color: '#6b7280',
        fontSize: '14px',
        gap: '8px',
      }}
    >
      <span
        style={{
          width: '16px',
          height: '16px',
          border: '2px solid #e5e7eb',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      Loading editor plugin...
    </div>
  );
}

// ── SlotRenderer ──
interface SlotRendererProps {
  /** Which slot to render (e.g. "editor", "toolbar", "preview") */
  slot: keyof PageelPlugin['slots'];
  /** Plugin name from config (e.g. "@pageel/plugin-mdx") */
  pluginName?: string;
  /** Fallback UI when no plugin or plugin crashes */
  fallback: ReactNode;
  /** Props to pass to the plugin component */
  props: Record<string, unknown>;
  /** Custom loading indicator */
  loadingIndicator?: ReactNode;
}

export function SlotRenderer({
  slot,
  pluginName,
  fallback,
  props,
  loadingIndicator,
}: SlotRendererProps) {
  const PluginComponent = resolveSlotComponent<Record<string, unknown>>(pluginName, slot);

  if (!PluginComponent) {
    return <>{fallback}</>;
  }

  return (
    <PluginErrorBoundary fallback={fallback}>
      <Suspense fallback={loadingIndicator || <DefaultLoadingIndicator />}>
        <PluginComponent {...props} />
      </Suspense>
    </PluginErrorBoundary>
  );
}
