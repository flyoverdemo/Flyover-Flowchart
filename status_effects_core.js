(function attachStatusEffectsCore(globalScope) {
  /*
    STATUS EFFECT CATALOG (ordered)
    CORE 5E CONDITIONS
    1) blinded
    2) charmed
    3) deafened
    4) frightened
    5) grappled
    6) incapacitated
    7) invisible
    8) paralyzed
    9) petrified
    10) poisoned
    11) prone
    12) restrained
    13) stunned
    14) unconscious
    15) exhaustion (level-based placeholder scaffold)

    EXTENDED CUSTOM EFFECTS
    16) dodged
    17) helped_attack
    18) concentration_link

    RULE ALIGNMENT GUARDRAIL
    - Before adding or changing an effect definition, review the project reference set:
      reference/CHARACTER_SCHEMA_GUIDE.md
      reference/DATA_ORGANIZATION_CONCEPTUAL.md
      reference/SCHEMA_REORGANIZATION.md
    - Cross-check semantics against official SRD wording (Open5e and D&D Beyond SRD pages).
    - Keep effect IDs stable and append new effects instead of repurposing existing IDs.
    - If an effect deviates from core 5e rules, mark it as custom in label/notes and keep default behavior conservative.
  */
  const EFFECT_ID_ALIASES = {
    dodge: 'dodged',
    help: 'helped_attack',
    help_attack: 'helped_attack',
    concentration: 'concentration_link'
  };

  const KNOWN_DAMAGE_TYPES = [
    'acid',
    'bludgeoning',
    'cold',
    'fire',
    'force',
    'lightning',
    'necrotic',
    'piercing',
    'poison',
    'psychic',
    'radiant',
    'slashing',
    'thunder'
  ];

  const STATUS_EFFECTS_STORAGE_KEY = 'chain_warden_status_effects_store_v1';

  const DEFAULT_EFFECT_LIBRARY = {
    blinded: {
      id: 'blinded',
      label: 'Blinded',
      applicationMode: 'applied',
      relationshipScope: 'target',
      attackModifiers: {
        outgoingAttackDisadvantage: true,
        incomingAttackAdvantage: true
      },
      lifecycleHooks: { on_hit_apply: [], on_miss_apply: [], start_turn_tick: [], end_turn_expire: [] },
      conditionPatch: { movement: {}, initiative: {}, hp: {} },
      notes: 'Scaffolded: line-of-sight interaction details remain resolver-level.'
    },
    charmed: {
      id: 'charmed',
      label: 'Charmed',
      applicationMode: 'applied',
      relationshipScope: 'relationship',
      attackModifiers: {},
      lifecycleHooks: { on_hit_apply: [], on_miss_apply: [], start_turn_tick: [], end_turn_expire: [] },
      conditionPatch: { movement: {}, initiative: {}, hp: {} },
      notes: 'Scaffolded: charmer-specific target restrictions are not auto-enforced yet.'
    },
    deafened: {
      id: 'deafened',
      label: 'Deafened',
      applicationMode: 'applied',
      relationshipScope: 'target',
      attackModifiers: {},
      lifecycleHooks: { on_hit_apply: [], on_miss_apply: [], start_turn_tick: [], end_turn_expire: [] },
      conditionPatch: { movement: {}, initiative: {}, hp: {} },
      notes: 'Scaffolded: perception/audio dependency checks are not auto-enforced yet.'
    },
    frightened: {
      id: 'frightened',
      label: 'Frightened',
      applicationMode: 'applied',
      relationshipScope: 'relationship',
      attackModifiers: {
        outgoingAttackDisadvantage: true
      },
      lifecycleHooks: { on_hit_apply: [], on_miss_apply: [], start_turn_tick: [], end_turn_expire: [] },
      conditionPatch: { movement: {}, initiative: {}, hp: {} },
      notes: 'Scaffolded: source line-of-sight movement restrictions remain pending.'
    },
    grappled: {
      id: 'grappled',
      label: 'Grappled',
      applicationMode: 'applied',
      relationshipScope: 'target',
      attackModifiers: {},
      lifecycleHooks: { on_hit_apply: [], on_miss_apply: [], start_turn_tick: [], end_turn_expire: [] },
      conditionPatch: { movement: { grappled: true }, initiative: {}, hp: {} }
    },
    incapacitated: {
      id: 'incapacitated',
      label: 'Incapacitated',
      applicationMode: 'applied',
      relationshipScope: 'target',
      attackModifiers: {
        outgoingAttackDisadvantage: true
      },
      lifecycleHooks: { on_hit_apply: [], on_miss_apply: [], start_turn_tick: [], end_turn_expire: [] },
      resourceLocks: { action: true, bonusAction: true, reaction: true },
      conditionPatch: { movement: {}, initiative: {}, hp: {} },
      notes: 'Scaffolded: action/reaction lock should be enforced by action economy layer.'
    },
    invisible: {
      id: 'invisible',
      label: 'Invisible',
      applicationMode: 'applied',
      relationshipScope: 'target',
      attackModifiers: {
        outgoingAttackAdvantage: true,
        incomingAttackDisadvantage: true
      },
      lifecycleHooks: { on_hit_apply: [], on_miss_apply: [], start_turn_tick: [], end_turn_expire: [] },
      conditionPatch: { movement: {}, initiative: {}, hp: {} }
    },
    paralyzed: {
      id: 'paralyzed',
      label: 'Paralyzed',
      applicationMode: 'applied',
      relationshipScope: 'target',
      attackModifiers: {
        outgoingAttackDisadvantage: true,
        incomingAttackAdvantage: true
      },
      lifecycleHooks: { on_hit_apply: [], on_miss_apply: [], start_turn_tick: [], end_turn_expire: [] },
      resourceLocks: { action: true, bonusAction: true, reaction: true },
      conditionPatch: { movement: { restrained: true }, initiative: {}, hp: {} },
      notes: 'Scaffolded: auto-crit at 5ft is not modeled yet.'
    },
    petrified: {
      id: 'petrified',
      label: 'Petrified',
      applicationMode: 'applied',
      relationshipScope: 'target',
      attackModifiers: {
        outgoingAttackDisadvantage: true,
        incomingAttackAdvantage: true
      },
      lifecycleHooks: { on_hit_apply: [], on_miss_apply: [], start_turn_tick: [], end_turn_expire: [] },
      resourceLocks: { action: true, bonusAction: true, reaction: true },
      conditionPatch: { movement: { restrained: true }, initiative: {}, hp: {} },
      notes: 'Scaffolded: resistance and disease/poison immunity side effects not automated yet.'
    },
    poisoned: {
      id: 'poisoned',
      label: 'Poisoned',
      applicationMode: 'applied',
      relationshipScope: 'target',
      attackModifiers: {
        outgoingAttackDisadvantage: true
      },
      lifecycleHooks: { on_hit_apply: [], on_miss_apply: [], start_turn_tick: [], end_turn_expire: [] },
      conditionPatch: { movement: {}, initiative: {}, hp: {} }
    },
    prone: {
      id: 'prone',
      label: 'Prone',
      applicationMode: 'applied',
      relationshipScope: 'target',
      attackModifiers: {},
      lifecycleHooks: { on_hit_apply: [], on_miss_apply: [], start_turn_tick: [], end_turn_expire: [] },
      conditionPatch: { movement: { prone: true }, initiative: {}, hp: {} },
      notes: 'Scaffolded: melee/ranged split advantage logic is pending distance-aware resolver support.'
    },
    dodged: {
      id: 'dodged',
      label: 'Dodge',
      applicationMode: 'applied',
      relationshipScope: 'target',
      attackModifiers: {
        incomingAttackDisadvantage: true
      },
      lifecycleHooks: {
        on_hit_apply: [],
        on_miss_apply: [],
        start_turn_tick: [],
        end_turn_expire: []
      },
      conditionPatch: {
        initiative: {},
        movement: {},
        hp: {}
      }
    },
    helped_attack: {
      id: 'helped_attack',
      label: 'Help (Attack)',
      applicationMode: 'applied',
      relationshipScope: 'attacker',
      attackModifiers: {
        outgoingAttackAdvantage: true,
        consumeOnHitOrMiss: true
      },
      lifecycleHooks: {
        on_hit_apply: [],
        on_miss_apply: [],
        start_turn_tick: [],
        end_turn_expire: [
          {
            action: 'expire_effect',
            target: 'effect_target'
          }
        ]
      },
      conditionPatch: {
        initiative: {},
        movement: {},
        hp: {}
      }
    },
    restrained: {
      id: 'restrained',
      label: 'Restrained',
      applicationMode: 'applied',
      relationshipScope: 'target',
      attackModifiers: {
        incomingAttackAdvantage: true,
        outgoingAttackDisadvantage: true
      },
      lifecycleHooks: {
        on_hit_apply: [],
        on_miss_apply: [],
        start_turn_tick: [],
        end_turn_expire: []
      },
      conditionPatch: {
        movement: { restrained: true }
      }
    },
    stunned: {
      id: 'stunned',
      label: 'Stunned',
      applicationMode: 'applied',
      relationshipScope: 'target',
      attackModifiers: {
        outgoingAttackDisadvantage: true,
        incomingAttackAdvantage: true
      },
      lifecycleHooks: { on_hit_apply: [], on_miss_apply: [], start_turn_tick: [], end_turn_expire: [] },
      resourceLocks: { action: true, bonusAction: true, reaction: true },
      conditionPatch: { movement: { restrained: true }, initiative: {}, hp: {} },
      notes: 'Scaffolded: full action/speech incapacitation handling remains pending action-layer integration.'
    },
    unconscious: {
      id: 'unconscious',
      label: 'Unconscious',
      applicationMode: 'applied',
      relationshipScope: 'target',
      attackModifiers: {
        outgoingAttackDisadvantage: true,
        incomingAttackAdvantage: true
      },
      lifecycleHooks: { on_hit_apply: [], on_miss_apply: [], start_turn_tick: [], end_turn_expire: [] },
      resourceLocks: { action: true, bonusAction: true, reaction: true },
      conditionPatch: { movement: { prone: true }, initiative: {}, hp: {} },
      notes: 'Scaffolded: auto-crit at 5ft and death-save interactions are not automated yet.'
    },
    exhaustion: {
      id: 'exhaustion',
      label: 'Exhaustion',
      applicationMode: 'applied',
      relationshipScope: 'target',
      attackModifiers: {
        outgoingAttackDisadvantage: true
      },
      lifecycleHooks: { on_hit_apply: [], on_miss_apply: [], start_turn_tick: [], end_turn_expire: [] },
      conditionPatch: { movement: {}, initiative: {}, hp: {} },
      notes: 'Scaffolded: level-by-level exhaustion penalties require dedicated level state support.'
    },
    concentration_link: {
      id: 'concentration_link',
      label: 'Concentration Link',
      applicationMode: 'inherited',
      relationshipScope: 'source_and_inherited_targets',
      attackModifiers: {},
      lifecycleHooks: {
        on_hit_apply: [],
        on_miss_apply: [],
        start_turn_tick: [],
        end_turn_expire: []
      },
      conditionPatch: {
        hp: {}
      }
    }
  };

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

  function slugifyRuleToken(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/condition$/i, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function toList(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    if (typeof value === 'string') {
      return value
        .split(/,|;|\n|\|/g)
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
    }
    if (typeof value === 'object') {
      return Object.entries(value)
        .filter(([, enabled]) => enabled)
        .map(([entry]) => String(entry || '').trim())
        .filter(Boolean);
    }
    return [value];
  }

  function toDamageTypeSet(value) {
    const knownTypes = new Set(KNOWN_DAMAGE_TYPES);
    const normalized = new Set();
    toList(value).forEach((rawEntry) => {
      const lowered = String(rawEntry || '').toLowerCase();
      knownTypes.forEach((damageType) => {
        if (lowered === damageType || lowered.includes(damageType)) {
          normalized.add(damageType);
        }
      });
    });
    return normalized;
  }

  function toDamageDefenseEntries(value) {
    const entries = [];
    const dedupe = new Set();

    toList(value).forEach((rawEntry) => {
      const rawText = typeof rawEntry === 'object' && rawEntry !== null
        ? String(rawEntry.raw || rawEntry.label || rawEntry.damageType || rawEntry.type || '').trim()
        : String(rawEntry || '').trim();
      if (!rawText) return;

      const lowered = rawText.toLowerCase();
      const matchedDamageTypes = [];
      const explicitDamageType = typeof rawEntry === 'object' && rawEntry !== null
        ? String(rawEntry.damageType || rawEntry.type || '').trim().toLowerCase()
        : '';

      if (explicitDamageType && KNOWN_DAMAGE_TYPES.includes(explicitDamageType)) {
        matchedDamageTypes.push(explicitDamageType);
      }

      KNOWN_DAMAGE_TYPES.forEach((damageType) => {
        if (lowered === damageType || lowered.includes(damageType)) {
          if (matchedDamageTypes.includes(damageType)) return;
          matchedDamageTypes.push(damageType);
        }
      });

      const qualifierMeta = {
        requiresNonmagical: (typeof rawEntry === 'object' && rawEntry !== null && rawEntry.requiresNonmagical === true) || lowered.includes('nonmagical'),
        requiresMagical: (typeof rawEntry === 'object' && rawEntry !== null && rawEntry.requiresMagical === true) || (!lowered.includes('nonmagical') && lowered.includes('magical')),
        bypassedBySilvered: (typeof rawEntry === 'object' && rawEntry !== null && rawEntry.bypassedBySilvered === true) || lowered.includes('silvered'),
        bypassedByAdamantine: (typeof rawEntry === 'object' && rawEntry !== null && rawEntry.bypassedByAdamantine === true) || lowered.includes('adamantine')
      };

      matchedDamageTypes.forEach((damageType) => {
        const key = [
          damageType,
          qualifierMeta.requiresNonmagical ? 'nonmagical' : '',
          qualifierMeta.requiresMagical ? 'magical' : '',
          qualifierMeta.bypassedBySilvered ? 'silvered-bypass' : '',
          qualifierMeta.bypassedByAdamantine ? 'adamantine-bypass' : ''
        ].join('|');
        if (dedupe.has(key)) return;
        dedupe.add(key);
        entries.push({
          damageType,
          ...qualifierMeta,
          raw: rawText
        });
      });
    });

    return entries;
  }

  function toConditionIdSet(value, definitions = null) {
    const normalized = new Set();
    const definitionMap = definitions && typeof definitions === 'object' ? definitions : null;

    toList(value).forEach((rawEntry) => {
      const slug = slugifyRuleToken(rawEntry);
      if (!slug) return;
      const resolvedId = resolveDefinitionId(slug, definitionMap);
      if (!resolvedId) return;
      normalized.add(resolvedId);
    });

    return normalized;
  }

  function createEmptyDefenseProfile() {
    return {
      damageImmunities: [],
      damageResistances: [],
      damageVulnerabilities: [],
      conditionImmunities: [],
      damageImmunityEntries: [],
      damageResistanceEntries: [],
      damageVulnerabilityEntries: []
    };
  }

  const defenseAliasWarnings = new Set();

  function warnDefenseAliasOnce(code, message, details = {}) {
    if (defenseAliasWarnings.has(code)) return;
    defenseAliasWarnings.add(code);
    try {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn(`[StatusEffectsCore] ${message}`, details);
      }
    } catch {}
  }

  function normalizeDefenseProfile(rawProfile = {}, definitions = null) {
    const source = rawProfile && typeof rawProfile === 'object' ? rawProfile : {};

    if (source.damage_immunities !== undefined || source.immunities !== undefined) {
      warnDefenseAliasOnce('alias_damage_immunities', 'Legacy damage immunity aliases detected at status boundary; prefer canonical `damageImmunities`.', {
        hasSnakeCase: source.damage_immunities !== undefined,
        hasGenericImmunities: source.immunities !== undefined
      });
    }
    if (source.damage_resistances !== undefined || source.resistances !== undefined) {
      warnDefenseAliasOnce('alias_damage_resistances', 'Legacy damage resistance aliases detected at status boundary; prefer canonical `damageResistances`.', {
        hasSnakeCase: source.damage_resistances !== undefined,
        hasGenericResistances: source.resistances !== undefined
      });
    }
    if (source.damage_vulnerabilities !== undefined || source.vulnerabilities !== undefined) {
      warnDefenseAliasOnce('alias_damage_vulnerabilities', 'Legacy damage vulnerability aliases detected at status boundary; prefer canonical `damageVulnerabilities`.', {
        hasSnakeCase: source.damage_vulnerabilities !== undefined,
        hasGenericVulnerabilities: source.vulnerabilities !== undefined
      });
    }
    if (source.condition_immunities !== undefined) {
      warnDefenseAliasOnce('alias_condition_immunities', 'Legacy condition immunity alias detected at status boundary; prefer canonical `conditionImmunities`.', {
        hasSnakeCase: source.condition_immunities !== undefined
      });
    }

    const damageImmunities = toDamageTypeSet(
      source.damageImmunities
      ?? source.damage_immunities
      ?? source.immunities
      ?? source.damage?.immunities
      ?? source.defenses?.damageImmunities
    );

    const damageResistances = toDamageTypeSet(
      source.damageResistances
      ?? source.damage_resistances
      ?? source.resistances
      ?? source.damage?.resistances
      ?? source.defenses?.damageResistances
    );

    const damageVulnerabilities = toDamageTypeSet(
      source.damageVulnerabilities
      ?? source.damage_vulnerabilities
      ?? source.vulnerabilities
      ?? source.damage?.vulnerabilities
      ?? source.defenses?.damageVulnerabilities
    );

    const conditionImmunities = toConditionIdSet(
      source.conditionImmunities
      ?? source.condition_immunities
      ?? source.conditions?.immunities
      ?? source.defenses?.conditionImmunities,
      definitions
    );

    const damageImmunityEntries = toDamageDefenseEntries(
      source.damageImmunityEntries
      ?? source.damage_immunity_entries
      ?? source.damageImmunities
      ?? source.damage_immunities
      ?? source.immunities
      ?? source.damage?.immunities
      ?? source.defenses?.damageImmunities
    );

    const damageResistanceEntries = toDamageDefenseEntries(
      source.damageResistanceEntries
      ?? source.damage_resistance_entries
      ?? source.damageResistances
      ?? source.damage_resistances
      ?? source.resistances
      ?? source.damage?.resistances
      ?? source.defenses?.damageResistances
    );

    const damageVulnerabilityEntries = toDamageDefenseEntries(
      source.damageVulnerabilityEntries
      ?? source.damage_vulnerability_entries
      ?? source.damageVulnerabilities
      ?? source.damage_vulnerabilities
      ?? source.vulnerabilities
      ?? source.damage?.vulnerabilities
      ?? source.defenses?.damageVulnerabilities
    );

    return {
      damageImmunities: Array.from(damageImmunities).sort(),
      damageResistances: Array.from(damageResistances).sort(),
      damageVulnerabilities: Array.from(damageVulnerabilities).sort(),
      conditionImmunities: Array.from(conditionImmunities).sort(),
      damageImmunityEntries,
      damageResistanceEntries,
      damageVulnerabilityEntries
    };
  }

  function mergeDefenseProfiles(primaryProfile = {}, secondaryProfile = {}) {
    const merged = createEmptyDefenseProfile();

    const primary = normalizeDefenseProfile(primaryProfile);
    const secondary = normalizeDefenseProfile(secondaryProfile);

    merged.damageImmunities = Array.from(new Set([...(secondary.damageImmunities || []), ...(primary.damageImmunities || [])])).sort();
    merged.damageResistances = Array.from(new Set([...(secondary.damageResistances || []), ...(primary.damageResistances || [])])).sort();
    merged.damageVulnerabilities = Array.from(new Set([...(secondary.damageVulnerabilities || []), ...(primary.damageVulnerabilities || [])])).sort();
    merged.conditionImmunities = Array.from(new Set([...(secondary.conditionImmunities || []), ...(primary.conditionImmunities || [])])).sort();

    const mergeEntries = (primaryEntries = [], secondaryEntries = []) => {
      const combined = [...(secondaryEntries || []), ...(primaryEntries || [])];
      const dedupe = new Set();
      const nextEntries = [];
      combined.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const damageType = String(entry.damageType || '').trim().toLowerCase();
        if (!damageType) return;
        const key = [
          damageType,
          entry.requiresNonmagical ? 'nonmagical' : '',
          entry.requiresMagical ? 'magical' : '',
          entry.bypassedBySilvered ? 'silvered-bypass' : '',
          entry.bypassedByAdamantine ? 'adamantine-bypass' : ''
        ].join('|');
        if (dedupe.has(key)) return;
        dedupe.add(key);
        nextEntries.push({
          damageType,
          requiresNonmagical: !!entry.requiresNonmagical,
          requiresMagical: !!entry.requiresMagical,
          bypassedBySilvered: !!entry.bypassedBySilvered,
          bypassedByAdamantine: !!entry.bypassedByAdamantine,
          raw: entry.raw ? String(entry.raw) : damageType
        });
      });
      return nextEntries;
    };

    merged.damageImmunityEntries = mergeEntries(primary.damageImmunityEntries, secondary.damageImmunityEntries);
    merged.damageResistanceEntries = mergeEntries(primary.damageResistanceEntries, secondary.damageResistanceEntries);
    merged.damageVulnerabilityEntries = mergeEntries(primary.damageVulnerabilityEntries, secondary.damageVulnerabilityEntries);

    return merged;
  }

  function extractDefenseProfileFromCombatant(combatant = {}, definitions = null) {
    const source = combatant && typeof combatant === 'object' ? combatant : {};
    return normalizeDefenseProfile({
      damageImmunities:
        source.damageImmunities
        ?? source.damage_immunities
        ?? source.defenses?.damageImmunities
        ?? source.traits?.damageImmunities
        ?? source.stats?.damageImmunities,
      damageResistances:
        source.damageResistances
        ?? source.damage_resistances
        ?? source.defenses?.damageResistances
        ?? source.traits?.damageResistances
        ?? source.stats?.damageResistances,
      damageVulnerabilities:
        source.damageVulnerabilities
        ?? source.damage_vulnerabilities
        ?? source.defenses?.damageVulnerabilities
        ?? source.traits?.damageVulnerabilities
        ?? source.stats?.damageVulnerabilities,
      conditionImmunities:
        source.conditionImmunities
        ?? source.condition_immunities
        ?? source.defenses?.conditionImmunities
        ?? source.traits?.conditionImmunities
        ?? source.stats?.conditionImmunities
    }, definitions);
  }

  function resolveDefinitionId(definitionId, definitions = null) {
    const rawId = String(definitionId || '').trim();
    if (!rawId) return '';
    const aliasResolved = EFFECT_ID_ALIASES[rawId.toLowerCase()] || rawId;
    if (!definitions || typeof definitions !== 'object') {
      return aliasResolved;
    }
    if (definitions[aliasResolved]) {
      return aliasResolved;
    }
    return definitions[rawId] ? rawId : aliasResolved;
  }

  function createEmptyState() {
    return {
      schemaVersion: 'status-effects-v0',
      updatedAt: new Date().toISOString(),
      definitions: deepClone(DEFAULT_EFFECT_LIBRARY),
      activeEffects: [],
      defenseProfiles: {},
      meta: {
        context: 'init',
        lastAppliedEffectId: null
      }
    };
  }

  function getLocalStorageAdapter() {
    try {
      if (globalScope?.localStorage && typeof globalScope.localStorage.getItem === 'function') {
        return globalScope.localStorage;
      }
    } catch {}
    return null;
  }

  function hydratePersistedStatusEffectsState(context = 'status-effects:hydrate') {
    const storage = getLocalStorageAdapter();
    if (!storage) return null;

    try {
      const raw = storage.getItem(STATUS_EFFECTS_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;

      const base = createEmptyState();
      const sourceDefinitions = parsed.definitions && typeof parsed.definitions === 'object'
        ? parsed.definitions
        : {};
      const normalizedDefinitions = { ...base.definitions };

      Object.values(sourceDefinitions).forEach((definition) => {
        const normalized = normalizeEffectDefinition(definition);
        if (normalized?.id) {
          normalizedDefinitions[normalized.id] = normalized;
        }
      });

      const sourceEffects = Array.isArray(parsed.activeEffects) ? parsed.activeEffects : [];
      const normalizedActiveEffects = sourceEffects
        .map((effect) => normalizeActiveEffect(effect))
        .filter((effect) => !!effect.definitionId);

      const sourceDefenseProfiles = parsed.defenseProfiles && typeof parsed.defenseProfiles === 'object'
        ? parsed.defenseProfiles
        : {};
      const normalizedDefenseProfiles = {};
      Object.entries(sourceDefenseProfiles).forEach(([combatantId, profile]) => {
        const normalizedCombatantId = String(combatantId || '').trim();
        if (!normalizedCombatantId) return;
        normalizedDefenseProfiles[normalizedCombatantId] = normalizeDefenseProfile(profile, normalizedDefinitions);
      });

      return {
        schemaVersion: String(parsed.schemaVersion || base.schemaVersion),
        updatedAt: new Date().toISOString(),
        definitions: normalizedDefinitions,
        activeEffects: normalizedActiveEffects,
        defenseProfiles: normalizedDefenseProfiles,
        meta: {
          ...(base.meta || {}),
          ...(parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {}),
          context
        }
      };
    } catch (error) {
      console.warn('[StatusEffectsCore] Failed to hydrate persisted state:', error);
      return null;
    }
  }

  function persistStatusEffectsState(state, context = 'status-effects:persist') {
    const storage = getLocalStorageAdapter();
    if (!storage) return false;
    try {
      const payload = {
        schemaVersion: String(state?.schemaVersion || 'status-effects-v0'),
        updatedAt: new Date().toISOString(),
        definitions: state?.definitions && typeof state.definitions === 'object' ? state.definitions : {},
        activeEffects: Array.isArray(state?.activeEffects) ? state.activeEffects : [],
        defenseProfiles: state?.defenseProfiles && typeof state.defenseProfiles === 'object' ? state.defenseProfiles : {},
        meta: {
          ...(state?.meta && typeof state.meta === 'object' ? state.meta : {}),
          context
        }
      };
      storage.setItem(STATUS_EFFECTS_STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.warn('[StatusEffectsCore] Failed to persist state:', error);
      return false;
    }
  }

  function clearPersistedStatusEffectsState(context = 'status-effects:persist-clear') {
    const storage = getLocalStorageAdapter();
    if (!storage) return false;
    try {
      storage.removeItem(STATUS_EFFECTS_STORAGE_KEY);
      return true;
    } catch (error) {
      console.warn('[StatusEffectsCore] Failed to clear persisted state:', error);
      return false;
    }
  }

  function normalizeEffectDefinition(definition = {}) {
    // RULE REVIEW NOTE: treat this as the normalization gate for all new/edited effects.
    // Any new behavior should be validated against the reference docs + SRD condition text before merge.
    const source = definition && typeof definition === 'object' ? definition : {};
    const id = resolveDefinitionId(source.id || source.key || '');
    if (!id) return null;

    return {
      id,
      label: String(source.label || source.name || id),
      applicationMode: ['applied', 'inherited', 'relationship'].includes(String(source.applicationMode || 'applied'))
        ? String(source.applicationMode || 'applied')
        : 'applied',
      relationshipScope: String(source.relationshipScope || 'target'),
      attackModifiers: {
        outgoingAttackAdvantage: !!source.attackModifiers?.outgoingAttackAdvantage,
        outgoingAttackDisadvantage: !!source.attackModifiers?.outgoingAttackDisadvantage,
        incomingAttackAdvantage: !!source.attackModifiers?.incomingAttackAdvantage,
        incomingAttackDisadvantage: !!source.attackModifiers?.incomingAttackDisadvantage,
        outgoingDamageBonus: toNumberOrNull(source.attackModifiers?.outgoingDamageBonus) ?? 0,
        incomingDamageMultiplier: Number.isFinite(Number(source.attackModifiers?.incomingDamageMultiplier))
          ? Number(source.attackModifiers.incomingDamageMultiplier)
          : 1,
        consumeOnHitOrMiss: !!source.attackModifiers?.consumeOnHitOrMiss
      },
      lifecycleHooks: {
        on_hit_apply: Array.isArray(source.lifecycleHooks?.on_hit_apply) ? deepClone(source.lifecycleHooks.on_hit_apply) : [],
        on_miss_apply: Array.isArray(source.lifecycleHooks?.on_miss_apply) ? deepClone(source.lifecycleHooks.on_miss_apply) : [],
        start_turn_tick: Array.isArray(source.lifecycleHooks?.start_turn_tick) ? deepClone(source.lifecycleHooks.start_turn_tick) : [],
        end_turn_expire: Array.isArray(source.lifecycleHooks?.end_turn_expire) ? deepClone(source.lifecycleHooks.end_turn_expire) : []
      },
      resourceLocks: {
        action: !!source.resourceLocks?.action,
        bonusAction: !!source.resourceLocks?.bonusAction,
        reaction: !!source.resourceLocks?.reaction
      },
      conditionPatch: {
        movement: deepClone(source.conditionPatch?.movement || {}),
        initiative: deepClone(source.conditionPatch?.initiative || {}),
        hp: deepClone(source.conditionPatch?.hp || {})
      },
      notes: source.notes ? String(source.notes) : null
    };
  }

  function normalizeActiveEffect(effect = {}) {
    const source = effect && typeof effect === 'object' ? effect : {};
    const id = String(source.id || `${source.definitionId || 'effect'}_${Date.now()}`).trim();
    const definitionId = resolveDefinitionId(source.definitionId || '');

    return {
      id,
      definitionId,
      sourceCombatantId: source.sourceCombatantId ? String(source.sourceCombatantId) : null,
      targetCombatantId: source.targetCombatantId ? String(source.targetCombatantId) : null,
      inheritedFromEffectId: source.inheritedFromEffectId ? String(source.inheritedFromEffectId) : null,
      cause: String(source.cause || 'manual'),
      appliedAtRound: toNumberOrNull(source.appliedAtRound),
      durationRounds: toNumberOrNull(source.durationRounds),
      expiresAtRound: toNumberOrNull(source.expiresAtRound),
      active: source.active !== false,
      tags: Array.isArray(source.tags) ? source.tags.map((entry) => String(entry)) : []
    };
  }

  function getCombatantTeam(combatantId, combatantMap = {}) {
    const combatant = combatantMap && typeof combatantMap === 'object' ? combatantMap[combatantId] : null;
    if (!combatant) return null;
    if (combatant.team) return String(combatant.team);
    const kind = String(combatant.kind || '').toLowerCase();
    if (kind === 'player') return 'players';
    if (kind === 'enemy') return 'enemies';
    return 'neutral';
  }

  function resolveRelationship(attackerId, targetId, combatantMap = {}) {
    if (!attackerId || !targetId) {
      return {
        relation: 'unknown',
        sameTeam: null,
        attackerTeam: null,
        targetTeam: null
      };
    }

    const attackerTeam = getCombatantTeam(attackerId, combatantMap);
    const targetTeam = getCombatantTeam(targetId, combatantMap);
    const sameTeam = !!attackerTeam && !!targetTeam && attackerTeam === targetTeam;

    return {
      relation: sameTeam ? 'ally' : 'hostile',
      sameTeam,
      attackerTeam,
      targetTeam
    };
  }

  function evaluateAttackEffects(payload = {}) {
    const attackerId = payload.attackerId ? String(payload.attackerId) : null;
    const targetId = payload.targetId ? String(payload.targetId) : null;
    const activeEffects = Array.isArray(payload.activeEffects) ? payload.activeEffects : [];
    const definitions = payload.definitions && typeof payload.definitions === 'object' ? payload.definitions : {};

    const result = {
      attackerId,
      targetId,
      attackAdvantage: false,
      attackDisadvantage: false,
      outgoingDamageBonus: 0,
      incomingDamageMultiplier: 1,
      consumedEffectIds: [],
      appliedEffectIds: []
    };

    activeEffects.forEach((activeEffect) => {
      if (!activeEffect || activeEffect.active === false) return;
      const resolvedDefinitionId = resolveDefinitionId(activeEffect.definitionId, definitions);
      const definition = definitions[resolvedDefinitionId] || definitions[activeEffect.definitionId];
      if (!definition) return;

      const targetsAttacker = activeEffect.targetCombatantId && attackerId && activeEffect.targetCombatantId === attackerId;
      const targetsDefender = activeEffect.targetCombatantId && targetId && activeEffect.targetCombatantId === targetId;
      if (!targetsAttacker && !targetsDefender) return;

      const modifiers = definition.attackModifiers || {};
      if (targetsAttacker && modifiers.outgoingAttackAdvantage) result.attackAdvantage = true;
      if (targetsAttacker && modifiers.outgoingAttackDisadvantage) result.attackDisadvantage = true;
      if (targetsDefender && modifiers.incomingAttackAdvantage) result.attackAdvantage = true;
      if (targetsDefender && modifiers.incomingAttackDisadvantage) result.attackDisadvantage = true;

      if (targetsAttacker && Number.isFinite(Number(modifiers.outgoingDamageBonus))) {
        result.outgoingDamageBonus += Math.trunc(Number(modifiers.outgoingDamageBonus));
      }
      if (targetsDefender && Number.isFinite(Number(modifiers.incomingDamageMultiplier))) {
        result.incomingDamageMultiplier *= Number(modifiers.incomingDamageMultiplier);
      }

      result.appliedEffectIds.push(activeEffect.id);
      if (modifiers.consumeOnHitOrMiss && targetsAttacker) {
        result.consumedEffectIds.push(activeEffect.id);
      }
    });

    return result;
  }

  function toConditionPatchForCombatant(payload = {}) {
    const combatantId = payload.combatantId ? String(payload.combatantId) : null;
    const activeEffects = Array.isArray(payload.activeEffects) ? payload.activeEffects : [];
    const definitions = payload.definitions && typeof payload.definitions === 'object' ? payload.definitions : {};

    const patch = {
      movement: {},
      initiative: {},
      hp: {}
    };

    activeEffects.forEach((activeEffect) => {
      if (!activeEffect || activeEffect.active === false) return;
      if (!combatantId || activeEffect.targetCombatantId !== combatantId) return;
      const resolvedDefinitionId = resolveDefinitionId(activeEffect.definitionId, definitions);
      const definition = definitions[resolvedDefinitionId] || definitions[activeEffect.definitionId];
      if (!definition) return;

      if (definition.conditionPatch?.movement && typeof definition.conditionPatch.movement === 'object') {
        Object.assign(patch.movement, deepClone(definition.conditionPatch.movement));
      }
      if (definition.conditionPatch?.initiative && typeof definition.conditionPatch.initiative === 'object') {
        Object.assign(patch.initiative, deepClone(definition.conditionPatch.initiative));
      }
      if (definition.conditionPatch?.hp && typeof definition.conditionPatch.hp === 'object') {
        Object.assign(patch.hp, deepClone(definition.conditionPatch.hp));
      }
    });

    return patch;
  }

  function getResourceLockRecommendations(payload = {}) {
    const combatantId = payload.combatantId ? String(payload.combatantId) : null;
    const activeEffects = Array.isArray(payload.activeEffects) ? payload.activeEffects : [];
    const definitions = payload.definitions && typeof payload.definitions === 'object' ? payload.definitions : {};

    const recommendation = {
      combatantId,
      actionLocked: false,
      bonusActionLocked: false,
      reactionLocked: false,
      sourceEffectIds: [],
      sourceDefinitionIds: []
    };

    activeEffects.forEach((activeEffect) => {
      if (!activeEffect || activeEffect.active === false) return;
      if (!combatantId || activeEffect.targetCombatantId !== combatantId) return;

      const resolvedDefinitionId = resolveDefinitionId(activeEffect.definitionId, definitions);
      const definition = definitions[resolvedDefinitionId] || definitions[activeEffect.definitionId];
      if (!definition) return;

      const resourceLocks = definition.resourceLocks || {};
      const lockAction = !!resourceLocks.action;
      const lockBonus = !!resourceLocks.bonusAction;
      const lockReaction = !!resourceLocks.reaction;
      if (!lockAction && !lockBonus && !lockReaction) return;

      recommendation.actionLocked = recommendation.actionLocked || lockAction;
      recommendation.bonusActionLocked = recommendation.bonusActionLocked || lockBonus;
      recommendation.reactionLocked = recommendation.reactionLocked || lockReaction;
      recommendation.sourceEffectIds.push(activeEffect.id);
      recommendation.sourceDefinitionIds.push(definition.id || resolvedDefinitionId || activeEffect.definitionId);
    });

    return recommendation;
  }

  function resolveCombatantSnapshot(combatantId, explicitCombatant = null) {
    if (explicitCombatant && typeof explicitCombatant === 'object') {
      return explicitCombatant;
    }

    const normalizedCombatantId = String(combatantId || '').trim();
    if (!normalizedCombatantId) return null;

    try {
      const combatants = globalScope.canvasContextStore?.getState?.()?.dmCanvas?.combatants;
      const combatant = combatants && typeof combatants === 'object' ? combatants[normalizedCombatantId] : null;
      if (combatant && typeof combatant === 'object') {
        return combatant;
      }
    } catch {}

    if (normalizedCombatantId === 'primary_character') {
      const characterData = globalScope.characterLoader?.characterData;
      if (characterData && typeof characterData === 'object') {
        return characterData;
      }
    }

    return null;
  }

  function getCombatantDefenseProfile(payload = {}, context = 'status-effects:get-defense-profile') {
    const combatantId = String(payload?.combatantId || '').trim();
    if (!combatantId) {
      return {
        context,
        combatantId: null,
        profile: createEmptyDefenseProfile(),
        sources: []
      };
    }

    const storeState = payload.storeState && typeof payload.storeState === 'object'
      ? payload.storeState
      : ensureStatusEffectsStore(`${context}:ensure-store`).getState();

    const definitions = storeState?.definitions && typeof storeState.definitions === 'object'
      ? storeState.definitions
      : {};

    const storedProfile = storeState?.defenseProfiles && typeof storeState.defenseProfiles === 'object'
      ? storeState.defenseProfiles[combatantId]
      : null;

    const combatantSnapshot = resolveCombatantSnapshot(combatantId, payload?.combatant || null);
    const extractedProfile = extractDefenseProfileFromCombatant(combatantSnapshot || {}, definitions);
    const profile = mergeDefenseProfiles(storedProfile || {}, extractedProfile);

    const hasStoredSource = !!(storedProfile && typeof storedProfile === 'object');
    const hasSnapshotSource = !!combatantSnapshot;
    const sources = [];
    if (hasStoredSource) sources.push('store');
    if (hasSnapshotSource) sources.push('combatant_snapshot');
    if (!sources.length) sources.push('none');

    return {
      context,
      combatantId,
      profile,
      sources
    };
  }

  function upsertCombatantDefenseProfile(payload = {}, context = 'status-effects:upsert-defense-profile') {
    const combatantId = String(payload?.combatantId || '').trim();
    if (!combatantId) return null;

    const store = ensureStatusEffectsStore(`${context}:ensure-store`);
    let nextProfile = createEmptyDefenseProfile();

    store.patchState((draft) => {
      if (!draft.defenseProfiles || typeof draft.defenseProfiles !== 'object') {
        draft.defenseProfiles = {};
      }

      const definitions = draft.definitions && typeof draft.definitions === 'object' ? draft.definitions : {};
      const existingProfile = draft.defenseProfiles[combatantId] || createEmptyDefenseProfile();
      const incomingProfile = normalizeDefenseProfile(payload?.profile || {}, definitions);
      const shouldReplace = payload?.replace === true;

      nextProfile = shouldReplace
        ? mergeDefenseProfiles(incomingProfile, createEmptyDefenseProfile())
        : mergeDefenseProfiles(incomingProfile, existingProfile);

      draft.defenseProfiles[combatantId] = nextProfile;
      draft.meta = {
        ...(draft.meta || {}),
        context
      };
    }, { context });

    return {
      context,
      combatantId,
      profile: nextProfile,
      state: store.getState()
    };
  }

  function syncCombatantDefenseProfile(payload = {}, context = 'status-effects:sync-defense-profile') {
    const combatantId = String(payload?.combatantId || '').trim();
    if (!combatantId) return null;

    const definitions = ensureStatusEffectsStore(`${context}:ensure-store`).getState()?.definitions || {};
    const normalizedProfile = payload?.profile && typeof payload.profile === 'object'
      ? normalizeDefenseProfile(payload.profile, definitions)
      : extractDefenseProfileFromCombatant(payload?.combatant || {}, definitions);

    return upsertCombatantDefenseProfile({
      combatantId,
      profile: normalizedProfile,
      replace: payload?.replace !== false
    }, context);
  }

  function doesDamageDefenseEntryMatch(entry = {}, damageType = '', qualifiers = {}) {
    const normalizedDamageType = String(damageType || '').trim().toLowerCase();
    if (!normalizedDamageType) return false;
    if (String(entry?.damageType || '').trim().toLowerCase() !== normalizedDamageType) return false;

    const isMagical = qualifiers?.isMagical === true;
    const isSilvered = qualifiers?.isSilvered === true;
    const isAdamantine = qualifiers?.isAdamantine === true;

    if (entry?.requiresNonmagical && isMagical) return false;
    if (entry?.requiresMagical && !isMagical) return false;
    if (entry?.bypassedBySilvered && isSilvered) return false;
    if (entry?.bypassedByAdamantine && isAdamantine) return false;

    return true;
  }

  function evaluateCombatantDamageDefense(payload = {}, context = 'status-effects:evaluate-damage-defense') {
    const combatantId = String(payload?.combatantId || '').trim();
    const damageType = String(payload?.damageType || '').trim().toLowerCase();
    const storeState = payload.storeState && typeof payload.storeState === 'object'
      ? payload.storeState
      : ensureStatusEffectsStore(`${context}:ensure-store`).getState();

    const defenseProfileResult = getCombatantDefenseProfile({
      combatantId,
      combatant: payload?.combatant || null,
      storeState
    }, `${context}:get-profile`);

    const profile = defenseProfileResult.profile || createEmptyDefenseProfile();
    const damageImmunityEntries = Array.isArray(profile.damageImmunityEntries) ? profile.damageImmunityEntries : [];
    const damageResistanceEntries = Array.isArray(profile.damageResistanceEntries) ? profile.damageResistanceEntries : [];
    const damageVulnerabilityEntries = Array.isArray(profile.damageVulnerabilityEntries) ? profile.damageVulnerabilityEntries : [];

    let multiplier = 1;
    let state = 'normal';

    const hasDamageType = !!damageType;
    const qualifiers = {
      isMagical: payload?.isMagical === true,
      isSilvered: payload?.isSilvered === true,
      isAdamantine: payload?.isAdamantine === true
    };

    const hasExplicitQualifierMetadata = Object.prototype.hasOwnProperty.call(payload || {}, 'isMagical')
      || Object.prototype.hasOwnProperty.call(payload || {}, 'isSilvered')
      || Object.prototype.hasOwnProperty.call(payload || {}, 'isAdamantine');

    const hasQualifiedResistanceEntry = hasDamageType && damageResistanceEntries.some((entry) => {
      if (String(entry?.damageType || '').trim().toLowerCase() !== damageType) return false;
      return entry?.requiresMagical
        || entry?.requiresNonmagical
        || entry?.bypassedBySilvered
        || entry?.bypassedByAdamantine;
    });

    const combatantResistanceSources = [
      payload?.combatant?.damageResistances,
      payload?.combatant?.damage_resistances,
      payload?.combatant?.defenses?.damageResistances,
      payload?.combatant?.traits?.damageResistances,
      payload?.combatant?.stats?.damageResistances
    ];

    const hasQualifiedResistanceText = hasDamageType && combatantResistanceSources.some((sourceEntry) => toList(sourceEntry).some((rawEntry) => {
      const text = String(rawEntry || '').trim().toLowerCase();
      if (!text || !text.includes(damageType)) return false;
      return text.includes('magical')
        || text.includes('nonmagical')
        || text.includes('silvered')
        || text.includes('adamantine');
    }));

    const qualifierMetadataMissingHint = !hasExplicitQualifierMetadata && (hasQualifiedResistanceEntry || hasQualifiedResistanceText);
    if (qualifierMetadataMissingHint && typeof console !== 'undefined' && typeof console.debug === 'function') {
      const targetLabel = combatantId || 'unknown_combatant';
      const damageTypeLabel = hasDamageType ? damageType : 'untyped';
      console.debug(`[StatusEffectsCore] Qualifier metadata missing for ${targetLabel} (${damageTypeLabel}) while qualified resistance exists. Include isMagical/isSilvered/isAdamantine for accurate defense matching.`);
    }

    const isImmune = hasDamageType && damageImmunityEntries.some((entry) => doesDamageDefenseEntryMatch(entry, damageType, qualifiers));
    const isResistant = hasDamageType && damageResistanceEntries.some((entry) => doesDamageDefenseEntryMatch(entry, damageType, qualifiers));
    const isVulnerable = hasDamageType && damageVulnerabilityEntries.some((entry) => doesDamageDefenseEntryMatch(entry, damageType, qualifiers));

    if (isImmune) {
      multiplier = 0;
      state = 'immune';
    } else if (isResistant && isVulnerable) {
      multiplier = 1;
      state = 'resistant_and_vulnerable';
    } else if (isResistant) {
      multiplier = 0.5;
      state = 'resistant';
    } else if (isVulnerable) {
      multiplier = 2;
      state = 'vulnerable';
    }

    return {
      context,
      combatantId: combatantId || null,
      damageType: hasDamageType ? damageType : null,
      multiplier,
      state,
      qualifiers,
      qualifierMetadataMissingHint,
      profile,
      sources: defenseProfileResult.sources || ['none']
    };
  }

  function canApplyStatusEffectToCombatant(payload = {}, context = 'status-effects:can-apply-status') {
    const combatantId = String(payload?.combatantId || '').trim();
    const definitionId = resolveDefinitionId(payload?.definitionId || '');
    if (!combatantId || !definitionId) {
      return {
        context,
        combatantId: combatantId || null,
        definitionId: definitionId || null,
        allowed: true,
        blockedBy: null
      };
    }

    const storeState = payload.storeState && typeof payload.storeState === 'object'
      ? payload.storeState
      : ensureStatusEffectsStore(`${context}:ensure-store`).getState();

    const defenseProfileResult = getCombatantDefenseProfile({
      combatantId,
      combatant: payload?.combatant || null,
      storeState
    }, `${context}:get-profile`);

    const conditionImmunities = new Set(defenseProfileResult?.profile?.conditionImmunities || []);
    const blocked = conditionImmunities.has(definitionId);

    return {
      context,
      combatantId,
      definitionId,
      allowed: !blocked,
      blockedBy: blocked ? 'condition_immunity' : null,
      profile: defenseProfileResult.profile || createEmptyDefenseProfile(),
      sources: defenseProfileResult.sources || ['none']
    };
  }

  class StatusEffectsStore {
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
      this._state.meta = {
        ...(this._state.meta || {}),
        context: meta.context || this._state.meta?.context || 'replace'
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
      if (typeof listener !== 'function') return () => {};
      this._subscribers.add(listener);
      return () => this._subscribers.delete(listener);
    }

    _emit() {
      this._subscribers.forEach((listener) => {
        try {
          listener(this.getState());
        } catch (error) {
          console.warn('[StatusEffectsCore] subscriber callback failed:', error);
        }
      });
    }
  }

  function createStore(initialState = createEmptyState()) {
    return new StatusEffectsStore(initialState);
  }

  function ensureStatusEffectsStore(context = 'status-effects:ensure-store') {
    if (!globalScope.statusEffectsStore || typeof globalScope.statusEffectsStore.patchState !== 'function') {
      const hydratedState = hydratePersistedStatusEffectsState(`${context}:hydrate`) || createEmptyState();
      globalScope.statusEffectsStore = createStore(hydratedState);

      if (!globalScope.statusEffectsStore.__persistenceBound) {
        globalScope.statusEffectsStore.subscribe((nextState) => {
          persistStatusEffectsState(nextState, `${context}:store-subscribe`);
        });
        globalScope.statusEffectsStore.__persistenceBound = true;
      }

      globalScope.statusEffectsStore.replaceState(globalScope.statusEffectsStore.getState(), { context });
    }
    return globalScope.statusEffectsStore;
  }

  function upsertStatusEffectDefinition(definition, context = 'status-effects:upsert-definition') {
    const normalized = normalizeEffectDefinition(definition || {});
    if (!normalized) return null;
    const store = ensureStatusEffectsStore(`${context}:ensure-store`);
    store.patchState((draft) => {
      if (!draft.definitions || typeof draft.definitions !== 'object') {
        draft.definitions = {};
      }
      draft.definitions[normalized.id] = normalized;
    }, { context });
    return store.getState();
  }

  function applyStatusEffect(effectInput = {}, context = 'status-effects:apply') {
    const normalized = normalizeActiveEffect(effectInput);
    if (!normalized.definitionId) {
      return null;
    }

    const store = ensureStatusEffectsStore(`${context}:ensure-store`);
    const preApplyState = store.getState();
    const applyGateDecision = canApplyStatusEffectToCombatant({
      combatantId: normalized.targetCombatantId,
      definitionId: normalized.definitionId,
      combatant: effectInput?.targetCombatant || null,
      storeState: preApplyState
    }, `${context}:gate-check`);

    if (applyGateDecision.allowed === false) {
      globalScope.dispatchEvent(new CustomEvent('status-effects:blocked', {
        detail: {
          context,
          reason: applyGateDecision.blockedBy || 'blocked',
          definitionId: applyGateDecision.definitionId,
          sourceCombatantId: normalized.sourceCombatantId || null,
          targetCombatantId: normalized.targetCombatantId || null,
          profile: applyGateDecision.profile || createEmptyDefenseProfile(),
          effect: normalized,
          state: preApplyState
        }
      }));
      return preApplyState;
    }

    store.patchState((draft) => {
      if (!Array.isArray(draft.activeEffects)) {
        draft.activeEffects = [];
      }
      draft.activeEffects.push(normalized);
      draft.meta = {
        ...(draft.meta || {}),
        lastAppliedEffectId: normalized.id,
        context
      };
    }, { context });

    const state = store.getState();
    const resolvedDefinitionId = resolveDefinitionId(normalized.definitionId, state?.definitions || {});
    const resolvedDefinition = (state?.definitions || {})[resolvedDefinitionId]
      || (state?.definitions || {})[normalized.definitionId]
      || null;

    globalScope.dispatchEvent(new CustomEvent('status-effects:applied', {
      detail: {
        context,
        effect: normalized,
        definitionId: resolvedDefinition?.id || resolvedDefinitionId || normalized.definitionId,
        definitionLabel: resolvedDefinition?.label || null,
        sourceCombatantId: normalized.sourceCombatantId || null,
        targetCombatantId: normalized.targetCombatantId || null,
        state
      }
    }));
    return state;
  }

  function clearStatusEffect(effectId, context = 'status-effects:clear') {
    const normalizedId = String(effectId || '').trim();
    if (!normalizedId) return null;
    const store = ensureStatusEffectsStore(`${context}:ensure-store`);
    const preClearState = store.getState();
    const matchedEffect = Array.isArray(preClearState?.activeEffects)
      ? preClearState.activeEffects.find((entry) => entry?.id === normalizedId) || null
      : null;

    store.patchState((draft) => {
      const effects = Array.isArray(draft.activeEffects) ? draft.activeEffects : [];
      draft.activeEffects = effects.map((entry) => {
        if (entry.id !== normalizedId) return entry;
        return {
          ...entry,
          active: false
        };
      });
      draft.meta = {
        ...(draft.meta || {}),
        context
      };
    }, { context });

    const state = store.getState();
    const resolvedDefinitionId = resolveDefinitionId(matchedEffect?.definitionId || '', state?.definitions || {});
    const resolvedDefinition = (state?.definitions || {})[resolvedDefinitionId]
      || (state?.definitions || {})[matchedEffect?.definitionId]
      || null;

    globalScope.dispatchEvent(new CustomEvent('status-effects:cleared', {
      detail: {
        context,
        reason: 'cleared',
        effectId: normalizedId,
        effect: matchedEffect,
        definitionId: resolvedDefinition?.id || resolvedDefinitionId || matchedEffect?.definitionId || null,
        definitionLabel: resolvedDefinition?.label || null,
        sourceCombatantId: matchedEffect?.sourceCombatantId || null,
        targetCombatantId: matchedEffect?.targetCombatantId || null,
        state
      }
    }));
    return state;
  }

  function expireStatusEffect(effectId, context = 'status-effects:expire') {
    const normalizedId = String(effectId || '').trim();
    if (!normalizedId) return null;

    const store = ensureStatusEffectsStore(`${context}:ensure-store`);
    const preExpireState = store.getState();
    const matchedEffect = Array.isArray(preExpireState?.activeEffects)
      ? preExpireState.activeEffects.find((entry) => entry?.id === normalizedId) || null
      : null;

    const state = clearStatusEffect(normalizedId, context);
    if (!state) return null;

    const resolvedDefinitionId = resolveDefinitionId(matchedEffect?.definitionId || '', state?.definitions || {});
    const resolvedDefinition = (state?.definitions || {})[resolvedDefinitionId]
      || (state?.definitions || {})[matchedEffect?.definitionId]
      || null;

    globalScope.dispatchEvent(new CustomEvent('status-effects:expired', {
      detail: {
        context,
        reason: 'expired',
        effectId: normalizedId,
        effect: matchedEffect,
        definitionId: resolvedDefinition?.id || resolvedDefinitionId || matchedEffect?.definitionId || null,
        definitionLabel: resolvedDefinition?.label || null,
        sourceCombatantId: matchedEffect?.sourceCombatantId || null,
        targetCombatantId: matchedEffect?.targetCombatantId || null,
        state
      }
    }));

    return state;
  }

  function evaluateAttackStatusEffects(payload = {}, context = 'status-effects:evaluate-attack') {
    const storeState = ensureStatusEffectsStore(`${context}:ensure-store`).getState();
    const evaluation = evaluateAttackEffects({
      attackerId: payload.attackerId,
      targetId: payload.targetId,
      activeEffects: storeState.activeEffects,
      definitions: storeState.definitions
    });

    return {
      context,
      ...evaluation
    };
  }

  function getStatusResourceLocksForCombatant(payload = {}, context = 'status-effects:resource-locks') {
    const storeState = ensureStatusEffectsStore(`${context}:ensure-store`).getState();
    const combatantId = payload.combatantId ? String(payload.combatantId) : null;
    return {
      context,
      ...getResourceLockRecommendations({
        combatantId,
        activeEffects: storeState.activeEffects,
        definitions: storeState.definitions
      })
    };
  }

  function buildConditionsPatchFromStatusEffects(payload = {}, context = 'status-effects:build-conditions-patch') {
    const storeState = ensureStatusEffectsStore(`${context}:ensure-store`).getState();
    const combatantId = payload.combatantId ? String(payload.combatantId) : null;
    return {
      context,
      combatantId,
      patch: toConditionPatchForCombatant({
        combatantId,
        activeEffects: storeState.activeEffects,
        definitions: storeState.definitions
      })
    };
  }

  const StatusEffectsCore = {
    createEmptyState,
    createStore,
    adapters: {
      normalizeEffectDefinition,
      normalizeActiveEffect,
      resolveDefinitionId,
      resolveRelationship,
      evaluateAttackEffects,
      toConditionPatchForCombatant,
      getResourceLockRecommendations,
      normalizeDefenseProfile,
      extractDefenseProfileFromCombatant,
      evaluateCombatantDamageDefense,
      canApplyStatusEffectToCombatant
    }
  };

  globalScope.StatusEffectsCore = StatusEffectsCore;
  globalScope.ensureStatusEffectsStore = ensureStatusEffectsStore;
  globalScope.upsertStatusEffectDefinition = upsertStatusEffectDefinition;
  globalScope.applyStatusEffectScaffold = applyStatusEffect;
  globalScope.clearStatusEffectScaffold = clearStatusEffect;
  globalScope.expireStatusEffectScaffold = expireStatusEffect;
  globalScope.evaluateAttackStatusEffects = evaluateAttackStatusEffects;
  globalScope.getStatusResourceLocksForCombatant = getStatusResourceLocksForCombatant;
  globalScope.buildConditionsPatchFromStatusEffects = buildConditionsPatchFromStatusEffects;
  globalScope.upsertCombatantDefenseProfileScaffold = upsertCombatantDefenseProfile;
  globalScope.getCombatantDefenseProfileScaffold = getCombatantDefenseProfile;
  globalScope.syncCombatantDefenseProfileScaffold = syncCombatantDefenseProfile;
  globalScope.evaluateCombatantDamageDefense = evaluateCombatantDamageDefense;
  globalScope.canApplyStatusEffectToCombatant = canApplyStatusEffectToCombatant;
  globalScope.persistStatusEffectsState = persistStatusEffectsState;
  globalScope.hydratePersistedStatusEffectsState = hydratePersistedStatusEffectsState;
  globalScope.clearPersistedStatusEffectsState = clearPersistedStatusEffectsState;
})(window);
