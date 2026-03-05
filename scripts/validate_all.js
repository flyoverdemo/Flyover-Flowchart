#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');

function runNodeCommand(args, label) {
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    console.error(`\n[${label}] execution error:`, result.error.message);
    return { ok: false, code: 1 };
  }

  const exitCode = typeof result.status === 'number' ? result.status : 1;
  return { ok: exitCode === 0, code: exitCode };
}

function main() {
  console.log('\n== Flyover Flowchart validation ==');

  console.log('\n[1/2] Boundary normalization smoke');
  const boundary = runNodeCommand(['scripts/boundary_normalization_smoke.js'], 'boundary-smoke');
  if (!boundary.ok) {
    console.error(`\nValidation failed at boundary smoke (exit code ${boundary.code}).`);
    process.exit(boundary.code || 1);
  }

  console.log('\n[2/2] Combat replay fixtures (strict invariants)');
  const replay = runNodeCommand(['scripts/validate_replay.js'], 'replay-suite');
  if (!replay.ok) {
    console.error(`\nValidation failed at replay suite (exit code ${replay.code}).`);
    process.exit(replay.code || 1);
  }

  console.log('\nValidation passed: boundary smoke + replay suite are green.');
}

main();
