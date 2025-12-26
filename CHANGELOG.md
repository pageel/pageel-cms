# Changelog

All notable changes to Pageel Core will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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

### Changed

- **BREAKING:** Renamed config file `.acmrc.json` → `.pageelrc.json`
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

---

## [1.0.0] - 2025-12-11

### 🎉 Initial Release

First public release of Pageel Core - a Git-based CMS for static & hybrid websites.

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

[1.0.0]: https://github.com/pageel/pageel-core/releases/tag/v1.0.0
