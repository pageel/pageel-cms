# Deployment Guide

> **Version**: 2.0.0-beta | **Updated**: 2026-03-25

## Prerequisites

- Node.js >= 22.12.0
- A GitHub repository with markdown content
- A GitHub personal access token (fine-grained recommended)

## Environment Variables

Create a `.env` file (see `.env.example`):

| Variable | Required | Description |
|:---------|:---------|:------------|
| `CMS_USER` | ✅ | Login username |
| `CMS_PASS_HASH` | ✅ | Bcrypt hash of the login password |
| `CMS_SECRET` | ✅ | Random string (min 16 chars) for session signing |
| `GITHUB_TOKEN` | ✅ | Git personal access token (fine-grained recommended) |
| `CMS_REPO` | ✅ | Repository in `owner/repo` format |
| `CMS_SERVICE` | ❌ | `github` (default), `gitea`, or `gogs` |
| `CMS_INSTANCE_URL` | ❌ | Self-hosted instance URL (for Gitea/Gogs) |

## Generating CMS_PASS_HASH

The password is stored as a **bcrypt hash** — the server never stores your plaintext password.

### Option 1: Using Node.js (recommended)

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your-password', 12).then(h => console.log(h))"
```

### Option 2: Using npx (no install required)

```bash
npx -y bcryptjs-cli hash "your-password" 12
```

### Option 3: Online generator

Use [bcrypt-generator.com](https://bcrypt-generator.com/) with 12 rounds.

### Important Notes

- The hash starts with `$2a$12$` or `$2b$12$` — this is normal
- Use **12 rounds** for a good balance of security and speed
- The `$` characters in the hash can cause issues with some `.env` parsers — wrap the value in double quotes:

```env
CMS_PASS_HASH="$2a$12$LJ3m4ys8Rqh5X.9Q4j5KyOZ1gGCIk9PM5dLr7h2EXAMPLE"
```

## Generating CMS_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or any random string generator — minimum 16 characters.

---

## Deploy to Vercel (Recommended) ✅

Zero-configuration deployment — just import and deploy.

### 1. Import Repository

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Select your GitHub repository
3. Vercel auto-detects **Astro** framework → Click **Deploy**

> 💡 No `vercel.json` or Root Directory config needed — the Astro app lives at repo root.

### 2. Set Environment Variables

In **Vercel Dashboard → Project → Settings → Environment Variables**:

```
CMS_USER       = admin
CMS_PASS_HASH  = $2a$12$...   ← paste as-is, Vercel doesn't corrupt $ chars
CMS_SECRET     = your-random-secret
GITHUB_TOKEN   = ghp_xxx
CMS_REPO       = owner/repo
CMS_SERVICE    = github
```

> **Note:** Vercel environment variables are NOT processed by dotenv-expand,
> so bcrypt hashes with `$` characters work without escaping.

### 3. Redeploy

After setting env vars, trigger a redeploy:
- **Deployments** tab → latest deployment → **Redeploy**

### Vercel Notes

- **Rate limiting** resets on each cold start (serverless function lifecycle)
- **Session storage** uses Vercel's default (check Astro session docs for Vercel adapter)
- **File system access** is read-only — the `.env` file fallback won't work (not needed since Vercel provides env vars natively)

---

## Deploy to VPS / Docker

For self-hosted deployment, switch to the Node.js adapter.

### 1. Switch Adapter

In `astro.config.mjs`, replace the Vercel adapter with Node:

```diff
- import vercel from '@astrojs/vercel';
+ import node from '@astrojs/node';

  export default defineConfig({
    output: 'server',
    integrations: [react()],
-   adapter: vercel(),
+   adapter: node({ mode: 'standalone' }),
    vite: {
      plugins: [tailwindcss()],
    },
  });
```

```bash
npm install @astrojs/node
```

### 2. Build

```bash
npm install
npm run build
```

### 3. Run

```bash
# Set environment variables
export CMS_USER=admin
export CMS_PASS_HASH='$2a$12$...'
export CMS_SECRET=your-secret
export GITHUB_TOKEN=ghp_xxx
export CMS_REPO=owner/repo

# Start server
node dist/server/entry.mjs
```

Server runs on `http://localhost:4321` by default.

### 4. With Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

ENV HOST=0.0.0.0
ENV PORT=4321

EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
```

### 5. With PM2

```bash
pm2 start dist/server/entry.mjs --name pageel-cms
```

### 6. Reverse Proxy (Nginx)

```nginx
server {
    listen 443 ssl;
    server_name cms.example.com;

    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Security Checklist

Before going to production:

- [ ] Use HTTPS (required for `Secure` cookie flag)
- [ ] Set a strong `CMS_SECRET` (32+ chars recommended)
- [ ] Use a strong password with 12+ characters
- [ ] Restrict `GITHUB_TOKEN` permissions (fine-grained: Contents read/write only)
- [ ] Monitor access logs for brute force attempts
- [ ] Keep dependencies updated (`npm audit`)

---

_Last updated: 2026-03-25_
