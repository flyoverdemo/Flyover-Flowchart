# Terminology Contract (Function-First)

This project inherits data and code from multiple sources. To protect stability, this contract standardizes language at boundaries while keeping runtime behavior unchanged.

## Scope and Priority

1. **Runtime correctness first** (no large rename sweeps).
2. **Canonical terms in core logic** (status/rules/replay).
3. **Alias translation at import/adaptation boundaries only**.
4. **Incremental migration** (small patch + validation run each step).

## Product Naming vs Legacy Compatibility

- Canonical product name in live docs/UI/tool output: **Flyover Flowchart**.
- Current release label: **v0.0.6**.
- Legacy names (for example `Chain Warden`, `Google WIP`) are historical/internal labels only.
- Legacy schema/runtime compatibility keys (for example `chain_warden_v1`) remain valid until an explicit versioned migration plan replaces them.

## Canonical D&D Terms (2024 Glossary-Aligned)

Use these terms as the preferred labels in code comments, docs, UI labels, and normalized payloads.

- **Armor Class** (`armorClass`) — abbreviation `AC` for display only
- **Hit Points** (`hitPoints.current`, `hitPoints.max`, `hitPoints.temporary`) — abbreviation `HP` for display only
- **Difficulty Class** (`saveDc`) — abbreviation `DC` for display only
- **Action**, **Bonus Action**, **Reaction**
- **Attack Roll**, **Saving Throw**, **Ability Check** (all are D20 Tests)
- **Condition** names exactly: `blinded`, `charmed`, `deafened`, `frightened`, `grappled`, `incapacitated`, `invisible`, `paralyzed`, `petrified`, `poisoned`, `prone`, `restrained`, `stunned`, `unconscious`, `exhaustion`
- **Damage Type** values exactly: `acid`, `bludgeoning`, `cold`, `fire`, `force`, `lightning`, `necrotic`, `piercing`, `poison`, `psychic`, `radiant`, `slashing`, `thunder`
- **Immunity**, **Resistance**, **Vulnerability**

## Canonical Internal Keys

Prefer these keys in normalized/runtime objects:

- `armorClass` (not `ac` except UI shorthand/display)
- `hitPoints` (not `hp` except UI shorthand/display)
- `saveDc` (not `dc`/`saveDC` in normalized shape)
- `toHit` (normalized attack modifier key)
- `damageType`, `totalDamage`
- qualifier booleans: `isMagical`, `isSilvered`, `isAdamantine`
- resources: `action`, `bonusAction`, `reaction`

## Alias Policy (Boundary-Only)

Allowed aliases must be normalized when data crosses a boundary (import/parser/adapter):

- `ac` -> `armorClass`
- `hp` -> `hitPoints`
- `dc` / `saveDC` -> `saveDc`
- `attackBonus` / `hitBonus` / `to_hit` -> `toHit`
- `magical` -> `isMagical`
- `silvered` -> `isSilvered`
- `adamantine` -> `isAdamantine`

Do not propagate alias keys deeper into core runtime models.

## Naming Style Rules

- Files: lowercase `snake_case` for new modules.
- Variables/functions: descriptive camelCase; avoid one-letter names.
- Events: existing event names remain stable unless a migration plan includes adapters.

## Change Control Rules

For terminology changes:

1. Update adapter/normalizer first.
2. Keep backward compatibility aliases.
3. Add/adjust replay fixture or invariant if behavior is affected.
4. Run replay suite after each step.

## Non-Goals (for now)

- No bulk global renaming of all variables.
- No large event-name refactor.
- No UI text rewrites beyond ambiguity fixes.
