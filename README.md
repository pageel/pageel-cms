# Pageel CMS

> **Version:** 1.1.0-beta.1 | **Updated:** December 2025

A powerful, client-side Content Management System (CMS) for managing Markdown/MDX content and images directly on **GitHub**, **Gitea**, or **Gogs** repositories. Built with React 19 and TypeScript, featuring a modern Notion-inspired UI.

<p align="center">
  <a href="https://pageel.com">
    <img src="https://raw.githubusercontent.com/pageel/pageel-cms/main/.github/assets/pageel-logo.svg" width="200" alt="Pageel Logo">
  </a>
</p>
<p align="center">
  <strong>A modern Git-first CMS for Astro & Next.js</strong>
</p>

<p align="center">
  <img src=".github/assets/pageel-dashboard-preview.png" alt="Pageel Dashboard Preview" width="100%">
</p>

**Quick Links:** [Changelog](./CHANGELOG.md) • [Licenses](./LICENSES.md) • [Contributing](./docs/guides/CONTRIBUTING.md)

---

## ✨ Key Features

| Feature                       | Description                                                           |
| :---------------------------- | :-------------------------------------------------------------------- |
| 📚 **Multi-Collection**       | Manage multiple content types (Blog, Docs, Projects) in one workspace |
| 🔐 **No Backend Required**    | Runs entirely in your browser, communicates directly with Git APIs    |
| 🔒 **Client-Side Encryption** | PAT encrypted with Web Crypto API (AES-GCM), stored in sessionStorage |
| 🌍 **Multi-Platform Support** | GitHub, Gitea, and Gogs (self-hosted)                                 |
| 🌐 **Multi-Language**         | English and Vietnamese (i18n ready)                                   |
| 🎨 **Notion-Style UI**        | Clean, minimalist, distraction-free interface                         |
| ⚡ **Optimistic Locking**     | SHA-check prevents overwriting concurrent changes                     |
| 🔗 **Deep Linking**           | URL query parameters sync with app state                              |

---

## 🧭 Application Modules

### 1. 📝 Manage Posts (`PostList`)

The central hub for content management.

- **View Modes:** Switch between dense data table or visual card grid with cover image previews
- **Smart Search:** Instant filtering by title, author, tags, or any frontmatter field
- **Quick Actions:**
  - Edit frontmatter properties inline
  - Split-pane Markdown editor with live preview
  - Upload new post file / Replace existing
  - Update cover image
  - Delete posts with confirmation
- **Sorting:** Sort by name, date (asc/desc)
- **SHA Validation:** Ensures file integrity before updates

### 2. 🖼️ Manage Images (`ImageList`)

Dedicated asset library for managing media files.

- **Gallery View:** Visual grid with lazy-loaded thumbnails
- **Upload Features:**
  - Bulk upload with drag & drop
  - Client-side compression (configurable max size/width)
  - Rename files before upload
- **Quick Actions:**
  - View in lightbox with zoom
  - Copy public URL (relative or absolute based on project type)
  - Delete with confirmation
- **Filtering:** Search by filename, sort by name/size

### 3. 📋 Post Template (`TemplateGenerator`)

Define and validate content structure.

- **Schema Generation:**
  - Upload existing post to auto-generate validation schema
  - Scan repository to select from existing posts
- **Field Types:** String, Date, Array, Object, Boolean, Number
- **Table Configuration:**
  - Choose which frontmatter fields appear in Posts table
  - Configure column widths (percentage-based)
  - Max 5 visible columns
- **Sample Download:** Export blank Markdown template with defined frontmatter

### 4. 🔄 Post Workflow (`PostWorkflow`)

Guided 3-step wizard for creating quality content.

**Step 1 - Assets:**

- Bulk upload images with preview
- Auto-compression based on settings
- Rename images before commit

**Step 2 - Content:**

- Upload Markdown file
- Automatic frontmatter validation against template
- Smart image path detection and mapping
- Link uploaded images to frontmatter fields (e.g., `image`, `cover`)
- Update body image references automatically

**Step 3 - Publish:**

- Review all changes
- Commit images first, then post
- Customizable commit message templates
- Success confirmation with quick actions

### 5. 💾 Backup (`BackupManager`)

Data safety and export tools.

- **Archive Downloads:**
  - Generate `.zip` of entire `posts` directory
  - Generate `.zip` of entire `images` directory
  - File size display before download
- **Config Export:**
  - Download `.pageelrc.json` configuration file from repository

### 6. ⚙️ Settings (`SettingsView`)

Global application configuration.

**Project Configuration:**
| Setting | Description |
| :--- | :--- |
| Project Type | "Web Project" (Astro/Next.js with domain) or "File Library" (raw GitHub links) |
| Posts Path | Directory containing Markdown/MDX files |
| Images Path | Directory containing media assets |
| Domain URL | Production URL for asset links (Web Project mode) |

**Content Settings:**
| Setting | Description |
| :--- | :--- |
| Post File Types | Extensions to include (e.g., `md,mdx`) |
| Image File Types | Extensions to include (e.g., `jpg,png,webp,gif,svg`) |
| Publish Date Source | Use file date or system date for new posts |

**Image Optimization:**
| Setting | Description |
| :--- | :--- |
| Compression Enabled | Toggle client-side image compression |
| Max File Size | Maximum KB before compression triggers |
| Max Width | Resize images exceeding this width |

**Commit Templates:**
| Template | Default Value |
| :--- | :--- |
| New Post | `Add: {filename}` |
| Update Post | `Update: {filename}` |
| New Image | `Add image: {filename}` |
| Update Image | `Update image: {filename}` |

**Other Options:**

- Import/Export local settings as JSON
- Sync settings to `.pageelrc.json` in repository
- Delete remote config file
- Language switcher (EN/VI)
- Logout with optional settings reset

---

## 🏗️ Technical Architecture

### Project Structure

```
pageel-cms/
├── core/
│   ├── src/
│   │   ├── App.tsx             # Main application entry point
│   │   ├── index.tsx           # React DOM render
│   │   ├── types.ts            # TypeScript interfaces & types
│   │   │
│   │   ├── features/           # Feature-based architecture (Pro-ready)
│   │   │   ├── auth/           # IAuthProvider interface
│   │   │   ├── settings/       # ISettingsProvider, SETTINGS_SCHEMA
│   │   │   └── navigation/     # useNavigation hook
│   │   │
│   │   ├── components/
│   │   │   ├── Dashboard.tsx       # Main layout with sidebar navigation
│   │   │   ├── GitServiceConnect.tsx   # Login form component
│   │   │   ├── SetupWizard.tsx     # Initial configuration wizard
│   │   │   ├── PostList.tsx        # Posts management module
│   │   │   ├── PostDetailView.tsx  # Single post editor
│   │   │   ├── ImageList.tsx       # Images management module
│   │   │   ├── TemplateGenerator.tsx   # Schema configuration
│   │   │   ├── PostWorkflow.tsx    # New post creation wizard
│   │   │   ├── BackupManager.tsx   # Backup/export tools
│   │   │   ├── SettingsView.tsx    # Application settings
│   │   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   │   └── icons/              # 42 SVG icon components
│   │   │
│   │   ├── services/
│   │   │   ├── baseGitService.ts   # Shared Git service logic
│   │   │   ├── baseGiteaService.ts # Gitea/Gogs shared adapter
│   │   │   ├── githubService.ts    # GitHub API adapter
│   │   │   ├── giteaService.ts     # Gitea API adapter
│   │   │   └── gogsService.ts      # Gogs API adapter
│   │   │
│   │   ├── utils/
│   │   │   ├── crypto.ts           # Web Crypto API utilities (AES-GCM)
│   │   │   ├── image.ts            # Image compression & validation
│   │   │   └── parsing.ts          # Markdown/frontmatter parsing
│   │   │
│   │   └── i18n/
│   │       ├── I18nContext.tsx     # React i18n context provider
│   │       └── translations.ts     # EN/VI translation strings
│   │
│   ├── index.html              # HTML shell with CDN dependencies
│   ├── vite.config.ts          # Vite development configuration
│   ├── tsconfig.json           # TypeScript configuration
│   └── package.json            # Dependencies
│
├── docs/
│   └── guides/
│       ├── CONTRIBUTING.md     # Contribution guidelines
│       └── DEVELOPMENT.md      # Development guide
│
├── README.md
├── CHANGELOG.md
└── LICENSES.md
```

### Core Design Patterns

**1. Adapter Pattern (`IGitService` Interface)**

```typescript
interface IGitService {
  getRepoContents(path: string): Promise<ContentInfo[]>;
  listFiles(path: string): Promise<RepoTreeInfo[]>;
  getFileContent(path: string): Promise<string>;
  uploadFile(path, file, commitMessage, sha?): Promise<any>;
  createFileFromString(path, content, commitMessage): Promise<any>;
  updateFileContent(path, content, commitMessage, sha): Promise<any>;
  deleteFile(path, sha, commitMessage): Promise<any>;
  getFileAsBlob(path: string): Promise<Blob>;
  // ... discovery methods
}
```

- `GithubAdapter` - GitHub REST API v3
- `GiteaAdapter` - Gitea API (self-hosted)
- `GogsAdapter` - Gogs API (self-hosted)

**2. Security Model**

- PAT encrypted with **AES-GCM** (256-bit key)
- Key generated per session via `crypto.getRandomValues()`
- Encrypted token stored in `sessionStorage` (cleared on tab close)
- Key stored separately as exported JWK

**3. State Management**
| Location | Data |
| :--- | :--- |
| `sessionStorage` | Encrypted PAT, crypto key, selected repo, service type |
| `localStorage` | Settings (keyed by repo: `postsPath_{repo}`, `projectType_{repo}`, etc.) |
| URL Query String | Active view/tab (`?view=posts`, `?view=images`) |
| Remote `.pageelrc.json` | Repository-synced configuration file |

**4. Performance Optimizations**

- **Git Tree API (Recursive):** Fetches entire directory tree in single request
- **Lazy Loading:** Images loaded on scroll (IntersectionObserver)
- **Blob Fetching:** Private repo images fetched via authenticated API
- **Optimistic Locking:** SHA validation before all write operations

### Image URL Resolution

Pageel CMS handles image URLs differently based on repository visibility:

| Repository Type | Image Loading Method   | URL Format                                                                           |
| :-------------- | :--------------------- | :----------------------------------------------------------------------------------- |
| **Public**      | Direct Raw GitHub URL  | `https://raw.githubusercontent.com/{owner}/{repo}/refs/heads/{branch}/public/{path}` |
| **Private**     | Authenticated Blob API | Temporary blob URLs via `gitService.getFileAsBlob()`                                 |

**Path Mapping:**

For web projects (Astro, Next.js), static assets are typically stored in the `public/` folder:

- **Frontmatter path:** `/images/photo.png` (web-relative)
- **Physical path on GitHub:** `public/images/photo.png`
- **Generated Raw URL:** `https://raw.githubusercontent.com/.../public/images/photo.png`

The CMS automatically prepends `public/` to relative paths when generating Raw GitHub URLs, unless the path already includes it.

**Private Repository Note:**

Private repos require authentication for raw file access. The CMS uses the GitHub API with your PAT to fetch images as blobs and creates temporary local URLs. No tokens are exposed in the browser.

---

## 🚀 Getting Started

### Prerequisites

- Modern browser with ES2020+ support
- Node.js 20.19+ or 22.12+ (for development)
- Git repository on GitHub, Gitea, or Gogs

### 1. Clone & Install

```bash
git clone https://github.com/pageel/pageel-cms.git
cd pageel-cms/core
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Generate Access Token

**For GitHub:**

1. Go to [GitHub Token Settings](https://github.com/settings/tokens/new?type=beta)
2. Create a Fine-Grained Personal Access Token
3. Select your repository
4. Grant **Contents** permission (Read and write)

**For Gitea/Gogs:**

1. Navigate to Settings → Applications → Generate Token
2. Copy the access token

### 4. Connect Repository

1. Select your Git service (GitHub/Gitea/Gogs)
2. Enter repository URL (e.g., `username/repo` or full URL)
3. Paste your access token
4. For self-hosted: Enter instance URL (e.g., `https://git.example.com`)

### 5. Initial Setup Wizard

1. Follow the file tree explorer to select your content directory
2. Select your images directory
3. Choose project type (Web Project or File Library)
4. Configuration is saved locally and optionally synced to repository

---

## 🔧 Development

### Available Scripts

| Command           | Description                               |
| :---------------- | :---------------------------------------- |
| `npm run dev`     | Start Vite development server (port 3000) |
| `npm run build`   | Build production bundle                   |
| `npm run preview` | Preview production build locally          |

### Technology Stack

| Category       | Technology                                |
| :------------- | :---------------------------------------- |
| **Framework**  | React 19                                  |
| **Language**   | TypeScript 5.9+                           |
| **Build Tool** | Vite 5+                                   |
| **Styling**    | Tailwind CSS (CDN with Typography plugin) |
| **Icons**      | Custom SVG components (42 icons)          |
| **Fonts**      | Inter (Google Fonts)                      |

### CDN Dependencies

| Library     | Purpose                  |
| :---------- | :----------------------- |
| `marked`    | Markdown to HTML parsing |
| `DOMPurify` | HTML sanitization        |
| `JSZip`     | ZIP archive generation   |
| `js-yaml`   | YAML frontmatter parsing |

---

## 📅 Roadmap

### ✅ Phase 1-2: Multi-Collection Architecture (Completed)

- Feature-based folder structure (`src/features/`)
- Zustand state management
- Collection TypeScript interfaces
- Multi-collection support with independent paths
- Per-collection templates and settings
- Sync to `.pageelrc.json`

### 🔄 Phase 3: v1.1.0 (Current)

- Migrate localStorage → IndexedDB
- Shared UI component library
- Template editor per collection

### 🚀 Future: v2.0

- WYSIWYG Markdown Editor
- GitLab Support
- Scheduled Publishing
- Image Gallery in Editor

---

## 🌐 Ecosystem

| Product            | Type       | Purpose                                       |
| ------------------ | ---------- | --------------------------------------------- |
| **Pageel CMS**     | OSS (MIT)  | Git-native CMS for content & media            |
| **Pageel Workhub** | Commercial | Team workspace: workflow, review, permissions |

> Pageel CMS focuses on **content**. For team collaboration features, see Pageel Workhub.

---

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](./docs/guides/CONTRIBUTING.md) for details.

### Quick Start

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Reporting Issues

- Use [GitHub Issues](https://github.com/pageel/pageel-cms/issues)
- Include browser version and console errors
- Describe steps to reproduce

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSES.md](./LICENSES.md) file for more details on third-party software.

---

<p align="center">
  Made with ❄️ by <a href="https://www.pageel.com">Pageel</a>
</p>
