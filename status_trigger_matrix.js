(function attachStatusTriggerMatrix(globalScope) {
  /*
    RULE ALIGNMENT GUARDRAIL
    - Trigger hooks (on_hit_apply/start_turn_tick/end_turn_expire) must be validated against official rules text.
    - If the rules interaction is unclear, queue metadata only and avoid automatic mutation.
    - Keep trigger action semantics centralized through StatusActionTaxonomy to reduce drift.
  */

  const DEFAULT_TRIGGER_KEYS = [
    'on_hit_apply',
    'on_miss_apply',
    'start_turn_tick',
    'end_turn_expire'
  ];

  function deepClone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  function toNumberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  function normalizeLifecycleHooks(rawHooks = {}) {
    const source = rawHooks && typeof rawHooks === 'object' ? rawHooks : {};
    const normalized = {};
    DEFAULT_TRIGGER_KEYS.forEach((key) => {
      const list = Array.isArray(source[key]) ? source[key] : [];
      normalized[key] = list
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          return {
            action: String(entry.action || '').trim(),
            target: String(entry.target || 'effect_target'),
            definitionId: entry.definitionId ? String(entry.definitionId) : null,
            durationRounds: toNumberOrNull(entry.durationRounds),
            amount: toNumberOrNull(entry.amount),
            notes: entry.notes ? String(entry.notes) : null
          };
        })
        .filter((entry) => !!entry?.action);
    });
    return normalized;
  }

  function resolveTargetCombatantId(targetMode, payload = {}, activeEffect = null) {
    const mode = String(targetMode || 'effect_target');
    if (mode === 'attacker') return payload.attackerId ? String(payload.attackerId) : null;
    if (mode === 'target') return payload.targetId ? String(payload.targetId) : null;
    if (mode === 'effect_source') return activeEffect?.sourceCombatantId ? String(activeEffect.sourceCombatantId) : null;
    if (mode === 'effect_target') return activeEffect?.targetCombatantId ? String(activeEffect.targetCombatantId) : null;
    return null;
  }

  function buildActionQueue(triggerKey, payload = {}, options = {}) {
    const trigger = String(triggerKey || '').trim().toLowerCase();
    const storeState = globalScope.ensureStatusEffectsStore?.('status-triggers:ensure-store')?.getState?.() || null;
    if (!storeState) {
      return {
        trigger,
        actions: [],
        consideredEffects: 0
      };
    }

    const activeEffects = Array.isArray(storeState.activeEffects) ? storeState.activeEffects : [];
    const definitions = storeState.definitions && typeof storeState.definitions === 'object' ? storeState.definitions : {};
    const includeInactive = options.includeInactive === true;

    const queue = [];
    let consideredEffects = 0;

    activeEffects.forEach((activeEffect) => {
      if (!activeEffect || (!includeInactive && activeEffect.active === false)) return;
      const definition = definitions[activeEffect.definitionId];
      if (!definition) return;

      const lifecycleHooks = normalizeLifecycleHooks(definition.lifecycleHooks || {});
      const hooksForTrigger = Array.isArray(lifecycleHooks[trigger]) ? lifecycleHooks[trigger] : [];
      if (!hooksForTrigger.length) return;

      consideredEffects += 1;
      hooksForTrigger.forEach((hook, index) => {
        const targetCombatantId = resolveTargetCombatantId(hook.target, payload, activeEffect);
        queue.push({
          id: `${activeEffect.id || activeEffect.definitionId || 'effect'}:${trigger}:${index + 1}`,
          trigger,
          effectId: activeEffect.id || null,
          sourceEffectDefinitionId: activeEffect.definitionId || null,
          action: hook.action,
          targetMode: hook.target,
          targetCombatantId,
          definitionId: hook.definitionId || null,
          amount: Number.isFinite(Number(hook.amount)) ? Math.trunc(Number(hook.amount)) : null,
          durationRounds: Number.isFinite(Number(hook.durationRounds)) ? Math.trunc(Number(hook.durationRounds)) : null,
          notes: hook.notes || null
        });
      });
    });

    return {
      trigger,
      actions: queue,
      consideredEffects
    };
  }

  function applyQueuedAction(action, payload = {}, context = 'status-triggers:apply') {
    // RULE REVIEW CHECKPOINT: all trigger actions should flow through taxonomy for consistent validation.
    if (typeof globalScope.StatusActionTaxonomy?.resolveAction === 'function') {
      return globalScope.StatusActionTaxonomy.resolveAction(action, payload, { context });
    }

    if (!action || typeof action !== 'object') {
      return { ok: false, reason: 'invalid-action' };
    }

    const actionType = String(action.action || '').toLowerCase();
    if (!actionType) {
      return { ok: false, reason: 'missing-action-type' };
    }

    if (actionType === 'apply_effect') {
      if (typeof globalScope.applyStatusEffectScaffold !== 'function') {
        return { ok: false, reason: 'status-effects-api-unavailable', action: actionType };
      }
      const effectId = `${action.definitionId || 'effect'}_${Date.now()}`;
      const targetCombatantId = action.targetCombatantId || payload.targetId || null;
      const targetCombatant = payload?.combatantMap && targetCombatantId
        ? payload.combatantMap[targetCombatantId] || null
        : null;
      globalScope.applyStatusEffectScaffold({
        id: effectId,
        definitionId: action.definitionId,
        sourceCombatantId: payload.attackerId || null,
        targetCombatantId,
        targetCombatant,
        cause: `trigger:${action.trigger}`
      }, `${context}:apply-effect`);
      return { ok: true, action: actionType, effectId };
    }

    if (actionType === 'clear_effect') {
      if (typeof globalScope.clearStatusEffectScaffold !== 'function') {
        return { ok: false, reason: 'status-effects-api-unavailable', action: actionType };
      }
      if (action.effectId) {
        globalScope.clearStatusEffectScaffold(action.effectId, `${context}:clear-effect`);
        return { ok: true, action: actionType, effectId: action.effectId };
      }
      return { ok: false, reason: 'missing-effect-id', action: actionType };
    }

    if (actionType === 'queue_damage') {
      return {
        ok: true,
        action: actionType,
        queuedDamage: {
          targetCombatantId: action.targetCombatantId || payload.targetId || null,
          amount: Number.isFinite(Number(action.amount)) ? Math.max(0, Math.trunc(Number(action.amount))) : 0
        }
      };
    }

    if (actionType === 'expire_effect') {
      if (!action.effectId || typeof globalScope.clearStatusEffectScaffold !== 'function') {
        return { ok: false, reason: 'expire-effect-unavailable', action: actionType };
      }
      globalScope.clearStatusEffectScaffold(action.effectId, `${context}:expire-effect`);
      return { ok: true, action: actionType, effectId: action.effectId };
    }

    return { ok: false, reason: 'unsupported-action', action: actionType };
  }

  function appendTriggerReplayEvent(trigger, summary, context = 'status-triggers') {
    if (!globalScope.combatReplayStore?.append) return;
    globalScope.combatReplayStore.append('STATUS_TRIGGER_EVALUATED', {
      trigger,
      consideredEffects: Number.isFinite(Number(summary.consideredEffects)) ? Math.trunc(Number(summary.consideredEffects)) : 0,
      queuedActionsCount: Array.isArray(summary.actions) ? summary.actions.length : 0,
      appliedActionsCount: Array.isArray(summary.appliedActions) ? summary.appliedActions.length : 0,
      attackerId: summary.attackerId || null,
      targetId: summary.targetId || null
    }, { context });
  }

  function evaluateStatusTrigger(triggerKey, payload = {}, options = {}) {
    const trigger = String(triggerKey || '').trim().toLowerCase();
    const context = String(options.context || `status-triggers:evaluate:${trigger || 'unknown'}`);
    const queueResult = buildActionQueue(trigger, payload, options);

    const summary = {
      trigger,
      attackerId: payload.attackerId ? String(payload.attackerId) : null,
      targetId: payload.targetId ? String(payload.targetId) : null,
      consideredEffects: queueResult.consideredEffects,
      actions: queueResult.actions,
      appliedActions: []
    };

    if (options.applyMutations === true) {
      summary.appliedActions = queueResult.actions.map((action) => applyQueuedAction(action, payload, context));
    }

    appendTriggerReplayEvent(trigger, summary, context);
    globalScope.dispatchEvent(new CustomEvent('status-triggers:evaluated', {
      detail: {
        context,
        ...deepClone(summary)
      }
    }));

    return summary;
  }

  function runTurnStatusTriggers(payload = {}, options = {}) {
    const context = String(options.context || 'status-triggers:run-turn');
    const start = evaluateStatusTrigger('start_turn_tick', payload, {
      ...options,
      context: `${context}:start-turn`
    });
    const end = evaluateStatusTrigger('end_turn_expire', payload, {
      ...options,
      context: `${context}:end-turn`
    });

    return {
      context,
      start,
      end
    };
  }

  const StatusTriggerMatrix = {
    DEFAULT_TRIGGER_KEYS,
    normalizeLifecycleHooks,
    buildActionQueue,
    evaluateStatusTrigger,
    runTurnStatusTriggers
  };

  globalScope.StatusTriggerMatrix = StatusTriggerMatrix;
  globalScope.evaluateStatusTrigger = evaluateStatusTrigger;
  globalScope.runTurnStatusTriggers = runTurnStatusTriggers;
})(window);
