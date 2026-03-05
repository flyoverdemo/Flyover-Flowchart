/**
 * Character Data Loader
 * Bridges character JSON data with the flowchart application
 * Loads character data and applies it to the UI
 */

class CharacterLoader {
  //mv:none //state:data-only //rel:parent=characterData child=UI-content-bindings
  constructor() {
    this.characterData = null;
    this.dataPath = 'character_data.json';
    this.onDataLoaded = null;
    this.onError = null;
  }

  normalizeBoundaryCharacterData(rawData = {}) {
    const source = rawData && typeof rawData === 'object' ? rawData : {};
    let normalizedData;

    try {
      normalizedData = JSON.parse(JSON.stringify(source));
    } catch {
      normalizedData = { ...source };
    }

    if (!normalizedData.combat || typeof normalizedData.combat !== 'object') {
      normalizedData.combat = {};
    }

    const combatData = normalizedData.combat;
    const armorClassValue = Number(combatData.armorClass ?? combatData.ac);
    if (Number.isFinite(armorClassValue)) {
      combatData.armorClass = Math.trunc(armorClassValue);
      combatData.ac = Math.trunc(armorClassValue);
    }

    const hitPointSource = (combatData.hitPoints && typeof combatData.hitPoints === 'object')
      ? combatData.hitPoints
      : ((combatData.hp && typeof combatData.hp === 'object') ? combatData.hp : {});

    const hitPointsNormalized = {
      max: Number.isFinite(Number(hitPointSource.max ?? hitPointSource.maximum))
        ? Math.trunc(Number(hitPointSource.max ?? hitPointSource.maximum))
        : null,
      current: Number.isFinite(Number(hitPointSource.current))
        ? Math.trunc(Number(hitPointSource.current))
        : (Number.isFinite(Number(hitPointSource.max ?? hitPointSource.maximum))
          ? Math.trunc(Number(hitPointSource.max ?? hitPointSource.maximum))
          : null),
      temporary: Number.isFinite(Number(hitPointSource.temporary ?? hitPointSource.temp))
        ? Math.max(0, Math.trunc(Number(hitPointSource.temporary ?? hitPointSource.temp)))
        : 0
    };

    combatData.hitPoints = hitPointsNormalized;
    combatData.hp = { ...hitPointsNormalized };

    const proficiencyBonusValue = Number(combatData.proficiencyBonus ?? combatData.profBonus);
    if (Number.isFinite(proficiencyBonusValue)) {
      combatData.proficiencyBonus = Math.trunc(proficiencyBonusValue);
      combatData.profBonus = Math.trunc(proficiencyBonusValue);
    }

    const abilityKeys = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    const abilityAliasMap = {
      strength: ['str'],
      dexterity: ['dex'],
      constitution: ['con'],
      intelligence: ['int'],
      wisdom: ['wis'],
      charisma: ['cha']
    };

    const parseNumericToken = (value) => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'number') return Number.isFinite(value) ? value : null;
      if (typeof value === 'string') {
        const match = value.match(/[+\-]?\d+/);
        if (!match) return null;
        const parsed = Number(match[0]);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    const findAbilityEntry = (abilityKey) => {
      const aliases = [abilityKey, ...(abilityAliasMap[abilityKey] || [])];
      const normalizedAliases = aliases.map(alias => String(alias).toLowerCase());
      const sources = [
        normalizedData.abilities,
        normalizedData.abilityScores,
        normalizedData.character?.abilities,
        normalizedData.character?.abilityScores
      ];

      for (const source of sources) {
        if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
        const sourceEntries = Object.entries(source);
        for (const [rawKey, rawValue] of sourceEntries) {
          const normalizedKey = String(rawKey || '').toLowerCase();
          if (!normalizedAliases.includes(normalizedKey)) continue;
          return rawValue;
        }
      }

      return null;
    };

    const normalizedAbilities = {};
    for (const abilityKey of abilityKeys) {
      const rawAbilityEntry = findAbilityEntry(abilityKey);
      let nextScore = null;
      let nextModifier = null;
      let nextSavingThrow = null;

      if (typeof rawAbilityEntry === 'number' || typeof rawAbilityEntry === 'string') {
        const parsedScalar = parseNumericToken(rawAbilityEntry);
        if (Number.isFinite(parsedScalar)) {
          const scalarText = String(rawAbilityEntry).trim();
          const hasExplicitSign = typeof rawAbilityEntry === 'string' && /^[+-]\d+$/.test(scalarText);
          if (hasExplicitSign) {
            // Signed scalar tokens in imported form-fields are usually modifiers.
            nextModifier = Math.trunc(parsedScalar);
          } else {
            // Unsuffixed scalar values are interpreted as base score.
            nextScore = Math.trunc(parsedScalar);
          }
        }
      } else if (rawAbilityEntry && typeof rawAbilityEntry === 'object') {
        const parsedScore = parseNumericToken(
          rawAbilityEntry.score
          ?? rawAbilityEntry.base
          ?? rawAbilityEntry.total
          ?? rawAbilityEntry.value
        );
        if (Number.isFinite(parsedScore)) {
          nextScore = Math.trunc(parsedScore);
        }

        const parsedModifier = parseNumericToken(
          rawAbilityEntry.modifier
          ?? rawAbilityEntry.mod
          ?? rawAbilityEntry.modBonus
          ?? rawAbilityEntry.modifierBonus
        );
        if (Number.isFinite(parsedModifier)) {
          nextModifier = Math.trunc(parsedModifier);
        }

        const parsedSavingThrow = parseNumericToken(
          rawAbilityEntry.savingThrow
          ?? rawAbilityEntry.save
          ?? rawAbilityEntry.saveModifier
        );
        if (Number.isFinite(parsedSavingThrow)) {
          nextSavingThrow = Math.trunc(parsedSavingThrow);
        }
      }

      if (!Number.isFinite(nextModifier) && Number.isFinite(nextScore)) {
        nextModifier = Math.floor((nextScore - 10) / 2);
      }

      normalizedAbilities[abilityKey] = {
        score: Number.isFinite(nextScore) ? Math.trunc(nextScore) : null,
        modifier: Number.isFinite(nextModifier) ? Math.trunc(nextModifier) : null,
        savingThrow: Number.isFinite(nextSavingThrow) ? Math.trunc(nextSavingThrow) : null,
        skills: []
      };
    }

    normalizedData.abilities = normalizedAbilities;
    normalizedData.abilityScores = JSON.parse(JSON.stringify(normalizedAbilities));

    if (!normalizedData.actions || typeof normalizedData.actions !== 'object') {
      normalizedData.actions = {};
    }

    const actionsSource = normalizedData.actions;
    const normalizeActionBucket = (value) => {
      if (!Array.isArray(value)) return [];
      return value
        .filter((actionEntry) => !!actionEntry && typeof actionEntry === 'object')
        .map((actionEntry) => ({
          ...actionEntry,
          range: actionEntry.range ?? actionEntry.reach ?? actionEntry.attackRange ?? actionEntry.distance ?? null,
          toHit: actionEntry.toHit ?? actionEntry.attackBonus ?? actionEntry.hitBonus ?? actionEntry.to_hit ?? actionEntry.attackRollBonus ?? null,
          saveDc: actionEntry.saveDc ?? actionEntry.dc ?? actionEntry.saveDC ?? null,
          isMagical: actionEntry.isMagical === true || actionEntry.magical === true,
          isSilvered: actionEntry.isSilvered === true || actionEntry.silvered === true,
          isAdamantine: actionEntry.isAdamantine === true || actionEntry.adamantine === true,
          damage: this.normalizeActionDamageValue(actionEntry.damage)
        }));
    };

    const normalizedActionBuckets = {
      ...actionsSource,
      weapons: normalizeActionBucket(actionsSource.weapons),
      spellAttacks: normalizeActionBucket(actionsSource.spellAttacks),
      cantrips: normalizeActionBucket(actionsSource.cantrips),
      abilities: normalizeActionBucket(actionsSource.abilities),
      primary: normalizeActionBucket(actionsSource.primary),
      bonusActions: normalizeActionBucket(actionsSource.bonusActions ?? actionsSource.bonus),
      reactions: normalizeActionBucket(actionsSource.reactions ?? actionsSource.reaction)
    };

    if (!Array.isArray(normalizedActionBuckets.bonus) || normalizedActionBuckets.bonus.length === 0) {
      normalizedActionBuckets.bonus = [...normalizedActionBuckets.bonusActions];
    }
    if (!Array.isArray(normalizedActionBuckets.reaction) || normalizedActionBuckets.reaction.length === 0) {
      normalizedActionBuckets.reaction = [...normalizedActionBuckets.reactions];
    }

    normalizedData.actions = normalizedActionBuckets;

    return normalizedData;
  }

  setCharacterData(rawData = {}, context = 'set-character-data') {
    this.characterData = this.normalizeBoundaryCharacterData(rawData);
    console.log('[CharacterLoader] Character data normalized:', context, this.characterData.character?.name || 'Unknown');

    if (this.onDataLoaded) {
      this.onDataLoaded(this.characterData);
    }

    return this.characterData;
  }

  /**
   * Load character data from JSON file
   */
  async loadCharacterData(path = null) {
    if (path) this.dataPath = path;

    try {
      const response = await fetch(this.dataPath);
      if (!response.ok) {
        throw new Error(`Failed to load character data: ${response.status}`);
      }
      const parsedJson = await response.json();
      return this.setCharacterData(parsedJson, 'load-character-data');
    } catch (error) {
      console.error('[CharacterLoader] Error loading character data:', error);
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }

  /**
   * Load character data from JSON blob (file import)
   */
  async loadCharacterDataFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsedBlobData = JSON.parse(e.target.result);
          const normalizedData = this.setCharacterData(parsedBlobData, 'load-character-data-from-blob');
          resolve(normalizedData);
        } catch (error) {
          reject(new Error('Invalid JSON: ' + error.message));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(blob);
    });
  }

  /**
   * Get character data from localStorage
   */
  getFromStorage() {
    try {
      const json = localStorage.getItem('characterData');
      if (json) {
        const parsedStorageData = JSON.parse(json);
        const normalizedStorageData = this.setCharacterData(parsedStorageData, 'get-from-storage');
        console.log('[CharacterLoader] Loaded from localStorage');
        return normalizedStorageData;
      }
    } catch (e) {
      console.warn('[CharacterLoader] Could not load from storage:', e);
    }
    return null;
  }

  /**
   * Get character ability modifier
   */
  getModifier(abilityName) {
    if (!this.characterData || !this.characterData.abilities) {
      return 0;
    }
    return this.characterData.abilities[abilityName]?.modifier || 0;
  }

  /**
   * Get character proficiency bonus
   */
  getProficiencyBonus() {
    return this.characterData?.combat?.proficiencyBonus || 2;
  }

  /**
   * Get to-hit bonus for an attack
   */
  getToHitBonus(ability = 'strength', proficient = false) {
    const mod = this.getModifier(ability);
    const prof = proficient ? this.getProficiencyBonus() : 0;
    return mod + prof;
  }

  /**
   * Get spell save DC
   */
  getSpellSaveDC(ability = 'charisma') {
    const mod = this.getModifier(ability);
    const prof = this.getProficiencyBonus();
    return 8 + mod + prof;
  }

  /**
   * Apply character data to flowchart UI
   */
  applyToFlowchart() {
    if (!this.characterData) {
      console.warn('[CharacterLoader] No character data available');
      return;
    }

    // Apply ability scores to stat boxes
    this.applyAbilityScores();

    // Apply actions to cards
    this.applyActions();

    // Apply combat stats
    this.applyCombatStats();

    console.log('[CharacterLoader] Applied to flowchart');
  }

  /**
   * Apply ability scores to UI
   */
  applyAbilityScores() {
    if (!this.characterData?.abilities) return;

    const abilities = this.characterData.abilities;
    
    // Update any ability display elements
    for (const [ability, data] of Object.entries(abilities)) {
      const elements = document.querySelectorAll(`[data-ability="${ability}"]`);
      elements.forEach(el => {
        el.textContent = data.modifier >= 0 ? `+${data.modifier}` : data.modifier;
      });
    }
  }

  /**
   * Apply actions to card system
   */
  applyActions() {
    if (!this.characterData?.actions) return;

    const combatantActionCollection = this.buildCombatantActionCollection();
    if (combatantActionCollection.length === 0) return;

    const primaryMeleeCardLinkedAction = this.getPrimaryMeleeCardLinkedAction(combatantActionCollection);
    this.applyPrimaryMeleeCardLinkedStatValues(primaryMeleeCardLinkedAction);
    
    // Map actions to cards
    combatantActionCollection.forEach((action, index) => {
      const card = document.getElementById(`card-${index}`);
      if (!card) return;

      // Update card label
      const labelEl = card.querySelector('[data-label]');
      if (labelEl) {
        labelEl.setAttribute('data-label', action.name);
      }

      // Update card footer
      const footer = card.querySelector('.card-footer');
      if (footer) {
        footer.textContent = action.name.toUpperCase();
      }

      // Store action data on card for reference
      card.dataset.actionId = action.id;
      card.dataset.externalLink = action.externalLink || '';
    });

    // Update folder label if first card changed
    if (combatantActionCollection.length > 0) {
      const activeLabel = document.getElementById('active-label');
      if (activeLabel) {
        activeLabel.textContent = combatantActionCollection[0].name;
      }
    }
  }

  buildCombatantActionCollection() {
    // ACTION DATA PIPELINE (Loader stage)
    // -----------------------------------
    // This function is the first canonical normalization pass for imported action data.
    // We intentionally flatten many legacy buckets into one display order because:
    // - older JSON/PDF imports may use different bucket keys
    // - card rendering expects a single ordered list
    // - resolver modules expect stable action ids/names/range/toHit/damage fields
    //
    // Any new action metadata (like defense qualifiers) should be preserved here so
    // later pipeline stages (RulesActionCore + status defense evaluator) can consume it.
    const combatantActionStore = this.characterData?.actions;
    if (!combatantActionStore || typeof combatantActionStore !== 'object') {
      return [];
    }

    const normalizedActionCollection = [];
    const actionBucketsInDisplayOrder = [
      ...(Array.isArray(combatantActionStore.weapons) ? combatantActionStore.weapons : []),
      ...(Array.isArray(combatantActionStore.spellAttacks) ? combatantActionStore.spellAttacks : []),
      ...(Array.isArray(combatantActionStore.abilities) ? combatantActionStore.abilities : []),
      ...(Array.isArray(combatantActionStore.primary) ? combatantActionStore.primary : []),
      ...(Array.isArray(combatantActionStore.bonus) ? combatantActionStore.bonus : []),
      ...(Array.isArray(combatantActionStore.reaction) ? combatantActionStore.reaction : [])
    ];

    actionBucketsInDisplayOrder.forEach((rawActionEntry, actionIndex) => {
      if (!rawActionEntry || typeof rawActionEntry !== 'object') return;

      // ACTION DATA PIPELINE NOTE:
      // Preserve source metadata and normalize commonly-variant keys.
      // We keep ids deterministic (`action_N`) when absent, because many
      // downstream systems use actionId for replay/log references.
      const normalizedActionEntry = {
        ...rawActionEntry,
        id: rawActionEntry.id || `action_${actionIndex + 1}`,
        name: rawActionEntry.name || `Action ${actionIndex + 1}`,
        range: rawActionEntry.range ?? rawActionEntry.reach ?? rawActionEntry.attackRange ?? rawActionEntry.distance ?? null,
        toHit: rawActionEntry.toHit ?? rawActionEntry.attackBonus ?? rawActionEntry.hitBonus ?? rawActionEntry.to_hit ?? rawActionEntry.attackRollBonus ?? null,
        damage: this.normalizeActionDamageValue(rawActionEntry.damage),
        isMagical: rawActionEntry.isMagical === true || rawActionEntry.magical === true,
        isSilvered: rawActionEntry.isSilvered === true || rawActionEntry.silvered === true,
        isAdamantine: rawActionEntry.isAdamantine === true || rawActionEntry.adamantine === true,
        tags: Array.isArray(rawActionEntry.tags) ? [...rawActionEntry.tags] : []
      };

      normalizedActionCollection.push(normalizedActionEntry);
    });

    return normalizedActionCollection;
  }

  normalizeActionDamageValue(rawDamageValue) {
    // ACTION DATA PIPELINE NOTE:
    // Damage blocks in imports are inconsistent (`dice/value/roll`,
    // `modifier/bonus/flat`, qualifier booleans in different spots).
    // Normalize all aliases and preserve qualifier hints so resolver code
    // does not need importer-specific branching.
    if (rawDamageValue && typeof rawDamageValue === 'object') {
      return {
        ...rawDamageValue,
        modifier: rawDamageValue.modifier ?? rawDamageValue.bonus ?? rawDamageValue.flat ?? null,
        dice: rawDamageValue.dice ?? rawDamageValue.value ?? rawDamageValue.roll ?? null,
        isMagical: rawDamageValue.isMagical === true || rawDamageValue.magical === true,
        isSilvered: rawDamageValue.isSilvered === true || rawDamageValue.silvered === true,
        isAdamantine: rawDamageValue.isAdamantine === true || rawDamageValue.adamantine === true,
        tags: Array.isArray(rawDamageValue.tags) ? [...rawDamageValue.tags] : []
      };
    }

    if (typeof rawDamageValue === 'string' || typeof rawDamageValue === 'number') {
      return {
        dice: String(rawDamageValue),
        modifier: null
      };
    }

    return null;
  }

  getPrimaryMeleeCardLinkedAction(combatantActionCollection) {
    if (!Array.isArray(combatantActionCollection) || combatantActionCollection.length === 0) {
      return null;
    }

    const preferredUnarmedAction = combatantActionCollection.find((actionEntry) => {
      const actionIdentifier = String(actionEntry?.id || '').toLowerCase();
      const actionName = String(actionEntry?.name || '').toLowerCase();
      const actionType = String(actionEntry?.type || '').toLowerCase();
      return actionIdentifier.includes('unarmed') || actionName.includes('unarmed') || actionType.includes('unarmed');
    });

    return preferredUnarmedAction || combatantActionCollection[0] || null;
  }

  applyPrimaryMeleeCardLinkedStatValues(primaryMeleeCardLinkedAction) {
    const rangeOptionDisplayCollection = ['20ft', '15ft', '10ft', '5ft'];
    const toHitOptionDisplayCollection = [];
    for (let toHitModifierValue = 30; toHitModifierValue >= -10; toHitModifierValue--) {
      toHitOptionDisplayCollection.push((toHitModifierValue >= 0 ? '+' : '') + toHitModifierValue);
    }
    const damageOptionDisplayCollection = [];
    for (let damageDisplayValue = 20; damageDisplayValue >= 0; damageDisplayValue--) {
      damageOptionDisplayCollection.push(String(damageDisplayValue));
    }

    const linkedRangeDisplayValue = this.normalizeRangeDisplayValue(primaryMeleeCardLinkedAction?.range) || '5ft';
    const linkedToHitDisplayValue = this.normalizeToHitDisplayValue(primaryMeleeCardLinkedAction?.toHit) || '+0';
    const linkedDamageDisplayValue = this.resolveDamageDisplayValue(primaryMeleeCardLinkedAction) || '1';

    this.applySteppedStatDisplayValue({
      statBoxElementId: 'rng-box',
      scrollContainerElementId: 'rng-scroll',
      optionDisplayCollection: rangeOptionDisplayCollection,
      selectedDisplayValue: linkedRangeDisplayValue,
      fallbackDisplayValue: '5ft'
    });

    this.applySteppedStatDisplayValue({
      statBoxElementId: 'hit-box',
      scrollContainerElementId: 'hit-scroll',
      optionDisplayCollection: toHitOptionDisplayCollection,
      selectedDisplayValue: linkedToHitDisplayValue,
      fallbackDisplayValue: '+0'
    });

    this.applySteppedStatDisplayValue({
      statBoxElementId: 'dmg-box',
      scrollContainerElementId: 'dmg-scroll',
      optionDisplayCollection: damageOptionDisplayCollection,
      selectedDisplayValue: linkedDamageDisplayValue,
      fallbackDisplayValue: '1'
    });
  }

  applySteppedStatDisplayValue({
    statBoxElementId,
    scrollContainerElementId,
    optionDisplayCollection,
    selectedDisplayValue,
    fallbackDisplayValue
  }) {
    const preferredDisplayValue = selectedDisplayValue || fallbackDisplayValue;
    if (typeof window.setSteppedScrollDefaultValue === 'function') {
      window.setSteppedScrollDefaultValue(statBoxElementId, preferredDisplayValue);
      return;
    }

    const statBoxElement = document.getElementById(statBoxElementId);
    const scrollContainerElement = document.getElementById(scrollContainerElementId);
    if (!statBoxElement || !scrollContainerElement || !Array.isArray(optionDisplayCollection) || optionDisplayCollection.length === 0) {
      return;
    }

    scrollContainerElement.innerHTML = optionDisplayCollection
      .map((optionDisplayValue) => `<div class="scroll-item">${optionDisplayValue}</div>`)
      .join('');

    const normalizeToken = (value) => String(value || '').replace(/\s+/g, '').toLowerCase();
    const normalizedSelectedToken = normalizeToken(preferredDisplayValue);
    const normalizedFallbackToken = normalizeToken(fallbackDisplayValue);

    let selectedOptionIndex = optionDisplayCollection.findIndex((optionDisplayValue) => normalizeToken(optionDisplayValue) === normalizedSelectedToken);
    if (selectedOptionIndex < 0) {
      selectedOptionIndex = optionDisplayCollection.findIndex((optionDisplayValue) => normalizeToken(optionDisplayValue) === normalizedFallbackToken);
    }
    if (selectedOptionIndex < 0) {
      selectedOptionIndex = 0;
    }

    const scrollItemHeight = 44;
    scrollContainerElement.style.transform = `translateY(-${selectedOptionIndex * scrollItemHeight}px)`;

    const fallbackOptionIndex = optionDisplayCollection.findIndex((optionDisplayValue) => normalizeToken(optionDisplayValue) === normalizedFallbackToken);
    if (selectedOptionIndex !== fallbackOptionIndex) {
      statBoxElement.classList.add('modified');
    } else {
      statBoxElement.classList.remove('modified');
    }
  }

  normalizeRangeDisplayValue(rawRangeValue) {
    if (rawRangeValue === null || rawRangeValue === undefined) return null;
    const normalizedRangeToken = String(rawRangeValue).replace(/\s+/g, '').toLowerCase();
    const acceptedRangeTokenMap = {
      '5ft': '5ft',
      '10ft': '10ft',
      '15ft': '15ft',
      '20ft': '20ft'
    };

    return acceptedRangeTokenMap[normalizedRangeToken] || null;
  }

  normalizeToHitDisplayValue(rawToHitValue) {
    if (rawToHitValue === null || rawToHitValue === undefined || rawToHitValue === '') return null;
    const numericToHitValue = Number(rawToHitValue);
    if (!Number.isFinite(numericToHitValue)) return null;
    const roundedToHitValue = Math.trunc(numericToHitValue);
    return `${roundedToHitValue >= 0 ? '+' : ''}${roundedToHitValue}`;
  }

  resolveDamageDisplayValue(actionEntry) {
    if (!actionEntry || typeof actionEntry !== 'object') return null;

    const damageObject = actionEntry.damage;
    if (damageObject && typeof damageObject === 'object') {
      const numericModifier = Number(damageObject.modifier);
      if (Number.isFinite(numericModifier)) {
        return String(Math.max(1, Math.trunc(Math.abs(numericModifier))));
      }

      const numericFlatValue = Number(damageObject.flat);
      if (Number.isFinite(numericFlatValue)) {
        return String(Math.max(1, Math.trunc(Math.abs(numericFlatValue))));
      }

      const diceExpression = String(damageObject.dice || '').trim();
      if (diceExpression) {
        const additiveModifierMatch = diceExpression.match(/[+\-]\s*(\d+)/);
        if (additiveModifierMatch) {
          const additiveModifierValue = Number(additiveModifierMatch[1]);
          if (Number.isFinite(additiveModifierValue)) {
            return String(Math.max(1, Math.trunc(Math.abs(additiveModifierValue))));
          }
        }
      }
    }

    const directDamageNumber = Number(actionEntry.damage);
    if (Number.isFinite(directDamageNumber)) {
      return String(Math.max(1, Math.trunc(Math.abs(directDamageNumber))));
    }

    return null;
  }

  /**
   * Apply combat stats to UI
   */
  applyCombatStats() {
    if (!this.characterData?.combat) return;

    const combat = this.characterData.combat;

    // Update AC display if present
    const acElements = document.querySelectorAll('[data-stat="ac"]');
    acElements.forEach(el => {
      el.textContent = combat.armorClass;
    });

    // Update HP display if present
    const hpElements = document.querySelectorAll('[data-stat="hp"]');
    hpElements.forEach(el => {
      el.textContent = `${combat.hitPoints.current}/${combat.hitPoints.max}`;
    });
  }

  /**
   * Get action by ID
   */
  getActionById(actionId) {
    if (!this.characterData?.actions) return null;
    
    const allActions = [
      ...(this.characterData.actions.weapons || []),
      ...(this.characterData.actions.spellAttacks || []),
      ...(this.characterData.actions.cantrips || []),
      ...(this.characterData.actions.abilities || []),
      ...(this.characterData.actions.bonusActions || []),
      ...(this.characterData.actions.reactions || [])
    ];
    
    return allActions.find(a => a.id === actionId) || null;
  }

  /**
   * Get all actions of a specific type
   */
  getActionsByType(type) {
    if (!this.characterData?.actions) return [];
    
    const allActions = [
      ...(this.characterData.actions.weapons || []),
      ...(this.characterData.actions.spellAttacks || []),
      ...(this.characterData.actions.cantrips || []),
      ...(this.characterData.actions.abilities || []),
      ...(this.characterData.actions.bonusActions || []),
      ...(this.characterData.actions.reactions || [])
    ];
    
    return allActions.filter(a => a.type === type);
  }

  /**
   * Get character summary
   */
  getSummary() {
    if (!this.characterData) return null;
    
    const c = this.characterData.character;
    const combat = this.characterData.combat;
    
    return {
      name: c.name,
      classLevel: `${c.class} ${c.level}${c.subclass ? ` (${c.subclass})` : ''}`,
      ac: combat.armorClass,
      hp: `${combat.hitPoints.current}/${combat.hitPoints.max}`,
      actions: [
        ...(this.characterData.actions.weapons || []),
        ...(this.characterData.actions.spellAttacks || []),
        ...(this.characterData.actions.abilities || [])
      ].length
    };
  }

  /**
   * Export current character data
   */
  exportData() {
    if (!this.characterData) return;
    
    const blob = new Blob([JSON.stringify(this.characterData, null, 2)], 
      { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.characterData.character.name.toLowerCase().replace(/\s+/g, '_')}_data.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Create global instance
window.characterLoader = new CharacterLoader();
