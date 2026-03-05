# Terminology Audit (Focused, Function-First)

This audit highlights high-ROI inconsistencies to address gradually, without risky broad renames.

## Current Strengths

- Core damage defense vocabulary is mostly standardized (`immunity`/`resistance`/`vulnerability`, damage types, qualifiers).
- Status condition IDs are aligned to canonical names.
- Replay and schema layers already capture most normalized combat metadata.

## Main Drift Patterns Found

### 1) AC/HP/DC aliases coexist in runtime paths

Examples in live code include fallback reads like:

- `armorClass ?? ac`
- `hitPoints || hp`
- `saveDc ?? dc ?? saveDC`

**Risk:** accidental persistence of alias keys in core runtime objects.

**Recommendation:**
- Keep these aliases only in import/adapter boundaries.
- Add helper normalizers and call them once per boundary.

### 2) Action naming and resource pluralization drift

Both singular runtime flags and plural imported buckets appear:

- `bonusAction` / `reaction` (runtime flags)
- `bonusActions` / `reactions` (action collections)

**Risk:** confusion during transform and replay expectations.

**Recommendation:**
- Keep plural for collections (`bonusActions`, `reactions`), singular for availability flags (`bonusAction`, `reaction`).
- Document this split explicitly where action objects are normalized.

### 3) Attack modifier aliases remain broad (good at boundary, noisy elsewhere)

Aliases include `toHit`, `attackBonus`, `hitBonus`, `to_hit`, `attackRollBonus`.

**Risk:** future code may read raw aliases directly instead of normalized `toHit`.

**Recommendation:**
- Preserve alias support only in importer/normalizer.
- Ensure downstream logic reads normalized `toHit` only.

### 4) Qualifier key duals are still necessary but should stay boundary-only

Patterns include `isMagical` + `magical`, `isSilvered` + `silvered`, `isAdamantine` + `adamantine`.

**Risk:** mixed key emission in downstream event payloads.

**Recommendation:**
- Normalize to `is*` keys before resolver/replay layers.
- Keep raw aliases accepted at ingestion only.

## Suggested Low-Risk Sequence (No Broad Renames)

1. **Boundary audit pass only**
   - Touch `pdf_parser.js`, `character_loader.js`, and action normalizers.
   - Ensure all outgoing normalized objects use canonical keys.

2. **Core assertion pass**
   - Add small guard checks in core adapters (warn when alias keys leak past boundary).

3. **Replay contract lock**
   - Add one fixture per critical canonical field (`armorClass`, `hitPoints`, `saveDc`, `toHit`, qualifiers).

4. **UI wording cleanup (optional)**
   - Keep player-facing abbreviations (`AC`, `HP`, `DC`) while preserving canonical internal keys.

## Immediate Savings If Applied

- Less adapter complexity over time.
- Fewer subtle key-mismatch bugs.
- Faster onboarding due to one canonical vocabulary map.

## Intentional Deferrals

- No mass rename of variables/symbols across the repo.
- No event namespace rewrite.
- No archive/snapshot modernization work.
