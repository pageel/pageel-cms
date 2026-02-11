# Changelog

All notable changes to Pageel CMS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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

[1.1.0-beta.1]: https://github.com/pageel/pageel-cms/releases/tag/v1.1.0-beta.1
[1.0.0]: https://github.com/pageel/pageel-cms/releases/tag/v1.0.0
