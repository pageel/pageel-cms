# Pageel CMS — Setup & Auth Modes Guide

> **Version**: 2.0.1 | **Updated**: 2026-03-27

This document provides detailed instructions for installing Pageel CMS for the first time and an in-depth analysis of the 3 authentication modes, helping you choose the best model for your project.

## 1. Prerequisites

- **Environment**: Node.js >= 22.12.0
- **Account**: GitHub Personal Access Token (PAT) — *Fine-grained* token is recommended (granting only Read/Write Contents access to a specific repository).
- **Repository**: A GitHub repo with your Markdown content (or an empty one).

---

## 2. Initial Setup

Open your terminal and run the following commands:

```bash
# Clone the source code
git clone https://github.com/pageel/pageel-cms.git
cd pageel-cms

# Install dependencies
npm install

# Create environment configuration file
cp .env.example .env
```

---

## 3. Configuring the 3 Auth Modes

Pageel CMS v2.0 supports 3 distinct security and access models, fully controlled by your `.env` file. Depending on which variables you provide, the system automatically enables the corresponding mode.

### A. Server Mode
> **Best for**: Admins managing their own repository. Provide an internal account (user/password) for authorized users to log in and write content without exposing Git credentials.

- **Characteristics**: The Git token is NEVER exposed to the client, nor is there a need for the user to input it. Guests just use the system's username and password.
- **Required Environment Variables (`.env`)**:
  ```env
  CMS_USER=admin
  CMS_PASS_HASH="$2a$12$..."   # Internal password hashed via CLI tool
  CMS_SECRET=random_secret_string_123

  # MANDATORY: Token and Repo
  GITHUB_TOKEN=ghp_xxxx1234xxxx
  CMS_REPO=username/repo
  ```
- **Login Experience**: The interface shows only 2 fields: Username and Password. The system automatically proxies Git commands to the configured repo using the backend token.

### B. Connect Mode
> **Best for**: Providing the CMS as a service (SaaS/On-prem). You manage who has permission to access the system, but each user must provide their own GitHub Token and Repository.

- **Characteristics**: Access is controlled with a CMS Username/Password. Users have an internal account but must supply their own GitHub credentials to push code.
- **Required Environment Variables (`.env`)**:
  ```env
  CMS_USER=admin
  CMS_PASS_HASH="$2a$12$..."
  CMS_SECRET=random_secret_string_123

  # LEAVE EMPTY (Or delete these two lines entirely)
  # GITHUB_TOKEN=
  # CMS_REPO=
  ```
- **Login Experience**: The interface shows 4 fields: Username, Password, Repository, and GitHub Token.
- **Security**: The token inputted by the user is encrypted into a Cookie using HMAC-SHA256 (`CMS_SECRET`), so it will not leak even upon page refresh. The Cookie is destroyed upon expiration or mode change. The system validates credential completeness natively in the custom middleware.

### C. Open Mode (Multi-Tenant)
> **Best for**: Open usage (similar to Decap CMS / TinaCMS standalone). Suitable for community projects where centralized access control is not needed.

- **Characteristics**: Anyone with a valid Markdown repo and their own GitHub Token can use your CMS instance. No internal username/password required.
- **Required Environment Variables (`.env`)**:
  ```env
  CMS_SECRET=random_secret_string_123

  # DELETE all other lines (CMS_USER, CMS_PASS_HASH, GITHUB_TOKEN, CMS_REPO)
  ```
- **Login Experience**: The login interface automatically hides the User/Password fields. It displays an "Open Environment" notice and only requires the Repository and GitHub Token.
- **Security**: The token is validated instantly via the GitHub API server-side before the session cookie is created.

---

## 4. Generating Security Configuration

### 4.1. Generate CMS_PASS_HASH (Password)
Plaintext passwords should never be saved. After running `npm install`, generate a hash using the built-in CLI tool:

```bash
npx pageel-cms hash my-secret-password
```
Copy the `$2b$12$...` string to your `.env` file. **Make sure to wrap it in double quotes (`"..."`)** to prevent shell evaluation issues.

### 4.2. Generate CMS_SECRET
Use this script to generate a secure 64-character hex string:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 5. Running the Environment

Once configuration is complete:

```bash
# Start Development Server
npm run dev
```

Visit `http://localhost:4321`. You will be redirected to the `/login` page with an interface that matches one of the 3 modes configured above.

> **💡 Tip:** If you are using Connect Mode or Open Mode and want to switch back to Server Mode, simply add the `GITHUB_TOKEN` variable and restart the server.

---

_Last updated: 2026-03-26_
