#!/usr/bin/env node
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

// Project-local installation; no global agent configuration is modified.
const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, '.local-tools/rea/node_modules/rea-agents/scripts/rea.mjs');
const javaHome = join(root, '.local-tools/android/jdk/jdk-21.0.12.1+1');
const jadx = join(root, '.local-tools/android/jadx-headless-mcp-0.7.1-all.jar');

try {
  await access(cli, constants.R_OK);
} catch {
  console.error('REA is not installed locally. See docs/research/adobe-scan.md.');
  process.exit(1);
}

const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: {
    ...process.env,
    JAVA_HOME: process.env.JAVA_HOME || javaHome,
    REA_JADX_MCP_JAR: process.env.REA_JADX_MCP_JAR || jadx,
  },
});
child.once('error', error => {
  console.error(`Could not start REA: ${error.message}`);
  process.exitCode = 1;
});
child.once('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
