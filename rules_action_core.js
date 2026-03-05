(function attachRulesActionCore(globalScope) {
  // Shared numeric coercion helper so resolvers return stable integer/null payloads.
  function toNumberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function deepClone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  const aliasLeakWarnings = new Set();

  function warnAliasLeakOnce(code, message, details = {}) {
    if (aliasLeakWarnings.has(code)) return;
    aliasLeakWarnings.add(code);
    try {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn(`[RulesActionCore] ${message}`, details);
      }
    } catch {}
  }

  function pushQualifierTextBucket(bucket = [], value) {
    if (typeof value === 'string') {
      const normalizedValue = String(value).trim();
      if (normalizedValue) bucket.push(normalizedValue);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => pushQualifierTextBucket(bucket, entry));
      return;
    }

    if (!value || typeof value !== 'object') return;

    [
      value.name,
      value.label,
      value.type,
      value.weaponType,
      value.weaponCategory,
      value.material,
      value.description,
      value.text,
      value.notes,
      value.note,
      value.details,
      value.traits,
      value.property,
      value.properties
    ].forEach((entry) => pushQualifierTextBucket(bucket, entry));
  }

  function collectQualifierHintText(action = {}, source = {}, damageSource = {}, input = {}) {
    const textBucket = [];

    [
      action?.id,
      action?.name,
      source?.id,
      source?.name,
      source?.label,
      source?.type,
      source?.weaponType,
      source?.weaponCategory,
      source?.material,
      source?.description,
      source?.notes,
      source?.note,
      source?.text,
      source?.details,
      source?.attackDescription,
      damageSource?.description,
      damageSource?.notes,
      damageSource?.note,
      damageSource?.text,
      input?.description,
      input?.notes,
      input?.note,
      input?.weaponName,
      input?.weaponType,
      input?.weaponMaterial
    ].forEach((entry) => pushQualifierTextBucket(textBucket, entry));

    pushQualifierTextBucket(textBucket, action?.tags);
    pushQualifierTextBucket(textBucket, source?.tags);
    pushQualifierTextBucket(textBucket, source?.properties);
    pushQualifierTextBucket(textBucket, source?.weaponProperties);
    pushQualifierTextBucket(textBucket, source?.traits);
    pushQualifierTextBucket(textBucket, damageSource?.tags);
    pushQualifierTextBucket(textBucket, source?.weapon);
    pushQualifierTextBucket(textBucket, source?.source);
    pushQualifierTextBucket(textBucket, source?.damage);

    return textBucket.join(' ').toLowerCase();
  }

  // ACTION PIPELINE NOTE:
  // Damage qualifier flags (magical/silvered/adamantine) can arrive from many sources:
  // - explicit action metadata
  // - nested damage metadata
  // - tags or property arrays from imported sheets/statblocks
  // This helper collapses those variants into one stable boolean contract.
  function deriveDamageQualifiers(action = {}, input = {}) {
    const source = action?.source && typeof action.source === 'object' ? action.source : {};
    const damageSource = action?.damage && typeof action.damage === 'object' ? action.damage : {};

    const tags = new Set([
      ...(Array.isArray(action?.tags) ? action.tags : []),
      ...(Array.isArray(source?.tags) ? source.tags : []),
      ...(Array.isArray(source?.properties) ? source.properties : []),
      ...(Array.isArray(source?.weaponProperties) ? source.weaponProperties : []),
      ...(Array.isArray(damageSource?.tags) ? damageSource.tags : [])
    ].map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean));

    const qualifierHintText = collectQualifierHintText(action, source, damageSource, input);
    const hasNonMagicalHint = /\bnon[-\s]?magical\b/.test(qualifierHintText);
    const hasMagicalHint = /\bmagic(?:al)?\s+weapon\b|\bcounts?\s+as\s+magical\b|\btreated\s+as\s+magical\b|\bmagical\b/.test(qualifierHintText);
    const hasSilveredHint = /\bsilver(?:ed)?\s+weapon\b|\bsilvered\b/.test(qualifierHintText);
    const hasAdamantineHint = /\badamantine\s+weapon\b|\badamantine\b/.test(qualifierHintText);

    const isMagical = input?.isMagical === true
      || source?.isMagical === true
      || source?.magical === true
      || damageSource?.isMagical === true
      || damageSource?.magical === true
      || tags.has('magical')
      || (hasMagicalHint && !hasNonMagicalHint);

    const isSilvered = input?.isSilvered === true
      || source?.isSilvered === true
      || source?.silvered === true
      || damageSource?.isSilvered === true
      || damageSource?.silvered === true
      || tags.has('silvered')
      || hasSilveredHint;

    const isAdamantine = input?.isAdamantine === true
      || source?.isAdamantine === true
      || source?.adamantine === true
      || damageSource?.isAdamantine === true
      || damageSource?.adamantine === true
      || tags.has('adamantine')
      || hasAdamantineHint;

    return {
      isMagical,
      isSilvered,
      isAdamantine
    };
  }

  // Normalizes mixed legacy card/action records into a consistent action contract.
  function normalizeActionInput(rawAction = {}) {
    const source = rawAction && typeof rawAction === 'object' ? rawAction : {};
    // ACTION PIPELINE NOTE:
    // We normalize once here so all downstream resolvers see consistent keys.
    // Keep this shape stable; it is the contract for attack/damage/save/roll handlers.
    const normalizedDamage = normalizeDamageBlock(source.damage);
    const normalizedTags = Array.isArray(source.tags) ? [...source.tags] : [];

    if (source.attackBonus !== undefined || source.hitBonus !== undefined || source.to_hit !== undefined || source.attackRollBonus !== undefined) {
      warnAliasLeakOnce('alias_to_hit', 'Legacy to-hit aliases detected at resolver boundary; normalize to `toHit` upstream when possible.', {
        hasAttackBonus: source.attackBonus !== undefined,
        hasHitBonus: source.hitBonus !== undefined,
        hasToHitUnderscore: source.to_hit !== undefined,
        hasAttackRollBonus: source.attackRollBonus !== undefined
      });
    }

    if (source.dc !== undefined || source.saveDC !== undefined) {
      warnAliasLeakOnce('alias_save_dc', 'Legacy save DC aliases detected at resolver boundary; prefer canonical `saveDc` upstream.', {
        hasDc: source.dc !== undefined,
        hasSaveDC: source.saveDC !== undefined
      });
    }

    return {
      id: String(source.id || source.key || source.name || 'action_unknown'),
      name: String(source.name || 'Unknown Action'),
      category: String(source.bucket || source.type || source.category || 'action'),
      activation: String(source.activation || source.actionCost || 'action'),
      range: source.range ?? source.reach ?? null,
      toHit: toNumberOrNull(source.toHit ?? source.attackBonus ?? source.hitBonus ?? source.to_hit) ?? 0,
      saveDc: toNumberOrNull(source.saveDc ?? source.dc ?? source.saveDC),
      damage: normalizedDamage,
      tags: normalizedTags,
      qualifiers: deriveDamageQualifiers({ damage: normalizedDamage, tags: normalizedTags, source }, {}),
      source: deepClone(source)
    };
  }

  // Canonical damage parser reused by attack and direct damage resolvers.
  function normalizeDamageBlock(rawDamage) {
    if (!rawDamage) return { formula: null, flat: null, type: null };
    if (typeof rawDamage === 'number' || typeof rawDamage === 'string') {
      const numeric = toNumberOrNull(rawDamage);
      return {
        formula: typeof rawDamage === 'string' ? String(rawDamage) : null,
        flat: numeric,
        type: null
      };
    }

    if (typeof rawDamage === 'object') {
      if (rawDamage.damageType !== undefined) {
        warnAliasLeakOnce('alias_damage_type', 'Legacy damage type alias detected at resolver boundary; prefer canonical `type` in normalized damage blocks.', {
          hasDamageTypeAlias: true
        });
      }
      if (rawDamage.magical !== undefined || rawDamage.silvered !== undefined || rawDamage.adamantine !== undefined) {
        warnAliasLeakOnce('alias_damage_qualifiers', 'Legacy qualifier aliases detected at resolver boundary; prefer canonical `isMagical`/`isSilvered`/`isAdamantine`.', {
          hasMagical: rawDamage.magical !== undefined,
          hasSilvered: rawDamage.silvered !== undefined,
          hasAdamantine: rawDamage.adamantine !== undefined
        });
      }

      // ACTION PIPELINE NOTE:
      // Preserve a few qualifier hints directly on normalized damage so the
      // resolver can inspect them even if upstream action metadata is sparse.
      return {
        formula: rawDamage.dice ?? rawDamage.formula ?? rawDamage.value ?? null,
        flat: toNumberOrNull(rawDamage.modifier ?? rawDamage.flat ?? rawDamage.bonus),
        type: rawDamage.type ?? rawDamage.damageType ?? null,
        isMagical: rawDamage.isMagical === true || rawDamage.magical === true,
        isSilvered: rawDamage.isSilvered === true || rawDamage.silvered === true,
        isAdamantine: rawDamage.isAdamantine === true || rawDamage.adamantine === true,
        tags: Array.isArray(rawDamage.tags) ? [...rawDamage.tags] : []
      };
    }

    return { formula: null, flat: null, type: null };
  }

  // Resolves a to-hit roll against AC without mutating UI or actor state.
  function resolveAttackAction(input = {}) {
    const action = normalizeActionInput(input.action || {});
    const targetAc = toNumberOrNull(input.targetAc);
    const attackRoll = toNumberOrNull(input.attackRoll);
    const extraToHit = toNumberOrNull(input.extraToHit) ?? 0;
    const attackTotal = Number.isFinite(attackRoll)
      ? Math.trunc(attackRoll) + Math.trunc(action.toHit) + Math.trunc(extraToHit)
      : null;
    const hit = Number.isFinite(targetAc) && Number.isFinite(attackTotal)
      ? attackTotal >= Math.trunc(targetAc)
      : null;

    return {
      actionId: action.id,
      actionName: action.name,
      targetAc: Number.isFinite(targetAc) ? Math.trunc(targetAc) : null,
      roll: Number.isFinite(attackRoll) ? Math.trunc(attackRoll) : null,
      toHit: Math.trunc(action.toHit),
      extraToHit: Math.trunc(extraToHit),
      attackTotal,
      hit,
      damage: deepClone(action.damage)
    };
  }

  // Resolves contested check style rolls (push/grapple/custom variants).
  function resolveContestedCheckAction(input = {}) {
    const action = normalizeActionInput(input.action || {});
    const checkRoll = toNumberOrNull(input.checkRoll);
    const checkModifier = toNumberOrNull(input.checkModifier) ?? action.toHit;
    const flatBonus = toNumberOrNull(input.flatBonus) ?? 0;
    const total = Number.isFinite(checkRoll)
      ? Math.trunc(checkRoll) + Math.trunc(checkModifier) + Math.trunc(flatBonus)
      : null;
    const ruleVariant = String(input.ruleVariant || action.source?.ruleVariant || 'contested_check');

    let contestedModel = 'd20_plus_mod_vs_d20_plus_mod';
    if (ruleVariant === 'custom_contested_str_dex_vs_grapple_dc') {
      contestedModel = 'd20_plus_mod_vs_grapple_dc';
    }

    return {
      actionId: action.id,
      actionName: action.name,
      roll: Number.isFinite(checkRoll) ? Math.trunc(checkRoll) : null,
      modifier: Math.trunc(checkModifier),
      flatBonus: Math.trunc(flatBonus),
      total,
      ruleVariant,
      contestedModel,
      opponentValue: toNumberOrNull(input.opponentValue),
      success: Number.isFinite(Number(input.opponentValue)) && Number.isFinite(total)
        ? total >= Math.trunc(Number(input.opponentValue))
        : null
    };
  }

  // Produces a normalized damage packet from explicit values or roll+flat input.
  function resolveDamageAction(input = {}) {
    // ACTION PIPELINE NOTE:
    // 1) normalize incoming action
    // 2) calculate total damage
    // 3) derive qualifier flags
    // 4) return a packet suitable for replay, logs, and defense evaluation
    const action = normalizeActionInput(input.action || {});
    const explicitDamageValue = toNumberOrNull(input.damageValue);
    const rolledDamage = toNumberOrNull(input.damageRoll);
    const damageFlat = toNumberOrNull(action.damage?.flat) ?? 0;
    const qualifiers = deriveDamageQualifiers(action, input);

    const totalDamage = Number.isFinite(explicitDamageValue)
      ? Math.max(0, Math.trunc(explicitDamageValue))
      : (Number.isFinite(rolledDamage)
        ? Math.max(0, Math.trunc(rolledDamage + damageFlat))
        : (Number.isFinite(damageFlat) ? Math.max(0, Math.trunc(damageFlat)) : 0));

    return {
      actionId: action.id,
      actionName: action.name,
      damageType: String(input.damageType || action.damage?.type || 'bludgeoning'),
      damageFormula: action.damage?.formula || null,
      rolledDamage: Number.isFinite(rolledDamage) ? Math.trunc(rolledDamage) : null,
      flatBonus: Math.trunc(damageFlat),
      totalDamage,
      isMagical: qualifiers.isMagical,
      isSilvered: qualifiers.isSilvered,
      isAdamantine: qualifiers.isAdamantine
    };
  }

  // Generic d20-style roll resolver used for RAD/utility roll buttons.
  function resolveSimpleRollAction(input = {}) {
    const action = normalizeActionInput(input.action || {});
    const roll = toNumberOrNull(input.roll);
    const modifier = toNumberOrNull(input.modifier) ?? 0;
    const flatBonus = toNumberOrNull(input.flatBonus) ?? 0;
    const total = Number.isFinite(roll)
      ? Math.trunc(roll) + Math.trunc(modifier) + Math.trunc(flatBonus)
      : null;

    return {
      actionId: action.id,
      actionName: action.name,
      rollType: String(input.rollType || 'roll'),
      roll: Number.isFinite(roll) ? Math.trunc(roll) : null,
      modifier: Math.trunc(modifier),
      flatBonus: Math.trunc(flatBonus),
      total
    };
  }

  // Resolves save DC payloads for display, logging, and replay metadata.
  function resolveSaveDcAction(input = {}) {
    const action = normalizeActionInput(input.action || {});
    const explicitSaveDc = toNumberOrNull(input.saveDc);
    const actionSaveDc = toNumberOrNull(action.saveDc);
    const saveDc = Number.isFinite(explicitSaveDc)
      ? Math.trunc(explicitSaveDc)
      : (Number.isFinite(actionSaveDc) ? Math.trunc(actionSaveDc) : null);

    return {
      actionId: action.id,
      actionName: action.name,
      saveDc,
      saveType: String(input.saveType || action.source?.saveType || 'unspecified')
    };
  }

  // Generates all unarmed permutations from actor abilities/proficiency context.
  function generateUnarmedVariants(baseAction = {}, options = {}) {
    const normalizedBase = normalizeActionInput(baseAction);
    const actor = options.actor && typeof options.actor === 'object' ? options.actor : {};
    const abilityVariants = Array.isArray(options.abilityOrder) && options.abilityOrder.length
      ? options.abilityOrder
      : ['strength', 'dexterity'];
    const proficiencyOptions = Array.isArray(options.proficiencyOptions) && options.proficiencyOptions.length
      ? options.proficiencyOptions
      : [true, false];

    const actorAbilities = actor.abilities && typeof actor.abilities === 'object' ? actor.abilities : {};
    const proficiencyBonus = toNumberOrNull(actor.proficiencyBonus) ?? 0;

    const variants = [];
    abilityVariants.forEach((abilityKey) => {
      const abilityEntry = actorAbilities[abilityKey] || {};
      const abilityMod = toNumberOrNull(abilityEntry.modifier) ?? 0;

      proficiencyOptions.forEach((isProficient) => {
        const toHit = abilityMod + (isProficient ? proficiencyBonus : 0);
        const variantKey = `${normalizedBase.id}_unarmed_${abilityKey}_${isProficient ? 'prof' : 'noprof'}`;
        variants.push({
          ...deepClone(normalizedBase),
          id: variantKey,
          key: variantKey,
          name: `${normalizedBase.name} (${abilityKey.toUpperCase()}${isProficient ? ', Prof' : ''})`,
          bucket: normalizedBase.category,
          activation: normalizedBase.activation,
          tags: Array.from(new Set([...(normalizedBase.tags || []), 'unarmed', abilityKey, isProficient ? 'proficient' : 'non-proficient'])),
          toHit,
          damage: {
            ...(normalizedBase.damage || {}),
            flat: abilityMod
          },
          variantMeta: {
            baseActionId: normalizedBase.id,
            ability: abilityKey,
            proficient: !!isProficient,
            proficiencyBonus,
            abilityModifier: abilityMod
          }
        });
      });
    });

    return variants;
  }

  const RulesActionCore = {
    normalizeActionInput,
    resolveAttackAction,
    resolveContestedCheckAction,
    resolveDamageAction,
    resolveSimpleRollAction,
    resolveSaveDcAction,
    generateUnarmedVariants
  };

  globalScope.RulesActionCore = RulesActionCore;
})(window);
