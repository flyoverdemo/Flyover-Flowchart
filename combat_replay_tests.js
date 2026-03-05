(function attachCombatReplayTests(globalScope) {
  // Utility: deep clone for stable fixture comparisons and event/state snapshots.
  function deepClone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  function isObjectLike(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  // Recursive structural diff used to compare expected fixture state against reducer output.
  function diffStates(actual, expected, pathPrefix = '') {
    const mismatches = [];

    if (Array.isArray(expected)) {
      if (!Array.isArray(actual)) {
        mismatches.push({ path: pathPrefix || '(root)', expected, actual });
        return mismatches;
      }
      const maxLength = Math.max(actual.length, expected.length);
      for (let index = 0; index < maxLength; index++) {
        const nextPath = `${pathPrefix}[${index}]`;
        if (index >= actual.length || index >= expected.length) {
          mismatches.push({ path: nextPath, expected: expected[index], actual: actual[index] });
          continue;
        }
        mismatches.push(...diffStates(actual[index], expected[index], nextPath));
      }
      return mismatches;
    }

    if (isObjectLike(expected)) {
      if (!isObjectLike(actual)) {
        mismatches.push({ path: pathPrefix || '(root)', expected, actual });
        return mismatches;
      }
      const keySet = new Set([...Object.keys(expected), ...Object.keys(actual)]);
      keySet.forEach((key) => {
        const nextPath = pathPrefix ? `${pathPrefix}.${key}` : key;
        if (!Object.prototype.hasOwnProperty.call(actual, key) || !Object.prototype.hasOwnProperty.call(expected, key)) {
          mismatches.push({ path: nextPath, expected: expected[key], actual: actual[key] });
          return;
        }
        mismatches.push(...diffStates(actual[key], expected[key], nextPath));
      });
      return mismatches;
    }

    if (actual !== expected) {
      mismatches.push({ path: pathPrefix || '(root)', expected, actual });
    }

    return mismatches;
  }

  // Default invariants for deterministic replay state integrity.
  function defaultInvariantChecks(state) {
    const violations = [];
    const hp = state?.combat?.hitPoints || {};
    const current = Number(hp.current);
    const max = Number(hp.max);
    const temporary = Number(hp.temporary);

    if (Number.isFinite(current) && current < 0) {
      violations.push({ code: 'hp_current_negative', message: 'HP current cannot be negative.', value: current });
    }
    if (Number.isFinite(temporary) && temporary < 0) {
      violations.push({ code: 'hp_temporary_negative', message: 'Temp HP cannot be negative.', value: temporary });
    }
    if (Number.isFinite(max) && max < 0) {
      violations.push({ code: 'hp_max_negative', message: 'HP max cannot be negative.', value: max });
    }
    if (Number.isFinite(current) && Number.isFinite(max) && current > max) {
      violations.push({ code: 'hp_current_exceeds_max', message: 'HP current exceeds HP max.', current, max });
    }

    const damageEventsCount = Number(state?.damageEventsCount);
    const attackResolvedEventsCount = Number(state?.attackResolvedEventsCount);
    const statusEffectEventsCount = Number(state?.statusEffectEventsCount);
    const statusPipelineStageEventsCount = Number(state?.statusPipelineStageEventsCount);
    const statusTriggerEventsCount = Number(state?.statusTriggerEventsCount);
    const radRollEventsCount = Number(state?.radRollEventsCount);
    const saveDcEventsCount = Number(state?.saveDcEventsCount);
    if (Number.isFinite(damageEventsCount) && damageEventsCount < 0) {
      violations.push({ code: 'damage_count_negative', message: 'Damage event count cannot be negative.', value: damageEventsCount });
    }
    if (Number.isFinite(attackResolvedEventsCount) && attackResolvedEventsCount < 0) {
      violations.push({ code: 'attack_resolved_count_negative', message: 'Attack resolved event count cannot be negative.', value: attackResolvedEventsCount });
    }
    if (Number.isFinite(statusEffectEventsCount) && statusEffectEventsCount < 0) {
      violations.push({ code: 'status_effect_count_negative', message: 'Status effect event count cannot be negative.', value: statusEffectEventsCount });
    }
    if (Number.isFinite(statusPipelineStageEventsCount) && statusPipelineStageEventsCount < 0) {
      violations.push({ code: 'status_pipeline_stage_count_negative', message: 'Status pipeline stage count cannot be negative.', value: statusPipelineStageEventsCount });
    }
    if (Number.isFinite(statusTriggerEventsCount) && statusTriggerEventsCount < 0) {
      violations.push({ code: 'status_trigger_count_negative', message: 'Status trigger event count cannot be negative.', value: statusTriggerEventsCount });
    }
    if (Number.isFinite(radRollEventsCount) && radRollEventsCount < 0) {
      violations.push({ code: 'rad_count_negative', message: 'RAD roll event count cannot be negative.', value: radRollEventsCount });
    }
    if (Number.isFinite(saveDcEventsCount) && saveDcEventsCount < 0) {
      violations.push({ code: 'save_dc_count_negative', message: 'Save DC event count cannot be negative.', value: saveDcEventsCount });
    }

    return violations;
  }

  // Stricter invariants for CI/debug gating beyond baseline safety checks.
  function strictInvariantChecks(state) {
    const violations = [];
    const hp = state?.combat?.hitPoints || {};
    const resourceState = state?.resources || {};

    const hpCurrent = hp.current;
    const hpMax = hp.max;
    const hpTemporary = hp.temporary;
    if (hpCurrent !== null && hpCurrent !== undefined && !Number.isInteger(Number(hpCurrent))) {
      violations.push({ code: 'hp_current_not_integer', message: 'HP current must be an integer when set.', value: hpCurrent });
    }
    if (hpMax !== null && hpMax !== undefined && !Number.isInteger(Number(hpMax))) {
      violations.push({ code: 'hp_max_not_integer', message: 'HP max must be an integer when set.', value: hpMax });
    }
    if (hpTemporary !== null && hpTemporary !== undefined && !Number.isInteger(Number(hpTemporary))) {
      violations.push({ code: 'hp_temporary_not_integer', message: 'Temp HP must be an integer when set.', value: hpTemporary });
    }

    ['action', 'bonusAction', 'reaction', 'freeObjectInteraction'].forEach((key) => {
      if (typeof resourceState[key] !== 'boolean') {
        violations.push({
          code: 'resource_not_boolean',
          message: `Resource flag "${key}" must be boolean.`,
          key,
          value: resourceState[key]
        });
      }
    });

    const damageEventsCount = Number(state?.damageEventsCount);
    const attackResolvedEventsCount = Number(state?.attackResolvedEventsCount);
    const statusEffectEventsCount = Number(state?.statusEffectEventsCount);
    const statusPipelineStageEventsCount = Number(state?.statusPipelineStageEventsCount);
    const statusTriggerEventsCount = Number(state?.statusTriggerEventsCount);
    const radRollEventsCount = Number(state?.radRollEventsCount);
    const saveDcEventsCount = Number(state?.saveDcEventsCount);
    if (state?.lastStatusEffectEvent && (!Number.isFinite(statusEffectEventsCount) || statusEffectEventsCount < 1)) {
      violations.push({ code: 'status_effect_last_event_without_count', message: 'lastStatusEffectEvent exists but statusEffectEventsCount is not >= 1.' });
    }
    if (state?.lastStatusPipelineStageEvent && (!Number.isFinite(statusPipelineStageEventsCount) || statusPipelineStageEventsCount < 1)) {
      violations.push({ code: 'status_pipeline_stage_last_event_without_count', message: 'lastStatusPipelineStageEvent exists but statusPipelineStageEventsCount is not >= 1.' });
    }
    if (state?.lastStatusTriggerEvent && (!Number.isFinite(statusTriggerEventsCount) || statusTriggerEventsCount < 1)) {
      violations.push({ code: 'status_trigger_last_event_without_count', message: 'lastStatusTriggerEvent exists but statusTriggerEventsCount is not >= 1.' });
    }
    if (state?.lastAttackResolvedEvent && (!Number.isFinite(attackResolvedEventsCount) || attackResolvedEventsCount < 1)) {
      violations.push({ code: 'attack_resolved_last_event_without_count', message: 'lastAttackResolvedEvent exists but attackResolvedEventsCount is not >= 1.' });
    }
    if (state?.lastDamageEvent && (!Number.isFinite(damageEventsCount) || damageEventsCount < 1)) {
      violations.push({ code: 'damage_last_event_without_count', message: 'lastDamageEvent exists but damageEventsCount is not >= 1.' });
    }
    if (state?.lastRadRollEvent && (!Number.isFinite(radRollEventsCount) || radRollEventsCount < 1)) {
      violations.push({ code: 'rad_last_event_without_count', message: 'lastRadRollEvent exists but radRollEventsCount is not >= 1.' });
    }
    if (state?.lastSaveDcEvent && (!Number.isFinite(saveDcEventsCount) || saveDcEventsCount < 1)) {
      violations.push({ code: 'save_dc_last_event_without_count', message: 'lastSaveDcEvent exists but saveDcEventsCount is not >= 1.' });
    }

    return violations;
  }

  // Evaluates qualifier-aware defense logic directly through StatusEffectsCore adapters.
  function evaluateStatusEffectsCoreDefenseFixture(payload = {}) {
    const adapter = globalScope.StatusEffectsCore?.adapters;
    if (!adapter || typeof adapter.evaluateCombatantDamageDefense !== 'function') {
      return {
        ok: false,
        reason: 'status-effects-adapter-unavailable',
        evaluation: null
      };
    }

    const combatantId = String(payload.combatantId || 'fixture_target');
    const profile = {
      damageResistances: Array.isArray(payload.damageResistances) ? payload.damageResistances : []
    };

    const evaluation = adapter.evaluateCombatantDamageDefense({
      combatantId,
      damageType: payload.damageType,
      isMagical: payload.isMagical === true,
      isSilvered: payload.isSilvered === true,
      isAdamantine: payload.isAdamantine === true,
      storeState: {
        definitions: {},
        activeEffects: [],
        defenseProfiles: {
          [combatantId]: profile
        }
      }
    }, 'test:status-effects-defense-eval');

    const expectedState = String(payload.expectedState || 'normal');
    const expectedMultiplier = Number(payload.expectedMultiplier);

    return {
      ok: String(evaluation?.state || '') === expectedState
        && (!Number.isFinite(expectedMultiplier) || Number(evaluation?.multiplier) === expectedMultiplier),
      reason: 'evaluation-mismatch',
      evaluation
    };
  }

  function createDefenseBypassInvariant(payload = {}) {
    return function defenseBypassInvariant() {
      const result = evaluateStatusEffectsCoreDefenseFixture(payload);
      if (result.ok) return [];
      return [{
        code: 'status_effects_defense_eval_mismatch',
        message: `Expected ${payload.expectedState} x${payload.expectedMultiplier}, got ${result.evaluation?.state} x${result.evaluation?.multiplier}`,
        details: result.evaluation
      }];
    };
  }

  // Executes default and optional custom invariant checks against final fixture state.
  function runInvariantChecks(state, options = {}) {
    const customInvariantChecks = Array.isArray(options.invariantChecks) ? options.invariantChecks : [];
    const includeDefaultInvariants = options.includeDefaultInvariants !== false;
    const checks = [];
    if (includeDefaultInvariants) {
      checks.push(defaultInvariantChecks);
    }
    checks.push(...customInvariantChecks.filter((checkFn) => typeof checkFn === 'function'));

    const violations = [];
    checks.forEach((checkFn) => {
      try {
        const checkViolations = checkFn(state, options);
        if (Array.isArray(checkViolations)) {
          checkViolations.forEach((violation) => {
            if (violation && typeof violation === 'object') {
              violations.push(violation);
            }
          });
        }
      } catch (error) {
        violations.push({
          code: 'invariant_check_exception',
          message: 'Invariant check threw an exception.',
          error: String(error?.message || error)
        });
      }
    });

    return violations;
  }

  // Validates replay events against optional schema validators (used for combatant link scaffolding).
  function runEventSchemaChecks(events = [], options = {}) {
    const eventList = Array.isArray(events) ? events : [];
    const customSchemaValidator = typeof options.schemaValidator === 'function'
      ? options.schemaValidator
      : null;
    const globalSchemaValidator = typeof globalScope.CombatantLinkSchema?.validateEvent === 'function'
      ? globalScope.CombatantLinkSchema.validateEvent
      : null;
    const schemaValidator = customSchemaValidator || globalSchemaValidator;

    if (typeof schemaValidator !== 'function') {
      return [];
    }

    const violations = [];
    eventList.forEach((event, index) => {
      try {
        const result = schemaValidator(event, options) || null;
        if (result && result.ok === false) {
          violations.push({
            index,
            type: String(event?.type || 'UNKNOWN'),
            errors: Array.isArray(result.errors) ? result.errors : [],
            event: deepClone(event)
          });
        }
      } catch (error) {
        violations.push({
          index,
          type: String(event?.type || 'UNKNOWN'),
          errors: [{ code: 'schema_validator_exception', message: String(error?.message || error) }],
          event: deepClone(event)
        });
      }
    });

    return violations;
  }

  // Runs a single fixture end-to-end and captures mismatch + first-failing-event diagnostics.
  function runFixture(fixture, options = {}) {
    const reducer = typeof options.reducer === 'function'
      ? options.reducer
      : globalScope.CombatReplayLog?.defaultCombatReducer;
    const createInitialState = typeof options.createInitialState === 'function'
      ? options.createInitialState
      : globalScope.CombatReplayLog?.createInitialReplayState;

    if (typeof reducer !== 'function' || typeof createInitialState !== 'function') {
      return {
        ok: false,
        name: fixture?.name || 'unknown-fixture',
        reason: 'missing-reducer-or-initial-state-factory',
        mismatches: []
      };
    }

    const events = Array.isArray(fixture?.events) ? fixture.events : [];
    const initialState = fixture?.initialState ? deepClone(fixture.initialState) : createInitialState();
    const expectedState = fixture?.expectedState ? deepClone(fixture.expectedState) : null;

    const eventHistory = [deepClone(initialState)];
    const eventSnapshots = [];
    let runningState = deepClone(initialState);
    events.forEach((event, index) => {
      runningState = reducer(runningState, event);
      const stateSnapshot = deepClone(runningState);
      eventHistory.push(stateSnapshot);
      eventSnapshots.push({
        index,
        event: deepClone(event),
        state: stateSnapshot
      });
    });

    const actualState = deepClone(runningState);
    const mismatches = expectedState ? diffStates(actualState, expectedState) : [];
    const invariantViolations = runInvariantChecks(actualState, {
      includeDefaultInvariants: fixture?.includeDefaultInvariants !== false,
      invariantChecks: Array.isArray(fixture?.invariantChecks) ? fixture.invariantChecks : options.invariantChecks
    });
    const schemaViolations = runEventSchemaChecks(events, {
      schemaValidator: typeof fixture?.schemaValidator === 'function' ? fixture.schemaValidator : options.schemaValidator
    });

    let firstFailingEventIndex = null;
    let firstFailingEvent = null;
    let firstFailingEventState = null;
    let firstFailingEventMismatches = [];
    if (expectedState && mismatches.length > 0) {
      for (let index = 0; index < eventHistory.length; index++) {
        const prefixMismatches = diffStates(eventHistory[index], expectedState);
        if (prefixMismatches.length > 0) {
          firstFailingEventIndex = index === 0 ? -1 : (index - 1);
          firstFailingEvent = firstFailingEventIndex >= 0 ? deepClone(events[firstFailingEventIndex]) : null;
          firstFailingEventState = deepClone(eventHistory[index]);
          firstFailingEventMismatches = prefixMismatches;
          break;
        }
      }
    }

    return {
      ok: (expectedState ? mismatches.length === 0 : true) && invariantViolations.length === 0 && schemaViolations.length === 0,
      name: fixture?.name || 'unnamed-fixture',
      context: fixture?.context || null,
      eventCount: events.length,
      mismatches,
      invariantViolations,
      schemaViolations,
      firstFailingEventIndex,
      firstFailingEvent,
      firstFailingEventState,
      firstFailingEventMismatches,
      eventSnapshots,
      actualState,
      expectedState
    };
  }

  // Runs the fixture list sequentially with optional stop-on-first-failure behavior.
  function runSuite(fixtures = [], options = {}) {
    const fixtureList = Array.isArray(fixtures) ? fixtures : [];
    const stopOnFirstFailure = !!options.stopOnFirstFailure;
    const reports = [];
    for (const fixture of fixtureList) {
      const report = runFixture(fixture, options);
      reports.push(report);
      if (stopOnFirstFailure && !report.ok) {
        break;
      }
    }
    const failed = reports.filter((entry) => !entry.ok);

    return {
      ok: failed.length === 0,
      fixtureCount: reports.length,
      failedCount: failed.length,
      reports
    };
  }

  // Provides a baseline deterministic suite covering HP/resources/metadata turn chains.
  function createDefaultFixtures(createInitialState = globalScope.CombatReplayLog?.createInitialReplayState) {
    const buildInitial = typeof createInitialState === 'function'
      ? createInitialState
      : (() => ({
        combat: {
          armorClass: null,
          initiativeModifier: 0,
          initiativeRolled: null,
          hitPoints: { current: null, max: null, temporary: 0 }
        },
        resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
        lastDamageEvent: null,
        damageEventsCount: 0,
        lastAttackResolvedEvent: null,
        attackResolvedEventsCount: 0,
        lastStatusEffectEvent: null,
        statusEffectEventsCount: 0,
        lastStatusPipelineStageEvent: null,
        statusPipelineStageEventsCount: 0,
        lastStatusTriggerEvent: null,
        statusTriggerEventsCount: 0,
        lastRadRollEvent: null,
        radRollEventsCount: 0,
        lastSaveDcEvent: null,
        saveDcEventsCount: 0
      }));

    return [
      {
        name: 'hp_damage_uses_temp_then_current',
        context: 'phase4:fixture:hp-damage',
        events: [
          { type: 'SET_HP', payload: { current: 20, max: 20, temporary: 5 } },
          { type: 'DAMAGE_APPLIED', payload: { amount: 7, useTempHp: true } }
        ],
        expectedState: {
          ...buildInitial(),
          combat: {
            ...buildInitial().combat,
            hitPoints: {
              current: 18,
              max: 20,
              temporary: 0
            }
          },
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: null,
          damageEventsCount: 0,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'hp_heal_clamps_to_max',
        context: 'phase4:fixture:hp-heal',
        events: [
          { type: 'SET_HP', payload: { current: 6, max: 10, temporary: 0 } },
          { type: 'HEAL_APPLIED', payload: { amount: 8, allowOverheal: false } }
        ],
        expectedState: {
          ...buildInitial(),
          combat: {
            ...buildInitial().combat,
            hitPoints: {
              current: 10,
              max: 10,
              temporary: 0
            }
          },
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: null,
          damageEventsCount: 0,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'damage_resolved_metadata_tracks_count',
        context: 'phase4:fixture:damage-metadata',
        events: [
          { type: 'DAMAGE_RESOLVED', payload: { actionId: 'card-0', actionName: 'Unarmed Attack', damageType: 'bludgeoning', totalDamage: 4 } },
          { type: 'DAMAGE_RESOLVED', payload: { actionId: 'card-1', actionName: 'Divine Unarmed', damageType: 'radiant', totalDamage: 6 } }
        ],
        expectedState: {
          ...buildInitial(),
          combat: {
            ...buildInitial().combat,
            hitPoints: {
              current: null,
              max: null,
              temporary: 0
            }
          },
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: {
            actionId: 'card-1',
            actionName: 'Divine Unarmed',
            damageType: 'radiant',
            totalDamage: 6
          },
          damageEventsCount: 2,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'damage_resolved_tracks_immune_defense_outcome',
        context: 'phase4:fixture:damage-defense-immune',
        events: [
          {
            type: 'DAMAGE_RESOLVED',
            payload: {
              actionId: 'card-0',
              actionName: 'Unarmed Attack',
              damageType: 'poison',
              totalDamage: 0,
              defenseState: 'immune',
              defenseMultiplier: 0,
              isMagical: false,
              isSilvered: false,
              isAdamantine: false
            }
          }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: {
            actionId: 'card-0',
            actionName: 'Unarmed Attack',
            damageType: 'poison',
            totalDamage: 0,
            defenseState: 'immune',
            defenseMultiplier: 0,
            isMagical: false,
            isSilvered: false,
            isAdamantine: false
          },
          damageEventsCount: 1,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'damage_resolved_tracks_resistant_defense_outcome',
        context: 'phase4:fixture:damage-defense-resistant',
        events: [
          {
            type: 'DAMAGE_RESOLVED',
            payload: {
              actionId: 'card-0',
              actionName: 'Unarmed Attack',
              damageType: 'bludgeoning',
              totalDamage: 3,
              defenseState: 'resistant',
              defenseMultiplier: 0.5,
              isMagical: false,
              isSilvered: false,
              isAdamantine: false
            }
          }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: {
            actionId: 'card-0',
            actionName: 'Unarmed Attack',
            damageType: 'bludgeoning',
            totalDamage: 3,
            defenseState: 'resistant',
            defenseMultiplier: 0.5,
            isMagical: false,
            isSilvered: false,
            isAdamantine: false
          },
          damageEventsCount: 1,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'damage_resolved_tracks_vulnerable_defense_outcome',
        context: 'phase4:fixture:damage-defense-vulnerable',
        events: [
          {
            type: 'DAMAGE_RESOLVED',
            payload: {
              actionId: 'card-0',
              actionName: 'Unarmed Attack',
              damageType: 'radiant',
              totalDamage: 10,
              defenseState: 'vulnerable',
              defenseMultiplier: 2,
              isMagical: true,
              isSilvered: false,
              isAdamantine: false
            }
          }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: {
            actionId: 'card-0',
            actionName: 'Unarmed Attack',
            damageType: 'radiant',
            totalDamage: 10,
            defenseState: 'vulnerable',
            defenseMultiplier: 2,
            isMagical: true,
            isSilvered: false,
            isAdamantine: false
          },
          damageEventsCount: 1,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'damage_resolved_necrotic_preserves_qualifier_flags',
        context: 'phase4:fixture:damage-necrotic-qualifiers',
        events: [
          {
            type: 'DAMAGE_RESOLVED',
            payload: {
              actionId: 'nec_damage_action',
              actionName: 'Necrotic Effect',
              damageType: 'necrotic',
              totalDamage: 7,
              isMagical: true,
              isSilvered: false,
              isAdamantine: false
            }
          }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: {
            actionId: 'nec_damage_action',
            actionName: 'Necrotic Effect',
            damageType: 'necrotic',
            totalDamage: 7,
            isMagical: true,
            isSilvered: false,
            isAdamantine: false
          },
          damageEventsCount: 1,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'damage_resolved_silvered_preserves_qualifier_flags',
        context: 'phase4:fixture:damage-silvered-qualifiers',
        events: [
          {
            type: 'DAMAGE_RESOLVED',
            payload: {
              actionId: 'silvered_slash_action',
              actionName: 'Silvered Slash',
              damageType: 'slashing',
              totalDamage: 5,
              isMagical: false,
              isSilvered: true,
              isAdamantine: false
            }
          }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: {
            actionId: 'silvered_slash_action',
            actionName: 'Silvered Slash',
            damageType: 'slashing',
            totalDamage: 5,
            isMagical: false,
            isSilvered: true,
            isAdamantine: false
          },
          damageEventsCount: 1,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'damage_resolved_adamantine_preserves_qualifier_flags',
        context: 'phase4:fixture:damage-adamantine-qualifiers',
        events: [
          {
            type: 'DAMAGE_RESOLVED',
            payload: {
              actionId: 'adamantine_strike_action',
              actionName: 'Adamantine Strike',
              damageType: 'bludgeoning',
              totalDamage: 6,
              isMagical: false,
              isSilvered: false,
              isAdamantine: true
            }
          }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: {
            actionId: 'adamantine_strike_action',
            actionName: 'Adamantine Strike',
            damageType: 'bludgeoning',
            totalDamage: 6,
            isMagical: false,
            isSilvered: false,
            isAdamantine: true
          },
          damageEventsCount: 1,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'status_effects_core_silvered_bypass_resistance',
        context: 'phase4:fixture:status-effects-core-silvered-bypass',
        events: [],
        invariantChecks: [
          createDefenseBypassInvariant({
            combatantId: 'enemy_1',
            damageType: 'slashing',
            isMagical: false,
            isSilvered: true,
            isAdamantine: false,
            damageResistances: ['nonmagical slashing from non silvered weapons'],
            expectedState: 'normal',
            expectedMultiplier: 1
          })
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: null,
          damageEventsCount: 0,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'status_effects_core_adamantine_bypass_resistance',
        context: 'phase4:fixture:status-effects-core-adamantine-bypass',
        events: [],
        invariantChecks: [
          createDefenseBypassInvariant({
            combatantId: 'enemy_1',
            damageType: 'bludgeoning',
            isMagical: false,
            isSilvered: false,
            isAdamantine: true,
            damageResistances: ['nonmagical bludgeoning from non adamantine weapons'],
            expectedState: 'normal',
            expectedMultiplier: 1
          })
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: null,
          damageEventsCount: 0,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'status_pipeline_stage_tracks_resist_vuln_conflict_outcome',
        context: 'phase4:fixture:status-pipeline-defense-conflict',
        events: [
          {
            type: 'STATUS_PIPELINE_STAGE',
            payload: {
              stage: 'on_hit',
              attackerId: 'primary_character',
              targetId: 'enemy_1',
              damageType: 'fire',
              defenseState: 'resistant_and_vulnerable',
              defenseMultiplier: 1
            }
          }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: null,
          damageEventsCount: 0,
          lastStatusPipelineStageEvent: {
            stage: 'on_hit',
            attackerId: 'primary_character',
            targetId: 'enemy_1',
            damageType: 'fire',
            defenseState: 'resistant_and_vulnerable',
            defenseMultiplier: 1
          },
          statusPipelineStageEventsCount: 1,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'status_pipeline_stage_tracks_missing_qualifier_hint_flag',
        context: 'phase4:fixture:status-pipeline-missing-qualifier-hint',
        events: [
          {
            type: 'STATUS_PIPELINE_STAGE',
            payload: {
              stage: 'on_hit',
              attackerId: 'primary_character',
              targetId: 'enemy_1',
              damageType: 'slashing',
              defenseState: 'resistant',
              defenseMultiplier: 0.5,
              qualifierMetadataMissingHint: true
            }
          }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: null,
          damageEventsCount: 0,
          lastStatusPipelineStageEvent: {
            stage: 'on_hit',
            attackerId: 'primary_character',
            targetId: 'enemy_1',
            damageType: 'slashing',
            defenseState: 'resistant',
            defenseMultiplier: 0.5,
            qualifierMetadataMissingHint: true
          },
          statusPipelineStageEventsCount: 1,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'status_pipeline_stage_qualifier_hint_flag_drives_debug_log_bridge_contract',
        context: 'phase4:fixture:status-pipeline-debug-hint-bridge',
        events: [
          {
            type: 'STATUS_PIPELINE_STAGE',
            payload: {
              stage: 'on_hit',
              attackerId: 'primary_character',
              targetId: 'enemy_1',
              damageType: 'slashing',
              defenseState: 'normal',
              defenseMultiplier: 1,
              qualifierMetadataMissingHint: true
            }
          }
        ],
        invariantChecks: [
          (state) => {
            const stageEvent = state?.lastStatusPipelineStageEvent || {};
            if (
              String(stageEvent.stage || '') === 'on_hit'
              && stageEvent.qualifierMetadataMissingHint === true
            ) {
              return [];
            }
            return [{
              code: 'missing_debug_log_bridge_hint_contract',
              message: 'Expected on_hit stage event with qualifierMetadataMissingHint=true so UI log bridge can emit debug hint row.',
              details: stageEvent
            }];
          }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: null,
          damageEventsCount: 0,
          lastStatusPipelineStageEvent: {
            stage: 'on_hit',
            attackerId: 'primary_character',
            targetId: 'enemy_1',
            damageType: 'slashing',
            defenseState: 'normal',
            defenseMultiplier: 1,
            qualifierMetadataMissingHint: true
          },
          statusPipelineStageEventsCount: 1,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'rad_roll_tracks_last_event_and_count',
        context: 'phase4:fixture:rad-roll',
        events: [
          { type: 'RAD_ROLL', payload: { actionId: 'card-1', actionName: 'Divine Unarmed', roll: 12, modifier: 4, total: 16 } },
          { type: 'RAD_ROLL', payload: { actionId: 'card-1', actionName: 'Divine Unarmed', roll: 8, modifier: 4, total: 12 } }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: null,
          damageEventsCount: 0,
          lastRadRollEvent: {
            actionId: 'card-1',
            actionName: 'Divine Unarmed',
            roll: 8,
            modifier: 4,
            total: 12
          },
          radRollEventsCount: 2,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'save_dc_tracks_last_event_and_count',
        context: 'phase4:fixture:save-dc',
        events: [
          { type: 'SAVE_DC_RESOLVED', payload: { actionId: 'card-2', actionName: 'Blight Unarmed', saveDc: 14, saveType: 'constitution' } }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: null,
          damageEventsCount: 0,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: {
            actionId: 'card-2',
            actionName: 'Blight Unarmed',
            saveDc: 14,
            saveType: 'constitution'
          },
          saveDcEventsCount: 1
        }
      },
      {
        name: 'save_dc_resolved_prefers_canonical_saveDc_over_alias',
        context: 'phase4:fixture:save-dc-canonical-precedence',
        events: [
          { type: 'SAVE_DC_RESOLVED', payload: { actionId: 'card-2', actionName: 'Blight Unarmed', saveDc: 15, saveDC: 9, saveType: 'constitution' } }
        ],
        invariantChecks: [
          (state) => {
            const saveEvent = state?.lastSaveDcEvent || {};
            if (saveEvent.saveDc === 15 && saveEvent.saveDC === undefined) {
              return [];
            }
            return [{
              code: 'save_dc_canonical_contract_violation',
              message: 'Expected canonical saveDc field to be retained and non-canonical saveDC to be absent in replay state.',
              details: saveEvent
            }];
          }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: null,
          damageEventsCount: 0,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: {
            actionId: 'card-2',
            actionName: 'Blight Unarmed',
            saveDc: 15,
            saveType: 'constitution'
          },
          saveDcEventsCount: 1
        }
      },
      {
        name: 'damage_resolved_retains_canonical_damageType_when_alias_present',
        context: 'phase4:fixture:damage-type-canonical-precedence',
        events: [
          {
            type: 'DAMAGE_RESOLVED',
            payload: {
              actionId: 'card-0',
              actionName: 'Unarmed Attack',
              damageType: 'bludgeoning',
              damage_type: 'fire',
              totalDamage: 4
            }
          }
        ],
        invariantChecks: [
          (state) => {
            const damageEvent = state?.lastDamageEvent || {};
            if (damageEvent.damageType === 'bludgeoning' && damageEvent.damage_type === undefined) {
              return [];
            }
            return [{
              code: 'damage_type_canonical_contract_violation',
              message: 'Expected canonical damageType to be retained and non-canonical damage_type to be absent in replay state.',
              details: damageEvent
            }];
          }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: {
            actionId: 'card-0',
            actionName: 'Unarmed Attack',
            damageType: 'bludgeoning',
            totalDamage: 4
          },
          damageEventsCount: 1,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'turn_chain_unarmed_damage_apply_and_save',
        context: 'phase4:fixture:turn-chain-unarmed',
        events: [
          { type: 'SET_HP', payload: { current: 18, max: 24, temporary: 2 } },
          { type: 'SPEND_RESOURCE', payload: { key: 'action' } },
          { type: 'ATTACK_ROLL', payload: { actionId: 'card-0', actionName: 'Unarmed Attack', roll: 14, toHit: 6, attackTotal: 20, hit: true } },
          { type: 'DAMAGE_RESOLVED', payload: { actionId: 'card-0', actionName: 'Unarmed Attack', damageType: 'bludgeoning', totalDamage: 5 } },
          { type: 'DAMAGE_APPLIED', payload: { amount: 5, useTempHp: true } },
          { type: 'SAVE_DC_RESOLVED', payload: { actionId: 'card-2', actionName: 'Blight Unarmed', saveDc: 13, saveType: 'constitution' } }
        ],
        expectedState: {
          ...buildInitial(),
          combat: {
            ...buildInitial().combat,
            hitPoints: {
              current: 15,
              max: 24,
              temporary: 0
            }
          },
          resources: { action: false, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: {
            actionId: 'card-0',
            actionName: 'Unarmed Attack',
            damageType: 'bludgeoning',
            totalDamage: 5
          },
          damageEventsCount: 1,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: {
            actionId: 'card-2',
            actionName: 'Blight Unarmed',
            saveDc: 13,
            saveType: 'constitution'
          },
          saveDcEventsCount: 1
        }
      },
      {
        name: 'turn_chain_rad_then_necrotic_with_heal',
        context: 'phase4:fixture:turn-chain-rad-nec',
        events: [
          { type: 'SET_HP', payload: { current: 9, max: 15, temporary: 0 } },
          { type: 'RAD_ROLL', payload: { actionId: 'card-1', actionName: 'Divine Unarmed', roll: 17, modifier: 4, total: 21 } },
          { type: 'DAMAGE_RESOLVED', payload: { actionId: 'card-2', actionName: 'Blight Unarmed', damageType: 'necrotic', totalDamage: 3 } },
          { type: 'DAMAGE_APPLIED', payload: { amount: 3, useTempHp: true } },
          { type: 'HEAL_APPLIED', payload: { amount: 2, allowOverheal: false } },
          { type: 'RESTORE_RESOURCE', payload: { key: 'action' } }
        ],
        expectedState: {
          ...buildInitial(),
          combat: {
            ...buildInitial().combat,
            hitPoints: {
              current: 8,
              max: 15,
              temporary: 0
            }
          },
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: {
            actionId: 'card-2',
            actionName: 'Blight Unarmed',
            damageType: 'necrotic',
            totalDamage: 3
          },
          damageEventsCount: 1,
          lastRadRollEvent: {
            actionId: 'card-1',
            actionName: 'Divine Unarmed',
            roll: 17,
            modifier: 4,
            total: 21
          },
          radRollEventsCount: 1,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'attack_resolved_links_attacker_and_target',
        context: 'postphase:fixture:combatant-links-hit',
        events: [
          {
            type: 'ATTACK_RESOLVED',
            payload: {
              attackerId: 'primary_character',
              targetId: 'enemy_1',
              actionId: 'card-0',
              actionName: 'Unarmed Attack',
              attackTotal: 18,
              targetAc: 12,
              hit: true
            }
          }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: null,
          damageEventsCount: 0,
          lastAttackResolvedEvent: {
            attackerId: 'primary_character',
            targetId: 'enemy_1',
            actionId: 'card-0',
            actionName: 'Unarmed Attack',
            attackTotal: 18,
            targetAc: 12,
            hit: true
          },
          attackResolvedEventsCount: 1,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'attack_resolved_links_attacker_and_target_miss',
        context: 'postphase:fixture:combatant-links-miss',
        events: [
          {
            type: 'ATTACK_RESOLVED',
            payload: {
              attackerId: 'enemy_1',
              targetId: 'primary_character',
              actionId: 'enemy_slash',
              actionName: 'Scimitar',
              attackTotal: 10,
              targetAc: 16,
              hit: false
            }
          }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: null,
          damageEventsCount: 0,
          lastAttackResolvedEvent: {
            attackerId: 'enemy_1',
            targetId: 'primary_character',
            actionId: 'enemy_slash',
            actionName: 'Scimitar',
            attackTotal: 10,
            targetAc: 16,
            hit: false
          },
          attackResolvedEventsCount: 1,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'attack_damage_chain_links_attacker_target_route',
        context: 'postphase:fixture:combatant-route-chain',
        events: [
          { type: 'SET_HP', payload: { current: 14, max: 20, temporary: 0 } },
          {
            type: 'ATTACK_RESOLVED',
            payload: {
              attackerId: 'primary_character',
              targetId: 'enemy_1',
              actionId: 'card-0',
              actionName: 'Unarmed Attack',
              attackTotal: 17,
              targetAc: 12,
              hit: true
            }
          },
          {
            type: 'DAMAGE_RESOLVED',
            payload: {
              attackerId: 'primary_character',
              targetId: 'enemy_1',
              actionId: 'card-0',
              actionName: 'Unarmed Attack',
              damageType: 'bludgeoning',
              totalDamage: 4
            }
          },
          {
            type: 'DAMAGE_APPLIED',
            payload: {
              attackerId: 'primary_character',
              targetId: 'enemy_1',
              amount: 4,
              useTempHp: true
            }
          }
        ],
        expectedState: {
          ...buildInitial(),
          combat: {
            ...buildInitial().combat,
            hitPoints: {
              current: 10,
              max: 20,
              temporary: 0
            }
          },
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: {
            actionId: 'card-0',
            actionName: 'Unarmed Attack',
            damageType: 'bludgeoning',
            totalDamage: 4,
            attackerId: 'primary_character',
            targetId: 'enemy_1'
          },
          damageEventsCount: 1,
          lastAttackResolvedEvent: {
            attackerId: 'primary_character',
            targetId: 'enemy_1',
            actionId: 'card-0',
            actionName: 'Unarmed Attack',
            attackTotal: 17,
            targetAc: 12,
            hit: true
          },
          attackResolvedEventsCount: 1,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'status_effect_apply_and_clear_tracks_metadata',
        context: 'postphase:fixture:status-effect-metadata',
        events: [
          {
            type: 'STATUS_EFFECT_APPLIED',
            payload: {
              effectId: 'eff_1',
              definitionId: 'restrained',
              sourceCombatantId: 'primary_character',
              targetCombatantId: 'enemy_1',
              cause: 'attack-on-hit'
            }
          },
          {
            type: 'STATUS_EFFECT_CLEARED',
            payload: {
              effectId: 'eff_1',
              targetCombatantId: 'enemy_1',
              cause: 'save-success'
            }
          }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: null,
          damageEventsCount: 0,
          lastAttackResolvedEvent: null,
          attackResolvedEventsCount: 0,
          lastStatusEffectEvent: {
            eventType: 'STATUS_EFFECT_CLEARED',
            effectId: 'eff_1',
            targetCombatantId: 'enemy_1',
            cause: 'save-success'
          },
          statusEffectEventsCount: 2,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'status_pipeline_stages_track_last_event_and_count',
        context: 'postphase:fixture:status-pipeline-stages',
        events: [
          { type: 'STATUS_PIPELINE_STAGE', payload: { stage: 'pre_attack', attackerId: 'primary_character', targetId: 'enemy_1' } },
          { type: 'STATUS_PIPELINE_STAGE', payload: { stage: 'on_hit', attackerId: 'primary_character', targetId: 'enemy_1' } },
          { type: 'STATUS_PIPELINE_STAGE', payload: { stage: 'post_attack', attackerId: 'primary_character', targetId: 'enemy_1' } }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: null,
          damageEventsCount: 0,
          lastAttackResolvedEvent: null,
          attackResolvedEventsCount: 0,
          lastStatusEffectEvent: null,
          statusEffectEventsCount: 0,
          lastStatusPipelineStageEvent: {
            stage: 'post_attack',
            attackerId: 'primary_character',
            targetId: 'enemy_1'
          },
          statusPipelineStageEventsCount: 3,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      },
      {
        name: 'status_trigger_evaluated_tracks_last_event_and_count',
        context: 'postphase:fixture:status-trigger-evaluated',
        events: [
          {
            type: 'STATUS_TRIGGER_EVALUATED',
            payload: {
              trigger: 'on_hit_apply',
              consideredEffects: 1,
              queuedActionsCount: 1,
              appliedActionsCount: 0,
              attackerId: 'primary_character',
              targetId: 'enemy_1'
            }
          },
          {
            type: 'STATUS_TRIGGER_EVALUATED',
            payload: {
              trigger: 'end_turn_expire',
              consideredEffects: 1,
              queuedActionsCount: 1,
              appliedActionsCount: 1,
              attackerId: 'primary_character',
              targetId: 'enemy_1'
            }
          }
        ],
        expectedState: {
          ...buildInitial(),
          resources: { action: true, bonusAction: true, reaction: true, freeObjectInteraction: true },
          lastDamageEvent: null,
          damageEventsCount: 0,
          lastAttackResolvedEvent: null,
          attackResolvedEventsCount: 0,
          lastStatusEffectEvent: null,
          statusEffectEventsCount: 0,
          lastStatusPipelineStageEvent: null,
          statusPipelineStageEventsCount: 0,
          lastStatusTriggerEvent: {
            trigger: 'end_turn_expire',
            consideredEffects: 1,
            queuedActionsCount: 1,
            appliedActionsCount: 1,
            attackerId: 'primary_character',
            targetId: 'enemy_1'
          },
          statusTriggerEventsCount: 2,
          lastRadRollEvent: null,
          radRollEventsCount: 0,
          lastSaveDcEvent: null,
          saveDcEventsCount: 0
        }
      }
    ];
  }

  globalScope.CombatReplayTests = {
    diffStates,
    defaultInvariantChecks,
    strictInvariantChecks,
    runInvariantChecks,
    runEventSchemaChecks,
    runFixture,
    runSuite,
    createDefaultFixtures
  };
})(window);
