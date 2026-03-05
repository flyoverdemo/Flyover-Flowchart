# DMG/NEC Qualifier + Defense Log Smoke Checklist

## Goal
Quick manual click-through to verify:
- DMG/NEC actions surface qualifier metadata (`isMagical`, `isSilvered`, `isAdamantine`)
- Status pipeline defense log output is present and readable
- Guardrail hint appears when qualifier metadata is missing against qualified resistance

## Setup
1. Open the app and load a combatant that has a qualified resistance, for example:
   - `damageResistances: ["nonmagical slashing from non silvered weapons"]`
2. Open the Action Log window.
3. Keep browser DevTools open (Console) for debug hints.

## Path A — DMG with explicit qualifiers
1. Trigger a DMG action that deals `slashing` damage.
2. Ensure the action metadata includes one qualifier explicitly (example: `isSilvered: true`).
3. Confirm log entries:
   - A defense summary row: attacker → target, damage type, defense state, multiplier, base → final damage.
   - Detail panel includes the on-hit damage transformation.
4. Verify expected behavior:
   - For `nonmagical ... non silvered` resistance, `isSilvered: true` should bypass that resistance path.

## Path B — NEC with explicit qualifiers
1. Trigger an NEC action with a typed payload (example: `slashing` or `necrotic`) and explicit qualifiers.
2. Confirm the same defense summary row pattern appears.
3. Expand details and verify final damage reflects the defense multiplier.

## Path C — Missing qualifier metadata guardrail
1. Trigger a DMG or NEC hit against the same target without qualifier metadata keys.
2. Confirm two logs appear:
   - Normal defense summary row.
   - Debug hint row indicating qualifier metadata was missing while qualified resistance exists.
3. In DevTools Console, confirm the debug hint message from `StatusEffectsCore` also appears.

## DevTools Helper Snippet (Optional)
Use this in browser Console to simulate one on-hit event that should produce both rows in the Action Log bridge:

```javascript
window.dispatchEvent(new CustomEvent('status-pipeline:stage', {
   detail: {
      stage: 'on_hit',
      attackerId: 'primary_character',
      targetId: 'enemy_1',
      damageType: 'slashing',
      baseDamage: 10,
      modifiedDamage: 5,
      defenseState: 'resistant',
      defenseMultiplier: 0.5,
      qualifierMetadataMissingHint: true
   }
}));
```

Expected result in Action Log:
- One defense summary row (`Defense: ... RESISTANT (x0.5) | 10 → 5`)
- One debug hint row (`Defense Hint: Qualified resistance matched...`)

Use this second snippet to simulate an explicit-qualifier path where the debug hint should **not** appear:

```javascript
window.dispatchEvent(new CustomEvent('status-pipeline:stage', {
   detail: {
      stage: 'on_hit',
      attackerId: 'primary_character',
      targetId: 'enemy_1',
      damageType: 'slashing',
      baseDamage: 10,
      modifiedDamage: 10,
      defenseState: 'normal',
      defenseMultiplier: 1,
      isSilvered: true,
      qualifierMetadataMissingHint: false
   }
}));
```

Expected result in Action Log:
- One defense summary row (`Defense: ... NORMAL (x1) | 10 → 10`)
- No debug hint row for this event

## Pass Criteria
- Defense row appears for each on-hit event.
- Explicit qualifier paths produce expected defense state/multiplier outcomes.
- Missing qualifier metadata path emits exactly one guardrail hint per affected hit.
