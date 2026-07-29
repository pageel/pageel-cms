import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// @ts-ignore
import { verifyPBKDF2, hashPBKDF2, timingSafeEqual, hasPermission } from '../src/lib/auth';
// @ts-ignore
import { createCsrfToken, verifyCsrfToken } from '../src/lib/session';
// @ts-ignore
import { POST as handleLogin } from '../src/pages/api/auth/login';
// @ts-ignore
import { validateFileMagicBytes, sanitizeSvg } from '../src/lib/security-utils';
// @ts-ignore
import { POST as handleUpload } from '../src/pages/api/proxy/upload';
// @ts-ignore
import { GET as handleCallback } from '../src/pages/api/auth/callback';
// @ts-ignore
import { POST as handleLogoutPOST, GET as handleLogoutGET } from '../src/pages/api/auth/logout';

vi.mock('../src/lib/session', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    verifySession: vi.fn(),
    resolveGitCredentials: vi.fn(),
  };
});

vi.mock('../src/lib/git-client', () => {
  return {
    createGitConfig: vi.fn().mockReturnValue({}),
    getFileSha: vi.fn().mockResolvedValue('existing-sha'),
    uploadFile: vi.fn(),
  };
});

describe('Edge Security Hardening TDD Tests', () => {
  const secretKey = 'super-secret-key-16-chars-min';

  beforeEach(() => {
    vi.stubEnv('CMS_SECRET', secretKey);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Constant-Time String Comparison', () => {
    it('should return true for identical strings', () => {
      expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      expect(timingSafeEqual('abc', 'abcdef')).toBe(false);
    });
  });

  describe('PBKDF2 Web Crypto Cryptography', () => {
    it('should hash a password into the expected format', async () => {
      const password = 'my-secure-password';
      const hash = await hashPBKDF2(password);
      
      // Expected format: pbkdf2:iterations:salt_hex:hash_hex
      expect(hash).toMatch(/^pbkdf2:100000:[a-f0-9]{32}:[a-f0-9]{64}$/);
    });

    it('should verify a correct password successfully', async () => {
      const password = 'my-secure-password';
      const hash = await hashPBKDF2(password);
      
      const isValid = await verifyPBKDF2(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const password = 'my-secure-password';
      const wrongPassword = 'wrong-password';
      const hash = await hashPBKDF2(password);
      
      const isValid = await verifyPBKDF2(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should fail verification for malformed hash formats', async () => {
      const isValid = await verifyPBKDF2('password', 'invalid-hash-format');
      expect(isValid).toBe(false);
    });
  });

  describe('Double Submit HMAC CSRF Token', () => {
    const sessionId = 'session-id-12345';

    it('should generate a valid CSRF token containing sessionId signature', async () => {
      const token = await createCsrfToken(sessionId, secretKey);
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(64);
    });

    it('should validate a correct CSRF token successfully', async () => {
      const token = await createCsrfToken(sessionId, secretKey);
      const isValid = await verifyCsrfToken(token, sessionId, secretKey);
      expect(isValid).toBe(true);
    });

    it('should reject CSRF token if sessionId does not match', async () => {
      const token = await createCsrfToken(sessionId, secretKey);
      const wrongSessionId = 'wrong-session-id';
      const isValid = await verifyCsrfToken(token, wrongSessionId, secretKey);
      expect(isValid).toBe(false);
    });

    it('should reject CSRF token if signed with a different secret', async () => {
      const token = await createCsrfToken(sessionId, secretKey);
      const wrongSecret = 'wrong-secret-key-16-chars';
      const isValid = await verifyCsrfToken(token, sessionId, wrongSecret);
      expect(isValid).toBe(false);
    });

    it('should reject expired CSRF tokens', async () => {
      const expiredToken = await createCsrfToken(sessionId, secretKey);
      vi.useFakeTimers();
      // Advance by 25 hours (max age is 24 hours)
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      
      const isValid = await verifyCsrfToken(expiredToken, sessionId, secretKey);
      expect(isValid).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('Login API Endpoint with PBKDF2 & CSRF Cookie', () => {
    let testHash = '';

    beforeEach(async () => {
      testHash = await hashPBKDF2('correct-password');
      vi.stubEnv('CMS_USER', 'admin');
      vi.stubEnv('CMS_PASS_HASH', testHash);
      vi.stubEnv('CMS_SECRET', secretKey);
      vi.stubEnv('GITHUB_TOKEN', 'gh-token');
      vi.stubEnv('CMS_REPO', 'owner/repo');
    });

    it('should login successfully with correct credentials and set session + CSRF cookies', async () => {
      const formData = new FormData();
      formData.append('username', 'admin');
      formData.append('password', 'correct-password');

      const context = {
        request: new Request('http://localhost/api/auth/login', {
          method: 'POST',
          body: formData,
        }),
        cookies: { set: vi.fn(), delete: vi.fn(), get: vi.fn() },
        locals: {},
        redirect: vi.fn().mockImplementation((url) => new Response(null, { status: 302, headers: { Location: url } })),
        clientAddress: '127.0.0.1',
      } as any;

      const response = await handleLogin(context);
      expect(response.status).toBe(302);
      expect(context.redirect).toHaveBeenCalledWith('/cms');
      
      // Should set session cookie
      expect(context.cookies.set).toHaveBeenCalledWith('pageel_cms_session', expect.any(String), expect.any(Object));
      // Should set CSRF cookie
      expect(context.cookies.set).toHaveBeenCalledWith('pageel_cms_csrf', expect.any(String), expect.objectContaining({
        httpOnly: false, // CSRF token cookie allows client-side JS to read and attach to custom header
        path: '/',
      }));
    });

    it('should reject login if password is incorrect', async () => {
      const formData = new FormData();
      formData.append('username', 'admin');
      formData.append('password', 'wrong-password');

      const context = {
        request: new Request('http://localhost/api/auth/login', {
          method: 'POST',
          body: formData,
        }),
        cookies: { set: vi.fn(), delete: vi.fn(), get: vi.fn() },
        locals: {},
        redirect: vi.fn().mockImplementation((url) => new Response(null, { status: 302, headers: { Location: url } })),
        clientAddress: '127.0.0.1',
      } as any;

      const response = await handleLogin(context);
      expect(response.status).toBe(302);
      expect(context.redirect).toHaveBeenCalledWith(expect.stringContaining('Invalid%20credentials'));
      expect(context.cookies.set).not.toHaveBeenCalled();
    });
  });

  describe('Magic Bytes and SVG Scrubbing', () => {
    describe('validateFileMagicBytes', () => {
      it('should validate valid PNG magic bytes', () => {
        const validPng = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0]);
        expect(validateFileMagicBytes(validPng, 'png')).toBe(true);
      });

      it('should validate valid JPEG magic bytes', () => {
        const validJpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 0]);
        expect(validateFileMagicBytes(validJpeg, 'jpg')).toBe(true);
        expect(validateFileMagicBytes(validJpeg, 'jpeg')).toBe(true);
      });

      it('should validate valid GIF magic bytes', () => {
        const validGif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]);
        expect(validateFileMagicBytes(validGif, 'gif')).toBe(true);
      });

      it('should validate valid WebP magic bytes', () => {
        const validWebp = new Uint8Array([
          0x52, 0x49, 0x46, 0x46, // RIFF
          0, 0, 0, 0,
          0x57, 0x45, 0x42, 0x50  // WEBP
        ]);
        expect(validateFileMagicBytes(validWebp, 'webp')).toBe(true);
      });

      it('should reject spoofed extension files', () => {
        const fakePng = new Uint8Array([0x61, 0x62, 0x63, 0x64, 0x65]); // plain text "abcde"
        expect(validateFileMagicBytes(fakePng, 'png')).toBe(false);
      });
    });

    describe('sanitizeSvg', () => {
      it('should allow clean SVG files', () => {
        const cleanSvg = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" /></svg>';
        const result = sanitizeSvg(cleanSvg);
        expect(result).toContain('svg');
        expect(result).not.toContain('<script');
      });

      it('should remove script elements from SVG', () => {
        const maliciousSvg = '<svg><script>alert(1)</script><circle cx="50" cy="50" r="40" /></svg>';
        const result = sanitizeSvg(maliciousSvg);
        expect(result).not.toContain('<script');
        expect(result).not.toContain('alert');
      });

      it('should remove inline event handlers', () => {
        const maliciousSvg = '<svg><circle cx="50" cy="50" r="40" onload="alert(1)" onerror="console.log(2)" /></svg>';
        const result = sanitizeSvg(maliciousSvg);
        expect(result).not.toContain('onload');
        expect(result).not.toContain('onerror');
      });

      it('should remove javascript: links', () => {
        const maliciousSvg = '<svg><a href="javascript:alert(1)"><rect width="10" height="10"/></a></svg>';
        const result = sanitizeSvg(maliciousSvg);
        expect(result).not.toContain('javascript:');
      });

      it('should remove obfuscated HTML entity javascript: links', () => {
        const maliciousSvg = '<svg><a href="java&#x09;script:alert(1)"><rect width="10" height="10"/></a></svg>';
        const result = sanitizeSvg(maliciousSvg);
        expect(result).not.toContain('java');
        expect(result).not.toContain('script');
      });

      it('should remove foreignObject tags', () => {
        const maliciousSvg = '<svg><foreignObject width="100" height="100"><iframe src="javascript:alert(1)"></iframe></foreignObject></svg>';
        const result = sanitizeSvg(maliciousSvg);
        expect(result).not.toContain('<foreignObject');
        expect(result).not.toContain('<iframe');
      });
    });
  });

  describe('Upload API Proxy Endpoint', () => {
    beforeEach(async () => {
      // Dynamic import to allow proper mock resolution in describe blocks
      const { verifySession, resolveGitCredentials } = await import('../src/lib/session');
      // @ts-ignore
      verifySession.mockResolvedValue({ username: 'admin' });
      // @ts-ignore
      resolveGitCredentials.mockReturnValue({ token: 'gh-token', repo: 'owner/repo' });
      
      const { uploadFile } = await import('../src/lib/git-client');
      // @ts-ignore
      uploadFile.mockResolvedValue({ success: true, content: { name: 'file.png' } });
    });

    it('should allow valid image upload and pass to Git API', async () => {
      const validPng = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const file = new File([validPng], 'image.png', { type: 'image/png' });
      
      const formData = new FormData();
      formData.append('path', 'public/image.png');
      formData.append('file', file);

      const context = {
        request: new Request('http://localhost/api/proxy/upload', {
          method: 'POST',
          body: formData,
        }),
        cookies: { get: vi.fn().mockReturnValue({ value: 'session-token-123' }) },
      } as any;

      const response = await handleUpload(context);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      
      const { uploadFile } = await import('../src/lib/git-client');
      expect(uploadFile).toHaveBeenCalled();
    });

    it('should reject spoofed image extension upload with 400', async () => {
      const fakePng = new Uint8Array([0x61, 0x62, 0x63, 0x64]); // text file
      const file = new File([fakePng], 'image.png', { type: 'image/png' });
      
      const formData = new FormData();
      formData.append('path', 'public/image.png');
      formData.append('file', file);

      const context = {
        request: new Request('http://localhost/api/proxy/upload', {
          method: 'POST',
          body: formData,
        }),
        cookies: { get: vi.fn().mockReturnValue({ value: 'session-token-123' }) },
      } as any;

      const response = await handleUpload(context);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('magic bytes');
    });

    it('should sanitize SVG upload and replace script with safe tags', async () => {
      const maliciousSvg = '<svg><script>alert(1)</script><circle cx="5"/></svg>';
      const file = new File([maliciousSvg], 'vector.svg', { type: 'image/svg+xml' });
      
      const formData = new FormData();
      formData.append('path', 'public/vector.svg');
      formData.append('file', file);

      const context = {
        request: new Request('http://localhost/api/proxy/upload', {
          method: 'POST',
          body: formData,
        }),
        cookies: { get: vi.fn().mockReturnValue({ value: 'session-token-123' }) },
      } as any;

      const response = await handleUpload(context);
      expect(response.status).toBe(200);

      const { uploadFile } = await import('../src/lib/git-client');
      // @ts-ignore
      const lastCallArgs = uploadFile.mock.calls[uploadFile.mock.calls.length - 1];
      const uploadedBase64 = lastCallArgs[2];
      const uploadedText = atob(uploadedBase64);
      
      expect(uploadedText).not.toContain('<script');
    });
  });

  describe('SSO Callback API with CSRF integration', () => {
    it('should set both session and CSRF cookies on successful SSO handshake', async () => {
      const mockResponse = {
        success: true,
        user: { id: '1', email: 'sso-user@example.com', role: 'admin' },
        config: { githubToken: 'gh-token', repoOwner: 'owner', repoName: 'repo' }
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      vi.stubGlobal('fetch', fetchMock);

      const context = {
        request: new Request('http://localhost/api/auth/callback?token=sso-jwt-token'),
        cookies: { set: vi.fn(), delete: vi.fn(), get: vi.fn() },
        locals: {},
        redirect: vi.fn().mockImplementation((url) => new Response(null, { status: 302, headers: { Location: url } })),
      } as any;

      const response = await handleCallback(context);
      expect(response.status).toBe(302);
      expect(context.redirect).toHaveBeenCalledWith('/cms');
      
      // Should set session cookie
      expect(context.cookies.set).toHaveBeenCalledWith('pageel_cms_session', expect.any(String), expect.any(Object));
      // Should set CSRF cookie
      expect(context.cookies.set).toHaveBeenCalledWith('pageel_cms_csrf', expect.any(String), expect.objectContaining({
        httpOnly: false,
        path: '/',
      }));
    });
  });

  describe('Dynamic RBAC Mapping', () => {
    it('should grant all permissions to admin', () => {
      expect(hasPermission('admin', 'read')).toBe(true);
      expect(hasPermission('admin', 'write')).toBe(true);
      expect(hasPermission('admin', 'delete')).toBe(true);
      expect(hasPermission('admin', 'config')).toBe(true);
    });

    it('should grant read and write permissions to editor', () => {
      expect(hasPermission('editor', 'read')).toBe(true);
      expect(hasPermission('editor', 'write')).toBe(true);
      expect(hasPermission('editor', 'delete')).toBe(false);
      expect(hasPermission('editor', 'config')).toBe(false);
    });

    it('should grant read permission only to viewer', () => {
      expect(hasPermission('viewer', 'read')).toBe(true);
      expect(hasPermission('viewer', 'write')).toBe(false);
      expect(hasPermission('viewer', 'delete')).toBe(false);
      expect(hasPermission('viewer', 'config')).toBe(false);
    });

    it('should fallback to admin permissions if role is undefined', () => {
      expect(hasPermission(undefined, 'write')).toBe(true);
      expect(hasPermission(undefined, 'config')).toBe(true);
    });
  });

  describe('SaaS Logout API with POST and CSRF protection', () => {
    it('should allow GET logout request, clear cookies and redirect with 302', async () => {
      const context = {
        request: new Request('http://localhost/api/auth/logout?logout=true', { method: 'GET' }),
        cookies: { delete: vi.fn(), get: vi.fn() },
        locals: {},
      } as any;

      const response = await handleLogoutGET(context);
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/login?logout=true');
    });

    it('should reject POST request if CSRF token is missing or invalid', async () => {
      const context = {
        request: new Request('http://localhost/api/auth/logout', {
          method: 'POST',
        }),
        cookies: {
          delete: vi.fn(),
          get: vi.fn().mockReturnValue({ value: 'session-payload.session-sig' }),
        },
        locals: {},
      } as any;

      const response = await handleLogoutPOST(context);
      expect(response.status).toBe(403);
    });

    it('should allow POST request with valid CSRF token, delete cookies and redirect', async () => {
      const sessionToken = 'payload.session-signature-123';
      const validCsrf = await createCsrfToken('session-signature-123', secretKey);

      const context = {
        request: new Request('http://localhost/api/auth/logout', {
          method: 'POST',
          headers: { 'x-csrf-token': validCsrf },
        }),
        cookies: {
          set: vi.fn(),
          delete: vi.fn(),
          get: vi.fn().mockImplementation((name) => {
            if (name === 'pageel_cms_session') return { value: sessionToken };
            if (name === 'pageel_cms_csrf') return { value: validCsrf };
            return null;
          }),
        },
        locals: {
          runtime: {
            env: {
              PAGEEL_APP_URL: 'https://api.example.com'
            }
          }
        },
        redirect: vi.fn().mockImplementation((url) => new Response(null, { status: 302, headers: { Location: url } })),
      } as any;

      const response = await handleLogoutPOST(context);
      expect(response.status).toBe(302);

      // Verify cookies are cleared via raw Set-Cookie headers (not cookies.set())
      const setCookieHeaders = response.headers.getSetCookie();
      const sessionClears = setCookieHeaders.filter(h => h.startsWith('pageel_cms_session=;'));
      const csrfClears = setCookieHeaders.filter(h => h.startsWith('pageel_cms_csrf=;'));
      expect(sessionClears.length).toBeGreaterThanOrEqual(2);
      expect(csrfClears.length).toBeGreaterThanOrEqual(2);
      expect(sessionClears[0]).toContain('Max-Age=0');
    });

    it('should redirect to /login directly in Server Mode when SSO envs are missing', async () => {
      const sessionToken = 'payload.session-signature-123';
      const validCsrf = await createCsrfToken('session-signature-123', secretKey);

      const context = {
        request: new Request('http://localhost/api/auth/logout', {
          method: 'POST',
          headers: { 'x-csrf-token': validCsrf },
        }),
        cookies: {
          get: vi.fn().mockImplementation((name) => {
            if (name === 'pageel_cms_session') return { value: sessionToken };
            if (name === 'pageel_cms_csrf') return { value: validCsrf };
            return null;
          }),
        },
        locals: {},
        redirect: vi.fn().mockImplementation((url) => new Response(null, { status: 302, headers: { Location: url } })),
      } as any;

      const response = await handleLogoutPOST(context);
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/login');

      const setCookieHeaders = response.headers.getSetCookie();
      const sessionClears = setCookieHeaders.filter(h => h.startsWith('pageel_cms_session=;'));
      expect(sessionClears.length).toBeGreaterThanOrEqual(2);
    });
  });
});
