#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const composeFile = process.env.COMPOSE_FILE || 'docker-compose.yml';
const baseUrl = process.env.BASE_URL || process.argv[2] || 'http://localhost:3000';
const waitSeconds = Number(process.env.WAIT_SECONDS || 30);

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: projectRoot,
    env: process.env,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }
}

function sleep(seconds) {
  if (seconds <= 0) return;
  const sab = new SharedArrayBuffer(4);
  const int32 = new Int32Array(sab);
  Atomics.wait(int32, 0, 0, seconds * 1000);
}

function hasBash() {
  try {
    const probe = spawnSync('bash', ['-lc', 'echo ok'], { stdio: 'pipe' });
    return probe.status === 0;
  } catch {
    return false;
  }
}

function runIntegrationScript() {
  const scriptPath = 'scripts/integration-test.sh';
  const cmd = hasBash() ? 'bash' : 'sh';
  const args = hasBash()
    ? ['-lc', `chmod +x ${scriptPath} && ./${scriptPath} ${baseUrl}`]
    : ['-lc', `chmod +x ${scriptPath} && ./${scriptPath} ${baseUrl}`];

  run(cmd, args);
}

function composeDown() {
  try {
    run('docker', ['compose', '-f', composeFile, 'down', '-v']);
  } catch {
    // Swallow cleanup errors
  }
}

function main() {
  try {
    run('docker', ['compose', '-f', composeFile, 'build']);
    run('docker', ['compose', '-f', composeFile, 'up', '-d']);
    sleep(waitSeconds);
    runIntegrationScript();
  } finally {
    composeDown();
  }
}

process.on('SIGINT', () => {
  composeDown();
  process.exit(130);
});

process.on('SIGTERM', () => {
  composeDown();
  process.exit(143);
});

main();
