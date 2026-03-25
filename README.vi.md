<div align="center">
  <a href="https://pageel.com">
    <img src="https://raw.githubusercontent.com/pageel/pageel-cms/main/.github/assets/pageel-icon.svg" width="120" alt="Pageel CMS">
  </a>

  <h1>Pageel CMS</h1>

  <p><strong>CMS nhẹ, tự host, nền tảng Git — native cho Astro</strong></p>
  <p>Quản lý nội dung ngay nơi code của bạn. Không cần database.</p>

  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
  [![Version](https://img.shields.io/badge/version-2.0.0--beta-blue.svg)](CHANGELOG.md)
  ![Status](https://img.shields.io/badge/status-beta-yellow.svg)
  [![GitHub](https://img.shields.io/badge/GitHub-supported-181717?logo=github&logoColor=white)](https://github.com)
  [![Astro](https://img.shields.io/badge/Astro-6-BC52EE?logo=astro&logoColor=white)](https://astro.build)
  [![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org)

  <br />

  <a href="README.md">🇺🇸 English</a> | <a href="README.vi.md">🇻🇳 <b>Tiếng Việt</b></a>

</div>

<br />

Hệ quản trị nội dung (CMS) nhẹ, tự host, sử dụng repository **GitHub** làm nơi lưu trữ nội dung. Không cần database — các file Markdown/MDX và hình ảnh nằm ngay trong repo của bạn. Xây dựng với **Astro 6** và **React 19**, xác thực server-side và giao diện phong cách Notion.

---

## 📸 Screenshots

<p align="center">
  <img src=".github/assets/pageel-dashboard-preview.png" alt="Giao diện Dashboard Pageel" width="100%" style="border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
</p>

---

## ✨ Tính năng nổi bật

| Tính năng                 | Mô tả                                                                                               |
| :------------------------ | :-------------------------------------------------------------------------------------------------- |
| 📚 **Multi-Collection**   | Quản lý nhiều loại nội dung (Blog, Docs, Projects) trong một workspace                              |
| 🏷️ **Typed Templates**    | Định nghĩa schema với các kiểu **String**, **Date**, **Boolean**, **Number**, **Array**, **Object** |
| 🔍 **Smart Filtering**    | Tự động tạo bộ lọc thông minh dựa trên template                                                     |
| 🔐 **Server-Side Auth**   | Env Auth với bcrypt — Git token không bao giờ rời khỏi server                                       |
| 🌐 **Đa ngôn ngữ**        | Hỗ trợ Tiếng Anh và Tiếng Việt (i18n ready)                                                         |
| ⚡ **Optimistic Locking** | **SHA-check** ngăn chặn ghi đè dữ liệu khi nhiều người cùng sửa                                    |
| 🚀 **Self-Hosted**        | Deploy trên VPS, Docker, hoặc serverless platform                                                    |

---

## 🏗️ Kiến trúc (v2.0)

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

### Mô hình bảo mật

- **Không có token phía client**: Git PAT chỉ lưu trên server
- **Bcrypt password hashing**: 12-round bcrypt với constant-time comparison
- **HMAC-SHA256 sessions**: Signed cookies với HttpOnly + SameSite=Strict
- **Rate limiting**: 5 lần/phút cho mỗi IP
- **Proxy pattern**: Mọi API call đều qua server — client không bao giờ truy cập GitHub API trực tiếp

---

## 🚀 Bắt đầu

### Yêu cầu

- Node.js >= 22.12.0
- Repository GitHub chứa nội dung markdown
- GitHub personal access token (fine-grained recommended)

### 1. Clone & Cài đặt

```bash
git clone https://github.com/pageel/pageel-cms.git
cd pageel-cms
npm install
```

### 2. Cấu hình môi trường

```bash
cp .env.example .env
```

Sửa file `.env`:

```env
CMS_USER=admin
CMS_PASS_HASH="$2a$12$..."   # Xem docs/deployment.md để tạo hash
CMS_SECRET=chuoi-ngau-nhien-toi-thieu-16-ky-tu
GITHUB_TOKEN=ghp_token_cua_ban
CMS_REPO=username/repo
```

### 3. Chạy Development Server

```bash
npm run dev
```

Mở [http://localhost:4321](http://localhost:4321) — sẽ chuyển hướng đến `/login`.

### 4. Tạo Password Hash

```bash
node -e "require('bcryptjs').hash('mat-khau-cua-ban', 12).then(h => console.log(h))"
```

Copy kết quả vào `CMS_PASS_HASH` trong file `.env`.

### 5. Build Production

```bash
npm run build
node dist/server/entry.mjs
```

Xem [docs/deployment.md](docs/deployment.md) để biết cách deploy lên VPS, Docker, và Vercel.

---

## 🌐 Hệ sinh thái

| Sản phẩm           | Loại       | Mục đích                                               |
| :----------------- | :--------- | :----------------------------------------------------- |
| **Pageel CMS**     | OSS (MIT)  | CMS Git-native quản lý nội dung & media                |
| **Pageel Workhub** | Thương mại | Workspace làm việc nhóm: quy trình, review, phân quyền |

> Pageel CMS tập trung vào **nội dung**. Để có tính năng làm việc nhóm, hãy xem Pageel Workhub.

---

## 🤝 Đóng góp

Chúng tôi hoan nghênh mọi đóng góp! Xem [Hướng dẫn đóng góp](./docs/guides/CONTRIBUTING.md).

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/tinh-nang-moi`)
3. Commit thay đổi (`git commit -m 'Thêm tính năng mới'`)
4. Push lên branch (`git push origin feature/tinh-nang-moi`)
5. Tạo Pull Request

---

## 📄 Bản quyền

Dự án này được cấp phép theo **MIT License**. Xem file [LICENSES.md](./LICENSES.md) để biết thêm chi tiết.

---

<p align="center">
  Made with ❄️ by <a href="https://www.pageel.com">Pageel</a>
</p>
