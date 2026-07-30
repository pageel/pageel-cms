import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(repoRoot, '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const rootPkg = readJson(path.join(repoRoot, 'package.json'));
const targetVersion = rootPkg.version;

console.log(`🔄 Syncing all package manifests to target version: v${targetVersion}...`);

// 1. Sync packages/cms-bridge/package.json
const cmsBridgePath = path.join(repoRoot, 'packages/cms-bridge/package.json');
if (fs.existsSync(cmsBridgePath)) {
  const cmsPkg = readJson(cmsBridgePath);
  cmsPkg.version = targetVersion;
  writeJson(cmsBridgePath, cmsPkg);
  console.log(`  ✅ Updated packages/cms-bridge/package.json -> ${targetVersion}`);
}

// 2. Sync project.md contract
const projectMdPath = path.join(projectRoot, 'project.md');
if (fs.existsSync(projectMdPath)) {
  let projectMd = fs.readFileSync(projectMdPath, 'utf8');
  projectMd = projectMd.replace(/version:\s*"[^"]+"/, `version: "${targetVersion}"`);
  fs.writeFileSync(projectMdPath, projectMd, 'utf8');
  console.log(`  ✅ Updated project.md -> ${targetVersion}`);
}

console.log(`\n🎉 Package version synchronization complete for v${targetVersion}!\n`);
