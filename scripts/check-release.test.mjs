import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function check({ version = '1.4.0', lockVersion = version, badge = version,
  entry = version, notes = '- A documented change.', ref = 'refs/heads/main' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'docuscan-release-check-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'frontend'));
    copyFileSync(new URL('./check-release.mjs', import.meta.url), join(root, 'scripts/check-release.mjs'));
    writeFileSync(join(root, 'frontend/package.json'), JSON.stringify({ version }));
    writeFileSync(join(root, 'frontend/package-lock.json'), JSON.stringify({
      version: lockVersion, packages: { '': { version: lockVersion } },
    }));
    writeFileSync(join(root, 'README.md'), `![Version](https://img.shields.io/badge/Version-${badge}-blue?style=for-the-badge)`);
    writeFileSync(join(root, 'CHANGELOG.md'), `# Changelog\n\n## [Unreleased]\n\n## [${entry}] - 2026-11-17\n\n### Added\n${notes}\n\n## [1.3.9] - 2026-07-08\n\n- Older changes.\n`);
    return spawnSync(process.execPath, [join(root, 'scripts/check-release.mjs')], {
      env: { ...process.env, GITHUB_REF: ref }, encoding: 'utf8',
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('stable version and matching tag pass', () => {
  assert.equal(check().status, 0);
  assert.equal(check({ ref: 'refs/tags/v1.4.0' }).status, 0);
});

test('stale lockfile, changelog, README and mismatched tag are rejected', () => {
  for (const options of [
    { lockVersion: '1.3.11' }, { entry: '1.3.11' }, { badge: '1.3.4' },
    { ref: 'refs/tags/v1.3.11' },
  ]) assert.equal(check(options).status, 1, JSON.stringify(options));
});

test('an empty current entry cannot borrow release notes from an older entry', () => {
  assert.equal(check({ notes: '' }).status, 1);
});

test('development builds may retain stable documentation but must match their lockfile', () => {
  assert.equal(check({ version: '1.4.1-dev.1', entry: '1.4.0', badge: '1.4.0' }).status, 0);
  assert.equal(check({ version: '1.4.1-dev.1', lockVersion: '1.4.0' }).status, 1);
});
