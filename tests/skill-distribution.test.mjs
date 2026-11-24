import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  PACKAGED_FILE_MAP,
  REPO_ROOT,
  SKILL_DIR,
  SKILL_ID,
  checkSkillPackage,
  packageSkill,
  parseAndValidateSkillFrontmatter
} from '../scripts/package-skill.mjs';

const execFileAsync = promisify(execFile);

async function runCli(entrypoint, args, cwd) {
  const { stdout, stderr } = await execFileAsync(process.execPath, [entrypoint, ...args], {
    cwd,
    env: { ...process.env }
  });
  return { stdout, stderr, json: JSON.parse(stdout) };
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

test('SKILL.md frontmatter conforms to official Agent Skills specification (agentskills.io)', async () => {
  const raw = await fs.readFile(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  const res = parseAndValidateSkillFrontmatter(raw, SKILL_ID);
  assert.equal(res.ok, true, `SKILL.md validation errors: ${res.errors.join('; ')}`);
  assert.equal(res.frontmatter.name, 'agentready');
  assert(res.frontmatter.description.length >= 20 && res.frontmatter.description.length <= 1024);
  assert.equal(res.frontmatter.license, 'MIT');
  assert(res.frontmatter.compatibility.length > 0 && res.frontmatter.compatibility.length <= 500);
  assert.equal(typeof res.frontmatter.metadata, 'object');
  assert.equal(res.frontmatter.metadata.version, '0.3.0-alpha.2');
  assert(res.lineCount <= 500);

  // Negative checks for spec validator
  const badName = parseAndValidateSkillFrontmatter('---\nname: AgentReady--Bad\ndescription: Test\n---\nBody\n', 'agentready');
  assert.equal(badName.ok, false);
  const missingDesc = parseAndValidateSkillFrontmatter('---\nname: agentready\n---\nBody\n', 'agentready');
  assert.equal(missingDesc.ok, false);
});

test('packaged skill passes drift check and detects stale or extra runtime files', async (t) => {
  const cleanCheck = await checkSkillPackage(REPO_ROOT);
  assert.equal(cleanCheck.ok, true, `Expected clean skill package, got: ${cleanCheck.errors.join('; ')}`);

  const tmpRepo = await fs.mkdtemp(path.join(os.tmpdir(), 'agentready-drift-'));
  t.after(() => fs.rm(tmpRepo, { recursive: true, force: true }));

  await fs.copyFile(path.join(REPO_ROOT, 'package.json'), path.join(tmpRepo, 'package.json'));
  for (const [srcRel] of PACKAGED_FILE_MAP) {
    const dest = path.join(tmpRepo, srcRel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(path.join(REPO_ROOT, srcRel), dest);
  }
  await fs.mkdir(path.join(tmpRepo, 'skills', SKILL_ID, 'references'), { recursive: true });
  await fs.copyFile(path.join(SKILL_DIR, 'SKILL.md'), path.join(tmpRepo, 'skills', SKILL_ID, 'SKILL.md'));
  await fs.copyFile(path.join(SKILL_DIR, 'references', 'UPSTREAM.md'), path.join(tmpRepo, 'skills', SKILL_ID, 'references', 'UPSTREAM.md'));

  const pkgRes = await packageSkill(tmpRepo);
  assert.equal(pkgRes.ok, true);
  assert.equal((await checkSkillPackage(tmpRepo)).ok, true);

  // 1. Mutate a packaged runtime file -> drift check MUST fail
  const packagedCore = path.join(tmpRepo, 'skills', SKILL_ID, 'scripts', 'src', 'core.mjs');
  await fs.appendFile(packagedCore, '\n// simulated drift\n');
  const staleRes = await checkSkillPackage(tmpRepo);
  assert.equal(staleRes.ok, false);
  assert(staleRes.errors.some((e) => e.includes('Stale or modified packaged file')));

  // Re-package restores clean state
  await packageSkill(tmpRepo);
  assert.equal((await checkSkillPackage(tmpRepo)).ok, true);

  // 2. Add an unexpected stale file inside scripts/ -> drift check MUST fail
  await fs.writeFile(path.join(tmpRepo, 'skills', SKILL_ID, 'scripts', 'orphan.mjs'), 'export default 1;\n');
  const extraRes = await checkSkillPackage(tmpRepo);
  assert.equal(extraRes.ok, false);
  assert(extraRes.errors.some((e) => e.includes('Unexpected stale file')));
});

test('packaged skill runs inspect, init, import, generate, and verify in an isolated temp dir with spaces & non-ASCII paths', async (t) => {
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'ar-isolated-'));
  t.after(() => fs.rm(sandbox, { recursive: true, force: true }));

  // Both skill installation path AND target storefront path contain spaces and non-ASCII Unicode characters
  const isolatedSkillDir = path.join(sandbox, 'Cài đặt Skill Thử Nghiệm', 'agentready');
  const targetProjectDir = path.join(sandbox, 'Cửa hàng Việt Nam — Demo 2026');

  // Copy ONLY skills/agentready/ (no access to original repository!)
  await copyDir(SKILL_DIR, isolatedSkillDir);
  await fs.mkdir(path.join(targetProjectDir, 'data'), { recursive: true });

  // Verify self-contained bundle files exist in isolated copy
  for (const rel of [
    'SKILL.md',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'references/UPSTREAM.md',
    'references/COMMERCE_VARIANTS.md',
    'scripts/package.json',
    'scripts/agentready.mjs',
    'scripts/.package-manifest.json'
  ]) {
    const stat = await fs.stat(path.join(isolatedSkillDir, rel));
    assert(stat.isFile(), `Missing bundled file in isolated skill: ${rel}`);
  }

  const runtimePkg = JSON.parse(await fs.readFile(path.join(isolatedSkillDir, 'scripts', 'package.json'), 'utf8'));
  assert.equal(runtimePkg.type, 'module');
  assert.equal(runtimePkg.dependencies, undefined);

  const entrypoint = path.join(isolatedSkillDir, 'scripts', 'agentready.mjs');

  // 1. inspect
  const inspectRes = await runCli(entrypoint, ['inspect', '--project', targetProjectDir], targetProjectDir);
  assert.equal(inspectRes.json.hasAgentReadyConfig, false);

  // 2. init
  const initRes = await runCli(
    entrypoint,
    ['init', '--project', targetProjectDir, '--site-name', 'Cửa hàng Trà Việt', '--site-url', 'https://traviet.example.com'],
    targetProjectDir
  );
  assert(initRes.json.configFile.endsWith('agentready.config.json'));
  assert(initRes.json.productsFile.endsWith('agentready-products.json'));

  // 3. import (local public Shopify export fixture)
  const shopifyFixture = {
    products: [
      {
        id: 9001,
        handle: 'tra-o-long-cao-cap',
        title: 'Trà Ô Long Cao Cấp',
        vendor: 'Trà Việt',
        product_type: 'Tea',
        body_html: '<p>Trà Ô Long thu hoạch thủ công.</p>',
        published_at: '2026-01-15T08:00:00Z',
        status: 'active',
        options: [{ name: 'Weight', position: 1, values: ['100g', '250g'] }],
        variants: [
          {
            id: 90011,
            sku: 'OLONG-100G',
            title: '100g',
            option1: '100g',
            price: '180000',
            available: true,
            published: true
          },
          {
            id: 90012,
            sku: 'OLONG-250G',
            title: '250g',
            option1: '250g',
            price: '420000',
            available: true,
            published: true
          }
        ]
      }
    ]
  };
  await fs.writeFile(
    path.join(targetProjectDir, 'data', 'shopify-export.json'),
    JSON.stringify(shopifyFixture, null, 2)
  );

  const importRes = await runCli(
    entrypoint,
    [
      'import',
      '--project',
      targetProjectDir,
      '--source',
      'data/shopify-export.json',
      '--format',
      'shopify',
      '--currency',
      'VND',
      '--allow-attributes',
      'weight',
      '--force'
    ],
    targetProjectDir
  );
  assert.equal(importRes.json.format, 'shopify');
  assert.equal(importRes.json.importedCount, 1);

  // 4. generate
  const genRes = await runCli(entrypoint, ['generate', '--project', targetProjectDir], targetProjectDir);
  assert.equal(genRes.json.productCount, 1);
  assert.equal(genRes.json.output.length, 7);

  // 5. verify
  const verifyRes = await runCli(entrypoint, ['verify', '--project', targetProjectDir], targetProjectDir);
  assert.equal(verifyRes.json.ok, true);
  assert.deepEqual(verifyRes.json.errors, []);
  assert.equal(verifyRes.json.productCount, 1);
});

test('simulated agent discovery layouts (Codex, Claude Code, Antigravity CLI) resolve SKILL.md and executable runtime', async (t) => {
  const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), 'ar-agent-layouts-'));
  t.after(() => fs.rm(fakeHome, { recursive: true, force: true }));

  // Official documented global skill directories (simulated filesystem check only — not live agent binary execution)
  const layouts = [
    { agent: 'codex', dir: path.join(fakeHome, '.agents', 'skills', SKILL_ID) },
    { agent: 'claude-code', dir: path.join(fakeHome, '.claude', 'skills', SKILL_ID) },
    { agent: 'antigravity-cli', dir: path.join(fakeHome, '.gemini', 'config', 'skills', SKILL_ID) }
  ];

  const targetDir = path.join(fakeHome, 'sample-store');
  await fs.mkdir(targetDir, { recursive: true });

  for (const layout of layouts) {
    await copyDir(SKILL_DIR, layout.dir);
    const skillMd = await fs.readFile(path.join(layout.dir, 'SKILL.md'), 'utf8');
    const check = parseAndValidateSkillFrontmatter(skillMd, path.basename(layout.dir));
    assert.equal(check.ok, true, `${layout.agent} SKILL.md invalid: ${check.errors.join('; ')}`);

    const res = await runCli(path.join(layout.dir, 'scripts', 'agentready.mjs'), ['inspect', '--project', targetDir], targetDir);
    assert.equal(res.json.hasAgentReadyConfig, false);
  }
});
