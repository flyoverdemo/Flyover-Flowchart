(function attachRulesCore(globalScope) {
  const DEFAULT_ACTION_BUCKET_ORDER = ['weapons', 'spellAttacks', 'abilities', 'primary', 'bonus', 'reaction'];

  // Shared guard: ensures adapter inputs are object-like before normalization.
  function toPlainObject(value, fallback = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...fallback };
    return value;
  }

  function deepClone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  function toNumberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeModifierFromScore(score) {
    if (!Number.isFinite(score)) return null;
    return Math.floor((score - 10) / 2);
  }

  function inferTotalLevel(classCollection) {
    if (!Array.isArray(classCollection)) return null;
    const sum = classCollection.reduce((levelTotal, entry) => {
      const nextLevel = Number(entry?.level ?? entry?.lvl ?? 0);
      if (!Number.isFinite(nextLevel)) return levelTotal;
      return levelTotal + Math.max(0, Math.trunc(nextLevel));
    }, 0);
    return sum > 0 ? sum : null;
  }

  function inferProficiencyBonus(totalLevel) {
    if (!Number.isFinite(totalLevel) || totalLevel <= 0) return 2;
    return Math.max(2, Math.floor((Math.trunc(totalLevel) - 1) / 4) + 2);
  }

  // Converts the legacy action bucket structure into a single ordered action list.
  function normalizeActionCollection(rawActionStore, bucketOrder = DEFAULT_ACTION_BUCKET_ORDER) {
    // ACTION DATA PIPELINE (Rules core stage)
    // --------------------------------------
    // This adapter provides a stable action contract for downstream runtime layers.
    // We intentionally preserve `source` as deep-cloned raw data so feature flags,
    // custom metadata, and future rule hints are not lost in normalization.
    //
    // Keep these canonical keys stable: id/key/bucket/name/activation/range/toHit/
    // saveDc/damage/source. Other systems (replay, UI logs, action resolvers) rely
    // on this shape for deterministic behavior.
    const store = toPlainObject(rawActionStore);
    const orderedRawEntries = [];

    bucketOrder.forEach((bucketKey) => {
      const bucketValues = Array.isArray(store[bucketKey]) ? store[bucketKey] : [];
      bucketValues.forEach((entry) => {
        orderedRawEntries.push({ bucketKey, entry });
      });
    });

    return orderedRawEntries
      .map(({ bucketKey, entry }, index) => {
        if (!entry || typeof entry !== 'object') return null;
        const normalizedId = String(entry.id || `${bucketKey}_${index + 1}`);
        return {
          id: normalizedId,
          key: String(entry.key || entry.name || normalizedId).toLowerCase().replace(/\s+/g, '_'),
          bucket: bucketKey,
          name: String(entry.name || `Action ${index + 1}`),
          activation: String(entry.activation || entry.actionCost || 'action'),
          range: entry.range ?? entry.reach ?? entry.attackRange ?? null,
          toHit: toNumberOrNull(entry.toHit ?? entry.attackBonus ?? entry.hitBonus ?? entry.to_hit ?? entry.attackRollBonus),
          saveDc: toNumberOrNull(entry.saveDc ?? entry.dc ?? entry.saveDC),
          damage: normalizeDamageBlock(entry.damage),
          source: deepClone(entry)
        };
      })
      .filter(Boolean);
  }

  function normalizeDamageBlock(rawDamage) {
    // ACTION DATA PIPELINE NOTE:
    // We collapse common damage aliases into a single structure so that
    // rule resolvers do not need to understand importer-specific formats.
    // If additional fields are needed later (e.g., qualifier metadata),
    // they should be added here and in RulesActionCore.normalizeDamageBlock.
    if (!rawDamage) return null;
    if (typeof rawDamage === 'string' || typeof rawDamage === 'number') {
      return {
        formula: String(rawDamage),
        bonus: null,
        type: null
      };
    }

    if (typeof rawDamage === 'object') {
      return {
        formula: rawDamage.dice ?? rawDamage.value ?? rawDamage.roll ?? null,
        bonus: toNumberOrNull(rawDamage.modifier ?? rawDamage.bonus ?? rawDamage.flat),
        type: rawDamage.type ?? rawDamage.damageType ?? null
      };
    }

    return null;
  }

  function normalizeAbilityBlock(rawAbilities, proficiencyBonus = 2) {
    const abilities = toPlainObject(rawAbilities);
    const abilityKeyMap = {
      strength: ['strength', 'str'],
      dexterity: ['dexterity', 'dex'],
      constitution: ['constitution', 'con'],
      intelligence: ['intelligence', 'int'],
      wisdom: ['wisdom', 'wis'],
      charisma: ['charisma', 'cha']
    };

    const normalized = {};
    Object.entries(abilityKeyMap).forEach(([canonicalKey, aliases]) => {
      const sourceEntry = aliases
        .map((alias) => abilities[alias])
        .find((entry) => entry && typeof entry === 'object');
      const sourceScore = sourceEntry?.score ?? sourceEntry?.value ?? null;
      const score = toNumberOrNull(sourceScore);
      const sourceModifier = sourceEntry?.modifier ?? sourceEntry?.mod ?? null;
      const modifier = Number.isFinite(Number(sourceModifier))
        ? Math.trunc(Number(sourceModifier))
        : normalizeModifierFromScore(score);
      const save = Number.isFinite(Number(sourceEntry?.savingThrow))
        ? Math.trunc(Number(sourceEntry.savingThrow))
        : (Number.isFinite(modifier) ? modifier : 0);
      const saveProficient = !!sourceEntry?.proficientSave;

      normalized[canonicalKey] = {
        score,
        modifier,
        save,
        saveProficient,
        saveTotal: saveProficient ? save + proficiencyBonus : save
      };
    });

    return normalized;
  }

  function normalizeCardCatalog(cardRegistry) {
    const rawCards = toPlainObject(cardRegistry);
    return Object.values(rawCards)
      .filter((entry) => entry && typeof entry === 'object' && entry.id)
      .map((entry) => ({
        id: String(entry.id),
        key: String(entry.key || entry.id),
        family: entry.family || null,
        sourceStackId: entry.sourceStackId || null,
        label: entry.label || entry.key || entry.id,
        actionCost: entry.actionCost || null,
        detachable: !!entry.detachable,
        detached: !!entry.detached,
        ruleVariant: entry.ruleVariant || null,
        fields: deepClone(entry.fields || {})
      }));
  }

  // Canonical rules-core snapshot used by the store and adapters.
  function createEmptyState() {
    return {
      schemaVersion: 'phase1-v1',
      updatedAt: new Date().toISOString(),
      actor: {
        identity: {
          id: null,
          name: 'Unknown Character',
          race: null,
          background: null,
          classes: [],
          totalLevel: null
        },
        combat: {
          armorClass: null,
          initiativeModifier: 0,
          initiativeRolled: null,
          hitPoints: {
            current: null,
            max: null,
            temporary: 0
          },
          movement: {
            baseFt: 0,
            maxFt: 0,
            leftFt: 0
          }
        },
        abilities: {},
        proficiencies: {
          armor: [],
          weapons: [],
          tools: [],
          skills: [],
          savingThrows: []
        },
        spellcasting: {
          isSpellcaster: false,
          spellcastingAbility: null,
          spellSaveDC: null,
          spellAttackBonus: null,
          concentrationActive: false,
          slots: {}
        }
      },
      resources: {
        action: true,
        bonusAction: true,
        reaction: true,
        freeObjectInteraction: true
      },
      conditions: {
        movement: {},
        initiative: {},
        hp: {}
      },
      actions: [],
      cards: [],
      mappings: {
        actionBucketOrder: [...DEFAULT_ACTION_BUCKET_ORDER],
        actionCostToResourceKey: {},
        ruleVariantToResolver: {}
      },
      canvas: {
        viewport: {
          zoom: 1,
          panX: 0,
          panY: 0
        },
        editLayout: {
          enabled: false,
          detachedCardIds: []
        }
      },
      source: {
        hasCharacterData: false,
        hasVariableRegistry: false,
        context: 'init'
      }
    };
  }

  // Main phase-1 adapter: transforms character loader + registry data into normalized state.
  function normalizeFromCharacterData(characterData, registry = null, options = {}) {
    const state = createEmptyState();
    const sourceData = toPlainObject(characterData, null) || {};
    const globalRegistry = toPlainObject(registry?.global);
    const characterRegistry = toPlainObject(registry?.character);
    const conditionRegistry = toPlainObject(registry?.conditions);
    const mappingRegistry = toPlainObject(registry?.mappings);
    const canvasRegistry = toPlainObject(registry?.canvas);

    const identity = toPlainObject(sourceData.character);
    const demographics = toPlainObject(identity.demographics);
    const classes = Array.isArray(sourceData.classes) ? sourceData.classes : [];
    const totalLevel = toNumberOrNull(identity.level ?? sourceData.level) ?? inferTotalLevel(classes);
    const proficiencyBonus =
      toNumberOrNull(sourceData.combat?.proficiencyBonus)
      ?? toNumberOrNull(globalRegistry?.derived?.proficiencyBonus)
      ?? inferProficiencyBonus(totalLevel);

    state.actor.identity = {
      id: identity.id || options.actorId || null,
      name: String(identity.name || options.actorName || 'Unknown Character'),
      race: demographics.race || identity.race || null,
      background: demographics.background || identity.background || null,
      classes: deepClone(classes),
      totalLevel
    };

    const combat = toPlainObject(sourceData.combat);
    const hitPoints = toPlainObject(combat.hitPoints);
    const movementRaw = combat.movement ?? combat.speed ?? 0;
    const movementNumber = Number.isFinite(Number(movementRaw))
      ? Math.max(0, Math.trunc(Number(movementRaw)))
      : toNumberOrNull(String(movementRaw).match(/\d+/)?.[0]) ?? 0;

    state.actor.combat = {
      armorClass: toNumberOrNull(combat.armorClass ?? combat.ac),
      initiativeModifier: toNumberOrNull(combat.initiative ?? combat.init) ?? 0,
      initiativeRolled: null,
      hitPoints: {
        current: toNumberOrNull(hitPoints.current ?? hitPoints.value ?? combat.currentHp),
        max: toNumberOrNull(hitPoints.max ?? combat.maxHp),
        temporary: toNumberOrNull(hitPoints.temporary ?? combat.tempHp) ?? 0
      },
      movement: {
        baseFt: movementNumber,
        maxFt: movementNumber,
        leftFt: movementNumber
      }
    };

    state.actor.abilities = normalizeAbilityBlock(sourceData.abilities, proficiencyBonus);

    state.actor.proficiencies = {
      armor: Array.isArray(sourceData.resources?.proficiencies?.armor) ? [...sourceData.resources.proficiencies.armor] : [],
      weapons: Array.isArray(sourceData.resources?.proficiencies?.weapons) ? [...sourceData.resources.proficiencies.weapons] : [],
      tools: Array.isArray(sourceData.resources?.proficiencies?.tools) ? [...sourceData.resources.proficiencies.tools] : [],
      skills: Array.isArray(sourceData.resources?.proficiencies?.skills) ? [...sourceData.resources.proficiencies.skills] : [],
      savingThrows: Array.isArray(sourceData.resources?.proficiencies?.savingThrows) ? [...sourceData.resources.proficiencies.savingThrows] : []
    };

    const rawSpellcasting = toPlainObject(sourceData.spellcasting);
    const rawConcentration = toPlainObject(rawSpellcasting.concentration);
    state.actor.spellcasting = {
      isSpellcaster: !!rawSpellcasting.isSpellcaster,
      spellcastingAbility: rawSpellcasting.spellcastingAbility || null,
      spellSaveDC: toNumberOrNull(rawSpellcasting.spellSaveDC),
      spellAttackBonus: toNumberOrNull(rawSpellcasting.spellAttackBonus),
      concentrationActive: !!rawConcentration.active,
      slots: deepClone(rawSpellcasting.slots || {})
    };

    const actionBucketOrder = Array.isArray(mappingRegistry.actionBucketOrder)
      ? mappingRegistry.actionBucketOrder
      : DEFAULT_ACTION_BUCKET_ORDER;

    state.actions = normalizeActionCollection(sourceData.actions, actionBucketOrder);

    state.cards = normalizeCardCatalog(registry?.cards || {});

    state.resources = {
      action: globalRegistry?.resources?.primaryActionAvailable !== false,
      bonusAction: globalRegistry?.resources?.bonusActionAvailable !== false,
      reaction: globalRegistry?.resources?.reactionAvailable !== false,
      freeObjectInteraction: globalRegistry?.resources?.freeObjectInteractionAvailable !== false
    };

    state.conditions = {
      movement: deepClone(conditionRegistry.movement || {}),
      initiative: deepClone(conditionRegistry.initiative || {}),
      hp: deepClone(conditionRegistry.hp || {})
    };

    state.mappings = {
      actionBucketOrder: [...actionBucketOrder],
      actionCostToResourceKey: deepClone(mappingRegistry.actionCostToResourceKey || {}),
      ruleVariantToResolver: deepClone(mappingRegistry.ruleVariantToResolver || {})
    };

    state.canvas = {
      viewport: {
        zoom: toNumberOrNull(canvasRegistry?.viewport?.zoom) ?? 1,
        panX: toNumberOrNull(canvasRegistry?.viewport?.panX) ?? 0,
        panY: toNumberOrNull(canvasRegistry?.viewport?.panY) ?? 0
      },
      editLayout: {
        enabled: !!canvasRegistry?.editLayout?.enabled,
        detachedCardIds: Array.isArray(canvasRegistry?.editLayout?.detachedCardIds)
          ? [...canvasRegistry.editLayout.detachedCardIds]
          : []
      }
    };

    state.source = {
      hasCharacterData: !!characterData,
      hasVariableRegistry: !!registry,
      context: options.context || 'normalize'
    };
    state.updatedAt = new Date().toISOString();

    return state;
  }

  // Runtime capture bridge used by index.html to sync live legacy values into RulesCore.
  function captureLegacyRuntime(payload = {}) {
    const characterData = payload.characterData || globalScope.characterLoader?.characterData || null;
    const registry = payload.registry || globalScope.rpgVariableRegistry || null;
    const normalized = normalizeFromCharacterData(characterData, registry, {
      context: payload.context || 'capture-runtime',
      actorName: payload.actorName || null,
      actorId: payload.actorId || null
    });

    if (payload.overrides && typeof payload.overrides === 'object') {
      const overrides = payload.overrides;
      if (Number.isFinite(Number(overrides.armorClass))) {
        normalized.actor.combat.armorClass = Math.trunc(Number(overrides.armorClass));
      }
      if (Number.isFinite(Number(overrides.initiativeRolled))) {
        normalized.actor.combat.initiativeRolled = Math.trunc(Number(overrides.initiativeRolled));
      }
      if (overrides.movement && typeof overrides.movement === 'object') {
        const baseFt = toNumberOrNull(overrides.movement.baseFt);
        const maxFt = toNumberOrNull(overrides.movement.maxFt);
        const leftFt = toNumberOrNull(overrides.movement.leftFt);
        if (Number.isFinite(baseFt)) normalized.actor.combat.movement.baseFt = Math.max(0, Math.trunc(baseFt));
        if (Number.isFinite(maxFt)) normalized.actor.combat.movement.maxFt = Math.max(0, Math.trunc(maxFt));
        if (Number.isFinite(leftFt)) normalized.actor.combat.movement.leftFt = Math.max(0, Math.trunc(leftFt));
      }
      if (overrides.hitPoints && typeof overrides.hitPoints === 'object') {
        const hpCurrent = toNumberOrNull(overrides.hitPoints.current);
        const hpMax = toNumberOrNull(overrides.hitPoints.max);
        const hpTemp = toNumberOrNull(overrides.hitPoints.temporary);
        if (Number.isFinite(hpCurrent)) normalized.actor.combat.hitPoints.current = Math.trunc(hpCurrent);
        if (Number.isFinite(hpMax)) normalized.actor.combat.hitPoints.max = Math.trunc(hpMax);
        if (Number.isFinite(hpTemp)) normalized.actor.combat.hitPoints.temporary = Math.trunc(hpTemp);
      }
      if (overrides.resources && typeof overrides.resources === 'object') {
        if (typeof overrides.resources.action === 'boolean') {
          normalized.resources.action = overrides.resources.action;
        }
        if (typeof overrides.resources.bonusAction === 'boolean') {
          normalized.resources.bonusAction = overrides.resources.bonusAction;
        }
        if (typeof overrides.resources.reaction === 'boolean') {
          normalized.resources.reaction = overrides.resources.reaction;
        }
        if (typeof overrides.resources.freeObjectInteraction === 'boolean') {
          normalized.resources.freeObjectInteraction = overrides.resources.freeObjectInteraction;
        }
      }
    }

    normalized.updatedAt = new Date().toISOString();
    return normalized;
  }

  // Inverse adapter used by writeback helpers to project normalized state to legacy fields.
  function toLegacyPatch(normalizedState) {
    const state = normalizedState || createEmptyState();
    return {
      combat: {
        armorClass: state.actor?.combat?.armorClass ?? null,
        initiativeModifier: state.actor?.combat?.initiativeModifier ?? 0,
        initiativeRolled: state.actor?.combat?.initiativeRolled ?? null,
        hitPoints: deepClone(state.actor?.combat?.hitPoints || {}),
        movement: deepClone(state.actor?.combat?.movement || {})
      },
      resources: {
        primaryActionAvailable: !!state.resources?.action,
        bonusActionAvailable: !!state.resources?.bonusAction,
        reactionAvailable: !!state.resources?.reaction,
        freeObjectInteractionAvailable: !!state.resources?.freeObjectInteraction
      },
      conditions: deepClone(state.conditions || {}),
      cards: deepClone(state.cards || []),
      actions: deepClone(state.actions || [])
    };
  }

  class RulesCoreStore {
    constructor(initialState = createEmptyState()) {
      this._state = deepClone(initialState);
      this._subscribers = new Set();
    }

    getState() {
      return deepClone(this._state);
    }

    // Full-state replacement entrypoint used for sync and deterministic updates.
    replaceState(nextState, meta = {}) {
      this._state = deepClone(nextState || createEmptyState());
      this._state.updatedAt = new Date().toISOString();
      this._state.source = {
        ...(this._state.source || {}),
        context: meta.context || this._state.source?.context || 'replace'
      };
      this._emit();
      return this.getState();
    }

    // Mutating convenience layer that applies a mutator and then emits as replaceState.
    patchState(mutator, meta = {}) {
      const draft = this.getState();
      if (typeof mutator === 'function') {
        mutator(draft);
      }
      return this.replaceState(draft, meta);
    }

    subscribe(listener) {
      if (typeof listener !== 'function') {
        return () => {};
      }
      this._subscribers.add(listener);
      return () => {
        this._subscribers.delete(listener);
      };
    }

    _emit() {
      this._subscribers.forEach((listener) => {
        try {
          listener(this.getState());
        } catch (error) {
          console.warn('[RulesCore] Subscriber callback failed:', error);
        }
      });
    }
  }

  // Factory kept small so callers can swap initial state while reusing store semantics.
  function createStore(initialState) {
    return new RulesCoreStore(initialState);
  }

  // Convenience bootstrap for one-shot migration from current window legacy runtime.
  function initFromCurrentWindow(payload = {}) {
    const state = captureLegacyRuntime(payload);
    const store = createStore(state);
    return {
      store,
      state
    };
  }

  const RulesCore = {
    createEmptyState,
    createStore,
    initFromCurrentWindow,
    adapters: {
      normalizeFromCharacterData,
      normalizeActionCollection,
      normalizeCardCatalog,
      captureLegacyRuntime,
      toLegacyPatch
    }
  };

  globalScope.RulesCore = RulesCore;
})(window);
