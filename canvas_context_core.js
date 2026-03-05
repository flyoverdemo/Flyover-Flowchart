(function attachCanvasContextCore(globalScope) {
  const DEFAULT_PRIMARY_STAT_KEYS = [
    'armorClass',
    'initiativeModifier',
    'initiativeRolled',
    'hitPointsCurrent',
    'hitPointsMax',
    'temporaryHitPoints',
    'speedFt'
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

  function createEmptyState() {
    return {
      schemaVersion: 'canvas-modes-v0',
      updatedAt: new Date().toISOString(),
      mode: 'player',
      playerCanvas: {
        primaryCombatantId: null,
        primaryListing: {
          combatantId: null,
          label: 'Primary Character',
          statKeys: [...DEFAULT_PRIMARY_STAT_KEYS],
          mirrorDmCards: true
        },
        allowedCardSources: ['player', 'dm'],
        mirroredCardIds: []
      },
      dmCanvas: {
        combatantOrder: [],
        combatants: {}
      },
      links: {
        primaryCombatantId: null,
        dmPrimaryProxyId: null
      },
      source: {
        context: 'init'
      }
    };
  }

  function normalizeCombatantSeed(seed = {}) {
    const source = seed && typeof seed === 'object' ? seed : {};
    const fallbackId = `combatant_${Date.now()}`;
    const normalizedId = String(source.id || fallbackId);

    return {
      id: normalizedId,
      name: String(source.name || 'Unknown Combatant'),
      kind: ['player', 'enemy', 'npc'].includes(String(source.kind || '').toLowerCase())
        ? String(source.kind).toLowerCase()
        : 'npc',
      isPrimaryReference: !!source.isPrimaryReference,
      sourceType: String(source.sourceType || 'manual'),
      readOnlyStatKeys: Array.isArray(source.readOnlyStatKeys)
        ? source.readOnlyStatKeys.map((entry) => String(entry))
        : [],
      stats: {
        armorClass: toNumberOrNull(source.stats?.armorClass),
        initiativeModifier: toNumberOrNull(source.stats?.initiativeModifier) ?? 0,
        initiativeRolled: toNumberOrNull(source.stats?.initiativeRolled),
        hitPointsCurrent: toNumberOrNull(source.stats?.hitPointsCurrent),
        hitPointsMax: toNumberOrNull(source.stats?.hitPointsMax),
        temporaryHitPoints: toNumberOrNull(source.stats?.temporaryHitPoints) ?? 0,
        speedFt: toNumberOrNull(source.stats?.speedFt)
      },
      defenses: {
        damageImmunities:
          source.defenses?.damageImmunities
          ?? source.damageImmunities
          ?? source.damage_immunities
          ?? source.stats?.damageImmunities
          ?? source.stats?.damage_immunities
          ?? [],
        damageResistances:
          source.defenses?.damageResistances
          ?? source.damageResistances
          ?? source.damage_resistances
          ?? source.stats?.damageResistances
          ?? source.stats?.damage_resistances
          ?? [],
        damageVulnerabilities:
          source.defenses?.damageVulnerabilities
          ?? source.damageVulnerabilities
          ?? source.damage_vulnerabilities
          ?? source.stats?.damageVulnerabilities
          ?? source.stats?.damage_vulnerabilities
          ?? [],
        conditionImmunities:
          source.defenses?.conditionImmunities
          ?? source.conditionImmunities
          ?? source.condition_immunities
          ?? source.stats?.conditionImmunities
          ?? source.stats?.condition_immunities
          ?? []
      },
      actionRefs: Array.isArray(source.actionRefs)
        ? source.actionRefs.map((entry) => String(entry))
        : []
    };
  }

  function capturePrimaryFromLegacy(payload = {}) {
    const characterData = payload.characterData || globalScope.characterLoader?.characterData || {};
    const combat = characterData?.combat || {};
    const hp = combat?.hitPoints || combat?.hp || {};

    return normalizeCombatantSeed({
      id: payload.primaryId || 'primary_character',
      name: characterData?.character?.name || characterData?.name || 'Primary Character',
      kind: 'player',
      isPrimaryReference: true,
      sourceType: 'primary-character',
      readOnlyStatKeys: [...DEFAULT_PRIMARY_STAT_KEYS],
      stats: {
        armorClass: combat?.armorClass ?? combat?.ac,
        initiativeModifier: combat?.initiative ?? combat?.init ?? 0,
        initiativeRolled: payload.initiativeRolled,
        hitPointsCurrent: hp?.current ?? hp?.value ?? combat?.currentHp ?? combat?.hpCurrent,
        hitPointsMax: hp?.max ?? combat?.maxHp ?? combat?.hpMax,
        temporaryHitPoints: hp?.temporary ?? combat?.tempHp ?? 0,
        speedFt: combat?.speed ?? combat?.movement
      },
      defenses: {
        damageImmunities:
          characterData?.defenses?.damageImmunities
          ?? characterData?.damageImmunities
          ?? characterData?.damage_immunities
          ?? [],
        damageResistances:
          characterData?.defenses?.damageResistances
          ?? characterData?.damageResistances
          ?? characterData?.damage_resistances
          ?? [],
        damageVulnerabilities:
          characterData?.defenses?.damageVulnerabilities
          ?? characterData?.damageVulnerabilities
          ?? characterData?.damage_vulnerabilities
          ?? [],
        conditionImmunities:
          characterData?.defenses?.conditionImmunities
          ?? characterData?.conditionImmunities
          ?? characterData?.condition_immunities
          ?? []
      }
    });
  }

  function applyPrimaryToState(draft, primaryCombatant, context = 'sync') {
    const primary = normalizeCombatantSeed(primaryCombatant);

    draft.playerCanvas.primaryCombatantId = primary.id;
    draft.playerCanvas.primaryListing = {
      combatantId: primary.id,
      label: primary.name,
      statKeys: [...DEFAULT_PRIMARY_STAT_KEYS],
      mirrorDmCards: true
    };

    draft.links.primaryCombatantId = primary.id;
    draft.links.dmPrimaryProxyId = primary.id;

    if (!draft.dmCanvas || typeof draft.dmCanvas !== 'object') {
      draft.dmCanvas = { combatantOrder: [], combatants: {} };
    }
    if (!draft.dmCanvas.combatants || typeof draft.dmCanvas.combatants !== 'object') {
      draft.dmCanvas.combatants = {};
    }
    if (!Array.isArray(draft.dmCanvas.combatantOrder)) {
      draft.dmCanvas.combatantOrder = [];
    }

    draft.dmCanvas.combatants[primary.id] = primary;
    if (!draft.dmCanvas.combatantOrder.includes(primary.id)) {
      draft.dmCanvas.combatantOrder.unshift(primary.id);
    }

    draft.updatedAt = new Date().toISOString();
    draft.source = {
      ...(draft.source || {}),
      context
    };
  }

  function createScaffoldFromLegacy(payload = {}) {
    const state = createEmptyState();
    const primary = capturePrimaryFromLegacy(payload);
    applyPrimaryToState(state, primary, payload.context || 'bootstrap');
    return state;
  }

  class CanvasContextStore {
    constructor(initialState = createEmptyState()) {
      this._state = deepClone(initialState);
      this._subscribers = new Set();
    }

    getState() {
      return deepClone(this._state);
    }

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
      return () => this._subscribers.delete(listener);
    }

    _emit() {
      this._subscribers.forEach((listener) => {
        try {
          listener(this.getState());
        } catch (error) {
          console.warn('[CanvasContextCore] subscriber callback failed:', error);
        }
      });
    }
  }

  function createStore(initialState = createEmptyState()) {
    return new CanvasContextStore(initialState);
  }

  function ensureCanvasContextStore(context = 'ensure-store') {
    if (!globalScope.canvasContextStore || typeof globalScope.canvasContextStore.patchState !== 'function') {
      globalScope.canvasContextStore = createStore(createScaffoldFromLegacy({ context }));
    }
    return globalScope.canvasContextStore;
  }

  function syncCanvasContextState(context = 'manual-sync') {
    const store = ensureCanvasContextStore(`${context}:ensure-store`);
    const primary = capturePrimaryFromLegacy({ context });
    store.patchState((draft) => {
      applyPrimaryToState(draft, primary, context);
    }, { context });

    const state = store.getState();
    globalScope.dispatchEvent(new CustomEvent('canvas-context:updated', {
      detail: {
        context,
        state
      }
    }));

    if (typeof globalScope.syncCombatantDefenseProfileScaffold === 'function') {
      globalScope.syncCombatantDefenseProfileScaffold({
        combatantId: primary.id,
        combatant: primary,
        replace: true
      }, `${context}:sync-primary-defense-profile`);
    }

    return state;
  }

  function setCanvasMode(mode, context = 'canvas-mode:set-mode') {
    const nextMode = String(mode || '').toLowerCase() === 'dm' ? 'dm' : 'player';
    const store = ensureCanvasContextStore(`${context}:ensure-store`);
    store.patchState((draft) => {
      draft.mode = nextMode;
    }, { context });
    return store.getState();
  }

  function upsertDmCombatant(seed = {}, context = 'canvas-mode:upsert-dm-combatant') {
    const normalized = normalizeCombatantSeed(seed);
    const store = ensureCanvasContextStore(`${context}:ensure-store`);
    store.patchState((draft) => {
      draft.dmCanvas.combatants[normalized.id] = normalized;
      if (!draft.dmCanvas.combatantOrder.includes(normalized.id)) {
        draft.dmCanvas.combatantOrder.push(normalized.id);
      }
    }, { context });

    if (typeof globalScope.syncCombatantDefenseProfileScaffold === 'function') {
      globalScope.syncCombatantDefenseProfileScaffold({
        combatantId: normalized.id,
        combatant: normalized,
        replace: true
      }, `${context}:sync-dm-defense-profile`);
    }

    return store.getState();
  }

  function setPlayerCanvasPrimaryCombatant(combatantId, context = 'canvas-mode:set-player-primary') {
    const normalizedId = String(combatantId || '').trim();
    if (!normalizedId) return null;

    const store = ensureCanvasContextStore(`${context}:ensure-store`);
    let hasCombatant = false;
    store.patchState((draft) => {
      const combatant = draft.dmCanvas.combatants[normalizedId];
      if (!combatant) return;
      hasCombatant = true;
      draft.playerCanvas.primaryCombatantId = normalizedId;
      draft.playerCanvas.primaryListing = {
        combatantId: normalizedId,
        label: combatant.name,
        statKeys: [...DEFAULT_PRIMARY_STAT_KEYS],
        mirrorDmCards: true
      };
      draft.links.primaryCombatantId = normalizedId;
    }, { context });

    return hasCombatant ? store.getState() : null;
  }

  function getCanvasModeScaffoldSnapshot() {
    const state = ensureCanvasContextStore('snapshot:ensure-store').getState();
    const combatants = state.dmCanvas?.combatants || {};
    const orderedCombatants = Array.isArray(state.dmCanvas?.combatantOrder)
      ? state.dmCanvas.combatantOrder
          .map((id) => combatants[id])
          .filter(Boolean)
          .map((entry) => ({
            id: entry.id,
            name: entry.name,
            kind: entry.kind,
            isPrimaryReference: !!entry.isPrimaryReference,
            sourceType: entry.sourceType
          }))
      : [];

    return {
      mode: state.mode,
      playerPrimary: deepClone(state.playerCanvas?.primaryListing || null),
      dmCombatantCount: orderedCombatants.length,
      dmCombatants: orderedCombatants
    };
  }

  const CanvasContextCore = {
    createEmptyState,
    createStore,
    adapters: {
      normalizeCombatantSeed,
      capturePrimaryFromLegacy,
      createScaffoldFromLegacy,
      applyPrimaryToState
    }
  };

  globalScope.CanvasContextCore = CanvasContextCore;
  globalScope.syncCanvasContextState = syncCanvasContextState;
  globalScope.setCanvasModeScaffoldMode = setCanvasMode;
  globalScope.upsertDmCanvasCombatantScaffold = upsertDmCombatant;
  globalScope.setPlayerCanvasPrimaryCombatant = setPlayerCanvasPrimaryCombatant;
  globalScope.getCanvasModeScaffoldSnapshot = getCanvasModeScaffoldSnapshot;
})(window);
