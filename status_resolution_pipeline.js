(function attachStatusResolutionPipeline(globalScope) {
  /*
    RULE ALIGNMENT GUARDRAIL
    - This module maps status effects into staged combat resolution.
    - Before adding stage logic, verify rule intent in the project reference docs and SRD condition text.
    - Prefer no-op/metadata scaffolding unless a rules interaction is explicitly confirmed.
  */

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

  function appendPipelineReplayEvent(stage, payload, context = 'status-pipeline') {
    if (!globalScope.combatReplayStore?.append) return;
    globalScope.combatReplayStore.append('STATUS_PIPELINE_STAGE', {
      stage,
      ...deepClone(payload)
    }, { context });
  }

  function emitPipelineEvent(stage, detail, context = 'status-pipeline') {
    globalScope.dispatchEvent(new CustomEvent('status-pipeline:stage', {
      detail: {
        stage,
        context,
        ...deepClone(detail)
      }
    }));
  }

  function evaluatePreAttack(payload = {}, context = 'status-pipeline:pre-attack') {
    // RULE REVIEW CHECKPOINT: attacker-target advantage/disadvantage interactions are rules-sensitive.
    const attackerId = payload.attackerId ? String(payload.attackerId) : null;
    const targetId = payload.targetId ? String(payload.targetId) : null;
    const statusEvaluation = globalScope.evaluateAttackStatusEffects
      ? globalScope.evaluateAttackStatusEffects({ attackerId, targetId }, `${context}:status-eval`)
      : {
          attackerId,
          targetId,
          attackAdvantage: false,
          attackDisadvantage: false,
          outgoingDamageBonus: 0,
          incomingDamageMultiplier: 1,
          consumedEffectIds: [],
          appliedEffectIds: []
        };

    const relation = globalScope.StatusEffectsCore?.adapters?.resolveRelationship
      ? globalScope.StatusEffectsCore.adapters.resolveRelationship(attackerId, targetId, payload.combatantMap || {})
      : { relation: 'unknown', sameTeam: null, attackerTeam: null, targetTeam: null };

    const result = {
      stage: 'pre_attack',
      attackerId,
      targetId,
      relation,
      attackAdvantage: !!statusEvaluation.attackAdvantage,
      attackDisadvantage: !!statusEvaluation.attackDisadvantage,
      appliedEffectIds: Array.isArray(statusEvaluation.appliedEffectIds) ? statusEvaluation.appliedEffectIds : [],
      consumedEffectIds: Array.isArray(statusEvaluation.consumedEffectIds) ? statusEvaluation.consumedEffectIds : []
    };

    appendPipelineReplayEvent('pre_attack', result, context);
    emitPipelineEvent('pre_attack', result, context);
    return result;
  }

  function evaluateOnHit(payload = {}, context = 'status-pipeline:on-hit') {
    // RULE REVIEW CHECKPOINT: damage modifiers should reflect confirmed RAW interactions only.
    const attackerId = payload.attackerId ? String(payload.attackerId) : null;
    const targetId = payload.targetId ? String(payload.targetId) : null;
    const baseDamage = Math.max(0, toNumberOrNull(payload.baseDamage) || 0);

    const statusEvaluation = globalScope.evaluateAttackStatusEffects
      ? globalScope.evaluateAttackStatusEffects({ attackerId, targetId }, `${context}:status-eval`)
      : {
          attackerId,
          targetId,
          attackAdvantage: false,
          attackDisadvantage: false,
          outgoingDamageBonus: 0,
          incomingDamageMultiplier: 1,
          consumedEffectIds: [],
          appliedEffectIds: []
        };

    const outgoingDamageBonus = Math.max(0, toNumberOrNull(statusEvaluation.outgoingDamageBonus) || 0);
    const incomingDamageMultiplier = Number.isFinite(Number(statusEvaluation.incomingDamageMultiplier))
      ? Number(statusEvaluation.incomingDamageMultiplier)
      : 1;

    const damageType = payload.damageType ? String(payload.damageType).trim().toLowerCase() : null;
    const hasIsMagicalQualifier = Object.prototype.hasOwnProperty.call(payload || {}, 'isMagical');
    const hasIsSilveredQualifier = Object.prototype.hasOwnProperty.call(payload || {}, 'isSilvered');
    const hasIsAdamantineQualifier = Object.prototype.hasOwnProperty.call(payload || {}, 'isAdamantine');
    const isMagical = hasIsMagicalQualifier ? payload?.isMagical === true : undefined;
    const isSilvered = hasIsSilveredQualifier ? payload?.isSilvered === true : undefined;
    const isAdamantine = hasIsAdamantineQualifier ? payload?.isAdamantine === true : undefined;
    const targetCombatant = payload.combatantMap && typeof payload.combatantMap === 'object'
      ? payload.combatantMap[targetId]
      : null;
    const defenseEvaluation = typeof globalScope.evaluateCombatantDamageDefense === 'function'
      ? globalScope.evaluateCombatantDamageDefense({
          combatantId: targetId,
          damageType,
          isMagical,
          isSilvered,
          isAdamantine,
          combatant: targetCombatant
        }, `${context}:damage-defense`)
      : {
          multiplier: 1,
          state: 'normal',
          profile: null,
          sources: ['api_unavailable']
        };

    const defenseMultiplier = Number.isFinite(Number(defenseEvaluation?.multiplier))
      ? Number(defenseEvaluation.multiplier)
      : 1;

    const modifiedDamage = Math.max(
      0,
      Math.trunc((baseDamage + outgoingDamageBonus) * incomingDamageMultiplier * defenseMultiplier)
    );

    const result = {
      stage: 'on_hit',
      attackerId,
      targetId,
      baseDamage,
      damageType,
      isMagical,
      isSilvered,
      isAdamantine,
      outgoingDamageBonus,
      incomingDamageMultiplier,
      defenseMultiplier,
      defenseState: String(defenseEvaluation?.state || 'normal'),
      qualifierMetadataMissingHint: defenseEvaluation?.qualifierMetadataMissingHint === true,
      defenseSources: Array.isArray(defenseEvaluation?.sources) ? defenseEvaluation.sources : [],
      modifiedDamage,
      appliedEffectIds: Array.isArray(statusEvaluation.appliedEffectIds) ? statusEvaluation.appliedEffectIds : [],
      consumedEffectIds: Array.isArray(statusEvaluation.consumedEffectIds) ? statusEvaluation.consumedEffectIds : []
    };

    appendPipelineReplayEvent('on_hit', result, context);
    emitPipelineEvent('on_hit', result, context);
    return result;
  }

  function evaluateOnMiss(payload = {}, context = 'status-pipeline:on-miss') {
    const attackerId = payload.attackerId ? String(payload.attackerId) : null;
    const targetId = payload.targetId ? String(payload.targetId) : null;
    const statusEvaluation = globalScope.evaluateAttackStatusEffects
      ? globalScope.evaluateAttackStatusEffects({ attackerId, targetId }, `${context}:status-eval`)
      : {
          consumedEffectIds: [],
          appliedEffectIds: []
        };

    const result = {
      stage: 'on_miss',
      attackerId,
      targetId,
      appliedEffectIds: Array.isArray(statusEvaluation.appliedEffectIds) ? statusEvaluation.appliedEffectIds : [],
      consumedEffectIds: Array.isArray(statusEvaluation.consumedEffectIds) ? statusEvaluation.consumedEffectIds : []
    };

    appendPipelineReplayEvent('on_miss', result, context);
    emitPipelineEvent('on_miss', result, context);
    return result;
  }

  function finalizePostAttack(payload = {}, context = 'status-pipeline:post-attack') {
    const consumedEffectIds = Array.isArray(payload.consumedEffectIds)
      ? payload.consumedEffectIds.map((entry) => String(entry)).filter(Boolean)
      : [];

    consumedEffectIds.forEach((effectId) => {
      if (typeof globalScope.clearStatusEffectScaffold === 'function') {
        globalScope.clearStatusEffectScaffold(effectId, `${context}:consume`);
      }
    });

    const result = {
      stage: 'post_attack',
      consumedEffectIds,
      consumedCount: consumedEffectIds.length
    };

    appendPipelineReplayEvent('post_attack', result, context);
    emitPipelineEvent('post_attack', result, context);
    return result;
  }

  function runAttackStatusPipeline(payload = {}, context = 'status-pipeline:run-attack') {
    const attackerId = payload.attackerId ? String(payload.attackerId) : null;
    const targetId = payload.targetId ? String(payload.targetId) : null;
    const hit = !!payload.hit;

    const preAttack = evaluatePreAttack({
      attackerId,
      targetId,
      combatantMap: payload.combatantMap || {}
    }, `${context}:pre`);

    const onHitOrMiss = hit
      ? evaluateOnHit({
          attackerId,
          targetId,
          baseDamage: payload.baseDamage,
          damageType: payload.damageType,
          ...(Object.prototype.hasOwnProperty.call(payload || {}, 'isMagical') ? { isMagical: payload.isMagical } : {}),
          ...(Object.prototype.hasOwnProperty.call(payload || {}, 'isSilvered') ? { isSilvered: payload.isSilvered } : {}),
          ...(Object.prototype.hasOwnProperty.call(payload || {}, 'isAdamantine') ? { isAdamantine: payload.isAdamantine } : {}),
          combatantMap: payload.combatantMap || {}
        }, `${context}:on-hit`)
      : evaluateOnMiss({ attackerId, targetId }, `${context}:on-miss`);

    const postAttack = finalizePostAttack({
      consumedEffectIds: onHitOrMiss.consumedEffectIds
    }, `${context}:post`);

    const summary = {
      context,
      attackerId,
      targetId,
      hit,
      preAttack,
      resolution: onHitOrMiss,
      postAttack
    };

    globalScope.dispatchEvent(new CustomEvent('status-pipeline:completed', {
      detail: summary
    }));

    return summary;
  }

  const StatusResolutionPipeline = {
    evaluatePreAttack,
    evaluateOnHit,
    evaluateOnMiss,
    finalizePostAttack,
    runAttackStatusPipeline
  };

  globalScope.StatusResolutionPipeline = StatusResolutionPipeline;
  globalScope.runAttackStatusPipeline = runAttackStatusPipeline;
})(window);
