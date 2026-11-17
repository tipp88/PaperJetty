import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const { version } = JSON.parse(read('frontend/package.json'));
const lock = JSON.parse(read('frontend/package-lock.json'));
const errors = [];

if (lock.version !== version || lock.packages?.['']?.version !== version) {
  errors.push('frontend/package.json and package-lock.json versions must match.');
}

const ref = process.env.GITHUB_REF ?? '';
if (ref.startsWith('refs/tags/v') && ref.slice('refs/tags/v'.length) !== version) {
  errors.push(`Release tag ${ref} does not match package version ${version}.`);
}

// Development builds do not change the stable README badge. Stable releases
// require the newest dated entry, not just a mention anywhere in the changelog.
if (!version.includes('-')) {
  const readme = read('README.md');
  const changelog = (readme.split(/^## Changelog\s*$/m)[1] ?? '').split(/^## /m)[0];
  const latest = /^### \[([^\]]+)\] - \d{4}-\d{2}-\d{2}\s*\n([\s\S]*?)(?=^### |$(?![\s\S]))/m.exec(changelog);
  if (!latest || latest[1] !== version || !/^- \S/m.test(latest[2])) {
    errors.push(`README.md Changelog must start with a dated, nonempty release entry for ${version} after Unreleased.`);
  }
  if (!read('README.md').includes(`/badge/Version-${version}-blue?`)) {
    errors.push(`README.md version badge must show ${version}.`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Release metadata is consistent: ${version}`);
}
