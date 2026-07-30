import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(repoRoot, '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const rootPkg = readJson(path.join(repoRoot, 'package.json'));
const cmsBridgePkg = readJson(path.join(repoRoot, 'packages/cms-bridge/package.json'));

const targetVersion = rootPkg.version;
console.log(`🔍 Checking Version Sync against root package.json version: v${targetVersion}...`);

const errors = [];

// 1. Check packages/cms-bridge/package.json
if (cmsBridgePkg.version !== targetVersion) {
  errors.push(`❌ packages/cms-bridge/package.json version "${cmsBridgePkg.version}" does not match root version "${targetVersion}".`);
}

// 2. Check project.md (if present)
const projectMdPath = path.join(projectRoot, 'project.md');
if (fs.existsSync(projectMdPath)) {
  const projectMd = fs.readFileSync(projectMdPath, 'utf8');
  const match = projectMd.match(/version:\s*"([^"]+)"/);
  if (match && match[1] !== targetVersion) {
    errors.push(`❌ project.md version "${match[1]}" does not match root version "${targetVersion}".`);
  }
}

// 3. Check CHANGELOG.md section
const changelogPath = path.join(repoRoot, 'CHANGELOG.md');
if (fs.existsSync(changelogPath)) {
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  if (!changelog.includes(`## [${targetVersion}]`)) {
    errors.push(`⚠️ CHANGELOG.md is missing release header section "## [${targetVersion}]".`);
  }
}

if (errors.length > 0) {
  console.error('\n🚨 Version Synchronization Audit Failed:');
  for (const err of errors) {
    console.error(`  ${err}`);
  }
  console.error('\n👉 Run "npm run version:sync" to automatically sync package versions.\n');
  process.exit(1);
}

console.log('✅ Version Synchronization Check Passed! All 4 release targets aligned.\n');
