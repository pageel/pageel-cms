# CI/CD Pipeline & Quality Gate Architecture

> **Target Repository:** `pageel-cms`
> **Ecosystem:** Astro 6 + React 19 + TypeScript 5.9

This document outlines the Continuous Integration (CI), Continuous Delivery (CD), and Dependabot security automation workflows configured for `pageel-cms`.

---

## 1. Quality Gate Workflow (`.github/workflows/ci.yml`)

The CI pipeline runs automatically on every push or pull request targeting `main` or `dev`. It executes three parallel jobs:

1. **`typecheck` (Type & Syntax Check):**
   - Node.js 22 runner environment.
   - Builds internal workspace packages (`npm run build:packages`).
   - Generates Astro types (`npx astro sync`).
   - Runs TypeScript static analysis (`npx tsc --noEmit`).
   - Runs Astro diagnostic check (`npx astro check`).

2. **`test` (Unit & Integration Tests):**
   - Node.js 22 runner environment.
   - Runs Vitest test suite (`npx vitest run`).

3. **`build` (Production Build Test):**
   - Node.js 22 runner environment.
   - Verifies production bundle creation for Vercel SSR adapter (`npm run build`).

---

## 2. CD Release Workflow (`.github/workflows/publish.yml`)

Triggers automatically upon pushing a git tag matching `v*` (e.g. `v2.5.0`):

1. **Security Audit Job:** Runs `npm audit --audit-level=high`.
2. **Publish Job:** Builds packages in dependency order and publishes `@pageel/plugin-types`, `@pageel/plugin-mdx`, and `@pageel/cms` to NPM Registry with `--provenance` signatures.

---

## 3. Dependabot Security Automation & Smart Auto-Merge

- **Schedule:** Monthly security sweeps (`interval: "monthly"`).
- **Limit:** Maximum 3 open pull requests simultaneously.
- **Scope:** Direct dependencies only, ignoring major breaking version bumps.
- **Smart Auto-Merge (`.github/workflows/dependabot-auto-merge.yml`):** Automatically enables auto-merge for non-major Dependabot PRs. The PR will automatically merge once all 3 CI quality checks pass green.

---

## 4. Local Pre-Commit Verification

Before committing changes locally, run:

```bash
# Type check & test suite
npx tsc --noEmit
npx vitest run
npm run build
```
