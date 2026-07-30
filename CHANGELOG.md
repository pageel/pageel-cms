# Changelog

All notable changes to Pageel CMS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.5.8] - 2026-07-30

### Fixed

- **PostList Sort Option Key Deduplication**: Filtered out `'date'` from `extraFields` array in `PostList.tsx:328` to prevent duplicate `date-asc` and `date-desc` React option keys (`#csa-postlist-sort-dedupe`).
- **Native Core Fallback Standardization**: Replaced raw HTML `<textarea>` fallback in `PostDetailView.tsx` prop `fallback` with Notion-style `NativePlainEditor` (`#csa-native-fallback-settings-bypass`).
- **Clean 2-Tab Architecture**: Consolidated tab system in `PostDetailView.tsx` to 2 Tabs ("Markdown Editor" using `NativePlainEditor` + "Preview") when no WYSIWYG plugin is active, eliminating the redundant "Source" tab (`#csa-tab-architecture-consolidation`).

## [2.5.7] - 2026-07-30

### Fixed

- **Zero-Plugin Native Core Fallback**: Replaced dynamic import fallback in `registry.ts` with static `NativePlainEditor` (`<textarea>`) component (`#csa-zero-plugin-native-fallback`).
- **Safe Props Protection**: Hardened `MdxEditorSlot` with default parameter `props = {} as EditorProps`, fallback `initialValue || ''`, and safe dummy callbacks (`#csa-safe-props-protection`).
- **Defensive Slot Renderer**: Added `safeProps = props || {}` fallback in `SlotRenderer.tsx` (`#csa-plugins-view-exclusive-toggle-boundary`).

## [2.5.6] - 2026-07-30

### Added

- **Plugin Status Metadata**: Added `status?: PluginStatus` ('stable' | 'beta' | 'experimental' | 'dev') to `PluginMetadata` in `registry.ts` (`#csa-plugin-status-metadata`).
- **Runtime Loader Fallback Engine**: Updated `resolveSlotComponent` in `registry.ts` to fall back to `@pageel/plugin-mdx` singleton component when target loader component returns empty or crashes (`#csa-loader-fallback-guard`).
- **UI Action Guard & Dev Badge**: Rendered 🚧 `Dev Mode` badge and disabled Activate button in `PluginsView.tsx` for dev plugins on Production unless `CMS_DEBUG=true` (`#csa-plugins-ui-dev-guard`).
- **API Server Dev Guard**: Rejection of dev status plugin activation attempts in `/api/settings/plugins.ts` with `HTTP 400 Bad Request` when `isDevMode` is false (`#csa-plugins-api-dev-guard`).

## [2.5.5] - 2026-07-29


### Added

- **Explicit Logout Return URL**: Updated `logout.ts` to append `?logout=true` to the worker `return_url` when `hasSso === true`, ensuring `login.astro` receives explicit notification when a logout occurs (`csa-cms-cfr-explicit-logout-url`).
- **Re-Auth Dual Button UI**: Updated `login.astro` to render primary SSO button as **"Tái xác thực & Đăng nhập lại ↗"** with `?force_reauth=true&prompt=consent` when `isTokenExpired || isLogout` is true (`csa-cms-cfr-reauth-button-ui`).
- **Full Logout Escape Hatch Link**: Added secondary escape hatch link **"Đăng xuất hoàn toàn & Đổi tài khoản khác"** to `login.astro` directing to `/api/auth/logout?logout=true`, enabling full session purge without entering the OAuth re-auth loop (`csa-cms-cfr-full-logout-escape-hatch`).
- **Client Storage Cache Purge**: Updated `login.astro` client script and `useSessionRestore.ts` to execute `localStorage.clear()` & `sessionStorage.clear()` on error/logout mount (`csa-cms-cfr-client-cache-purge`).

## [2.5.4] - 2026-07-29

### Added

- **SSO Force Re-Authentication Protocol**: Updated `login.astro` to append `?force_reauth=true&prompt=consent` to `ssoRedirectUrl` when `rawError === 'GITHUB_TOKEN_EXPIRED'`, forcing Pageel App Worker to invalidate KV session cache and prompt GitHub OAuth re-consent (`csa-cms-cfr-sso-force-reauth`).
- **Connect Mode Token Autofill Defense**: Added `autocomplete="off"`, cleared default value (`value=""`), and rendered help text link to GitHub Settings in Connect Mode when token is expired (`csa-cms-cfr-form-clear-autofill`).
- **Server Mode Env Warning**: Added dedicated server environment error hint banner when `envGitConfigured === true` and token is expired (`csa-cms-cfr-server-env-hint`).

## [2.5.3] - 2026-07-29

### Added

- **Cloudflare Under Attack Challenge Resilience**: Classified `CloudflareChallengeError` (Content-Type `text/html` guard) in `proxyGitService.ts` with automatic 3-attempt Exponential Backoff (1s ➔ 3s ➔ 9s) and interactive "Thử lại" / "Xác thực Cloudflare ↗" UI in `App.tsx`.
- **Smooth Session Logout UX Overlay**: Replaced jarring yellow session error card during logout with an `isLoggingOut` full-screen spinner overlay ("Đang đăng xuất...") and 1.5s Timeout Watchdog fallback.
- **SSO Token Expiration 302 Loop Breaker**: Classified Octokit 401 (`GITHUB_TOKEN_EXPIRED`) and 403/404 (`REPO_ACCESS_DENIED`) status codes in `/api/proxy/git`. Updated `login.astro` SSR frontmatter to delete session & CSRF cookies immediately on `?logout=true` or `?error=...`, completely breaking the 302 redirect loop and rendering sanitized error banners with automatic `history.replaceState` URL cleanup.
- **Sanitized Error Banner & URL Clean**: Added `ALLOWED_ERRORS` Whitelist filtering `rawError` query parameters against XSS/Phishing injection, rendering localized Vietnamese error messages.

### Refactored & Fixed

- **CI TypeScript Type Check Alignment**: Fixed `process.env` typo in `login.astro` and aligned local Pre-commit gate to run `npx astro sync && npx tsc --noEmit` before git commits.
- **Governance & Template Generalization**: Updated project `maintenance.md` §1, `.agents/skills/cicd/SKILL.md`, and plan templates (`detail-plan-hardened.md`, `detail-plan.md`, `detail-plan-tdd.md`) to enforce Astro typecheck pre-commit gates and support OSS PR Auto-Merge Protocol (`maintenance.md` §3).

## [2.5.0] - 2026-07-13

### Added

- **Plugins Management System**: Introduced a card-based Plugins View dashboard to manage editor extensions.
- **Exclusive Activation**: Implemented single-active editor plugin rule where activating one editor plugin automatically deactivates another.
- **Dynamic Configuration Form**: Created dynamic settings forms generated from plugin JSON Schemas, wrapped in an emergency Error Boundary fallback with manual rollback and force deactivate hooks.
- **Backend API Sanitization**: Added JSON depth (max 3), payload size limit (50KB), and Prototype Pollution defense filtering (`__proto__`, `constructor`, `prototype` keys) to `/api/settings/plugins`.
- **Core Bypass Control**: Added automatic `SlotRenderer` fallback rendering a raw textarea if `enablePlugins` settings are disabled globally.
- **NVM/Node 24 compatibility**: Ensured static type check compilation compatibility.

## [2.4.0] - 2026-07-10

### Added

- **Direct Post Creation**: Implemented direct blank post creation from the CMS dashboard UI. Users can compose, customize, and save new markdown posts directly to the Git repository.
- **Path and File Safety**: Implemented Vietnamese slug conversion mapping "đ/Đ" to "d", custom character sanitization (a-z0-9- only), directory path validation, and 409 file collision detection before writing.
- **Diagnostic Logging**: Added structured JSON diagnostic loggers to trace post creation operations.

### Refactored

- **React Memoization**: Applied strict React callbacks (`useCallback`/`useMemo`) for git service calls and editor updates to prevent render loops.

## [2.3.2] - 2026-07-09

### Fixed

- **Server Mode Logout Redirect Crash**: Fixed a 500 server crash during logout when running in Server Mode (local mode with SSO disabled). Now checks if SSO environment variables are active; if not, performs a local session and CSRF cookie clearance and redirects directly to `/login`.

## [2.3.1] - 2026-07-08

### Fixed

- **Vercel/Edge Logout & CSRF Issues**: Resolved a series of critical logout issues on serverless/edge environments.
  - Implemented custom `302` Response builder for logout to prevent middleware cookie stripping.
  - Expired session and CSRF cookies under both `Strict` and `Lax` SameSite configurations on logout.
  - Fixed CSRF validation errors (403 Forbidden) by normalizing spaces to plus, URL decoding tokens, and handling base64 padding.
  - Resolved logout loop caused by dual SameSite cookie mismatch and Astro raw Response bypass.
  - Switched client-side logout to submit a POST form with CSRF token to prevent 405 Method Not Allowed.
  - Handled missing CSRF cookies gracefully by navigating to `/login?logout=true` to clear the session cookie server-side.
  - Renamed CSRF cookie to `pageel_cms_csrf` to prevent namespace collisions.

## [2.3.0] - 2026-07-08

### Added

- **Secure Magic Bytes Filter**: Integrated binary magic bytes validation for PNG, JPEG, GIF, and WebP formats to prevent extension spoofing.
- **SVG Regex Scrubbing**: Implemented regex-based SVG sanitizer filtering dangerous tags (`<script>`, `<foreignObject>`), inline events (`onload`, `onerror`, etc.), and `javascript:` URIs (supporting HTML entity bypass mitigation).
- **Dynamic Session CSRF Token Generation**: Added automatic generation and storage of a `pageel_csrf_token` cookie upon successful SSO handshake to prevent CSRF attacks.
- **POST-ONLY Logout with CSRF**: Upgraded the logout endpoint to POST-only, validating the CSRF token (Double Submit Cookie pattern) before destroying session cookies.
- **Dynamic RBAC (Role-Based Access Control)**: Implemented dynamic user roles (`admin`, `editor`, `viewer`) mapping permissions for read, write, delete, and configuration actions.

### Refactored

- **PBKDF2 Password CLI**: Ported the password hashing CLI generator from bcrypt to node-native Web Crypto API PBKDF2.
- **Remove Bcryptjs**: Completely uninstalled `bcryptjs` and `@types/bcryptjs` from all project dependencies to improve security and performance.

## [2.2.2] - 2026-07-06

### Fixed

- **WYSIWYG Editor Settings Lost**: Fixed an issue where saving settings or collections overwrote `.pageelrc.json` on Git and accidentally removed the `plugins` configuration, disabling the WYSIWYG editor on subsequent sessions.

## [2.2.1] - 2026-07-02

### Fixed

- **Auth Bridge Redirect & Architecture Mismatch**: Resolved critical SSO routing failures across Cloudflare Pages (SPA) and Cloudflare Workers (API).
  - Fixed endpoint parameters and route paths for `getSsoRedirectUrl` redirect.
  - Routed CMS server-side calls using absolute API Worker URLs to prevent 404 errors.
  - Aligned verify-bridge response schema, corrected callback redirect destination, and fixed session cookie loop/naming conflicts.

## [2.2.0] - 2026-07-01

### Added

- **SSO Integration with Pageel App**: Implemented client-to-app handshake and SSO callback mechanism.
  - Added secure GET `/api/auth/callback` callback route verifying SaaS JWT with 5s timeout.
  - Implemented Cloudflare Service Binding routing with standard HTTP fetch fallback.
  - Implemented secure POST `/api/auth/logout` clearing local session cookie and safely calling remote logout API.
- **SSO Login UI Toggle**: Configured `login.astro` to detect `PAGEEL_APP_URL` env variable, toggle off local credential fields, and render a dedicated "Sign In with Pageel App" button redirecting users to the SaaS application.
- **Double-Binding Spec Coverage**: Bound all SSO module elements to the new specifications, achieving 100% project-wide CSA spec coverage.
- **Integration Test Suite**: Added 7 integration tests in `test/auth-bridge.test.ts` verifying UI redirects, JWT callbacks, cookie options (SameSite=Lax), and remote logout scenarios.

---

## [2.1.1] - 2026-06-18

### Added

- **Context-Aware Path Validation**: Implemented security context filtering (blob, cms-read, cms-write) to allow CMS reads and writes in specific content directories (`src/content/`, `src/data/`, `src/assets/`) while blocking execution-capable code extensions (`.ts`, `.tsx`, `.js`, `.jsx`, etc.).
- **URL Encoding Normalization**: Integrated mandatory path decoding before path checking to mitigate potential URL-encoded bypasses.
- **Access Violation Logging**: Integrated server-side warning logs when path access is blocked.
- **Unit Testing Suite**: Created root-level `test/proxy-utils.test.ts` covering 17 distinct validation and traversal scenarios, achieving 100% path validation logic branch coverage.

### Fixed

- **BUG-403**: Fixed Git proxy blocking CMS content directory reads (403 Forbidden).
- **TypeScript Type Warnings**: Resolved static type check issues in `I18nContext` and `ImageList`.

---

## [2.1.0] - 2026-04-22

### Added

- **Image Proxy Endpoint**: Created secure `/api/proxy/image/[...path]` endpoint specifically for editor image preview.
- **Smart Tabs System**: Bidirectional sync between WYSIWYG (Edit) and Markdown (Source) tabs, eliminating duplicate views.
- **Settings UI**: Added interface to configure editor plugins directly via UI, updating `.pageelrc.json` with optimistic UI updates.
- **Image Gallery Integration**: Integrated existing Image Picker into MDXEditor toolbar, using uncontrolled callback pattern (`onRequestImage`).

### Changed

- **Uncontrolled Editor Pattern**: Changed EditorProps `value` to `initialValue` to prevent re-render loops and improve typing performance (BUG-21 fix).
- **Core Version vs Plugin Version**: Decoupled core and plugin versioning (Core v2.1.0, Plugins v0.2.0).

---

## [2.1.0-beta.1] - 2026-03-30

### Added

- **Plugin System (Slot-based)**: Extensible editor architecture with `SlotRenderer`, `PluginRegistry`, and `ErrorBoundary` isolation. Plugins register via static import map and load lazily.
- **@pageel/plugin-types** (`0.1.0`): TypeScript interfaces — `PageelPlugin`, `EditorProps`, `EditorGitService`. Zero runtime dependencies.
- **@pageel/plugin-mdx** (`0.1.0`): WYSIWYG editor plugin wrapping MDXEditor with toolbar (headings, bold, italic, lists, links, images, code blocks), 300ms onChange debounce, and CSS isolation.
- **@pageel/cms** (`0.1.0`): Astro integration bridge — auto-detect content collections, generate/sync `.pageelrc.json`, inject `/cms` redirect route.
- **3-Tab Editing**: PostDetailView refactored to Edit (WYSIWYG/fallback) | Markdown (raw) | Preview (rendered HTML).
- **EditorGitService**: Restricted adapter exposing only `uploadImage()` and `getImageBlob()` to plugins — IGitService's 13 methods remain CMS-internal.
- **npm Workspace**: Monorepo setup with `packages/plugin-types`, `packages/plugin-mdx`, `packages/cms-bridge` under npm workspaces.
- **CI/CD Publish Pipeline**: GitHub Actions workflow with dependency-ordered builds, npm provenance signatures, dry-run support, and security audit.

### Security

- **Upload path validation (P1)**: Server-side blocklist prevents path traversal, `.env`, `.github/`, `src/`, and code file uploads.
- **File type/size validation (P2)**: Upload proxy restricts to image + markdown MIME types, 10MB max.
- **Plugin name validation (S3)**: Regex whitelist accepts only `@pageel/plugin-*` pattern — blocks injection via `.pageelrc.json`.

### Changed

- **`.pageelrc.json` schema**: Added optional `plugins` field (`{ editor?: string, toolbar?: string, preview?: string }`). Backward compatible — old configs work without modification.
- **Version**: 2.0.1 → 2.1.0 (MINOR — new plugin feature, no breaking changes)

---

## [2.0.1] - 2026-03-27

### Fixed

- **BUG-20: First login SetupWizard folder picker broken**: When logging in for the first time (no `.pageelrc.json` exists), the SetupWizard's `RepoFileTree` component failed to load directory structure. Fixed by auto-creating a default `.pageelrc.json` configuration when the repository scan successfully detects content and image directories, bypassing the SetupWizard entirely. Users can adjust settings later via the Settings page.

---

## [2.0.0] - 2026-03-26

### Added

- **Dynamic Session Credentials (Multi-Tenant)**: When `GITHUB_TOKEN` and `CMS_REPO` are not set in environment variables, the login page displays additional fields for users to provide their own GitHub token and repository. Credentials are verified against the GitHub API before being stored securely in the HMAC-signed HttpOnly session cookie. This enables a single CMS deployment to serve multiple repositories/users.
- **CLI Hash Utility**: Run `npx pageel-cms hash <password>` to generate bcrypt hashes for `CMS_PASS_HASH`. Replaces manual Node.js one-liners with a user-friendly CLI command.

### Fixed

- **BUG-19: Connect Mode proxy/git 500**: Added middleware Layer 3 credentials completeness check — prevents stale sessions after mode transitions (Server→Connect→Open). Detects missing Git credentials early and redirects to login with a clear error message instead of returning 500.
- **Bcrypt hash truncation**: Added `isValidBcryptHash()` validation (60 chars + `$2[aby]$` prefix). Rejects corrupted hashes from Vite's dotenv-expand `$`-expansion, falling back to raw `.env` file read.
- **CMS Page Blank Issue**: Switched to Astro's declarative `client:only="react"` mounting directive instead of manual script injection for the React container to ensure proper hydration and fix blank screens in production.

### Changed

- **Project structure**: Flattened `astro/` subdirectory to repo root (zero-config deploy)
- **Adapter**: Default adapter switched from `@astrojs/node` to `@astrojs/vercel`
- **`@astrojs/node`** moved to devDependencies (for local dev only)
- **LICENSES.md**: Added Astro, bcryptjs, and Zustand attributions

### Removed

- **`vercel.json`**: No longer needed (Vercel auto-detects Astro at root)

---

## [2.0.0-beta.0] - 2026-03-25

### ⚠️ BREAKING CHANGES

- **Architecture migration**: Vite SPA → Astro 6 SSR application
- **Auth model**: Client-side token paste → Server-side Env Auth (bcrypt)
- **Directory structure**: App at repo root (flat structure)
- **Removed**: Gitea/Gogs support (GitHub only for now)
- **Removed**: Client-side crypto (AES-GCM token encryption)
- **Removed**: `GitServiceConnect` token paste component

### Added

- **Astro 6 SSR** with Node.js standalone adapter
- **Server-side authentication**: Username/password via environment variables with bcrypt hashing
- **HMAC-SHA256 session cookies**: HttpOnly, SameSite=Strict, Secure
- **API proxy layer**: `/api/proxy/git`, `/api/proxy/upload`, `/api/proxy/blob` — client never touches GitHub API directly
- **Rate limiting**: 5 login attempts per minute per IP
- **Constant-time comparison**: Prevents timing attacks on username validation
- **Smart env resolution**: 3-tier bcrypt hash loading (import.meta.env → process.env → raw .env file)
- **Deployment guide**: `docs/deployment.md` covering VPS, Docker, and Vercel
- **npm bundled libraries**: `marked`, `dompurify`, `jszip`, `js-yaml` (replaced CDN globals)

### Changed

- **Route**: `/admin` → `/cms` (security-by-obscurity)
- **Version**: All UI references updated to v2.0
- **useSessionRestore**: Rewritten for Env Auth — no token paste, no crypto, no localStorage
- **App.tsx**: Simplified — always-authenticated view when user reaches `/cms`

### Removed

- `core/` directory (legacy Vite SPA) — moved to `reference/` outside repo
- `GitServiceConnect.tsx` (token paste form)
- `githubService.ts`, `giteaService.ts`, `gogsService.ts` (client-side Git adapters)
- `baseGitService.ts`, `baseGiteaService.ts` (base classes)
- `crypto.ts` (AES-GCM token encryption)

### Security

- Git token stored server-side only (environment variable)
- No client-side token storage (removed localStorage/sessionStorage)
- Middleware guards `/cms` and `/api/proxy/*` routes
- Session cookie with proper security flags

---

## [1.2.1] - 2026-03-24

### Added

- **Visual Gallery Editor** (WF-09): Frontmatter fields containing arrays of image objects (e.g., `gallery: [{src, label}]`) now open a visual grid editor instead of raw JSON.
  - Drag-to-reorder with visual feedback
  - Inline label and path editing per item
  - Add images via existing image picker
  - Delete items with hover-reveal × button
- **Frontmatter Field Modal**: Click any frontmatter field in the right sidebar to open a full-width editing modal — supports text, arrays, and JSON for complex objects.
- **GalleryThumbnail Component**: Loads real images from repos (public via CDN, private via blob API) with spinner and fallback.

### Fixed

- **BUG-16**: DirectoryPicker modal hidden behind NewCollectionModal/EditCollectionModal (z-index conflict z-50 → z-[60]).
- **BUG-17**: Gallery fields displaying `[object Object]` — array-of-objects now correctly detected and rendered.
- **PostImageSelectionModal z-index**: Raised to z-[70] to ensure it always overlays gallery editor modal (z-[60]).

### Changed

- **Version bump**: 1.1.0 → 1.2.1 across package.json, App.tsx, Sidebar.tsx, README.md, README.vi.md.
- **README logo**: Replaced full logo (with text) with icon-only version for cleaner presentation.

---

## [1.1.0] - 2026-03-17

### Added

- **Initial Scan Refactor** (MA-08): Granular progress bar UI (0-100%) and phased scanning logic in Setup Wizard.
- **Strict Sync Locking** (WF-06): Prevents concurrent Git operations with global locking and UI status banner.
- **Setup Wizard Enhancement**: Added initial collection naming field and fixed persistence race conditions.
- **Logout UX Simplification** (MA-07): Streamlined logout flow by removing unnecessary confirmation checkboxes.
- **Advanced Filtering System** (WF-08):
  - **Typed Templates**: Editable field types (String, Date, Boolean, Number, Array, Object) in Template Generator.
  - **Smart Filter Bar**: Dynamic filter UI based on template types (Dropdown, Date Range, Tag Chips, toggle).
  - **Dynamic Sorting**: Sort by any template field with clickable column headers.
- **Documentation Overhaul**: Professional README.md with badges/screenshots and new Vietnamese translation (README.vi.md).

### Changed

- **Tailwind CSS v4 Migration**: Migrated from CDN-based Tailwind to build-time PostCSS setup for production readiness and better performance.
- **Layout Consistency** (UI-01): Data views (PostList, Images, Template) now use full-width layout while form views (Settings, Backup) use centered layout for better readability.

### Fixed

- **Config Import** (BUG-14): Fixed configuration import not saving to repository and added sync progress feedback.
- **Config Export** (BUG-15): Fixed incomplete exports by standardizing on V2 schema and including all workspace data.
- **Comprehensive Reset** (BUG-13): Reset now clears all repo-scoped localStorage, Zustand states, and forces setup re-trigger.
- **Default Domain Fallback** (BUG-10): Added UI guidance for empty production domain behavior.
- **Tailwind CDN Fix** (BUG-16): Resolved production warnings and fixed 404 for missing CSS files.
- Fixed version detection in config import to correctly identify and process V2 configurations.
- **Documentation Fix**: Corrected installation instructions in README.md/README.vi.md to point to `core/` directory.

### Removed

- Deprecated `scripts/` directory in favor of workspace-level workflows.

---

## [1.1.0-beta.1] - 2025-12-31

### Added

- **Multi-Collection Support** (MC-01 to MC-05)
  - Create multiple collections within a single workspace
  - Independent paths per collection (posts, images)
  - Custom template per collection
  - Quick collection switching via CollectionPicker
  - Edit/Delete collections with modal UI
- New components: `CollectionPicker`, `NewCollectionModal`, `EditCollectionModal`
- `sync.ts` for persisting collections to `.pageelrc.json`
- Collection-aware `PostWorkflow` for template validation
- **Documentation:** Image URL Resolution section in README
- **New utility:** `github.ts` for centralized Raw GitHub URL generation

### Changed

- **BREAKING:** Renamed config file `.acmrc.json` → `.pageelrc.json`
- **Branding:** Renamed "Pageel Core" → "Pageel CMS" across all docs
- Refactored to feature-based folder structure (`src/features/`)
- Dashboard now uses shared `SETTINGS_SCHEMA` and `DEFAULT_SETTINGS`
- Auth storage: `sessionStorage` → `localStorage` (cross-tab persistence)
- `PostList` now uses per-collection table columns
- `TemplateGenerator` now saves/loads from collection store

### Fixed

- White screen after login (missing `useCollectionStore` import)
- New browser tab requiring re-login
- Template columns not syncing with PostList table
- Stale state in Dashboard save handlers
- Template settings not persisting to `.pageelrc.json` (BUG-05)
- Config sync using localStorage fallbacks instead of collection store (BUG-06)
- Production Domain not prioritized from `.pageelrc.json` (BUG-07)
- Removed redundant Posts/Images Directory from Settings (BUG-08)
- Login form now accepts both full URL and `owner/repo` format (BUG-09)
- Settings isolation: All localStorage keys are now scoped by repoId (MA-06)
- **Image URL missing `public/` prefix for Astro projects** (BUG-11)
- **Save settings overwriting `.pageelrc.json` with wrong format** (BUG-12)

---

## [1.0.0] - 2025-12-11

### 🎉 Initial Release

First public release of Pageel CMS - a Git-based CMS for static & hybrid websites.

#### Features

- **Posts Management**
  - Table and grid view modes
  - Inline frontmatter editing
  - Split-pane Markdown editor with live preview
  - SHA validation for file integrity

- **Media Management**
  - Gallery view with lazy-loaded thumbnails
  - Bulk upload with drag & drop
  - Client-side image compression
  - Lightbox preview with zoom

- **Template Generator**
  - Auto-generate validation schema from existing posts
  - Define frontmatter field types
  - Configure table columns
  - Export blank templates

- **Post Workflow**
  - 3-step wizard (Assets → Content → Publish)
  - Smart image path detection
  - Automatic frontmatter validation

- **Backup & Export**
  - ZIP archive of posts/images directories
  - Export `.pageelrc.json` configuration

- **Settings**
  - Project type configuration
  - Image optimization settings
  - Commit message templates
  - Multi-language support (EN/VI)

#### Platform Support

- GitHub
- Gitea (self-hosted)
- Gogs (self-hosted)

#### Technical

- React 19 + TypeScript 5.9
- Vite 5+ build system
- Client-side PAT encryption (AES-GCM)
- Notion-inspired UI

---

[2.2.0]: https://github.com/pageel/pageel-cms/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/pageel/pageel-cms/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/pageel/pageel-cms/compare/v2.1.0-beta.1...v2.1.0
[2.1.0-beta.1]: https://github.com/pageel/pageel-cms/compare/v2.0.1...v2.1.0-beta.1
[2.0.1]: https://github.com/pageel/pageel-cms/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/pageel/pageel-cms/compare/v2.0.0-beta.0...v2.0.0
[2.0.0-beta.0]: https://github.com/pageel/pageel-cms/compare/v1.2.1...v2.0.0-beta.0
[1.2.1]: https://github.com/pageel/pageel-cms/compare/v1.1.0...v1.2.1
[1.1.0]: https://github.com/pageel/pageel-cms/compare/v1.1.0-beta.1...v1.1.0
[1.1.0-beta.1]: https://github.com/pageel/pageel-cms/releases/tag/v1.1.0-beta.1
[1.0.0]: https://github.com/pageel/pageel-cms/releases/tag/v1.0.0
