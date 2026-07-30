import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// @ts-ignore
import { POST as handlePluginsAPI } from '../src/pages/api/settings/plugins';

vi.mock('../src/lib/session', () => {
  return {
    verifySession: vi.fn().mockResolvedValue({ username: 'admin' }),
    resolveGitCredentials: vi.fn().mockReturnValue({ token: 'gh-token', repo: 'owner/repo' }),
    COOKIE_NAME: 'pageel_cms_session',
  };
});

let mockFileContent = '{}';
let mockSha: string | null = null;
const mockUpdateFileContent = vi.fn();
const mockCreateFileFromString = vi.fn();

vi.mock('../src/lib/git-client', () => {
  return {
    createGitConfig: vi.fn().mockReturnValue({}),
    getFileSha: vi.fn().mockImplementation(() => Promise.resolve(mockSha)),
    getFileContent: vi.fn().mockImplementation(() => Promise.resolve(mockFileContent)),
    updateFileContent: vi.fn().mockImplementation((...args) => mockUpdateFileContent(...args)),
    createFileFromString: vi.fn().mockImplementation((...args) => mockCreateFileFromString(...args)),
  };
});

describe('Plugins Management API TDD Tests', () => {
  beforeEach(() => {
    mockFileContent = '{}';
    mockSha = null;
    mockUpdateFileContent.mockClear();
    mockCreateFileFromString.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createContext = (payload: any): any => {
    const request = new Request('http://localhost/api/settings/plugins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return {
      request,
      cookies: {
        get: vi.fn().mockReturnValue({ value: 'valid-session-token' }),
      },
    };
  };

  it('should accept valid editor plugin: @pageel/plugin-easymde', async () => {
    const context = createContext({ editor: '@pageel/plugin-easymde' });
    const response = await handlePluginsAPI(context);
    expect(response.status).toBe(200);
  });

  it('should prevent Prototype Pollution in merge payloads', async () => {
    const maliciousPayload = JSON.parse('{"editor": "@pageel/plugin-mdx", "settings": {"__proto__": {"polluted": true}}}');
    const context = createContext(maliciousPayload);
    const response = await handlePluginsAPI(context);
    expect(response.status).toBe(200);
    expect((global as any).polluted).toBeUndefined();
  });

  it('should reject payloads exceeding 50KB with 400 Bad Request', async () => {
    const largeObject: any = {};
    for (let i = 0; i < 2000; i++) {
      largeObject[`key_${i}`] = 'a'.repeat(30);
    }
    const context = createContext({ editor: '@pageel/plugin-mdx', settings: largeObject });
    const response = await handlePluginsAPI(context);
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toContain('Payload too large');
  });

  it('should reject payloads with depth > 3 with 400 Bad Request', async () => {
    const deepObject = {
      level1: {
        level2: {
          level3: {
            level4: 'deep'
          }
        }
      }
    };
    const context = createContext({ editor: '@pageel/plugin-mdx', settings: deepObject });
    const response = await handlePluginsAPI(context);
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toContain('Payload depth exceeded');
  });

  it('should merge dynamic settings properly in the config object', async () => {
    mockFileContent = JSON.stringify({ plugins: { editor: '@pageel/plugin-mdx', settings: { theme: 'dark' } } });
    mockSha = 'existing-sha';
    const context = createContext({ editor: '@pageel/plugin-mdx', settings: { fontSize: 14 } });
    const response = await handlePluginsAPI(context);
    expect(response.status).toBe(200);
    
    // Config should merge settings
    expect(mockUpdateFileContent).toHaveBeenCalled();
    const newContent = JSON.parse(mockUpdateFileContent.mock.calls[0][2]);
    expect(newContent.plugins.settings).toEqual({ fontSize: 14 });
  });

  it('should reject dev status plugin activation in prod mode with HTTP 400 Bad Request', async () => {

    // Set node env to production for this test
    const prevEnv = process.env.NODE_ENV;
    const prevDebug = process.env.CMS_DEBUG;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.CMS_DEBUG;

      const context = createContext({ editor: '@pageel/plugin-easymde' });
      const response = await handlePluginsAPI(context);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('PLUGINS_DEV_MODE_RESTRICTED');
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevDebug) process.env.CMS_DEBUG = prevDebug;
    }
  });

  it('should allow dev status plugin activation in prod mode when CMS_DEBUG=true', async () => {
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      process.env.CMS_DEBUG = 'true';

      const context = createContext({ editor: '@pageel/plugin-easymde' });
      const response = await handlePluginsAPI(context);

      expect(response.status).toBe(200);
    } finally {
      process.env.NODE_ENV = prevEnv;
      delete process.env.CMS_DEBUG;
    }
  });
});

