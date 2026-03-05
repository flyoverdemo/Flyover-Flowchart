(function attachCombatReplayLog(globalScope) {
  // Shared snapshot clone helper for event payloads and replay state safety.
  function deepClone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  // Baseline replay state mirrors only the combat/resource slices needed for deterministic checks.
  function createInitialReplayState() {
    return {
      combat: {
        armorClass: null,
        initiativeModifier: 0,
        initiativeRolled: null,
        hitPoints: {
          current: null,
          max: null,
          temporary: 0
        }
      },
      resources: {
        action: true,
        bonusAction: true,
        reaction: true,
        freeObjectInteraction: true
      },
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
    };
  }

  // Deterministic reducer for combat timeline replay; consumes append-only event records.
  function defaultCombatReducer(state, event) {
    const next = deepClone(state || createInitialReplayState());
    const payload = event?.payload || {};

    switch (String(event?.type || '').toUpperCase()) {
      case 'SET_HP': {
        if (Number.isFinite(Number(payload.current))) next.combat.hitPoints.current = Math.trunc(Number(payload.current));
        if (Number.isFinite(Number(payload.max))) next.combat.hitPoints.max = Math.trunc(Number(payload.max));
        if (Number.isFinite(Number(payload.temporary))) next.combat.hitPoints.temporary = Math.trunc(Number(payload.temporary));
        return next;
      }
      case 'SET_AC': {
        if (Number.isFinite(Number(payload.armorClass))) {
          next.combat.armorClass = Math.trunc(Number(payload.armorClass));
        }
        return next;
      }
      case 'SET_INITIATIVE': {
        if (Number.isFinite(Number(payload.initiativeModifier))) {
          next.combat.initiativeModifier = Math.trunc(Number(payload.initiativeModifier));
        }
        if (Number.isFinite(Number(payload.initiativeRolled))) {
          next.combat.initiativeRolled = Math.trunc(Number(payload.initiativeRolled));
        } else if (payload.initiativeRolled === null) {
          next.combat.initiativeRolled = null;
        }
        return next;
      }
      case 'SPEND_RESOURCE': {
        const key = String(payload.key || '');
        if (key && Object.prototype.hasOwnProperty.call(next.resources, key)) {
          next.resources[key] = false;
        }
        return next;
      }
      case 'RESTORE_RESOURCE': {
        const key = String(payload.key || '');
        if (key && Object.prototype.hasOwnProperty.call(next.resources, key)) {
          next.resources[key] = true;
        }
        return next;
      }
      case 'DAMAGE_RESOLVED': {
        const maybeAttackerId = payload.attackerId ? String(payload.attackerId) : null;
        const maybeTargetId = payload.targetId ? String(payload.targetId) : null;
        const maybeDefenseState = payload.defenseState ? String(payload.defenseState) : null;
        const maybeDefenseMultiplier = Number.isFinite(Number(payload.defenseMultiplier))
          ? Number(payload.defenseMultiplier)
          : null;
        const maybeIsMagical = typeof payload.isMagical === 'boolean' ? payload.isMagical : null;
        const maybeIsSilvered = typeof payload.isSilvered === 'boolean' ? payload.isSilvered : null;
        const maybeIsAdamantine = typeof payload.isAdamantine === 'boolean' ? payload.isAdamantine : null;
        next.lastDamageEvent = {
          actionId: payload.actionId || null,
          actionName: payload.actionName || null,
          damageType: payload.damageType || null,
          totalDamage: Number.isFinite(Number(payload.totalDamage)) ? Math.trunc(Number(payload.totalDamage)) : 0,
          ...(maybeAttackerId ? { attackerId: maybeAttackerId } : {}),
          ...(maybeTargetId ? { targetId: maybeTargetId } : {}),
          ...(maybeDefenseState ? { defenseState: maybeDefenseState } : {}),
          ...(maybeDefenseMultiplier !== null ? { defenseMultiplier: maybeDefenseMultiplier } : {}),
          ...(maybeIsMagical !== null ? { isMagical: maybeIsMagical } : {}),
          ...(maybeIsSilvered !== null ? { isSilvered: maybeIsSilvered } : {}),
          ...(maybeIsAdamantine !== null ? { isAdamantine: maybeIsAdamantine } : {})
        };
        next.damageEventsCount = Math.max(0, Math.trunc(Number(next.damageEventsCount || 0))) + 1;
        return next;
      }
      case 'ATTACK_RESOLVED': {
        next.lastAttackResolvedEvent = {
          attackerId: payload.attackerId ? String(payload.attackerId) : null,
          targetId: payload.targetId ? String(payload.targetId) : null,
          actionId: payload.actionId || null,
          actionName: payload.actionName || null,
          attackTotal: Number.isFinite(Number(payload.attackTotal)) ? Math.trunc(Number(payload.attackTotal)) : null,
          targetAc: Number.isFinite(Number(payload.targetAc)) ? Math.trunc(Number(payload.targetAc)) : null,
          hit: typeof payload.hit === 'boolean' ? payload.hit : null
        };
        next.attackResolvedEventsCount = Math.max(0, Math.trunc(Number(next.attackResolvedEventsCount || 0))) + 1;
        return next;
      }
      case 'STATUS_EFFECT_APPLIED': {
        next.lastStatusEffectEvent = {
          eventType: 'STATUS_EFFECT_APPLIED',
          effectId: payload.effectId ? String(payload.effectId) : null,
          definitionId: payload.definitionId ? String(payload.definitionId) : null,
          sourceCombatantId: payload.sourceCombatantId ? String(payload.sourceCombatantId) : null,
          targetCombatantId: payload.targetCombatantId ? String(payload.targetCombatantId) : null,
          cause: payload.cause ? String(payload.cause) : null
        };
        next.statusEffectEventsCount = Math.max(0, Math.trunc(Number(next.statusEffectEventsCount || 0))) + 1;
        return next;
      }
      case 'STATUS_EFFECT_CLEARED': {
        next.lastStatusEffectEvent = {
          eventType: 'STATUS_EFFECT_CLEARED',
          effectId: payload.effectId ? String(payload.effectId) : null,
          targetCombatantId: payload.targetCombatantId ? String(payload.targetCombatantId) : null,
          cause: payload.cause ? String(payload.cause) : null
        };
        next.statusEffectEventsCount = Math.max(0, Math.trunc(Number(next.statusEffectEventsCount || 0))) + 1;
        return next;
      }
      case 'STATUS_PIPELINE_STAGE': {
        const maybeDamageType = payload.damageType ? String(payload.damageType) : null;
        const maybeDefenseState = payload.defenseState ? String(payload.defenseState) : null;
        const maybeDefenseMultiplier = Number.isFinite(Number(payload.defenseMultiplier))
          ? Number(payload.defenseMultiplier)
          : null;
        const maybeQualifierMetadataMissingHint = typeof payload.qualifierMetadataMissingHint === 'boolean'
          ? payload.qualifierMetadataMissingHint
          : null;
        next.lastStatusPipelineStageEvent = {
          stage: payload.stage ? String(payload.stage) : null,
          attackerId: payload.attackerId ? String(payload.attackerId) : null,
          targetId: payload.targetId ? String(payload.targetId) : null,
          ...(maybeDamageType ? { damageType: maybeDamageType } : {}),
          ...(maybeDefenseState ? { defenseState: maybeDefenseState } : {}),
          ...(maybeDefenseMultiplier !== null ? { defenseMultiplier: maybeDefenseMultiplier } : {}),
          ...(maybeQualifierMetadataMissingHint !== null ? { qualifierMetadataMissingHint: maybeQualifierMetadataMissingHint } : {})
        };
        next.statusPipelineStageEventsCount = Math.max(0, Math.trunc(Number(next.statusPipelineStageEventsCount || 0))) + 1;
        return next;
      }
      case 'STATUS_TRIGGER_EVALUATED': {
        next.lastStatusTriggerEvent = {
          trigger: payload.trigger ? String(payload.trigger) : null,
          consideredEffects: Number.isFinite(Number(payload.consideredEffects)) ? Math.trunc(Number(payload.consideredEffects)) : 0,
          queuedActionsCount: Number.isFinite(Number(payload.queuedActionsCount)) ? Math.trunc(Number(payload.queuedActionsCount)) : 0,
          appliedActionsCount: Number.isFinite(Number(payload.appliedActionsCount)) ? Math.trunc(Number(payload.appliedActionsCount)) : 0,
          attackerId: payload.attackerId ? String(payload.attackerId) : null,
          targetId: payload.targetId ? String(payload.targetId) : null
        };
        next.statusTriggerEventsCount = Math.max(0, Math.trunc(Number(next.statusTriggerEventsCount || 0))) + 1;
        return next;
      }
      case 'RAD_ROLL': {
        next.lastRadRollEvent = {
          actionId: payload.actionId || null,
          actionName: payload.actionName || null,
          roll: Number.isFinite(Number(payload.roll)) ? Math.trunc(Number(payload.roll)) : null,
          modifier: Number.isFinite(Number(payload.modifier)) ? Math.trunc(Number(payload.modifier)) : 0,
          total: Number.isFinite(Number(payload.total)) ? Math.trunc(Number(payload.total)) : null
        };
        next.radRollEventsCount = Math.max(0, Math.trunc(Number(next.radRollEventsCount || 0))) + 1;
        return next;
      }
      case 'SAVE_DC_RESOLVED': {
        next.lastSaveDcEvent = {
          actionId: payload.actionId || null,
          actionName: payload.actionName || null,
          saveDc: Number.isFinite(Number(payload.saveDc)) ? Math.trunc(Number(payload.saveDc)) : null,
          saveType: payload.saveType || null
        };
        next.saveDcEventsCount = Math.max(0, Math.trunc(Number(next.saveDcEventsCount || 0))) + 1;
        return next;
      }
      case 'DAMAGE_APPLIED': {
        const amount = Math.max(0, Math.trunc(Number(payload.amount) || 0));
        const useTemp = payload.useTempHp !== false;
        let remainingDamage = amount;

        if (useTemp) {
          const tempHpBefore = Math.max(0, Math.trunc(Number(next.combat.hitPoints.temporary) || 0));
          const absorbedByTemp = Math.min(tempHpBefore, remainingDamage);
          next.combat.hitPoints.temporary = tempHpBefore - absorbedByTemp;
          remainingDamage -= absorbedByTemp;
        }

        const currentHpBefore = Number.isFinite(Number(next.combat.hitPoints.current))
          ? Math.trunc(Number(next.combat.hitPoints.current))
          : 0;
        next.combat.hitPoints.current = Math.max(0, currentHpBefore - remainingDamage);
        return next;
      }
      case 'HEAL_APPLIED': {
        const amount = Math.max(0, Math.trunc(Number(payload.amount) || 0));
        const currentHpBefore = Number.isFinite(Number(next.combat.hitPoints.current))
          ? Math.trunc(Number(next.combat.hitPoints.current))
          : 0;
        const maxHp = Number.isFinite(Number(next.combat.hitPoints.max))
          ? Math.trunc(Number(next.combat.hitPoints.max))
          : null;

        if (Number.isFinite(maxHp) && maxHp >= 0) {
          next.combat.hitPoints.current = Math.max(0, Math.min(maxHp, currentHpBefore + amount));
        } else {
          next.combat.hitPoints.current = Math.max(0, currentHpBefore + amount);
        }
        return next;
      }
      default:
        return next;
    }
  }

  // Pure replay helper used by tests and debug tooling.
  function replayEvents(events = [], reducer = defaultCombatReducer, initialState = createInitialReplayState()) {
    const eventList = Array.isArray(events) ? events : [];
    return eventList.reduce((state, event) => reducer(state, event), deepClone(initialState));
  }

  // Minimal event-store wrapper that supports append/list/reset/replay for runtime diagnostics.
  function createStore(initialState = createInitialReplayState()) {
    const store = {
      _initialState: deepClone(initialState),
      _events: [],
      _subscribers: new Set(),
      append(type, payload = {}, meta = {}) {
        const event = {
          id: `${Date.now()}_${this._events.length + 1}`,
          ts: new Date().toISOString(),
          type: String(type || 'UNKNOWN'),
          payload: deepClone(payload),
          meta: deepClone(meta)
        };
        this._events.push(event);
        this._emit();
        return deepClone(event);
      },
      list() {
        return deepClone(this._events);
      },
      reset() {
        this._events = [];
        this._emit();
      },
      replay(reducer = defaultCombatReducer) {
        return replayEvents(this._events, reducer, this._initialState);
      },
      subscribe(listener) {
        if (typeof listener !== 'function') return () => {};
        this._subscribers.add(listener);
        return () => this._subscribers.delete(listener);
      },
      _emit() {
        const events = this.list();
        this._subscribers.forEach((listener) => {
          try {
            listener(events);
          } catch (error) {
            console.warn('[CombatReplayLog] subscriber failed:', error);
          }
        });
      }
    };

    return store;
  }

  globalScope.CombatReplayLog = {
    createInitialReplayState,
    defaultCombatReducer,
    replayEvents,
    createStore
  };
})(window);
