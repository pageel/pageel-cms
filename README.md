<div align="center">
  <a href="https://pageel.com">
    <img src="https://raw.githubusercontent.com/pageel/pageel-cms/main/.github/assets/pageel-icon.svg" width="120" alt="Pageel CMS">
  </a>

  <h1>Pageel CMS</h1>

  <p><strong>A lightweight, self-hosted and Git-based CMS native for Astro</strong></p>
  <p>Manage your content where your code lives. No database required.</p>

  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
  [![Version](https://img.shields.io/badge/version-2.0.0--beta-blue.svg)](CHANGELOG.md)
  ![Status](https://img.shields.io/badge/status-beta-yellow.svg)
  [![GitHub](https://img.shields.io/badge/GitHub-supported-181717?logo=github&logoColor=white)](https://github.com)
  [![Astro](https://img.shields.io/badge/Astro-6-BC52EE?logo=astro&logoColor=white)](https://astro.build)
  [![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org)

  <br />

  <a href="README.md">🇺🇸 <b>English</b></a> | <a href="README.vi.md">🇻🇳 Tiếng Việt</a>

</div>

<br />

A lightweight, self-hosted Content Management System that uses your **GitHub** repository as the content backend. No external database — your Markdown/MDX files and images live right in your repo. Built with **Astro 6** and **React 19**, featuring server-side authentication and a Notion-inspired editing experience.

---

## 📸 Screenshots

<p align="center">
  <img src=".github/assets/pageel-dashboard-preview.png" alt="Pageel Dashboard Preview" width="100%" style="border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
</p>

---

## ✨ Key Features

| Feature                   | Description                                                                             |
| :------------------------ | :-------------------------------------------------------------------------------------- |
| 📚 **Multi-Collection**   | Manage multiple content types (Blog, Docs, Projects) in one workspace                   |
| 🏷️ **Typed Templates**    | Define schema with **String**, **Date**, **Boolean**, **Number**, **Array**, **Object** |
| 🔍 **Smart Filtering**    | Auto-generated filter UI based on your template types                                   |
| 🔐 **Server-Side Auth**   | Env Auth with bcrypt — your Git token never leaves the server                           |
| 🔀 **Multi-Tenant**       | One deployment, multiple repos — each user provides their own token at login             |
| 🌐 **i18n Ready**         | English and Vietnamese support                                                          |
| ⚡ **Optimistic Locking** | **SHA-check** prevents overwriting concurrent changes                                   |
| 🚀 **Self-Hosted**        | Deploy on any VPS, Docker, or serverless platform                                       |

---

## 🏗️ Architecture (v2.0)

```
┌─────────────────────────────────────────────┐
│              Browser (React SPA)            │
│  Dashboard, PostList, Images, Templates     │
│         ProxyGitAdapter → /api/proxy/*      │
└─────────────┬───────────────────────────────┘
              │ Cookie session (HMAC-SHA256)
┌─────────────▼───────────────────────────────┐
│           Astro SSR Server (Node.js)        │
│  middleware.ts → session guard              │
│  /api/auth/login → bcrypt verify            │
│  /api/proxy/git → GitHub API (server-side)  │
│  /api/proxy/upload → file upload via API    │
│  /api/proxy/blob → binary file serving      │
└─────────────────────────────────────────────┘
```

### Tech Stack

![Astro](https://img.shields.io/badge/Astro-6-BC52EE?style=flat-square&logo=astro&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)

### Security Model

- **No client-side tokens**: Git PAT stored server-side only (env or encrypted in session cookie)
- **Bcrypt password hashing**: 12-round bcrypt with constant-time comparison
- **HMAC-SHA256 sessions**: Signed cookies with HttpOnly + SameSite=Strict + Secure
- **Token validation at login**: Dynamic tokens are verified against GitHub API before session is created
- **Rate limiting**: 5 attempts per minute per IP
- **Proxy pattern**: All Git API calls go through server — client never touches GitHub API directly

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 22.12.0
- A GitHub repository with markdown content
- A GitHub personal access token (fine-grained recommended)

### 1. Clone & Install

```bash
git clone https://github.com/pageel/pageel-cms.git
cd pageel-cms
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
CMS_USER=admin
CMS_PASS_HASH="$2a$12$..."   # See docs/deployment.md for hash generation
CMS_SECRET=your-random-secret-min-16-chars

# Optional — if omitted, users provide these at login (Multi-Tenant mode)
GITHUB_TOKEN=ghp_your_token
CMS_REPO=username/repo
```

> **💡 Two modes:** Set `GITHUB_TOKEN` + `CMS_REPO` for a dedicated single-repo setup (**Server Mode**). Leave them empty to let each user provide their own token and repo at login (**Connect Mode** / Multi-Tenant).

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:4321](http://localhost:4321) — you'll be redirected to `/login`.

### 4. Generate Password Hash

```bash
node -e "require('bcryptjs').hash('your-password', 12).then(h => console.log(h))"
```

Copy the output to `CMS_PASS_HASH` in your `.env` file.

### 5. Production Build

```bash
npm run build
node dist/server/entry.mjs
```

See [docs/deployment.md](docs/deployment.md) for VPS, Docker, and Vercel deployment guides.

---

## 🌐 Ecosystem

| Product            | Type       | Purpose                                       |
| :----------------- | :--------- | :-------------------------------------------- |
| **Pageel CMS**     | OSS (MIT)  | Git-native CMS for content & media            |
| **Pageel Workhub** | Commercial | Team workspace: workflow, review, permissions |

> Pageel CMS focuses on **content**. For team collaboration features, see Pageel Workhub.

---

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](./docs/guides/CONTRIBUTING.md) for details.

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSES.md](./LICENSES.md) file for details.

---

<p align="center">
  Made with ❄️ by <a href="https://www.pageel.com">Pageel</a>
</p>
