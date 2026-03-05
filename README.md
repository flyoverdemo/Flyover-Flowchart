# Flyover Flowchart v0.0.6 – Phased RulesCore Migration Summary

This project moved from a legacy UI-driven rules flow to a phased RulesCore architecture (core game logic layer).

## Project Naming Contract

- Canonical product name: **Flyover Flowchart**
- Current release label: **v0.0.6**
- Legacy terms (such as "Chain Warden" or "Google WIP") are treated as historical/internal references only.
- For new docs, UI labels, and tooling output, prefer **Flyover Flowchart**.
- Detailed policy (including legacy compatibility keys): `reference/TERMINOLOGY_CONTRACT.md` -> "Product Naming vs Legacy Compatibility".

## Phase 1: Data Model + Adapters

- Built `rules_core.js` to define a normalized state schema (consistent data shape).
- Added adapters (translation helpers) to:
  - capture legacy runtime data into the new core format,
  - map core state back into legacy patch objects for compatibility.
- Introduced a core store (state container) with replace/patch and subscription support.
- Kept behavior non-breaking by preserving legacy structures while syncing into core.

## Phase 2: Mechanics Routing + Parity

- Routed core mechanics through RulesCore for:
  - HP (hit points),
  - AC (armor class),
  - Initiative (turn order roll/modifier).
- Added guarded writeback (safety check before writing) from core to legacy runtime.
- Added scoped patch/apply methods (targeted updates for only selected state slices).
- Implemented parity checks (equivalence comparison) between legacy and core mechanics values.

## Phase 2.1 / 2.2: Conditions + Unified Patch APIs

- Extended writeback to conditions (status/constraint state bucket).
- Added unified snapshot patch entrypoints (single API for controlled core updates).
- Added event-driven hooks (custom browser events) for sync/apply/report workflows.

## Phase 3: Action/Combat Resolution Migration

- Added `rules_action_core.js` as a headless resolver module (UI-independent rules engine).
- Migrated combat flows to core-first resolution:
  - attack roll resolution,
  - contested checks (opposed roll logic),
  - damage resolution,
  - save DC handling (difficulty class target),
  - simple roll handling.
- Added unarmed variant generation (auto-created action permutations by ability/proficiency).
- Integrated HP apply helpers for damage/heal with replay event logging.

## Phase 4: Replay + Deterministic Tests

- Added `combat_replay_log.js` for append-only event logging (timeline record of combat actions).
- Added deterministic replay (same inputs produce same state output) via reducer logic.
- Added `combat_replay_tests.js` fixture suite (predefined test scenarios) for turn chains and metadata checks.
- Added strict mode options (stop-on-first-failure behavior) and breadcrumb reporting (first failing event/mismatch pointers).

## Post-Phase Implementations

- Added invariant checks (state truth rules that must always hold), including:
  - default invariants (non-negative HP/count checks),
  - strict invariants (integer HP fields, boolean resource flags, event/count consistency).
- Wired strict invariants as default in browser fixture suite runs (unless custom checks are supplied).
- Expanded fixture report output with:
  - invariant mode (`strict-default`, `custom`, `none`),
  - invariant check count,
  - first invariant violation details.
- Added debug snapshot/report enhancements so console diagnostics include fixture invariant defaults.
- Performed quick inline comment pass across new core/replay modules and bridge functions for maintainability.

## Current Outcome

- Core migration phases are implemented and integrated.
- Deterministic replay suite passes current default fixtures.
- Strict invariant gate is active by default for fixture suite runs.
- Debug tooling now provides clearer visibility into parity, replay, and invariant status.

## Workspace Conventions

- Keep live runtime modules in project root (for now), including `index.html`, `character_loader.js`, `rules_core.js`, `rules_action_core.js`, and status/replay core files.
- Keep external integration modules in `external/`:
  - `external/open5e_api.js`
  - `external/aideDD_api.js`
  - `external/DnDBeyond_api.js`
  - `external/external_links.js`
- Keep user-provided assets in `user data/` (PDFs, screenshots, images).
- Keep reference/docs content in `reference/` (guides, manuals, conceptual notes, archived working summaries).
- For reorganization, prefer small, reversible moves: move one concern at a time, update paths, then run replay + diagnostics before next step.

### Filename Style

- For new JavaScript modules, prefer lowercase `snake_case` filenames (example: `status_effects_core.js`).
- Avoid introducing new PascalCase filenames for modules.
- Existing filenames can remain as-is until intentionally migrated in small validated steps (rename + path update + replay check).

### Standard Replay Validation Command

Use this command after each small structural or runtime change:

```powershell
node -e "const fs=require('fs'); const vm=require('vm'); global.window=global; global.dispatchEvent=()=>{}; global.CustomEvent=function(type,init){return {type,detail:init&&init.detail};}; ['status_effects_core.js','combatant_links_schema.js','combat_replay_log.js','combat_replay_tests.js'].forEach(f=>vm.runInThisContext(fs.readFileSync(f,'utf8'))); const fixtures=global.CombatReplayTests.createDefaultFixtures(global.CombatReplayLog.createInitialReplayState); const report=global.CombatReplayTests.runSuite(fixtures,{reducer:global.CombatReplayLog.defaultCombatReducer,createInitialState:global.CombatReplayLog.createInitialReplayState,invariantChecks:[global.CombatReplayTests.strictInvariantChecks]}); console.log(JSON.stringify({ok:report.ok,fixtureCount:report.fixtureCount,failedCount:report.failedCount,failedNames:report.reports.filter(r=>!r.ok).map(r=>r.name)}, null, 2));"
```

### Boundary Normalization Smoke Command

```powershell
node scripts/boundary_normalization_smoke.js
```

### One-Command Validation (Smoke + Replay)

```powershell
node scripts/validate_all.js
```

Optional npm shortcut:

```powershell
npm run validate
```

Replay-only npm shortcut:

```powershell
npm run validate:replay
```

Smoke-only npm shortcut:

```powershell
npm run validate:smoke
```

This runs boundary normalization smoke first, then the replay fixture suite with strict invariants.
It fails fast with a non-zero exit code if either step fails.

## Core Conditions Coverage Matrix

- **Implemented (active mechanical impact in scaffold):**
  - `dodged` (incoming attack disadvantage),
  - `helped_attack` (outgoing attack advantage; consume-on-use),
  - `restrained` (incoming advantage + outgoing disadvantage + movement patch),
  - `invisible` (outgoing advantage + incoming disadvantage),
  - `blinded` (outgoing disadvantage + incoming advantage),
  - `poisoned` (outgoing disadvantage),
  - plus trigger/pipeline hooks for pre-attack, on-hit/miss, turn start/end.

- **Scaffolded (definition exists; full RAW behavior pending additional resolvers):**
  - `charmed`, `deafened`, `frightened`, `grappled`, `incapacitated`,
  - `paralyzed`, `petrified`, `prone`, `stunned`, `unconscious`, `exhaustion`,
  - `concentration_link` (relationship/inherited linkage scaffold).

- **Pending automation layers (planned):**
  - distance-aware prone interactions (melee vs ranged logic),
  - auto-crit constraints (e.g., paralyzed/unconscious close-range interactions),
  - action/reaction lock enforcement for incapacitation-family conditions,
  - full exhaustion-level penalties,
  - concentration break/check resolution and cleanup chaining,
  - damage-type resistance/immunity/vulnerability as persistent status-state math.

- **Compatibility notes:**
  - Effect ID aliases are supported for backward compatibility (example: `dodge` → `dodged`).
  - Rule-alignment guardrail comments are now present across status scaffold modules.

## Next 5 Highest-Value Condition Automations

- [ ] **Action lock enforcement:** wire `incapacitated`/`stunned`/`paralyzed`/`unconscious` into action + reaction availability gates.
- [ ] **Prone distance model:** add melee-vs-ranged attack modifier branching for `prone` with explicit distance/range inputs.
- [ ] **Auto-crit window rules:** implement close-range critical handling for `paralyzed` and `unconscious` targets.
- [ ] **Concentration checks + break chain:** add CON save trigger on damage and automatic cleanup of linked concentration effects.
- [ ] **Damage-type mitigation layer:** persist and apply resistance/immunity/vulnerability by damage type in resolver math (not only manual calculator modifiers).
