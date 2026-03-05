(function attachStatusActionTaxonomy(globalScope) {
  const ACTION_TYPES = {
    APPLY_EFFECT: 'apply_effect',
    CLEAR_EFFECT: 'clear_effect',
    QUEUE_DAMAGE: 'queue_damage',
    EXPIRE_EFFECT: 'expire_effect',
    GRANT_ADVANTAGE: 'grant_advantage'
  };

  function toNumberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  function normalizeAction(action = {}) {
    const source = action && typeof action === 'object' ? action : {};
    return {
      action: String(source.action || '').trim().toLowerCase(),
      trigger: source.trigger ? String(source.trigger) : null,
      effectId: source.effectId ? String(source.effectId) : null,
      definitionId: source.definitionId ? String(source.definitionId) : null,
      targetCombatantId: source.targetCombatantId ? String(source.targetCombatantId) : null,
      amount: toNumberOrNull(source.amount),
      notes: source.notes ? String(source.notes) : null
    };
  }

  function validateAction(action = {}) {
    const normalized = normalizeAction(action);
    const errors = [];

    if (!normalized.action) {
      errors.push({ code: 'missing_action', message: 'Action type is required.' });
      return { ok: false, normalized, errors };
    }

    const allowed = Object.values(ACTION_TYPES);
    if (!allowed.includes(normalized.action)) {
      errors.push({ code: 'unsupported_action', message: `Unsupported action type: ${normalized.action}.` });
    }

    if (normalized.action === ACTION_TYPES.APPLY_EFFECT && !normalized.definitionId) {
      errors.push({ code: 'missing_definition_id', message: 'apply_effect requires definitionId.' });
    }

    if ((normalized.action === ACTION_TYPES.CLEAR_EFFECT || normalized.action === ACTION_TYPES.EXPIRE_EFFECT) && !normalized.effectId) {
      errors.push({ code: 'missing_effect_id', message: `${normalized.action} requires effectId.` });
    }

    if (normalized.action === ACTION_TYPES.QUEUE_DAMAGE && (!Number.isFinite(Number(normalized.amount)) || Number(normalized.amount) < 0)) {
      errors.push({ code: 'invalid_amount', message: 'queue_damage requires non-negative amount.' });
    }

    return {
      ok: errors.length === 0,
      normalized,
      errors
    };
  }

  function resolveAction(action = {}, payload = {}, options = {}) {
    const context = String(options.context || 'status-action-taxonomy:resolve');
    const validation = validateAction(action);
    if (!validation.ok) {
      return {
        ok: false,
        reason: 'validation_failed',
        errors: validation.errors,
        action: validation.normalized.action || null
      };
    }

    const normalized = validation.normalized;

    if (normalized.action === ACTION_TYPES.APPLY_EFFECT) {
      if (typeof globalScope.applyStatusEffectScaffold !== 'function') {
        return { ok: false, reason: 'status-effects-api-unavailable', action: normalized.action };
      }
      const effectId = `${normalized.definitionId}_${Date.now()}`;
      const targetCombatantId = normalized.targetCombatantId || payload.targetId || null;
      const targetCombatant = payload?.combatantMap && targetCombatantId
        ? payload.combatantMap[targetCombatantId] || null
        : null;
      globalScope.applyStatusEffectScaffold({
        id: effectId,
        definitionId: normalized.definitionId,
        sourceCombatantId: payload.attackerId || null,
        targetCombatantId,
        targetCombatant,
        cause: `trigger:${normalized.trigger || 'status-action'}`
      }, `${context}:apply-effect`);
      return { ok: true, action: normalized.action, effectId };
    }

    if (normalized.action === ACTION_TYPES.CLEAR_EFFECT || normalized.action === ACTION_TYPES.EXPIRE_EFFECT) {
      if (typeof globalScope.clearStatusEffectScaffold !== 'function') {
        return { ok: false, reason: 'status-effects-api-unavailable', action: normalized.action };
      }
      globalScope.clearStatusEffectScaffold(normalized.effectId, `${context}:${normalized.action}`);
      return { ok: true, action: normalized.action, effectId: normalized.effectId };
    }

    if (normalized.action === ACTION_TYPES.QUEUE_DAMAGE) {
      return {
        ok: true,
        action: normalized.action,
        queuedDamage: {
          targetCombatantId: normalized.targetCombatantId || payload.targetId || null,
          amount: Math.max(0, Math.trunc(Number(normalized.amount) || 0))
        }
      };
    }

    if (normalized.action === ACTION_TYPES.GRANT_ADVANTAGE) {
      return {
        ok: true,
        action: normalized.action,
        grantAdvantage: {
          targetCombatantId: normalized.targetCombatantId || payload.attackerId || null,
          reason: normalized.notes || 'status-action-taxonomy'
        }
      };
    }

    return { ok: false, reason: 'unsupported_action', action: normalized.action };
  }

  globalScope.StatusActionTaxonomy = {
    ACTION_TYPES,
    normalizeAction,
    validateAction,
    resolveAction
  };
})(window);
