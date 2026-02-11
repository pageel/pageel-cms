# Pageel CMS

> **Phiên bản:** 1.1.0-beta.1 | **Cập nhật:** Tháng 2/2026

Hệ quản trị nội dung (CMS) mạnh mẽ, chạy hoàn toàn trên trình duyệt (client-side) để quản lý nội dung Markdown/MDX và hình ảnh trực tiếp trên **GitHub**, **Gitea**, hoặc **Gogs**. Được xây dựng với **React 19** và **TypeScript**, mang lại giao diện hiện đại phong cách Notion.

<div align="center">
  <a href="https://pageel.com">
    <img src="https://raw.githubusercontent.com/pageel/pageel-cms/main/.github/assets/pageel-logo.svg" width="200" alt="Pageel Logo">
  </a>
</div>

<div align="center">
  <h1>Git-native CMS cho Astro & Next.js</h1>
  <p>Chạy hoàn toàn trên trình duyệt. Không database. Không backend.</p>

[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.0--beta.1-blue.svg)](CHANGELOG.md)
![Status](https://img.shields.io/badge/status-active-success.svg)

</div>

---

<div align="center">
  <a href="README.md">🇺🇸 English</a> | <a href="README.vi.md">🇻🇳 <b>Tiếng Việt</b></a>
</div>

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
| 🔐 **No Backend**         | Chạy 100% trên browser, giao tiếp trực tiếp với Git APIs                                            |
| 🔒 **Bảo mật**            | Mã hóa PAT bằng **AES-GCM** (Web Crypto API), lưu trong sessionStorage                              |
| 🌍 **Đa nền tảng**        | Hỗ trợ **GitHub**, **Gitea**, và **Gogs** (self-hosted)                                             |
| 🌐 **Đa ngôn ngữ**        | Hỗ trợ Tiếng Anh và Tiếng Việt (i18n ready)                                                         |
| ⚡ **Optimistic Locking** | **SHA-check** ngăn chặn việc ghi đè dữ liệu khi nhiều người cùng sửa                                |

---

## 🧭 Các Module chức năng

### 1. 📝 Quản lý bài viết (`PostList`)

Trung tâm quản lý nội dung của bạn.

- **Chế độ xem:** Chuyển đổi giữa dạng bảng (table) hoặc dạng lưới (grid) trực quan.
- **Bộ lọc nâng cao:** Lọc theo văn bản, khoảng thời gian, thẻ (tags), trạng thái (boolean) và số.
- **Sắp xếp thông minh:** Sắp xếp theo bất kỳ trường nào có trong template.
- **Thao tác nhanh:** Sửa frontmatter trực tiếp, trình soạn thảo Markdown split-pane, upload file.

### 2. 🖼️ Quản lý hình ảnh (`ImageList`)

Thư viện media chuyên dụng.

- **Gallery View:** Dạng lưới với thumbnail lazy-loaded.
- **Bulk Upload:** Kéo thả để upload nhiều ảnh cùng lúc.
- **Auto Compression:** Nén ảnh phía client (tự cấu hình max size/width).
- **Public URL:** Copy đường dẫn ảnh (tương đối hoặc tuyệt đối) chỉ với 1 click.

### 3. 📋 Post Template (`TemplateGenerator`)

Định nghĩa và validate cấu trúc nội dung.

- **Visual Editor:** Định nghĩa các trường dữ liệu qua giao diện dropdown.
- **Các kiểu hỗ trợ:**
  - `String` (Nhập văn bản)
  - `Date` (Chọn ngày)
  - `Array` (Chọn nhiều thẻ)
  - `Boolean` (Bật/tắt)
  - `Number` (Nhập số)
  - `Object` (Trình sửa JSON)
- **Tạo Schema:** Tự động tạo schema từ bài viết có sẵn.

---

## 🚀 Bắt đầu

### Yêu cầu

- Trình duyệt hiện đại (Chrome 80+, Firefox 75+, Safari 13.1+)
- Node.js 20.19+ (nếu chạy local development)
- Repository trên GitHub, Gitea, hoặc Gogs

### 1. Clone & Cài đặt

```bash
git clone https://github.com/pageel/pageel-cms.git
cd pageel-cms
npm install
```

### 2. Chạy Development Server

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) trên trình duyệt.

### 3. Tạo Access Token

| Nhà cung cấp   | Quyền hạn yêu cầu             |
| :------------- | :---------------------------- |
| **GitHub**     | **Contents** (Read and Write) |
| **Gitea/Gogs** | **Repo** (Read and Write)     |

### 4. Kết nối Repository

1. Chọn dịch vụ Git của bạn.
2. Nhập tên repository (ví dụ: `username/repo`).
3. Dán access token.
4. (Self-hosted) Nhập đường dẫn instance URL.

---

## 🏗️ Kiến trúc kỹ thuật

### Tech Stack

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)

### Các mẫu thiết kế cốt lõi (Design Patterns)

**1. Adapter Pattern (`IGitService`)**
Trừu tượng hóa các thao tác Git cho GitHub (`GithubAdapter`), Gitea (`GiteaAdapter`), và Gogs (`GogsAdapter`).

**2. Client-Side Encryption**

- Personal Access Tokens (PAT) được mã hóa bằng **AES-GCM**.
- Enrollment key được tạo ngẫu nhiên qua `crypto.getRandomValues()`.
- Không có dữ liệu nào được gửi về server của chúng tôi.

**3. Quản lý trạng thái (State Management)**

- **Zustand** cho trạng thái toàn cục (global state).
- **IndexedDB** / **localStorage** cho settings và cache.
- **URL Query Params** cho trạng thái deep linking.

---

## 🌐 Hệ sinh thái

| Sản phẩm           | Loại       | Mục đích                                               |
| :----------------- | :--------- | :----------------------------------------------------- |
| **Pageel CMS**     | OSS (MIT)  | CMS Git-native quản lý nội dung & media                |
| **Pageel Workhub** | Thương mại | Workspace làm việc nhóm: quy trình, review, phân quyền |

> Pageel CMS tập trung vào **nội dung**. Để có tính năng làm việc nhóm, hãy xem Pageel Workhub.

---

## 🤝 Đóng góp (Contributing)

Chúng tôi rất hoan nghênh mọi đóng góp! Xem [Hướng dẫn đóng góp](./docs/guides/CONTRIBUTING.md) để biết thêm chi tiết.

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/tinh-nang-moi`)
3. Commit thay đổi (`git commit -m 'Thêm tính năng mới'`)
4. Push lên branch (`git push origin feature/tinh-nang-moi`)
5. Tạo Pull Request

---

## 📄 Bản quyền (License)

Dự án này được cấp phép theo **MIT License**. Xem file [LICENSES.md](./LICENSES.md) để biết thêm chi tiết.

---

<p align="center">
  Made with ❄️ by <a href="https://www.pageel.com">Pageel</a>
</p>
