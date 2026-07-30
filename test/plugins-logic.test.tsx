import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlotRenderer } from '../src/plugins/SlotRenderer';
import { usePluginConfig } from '../src/plugins/PluginContext';
import { resolveSlotComponent } from '../src/plugins/registry';

vi.mock('../src/plugins/PluginContext', () => ({
  usePluginConfig: vi.fn(),
}));

vi.mock('../src/plugins/registry', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    resolveSlotComponent: vi.fn(),
  };
});


describe('Plugins Logic and SlotRenderer Bypass TDD Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render fallback if plugins are disabled globally (enabled === false)', () => {
    // Mock plugin config showing system is disabled
    vi.mocked(usePluginConfig).mockReturnValue({
      plugins: { enabled: false, editor: '@pageel/plugin-mdx' }
    });
    
    // Mock registry finding the editor component
    const MockEditor = () => 'MockEditorComponent';
    vi.mocked(resolveSlotComponent).mockReturnValue(MockEditor);

    const result = SlotRenderer({
      slot: 'editor',
      pluginName: '@pageel/plugin-mdx',
      fallback: 'fallback-textarea',
      props: {}
    });

    // Expect fallback content to be rendered since enabled is false
    expect(result.props.children).toBe('fallback-textarea');
  });

  it('should render plugin component if plugins are enabled globally (enabled === true)', () => {
    vi.mocked(usePluginConfig).mockReturnValue({
      plugins: { enabled: true, editor: '@pageel/plugin-mdx' }
    });

    const MockEditor = () => 'MockEditorComponent';
    vi.mocked(resolveSlotComponent).mockReturnValue(MockEditor);

    const result = SlotRenderer({
      slot: 'editor',
      pluginName: '@pageel/plugin-mdx',
      fallback: 'fallback-textarea',
      props: {}
    });

    // When active, it returns PluginErrorBoundary -> Suspense -> MockEditor
    // We expect it to not render fallback directly
    expect(result.props.children).not.toBe('fallback-textarea');
  });

  it('should have PluginStatus type and status field in SUPPORTED_PLUGINS metadata', async () => {

    const { SUPPORTED_PLUGINS } = await import('../src/plugins/registry');
    const easymde = SUPPORTED_PLUGINS.find(p => p.id === '@pageel/plugin-easymde');
    const mdx = SUPPORTED_PLUGINS.find(p => p.id === '@pageel/plugin-mdx');

    expect(mdx?.status).toBe('stable');
    expect(easymde?.status).toBe('dev');
  });

  it('should fallback to default @pageel/plugin-mdx editor slot when slot component is null or crashes', async () => {
    const actualRegistry = await vi.importActual<typeof import('../src/plugins/registry')>('../src/plugins/registry');
    
    // Test actual resolveSlotComponent function
    const FallbackComponent = actualRegistry.resolveSlotComponent('@pageel/plugin-easymde', 'editor');

    // Should return fallback MDX component instead of null/crash component
    expect(FallbackComponent).not.toBeNull();
    expect((FallbackComponent as any)?.__isMdxFallback).toBe(true);
  });
});



