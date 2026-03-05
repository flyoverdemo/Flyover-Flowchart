(function attachCombatantLinkSchema(globalScope) {
  function toNumberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  function deepClone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  function normalizeAttackResolvedEvent(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const payload = source.payload && typeof source.payload === 'object' ? source.payload : {};

    return {
      type: 'ATTACK_RESOLVED',
      payload: {
        attackerId: String(payload.attackerId || '').trim(),
        targetId: String(payload.targetId || '').trim(),
        actionId: String(payload.actionId || '').trim(),
        actionName: payload.actionName ? String(payload.actionName) : null,
        roll: toNumberOrNull(payload.roll),
        toHit: toNumberOrNull(payload.toHit),
        attackTotal: toNumberOrNull(payload.attackTotal),
        targetAc: toNumberOrNull(payload.targetAc),
        hit: typeof payload.hit === 'boolean' ? payload.hit : null
      },
      meta: deepClone(source.meta || {})
    };
  }

  function validateAttackResolvedEvent(input = {}) {
    const normalized = normalizeAttackResolvedEvent(input);
    const errors = [];

    if (!normalized.payload.attackerId) {
      errors.push({ code: 'missing_attacker_id', message: 'ATTACK_RESOLVED requires payload.attackerId.' });
    }
    if (!normalized.payload.targetId) {
      errors.push({ code: 'missing_target_id', message: 'ATTACK_RESOLVED requires payload.targetId.' });
    }
    if (!normalized.payload.actionId) {
      errors.push({ code: 'missing_action_id', message: 'ATTACK_RESOLVED requires payload.actionId.' });
    }

    if (normalized.payload.attackerId && normalized.payload.targetId && normalized.payload.attackerId === normalized.payload.targetId) {
      errors.push({ code: 'attacker_target_same', message: 'attackerId and targetId should not be identical for ATTACK_RESOLVED.' });
    }

    if (normalized.payload.hit !== null && normalized.payload.attackTotal !== null && normalized.payload.targetAc !== null) {
      const computedHit = normalized.payload.attackTotal >= normalized.payload.targetAc;
      if (computedHit !== normalized.payload.hit) {
        errors.push({
          code: 'hit_flag_mismatch',
          message: 'hit does not match attackTotal vs targetAc comparison.',
          attackTotal: normalized.payload.attackTotal,
          targetAc: normalized.payload.targetAc,
          hit: normalized.payload.hit
        });
      }
    }

    return {
      ok: errors.length === 0,
      type: 'ATTACK_RESOLVED',
      normalized,
      errors
    };
  }

  function normalizeDamageResolvedEvent(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const payload = source.payload && typeof source.payload === 'object' ? source.payload : {};

    return {
      type: 'DAMAGE_RESOLVED',
      payload: {
        attackerId: String(payload.attackerId || '').trim(),
        targetId: String(payload.targetId || '').trim(),
        actionId: String(payload.actionId || '').trim(),
        actionName: payload.actionName ? String(payload.actionName) : null,
        damageType: payload.damageType ? String(payload.damageType) : null,
        totalDamage: toNumberOrNull(payload.totalDamage),
        isMagical: payload.isMagical === true,
        isSilvered: payload.isSilvered === true,
        isAdamantine: payload.isAdamantine === true
      },
      meta: deepClone(source.meta || {})
    };
  }

  function validateDamageResolvedEvent(input = {}) {
    const normalized = normalizeDamageResolvedEvent(input);
    const errors = [];
    const hasAttacker = !!normalized.payload.attackerId;
    const hasTarget = !!normalized.payload.targetId;
    const hasLinking = hasAttacker || hasTarget;

    if (!hasLinking) {
      return {
        ok: true,
        type: 'DAMAGE_RESOLVED',
        normalized,
        errors: []
      };
    }

    if (!hasAttacker) {
      errors.push({ code: 'missing_attacker_id', message: 'DAMAGE_RESOLVED requires payload.attackerId.' });
    }
    if (!hasTarget) {
      errors.push({ code: 'missing_target_id', message: 'DAMAGE_RESOLVED requires payload.targetId.' });
    }
    if (!normalized.payload.actionId) {
      errors.push({ code: 'missing_action_id', message: 'DAMAGE_RESOLVED requires payload.actionId.' });
    }
    if (!Number.isFinite(Number(normalized.payload.totalDamage)) || Number(normalized.payload.totalDamage) < 0) {
      errors.push({ code: 'invalid_total_damage', message: 'DAMAGE_RESOLVED requires non-negative payload.totalDamage.' });
    }

    return {
      ok: errors.length === 0,
      type: 'DAMAGE_RESOLVED',
      normalized,
      errors
    };
  }

  function normalizeDamageAppliedEvent(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const payload = source.payload && typeof source.payload === 'object' ? source.payload : {};

    return {
      type: 'DAMAGE_APPLIED',
      payload: {
        attackerId: String(payload.attackerId || '').trim(),
        targetId: String(payload.targetId || '').trim(),
        amount: toNumberOrNull(payload.amount),
        useTempHp: payload.useTempHp !== false
      },
      meta: deepClone(source.meta || {})
    };
  }

  function validateDamageAppliedEvent(input = {}) {
    const normalized = normalizeDamageAppliedEvent(input);
    const errors = [];
    const hasAttacker = !!normalized.payload.attackerId;
    const hasTarget = !!normalized.payload.targetId;
    const hasLinking = hasAttacker || hasTarget;

    if (!hasLinking) {
      return {
        ok: true,
        type: 'DAMAGE_APPLIED',
        normalized,
        errors: []
      };
    }

    if (!hasTarget) {
      errors.push({ code: 'missing_target_id', message: 'DAMAGE_APPLIED requires payload.targetId.' });
    }
    if (!Number.isFinite(Number(normalized.payload.amount)) || Number(normalized.payload.amount) < 0) {
      errors.push({ code: 'invalid_amount', message: 'DAMAGE_APPLIED requires non-negative payload.amount.' });
    }
    if (hasAttacker && hasTarget && normalized.payload.attackerId === normalized.payload.targetId) {
      errors.push({ code: 'attacker_target_same', message: 'attackerId and targetId should not be identical for DAMAGE_APPLIED.' });
    }

    return {
      ok: errors.length === 0,
      type: 'DAMAGE_APPLIED',
      normalized,
      errors
    };
  }

  function normalizeStatusEffectAppliedEvent(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const payload = source.payload && typeof source.payload === 'object' ? source.payload : {};
    return {
      type: 'STATUS_EFFECT_APPLIED',
      payload: {
        effectId: String(payload.effectId || '').trim(),
        definitionId: String(payload.definitionId || '').trim(),
        sourceCombatantId: payload.sourceCombatantId ? String(payload.sourceCombatantId) : null,
        targetCombatantId: payload.targetCombatantId ? String(payload.targetCombatantId) : null,
        cause: payload.cause ? String(payload.cause) : null
      },
      meta: deepClone(source.meta || {})
    };
  }

  function validateStatusEffectAppliedEvent(input = {}) {
    const normalized = normalizeStatusEffectAppliedEvent(input);
    const errors = [];
    if (!normalized.payload.effectId) {
      errors.push({ code: 'missing_effect_id', message: 'STATUS_EFFECT_APPLIED requires payload.effectId.' });
    }
    if (!normalized.payload.definitionId) {
      errors.push({ code: 'missing_definition_id', message: 'STATUS_EFFECT_APPLIED requires payload.definitionId.' });
    }
    if (!normalized.payload.targetCombatantId) {
      errors.push({ code: 'missing_target_combatant_id', message: 'STATUS_EFFECT_APPLIED requires payload.targetCombatantId.' });
    }

    return {
      ok: errors.length === 0,
      type: 'STATUS_EFFECT_APPLIED',
      normalized,
      errors
    };
  }

  function normalizeStatusEffectClearedEvent(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const payload = source.payload && typeof source.payload === 'object' ? source.payload : {};
    return {
      type: 'STATUS_EFFECT_CLEARED',
      payload: {
        effectId: String(payload.effectId || '').trim(),
        targetCombatantId: payload.targetCombatantId ? String(payload.targetCombatantId) : null,
        cause: payload.cause ? String(payload.cause) : null
      },
      meta: deepClone(source.meta || {})
    };
  }

  function validateStatusEffectClearedEvent(input = {}) {
    const normalized = normalizeStatusEffectClearedEvent(input);
    const errors = [];
    if (!normalized.payload.effectId) {
      errors.push({ code: 'missing_effect_id', message: 'STATUS_EFFECT_CLEARED requires payload.effectId.' });
    }
    if (!normalized.payload.targetCombatantId) {
      errors.push({ code: 'missing_target_combatant_id', message: 'STATUS_EFFECT_CLEARED requires payload.targetCombatantId.' });
    }

    return {
      ok: errors.length === 0,
      type: 'STATUS_EFFECT_CLEARED',
      normalized,
      errors
    };
  }

  function normalizeStatusPipelineStageEvent(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const payload = source.payload && typeof source.payload === 'object' ? source.payload : {};
    return {
      type: 'STATUS_PIPELINE_STAGE',
      payload: {
        stage: payload.stage ? String(payload.stage) : null,
        attackerId: payload.attackerId ? String(payload.attackerId) : null,
        targetId: payload.targetId ? String(payload.targetId) : null,
        qualifierMetadataMissingHint: payload.qualifierMetadataMissingHint === true
      },
      meta: deepClone(source.meta || {})
    };
  }

  function validateStatusPipelineStageEvent(input = {}) {
    const normalized = normalizeStatusPipelineStageEvent(input);
    const errors = [];
    const stage = String(normalized.payload.stage || '');
    const allowedStages = ['pre_attack', 'on_hit', 'on_miss', 'post_attack'];
    if (!allowedStages.includes(stage)) {
      errors.push({ code: 'invalid_stage', message: `STATUS_PIPELINE_STAGE payload.stage must be one of: ${allowedStages.join(', ')}.` });
    }
    return {
      ok: errors.length === 0,
      type: 'STATUS_PIPELINE_STAGE',
      normalized,
      errors
    };
  }

  function normalizeStatusTriggerEvaluatedEvent(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const payload = source.payload && typeof source.payload === 'object' ? source.payload : {};
    return {
      type: 'STATUS_TRIGGER_EVALUATED',
      payload: {
        trigger: payload.trigger ? String(payload.trigger) : null,
        consideredEffects: Number.isFinite(Number(payload.consideredEffects)) ? Math.trunc(Number(payload.consideredEffects)) : 0,
        queuedActionsCount: Number.isFinite(Number(payload.queuedActionsCount)) ? Math.trunc(Number(payload.queuedActionsCount)) : 0,
        appliedActionsCount: Number.isFinite(Number(payload.appliedActionsCount)) ? Math.trunc(Number(payload.appliedActionsCount)) : 0,
        attackerId: payload.attackerId ? String(payload.attackerId) : null,
        targetId: payload.targetId ? String(payload.targetId) : null
      },
      meta: deepClone(source.meta || {})
    };
  }

  function validateStatusTriggerEvaluatedEvent(input = {}) {
    const normalized = normalizeStatusTriggerEvaluatedEvent(input);
    const errors = [];
    const trigger = String(normalized.payload.trigger || '');
    const allowedTriggers = ['on_hit_apply', 'on_miss_apply', 'start_turn_tick', 'end_turn_expire'];
    if (!allowedTriggers.includes(trigger)) {
      errors.push({ code: 'invalid_trigger', message: `STATUS_TRIGGER_EVALUATED payload.trigger must be one of: ${allowedTriggers.join(', ')}.` });
    }
    if (normalized.payload.consideredEffects < 0) {
      errors.push({ code: 'negative_considered_effects', message: 'consideredEffects cannot be negative.' });
    }
    if (normalized.payload.queuedActionsCount < 0) {
      errors.push({ code: 'negative_queued_actions', message: 'queuedActionsCount cannot be negative.' });
    }
    if (normalized.payload.appliedActionsCount < 0) {
      errors.push({ code: 'negative_applied_actions', message: 'appliedActionsCount cannot be negative.' });
    }

    return {
      ok: errors.length === 0,
      type: 'STATUS_TRIGGER_EVALUATED',
      normalized,
      errors
    };
  }

  function validateEvent(event = {}, options = {}) {
    const eventType = String(event?.type || '').toUpperCase();
    if (eventType === 'ATTACK_RESOLVED') {
      return validateAttackResolvedEvent(event);
    }
    if (eventType === 'DAMAGE_RESOLVED') {
      return validateDamageResolvedEvent(event);
    }
    if (eventType === 'DAMAGE_APPLIED') {
      return validateDamageAppliedEvent(event);
    }
    if (eventType === 'STATUS_EFFECT_APPLIED') {
      return validateStatusEffectAppliedEvent(event);
    }
    if (eventType === 'STATUS_EFFECT_CLEARED') {
      return validateStatusEffectClearedEvent(event);
    }
    if (eventType === 'STATUS_PIPELINE_STAGE') {
      return validateStatusPipelineStageEvent(event);
    }
    if (eventType === 'STATUS_TRIGGER_EVALUATED') {
      return validateStatusTriggerEvaluatedEvent(event);
    }
    if (options.validateAllEventTypes === true) {
      return {
        ok: false,
        type: eventType || 'UNKNOWN',
        normalized: deepClone(event),
        errors: [{ code: 'unsupported_event_type', message: `No schema validator registered for event type: ${eventType || 'UNKNOWN'}.` }]
      };
    }
    return {
      ok: true,
      type: eventType || 'UNKNOWN',
      normalized: deepClone(event),
      errors: []
    };
  }

  globalScope.CombatantLinkSchema = {
    normalizeAttackResolvedEvent,
    validateAttackResolvedEvent,
    normalizeDamageResolvedEvent,
    validateDamageResolvedEvent,
    normalizeDamageAppliedEvent,
    validateDamageAppliedEvent,
    normalizeStatusEffectAppliedEvent,
    validateStatusEffectAppliedEvent,
    normalizeStatusEffectClearedEvent,
    validateStatusEffectClearedEvent,
    normalizeStatusPipelineStageEvent,
    validateStatusPipelineStageEvent,
    normalizeStatusTriggerEvaluatedEvent,
    validateStatusTriggerEvaluatedEvent,
    validateEvent
  };
})(window);
