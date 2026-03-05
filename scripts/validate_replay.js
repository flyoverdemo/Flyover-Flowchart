#!/usr/bin/env node

const fs = require('fs');
const vm = require('vm');

global.window = global;
global.dispatchEvent = () => {};
global.CustomEvent = function(type, init) {
  return { type, detail: init && init.detail };
};

[
  'status_effects_core.js',
  'combatant_links_schema.js',
  'combat_replay_log.js',
  'combat_replay_tests.js'
].forEach((file) => vm.runInThisContext(fs.readFileSync(file, 'utf8')));

const fixtures = global.CombatReplayTests.createDefaultFixtures(
  global.CombatReplayLog.createInitialReplayState
);

const report = global.CombatReplayTests.runSuite(fixtures, {
  reducer: global.CombatReplayLog.defaultCombatReducer,
  createInitialState: global.CombatReplayLog.createInitialReplayState,
  invariantChecks: [global.CombatReplayTests.strictInvariantChecks]
});

const summary = {
  ok: report.ok,
  fixtureCount: report.fixtureCount,
  failedCount: report.failedCount,
  failedNames: report.reports.filter((entry) => !entry.ok).map((entry) => entry.name)
};

console.log(JSON.stringify(summary, null, 2));

if (!report.ok) {
  process.exit(1);
}
