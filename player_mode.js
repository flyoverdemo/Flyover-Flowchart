(function playerModeInfoWindowInit() {
	const PLAYER_INFO_TOGGLE_ID = 'toggle-player-info-window';
	const PLAYER_INFO_WINDOW_ID = 'player-info-window';
	const PLAYER_INFO_CONTENT_ID = 'player-info-content';
	const PLAYER_INFO_TITLE_ID = 'player-info-window-title';
	const PLAYER_INFO_HEADER_SELECTOR = '.player-info-header';
	const PLAYER_INFO_MODE_TOGGLE_ID = 'player-info-mode-toggle';
	const PLAYER_INFO_REVERT_ID = 'player-info-revert-btn';
	const PLAYER_INFO_COMMIT_ID = 'player-info-commit-btn';
	const ACTIVE_BUFFER_LABEL_ID = 'active-combatant-buffer-value';
	const PLAYER_INFO_BASE_WIDTH = 760;
	const PLAYER_INFO_BASE_HEIGHT = 660;
	const PLAYER_INFO_MIN_SCALE = 0.84;
	const PLAYER_INFO_MIN_NARROW_SCALE = 0.52;
	const PLAYER_INFO_NARROW_MEDIA_QUERY = '(max-width: 760px), (orientation: portrait) and (max-width: 820px)';
	const PLAYER_INFO_CANVAS_Z = 850;
	const PLAYER_INFO_MIN_HEADER_VISIBLE_X = 24;
	const PLAYER_INFO_MIN_HEADER_VISIBLE_Y = 24;
	const PLAYER_INFO_NARROW_VIEWPORT_MARGIN_X = 16;
	const PLAYER_INFO_NARROW_VIEWPORT_MARGIN_Y = 24;
	const PLAYER_INFO_NARROW_MIN_VISIBLE_X = 72;
	const PLAYER_INFO_NARROW_MIN_VISIBLE_Y = 40;
	const PLAYER_INFO_STATE_STORAGE_KEY = 'chain_warden_player_info_window_state_v1';
	const PLAYER_INFO_PROF_MIN = -30;
	const PLAYER_INFO_PROF_MAX = 50;
	const PLAYER_INFO_DISPLAY_MIN = -99;
	const PLAYER_INFO_DISPLAY_MAX = 99;
	const PLAYER_INFO_PROF_HOLD_DELAY_MS = 420;
	const PLAYER_INFO_PROF_DRAG_STEP_PX = 18;
	const PLAYER_INFO_PROF_TAP_MOVE_THRESHOLD_PX = 10;
	const PLAYER_INFO_INIT_MIN = -30;
	const PLAYER_INFO_INIT_MAX = 50;
	const PLAYER_INFO_INIT_HOLD_DELAY_MS = 420;
	const PLAYER_INFO_INIT_DRAG_STEP_PX = 18;
	const PLAYER_INFO_INIT_TAP_MOVE_THRESHOLD_PX = 10;
	const PLAYER_INFO_STR_MIN = -30;
	const PLAYER_INFO_STR_MAX = 50;
	const PLAYER_INFO_STR_SCORE_MIN = 1;
	const PLAYER_INFO_STR_SCORE_MAX = 30;
	const PLAYER_INFO_STR_HOLD_DELAY_MS = 420;
	const PLAYER_INFO_STR_DRAG_STEP_PX = 18;
	const PLAYER_INFO_STR_TAP_MOVE_THRESHOLD_PX = 10;
	const PLAYER_INFO_DEX_MIN = -30;
	const PLAYER_INFO_DEX_MAX = 50;
	const PLAYER_INFO_DEX_SCORE_MIN = 1;
	const PLAYER_INFO_DEX_SCORE_MAX = 30;
	const PLAYER_INFO_DEX_HOLD_DELAY_MS = 420;
	const PLAYER_INFO_DEX_DRAG_STEP_PX = 18;
	const PLAYER_INFO_DEX_TAP_MOVE_THRESHOLD_PX = 10;
	const PLAYER_INFO_STD_ABILITY_MIN = -30;
	const PLAYER_INFO_STD_ABILITY_MAX = 50;
	const PLAYER_INFO_STD_ABILITY_SCORE_MIN = 1;
	const PLAYER_INFO_STD_ABILITY_SCORE_MAX = 30;
	const PLAYER_INFO_STD_ABILITY_HOLD_DELAY_MS = 420;
	const PLAYER_INFO_STD_ABILITY_DRAG_STEP_PX = 18;
	const PLAYER_INFO_STD_ABILITY_TAP_MOVE_THRESHOLD_PX = 10;
	const PLAYER_INFO_OTHER_ABILITY_KEYS = ['constitution', 'intelligence', 'wisdom', 'charisma'];
	const ACTIVE_COMBATANT_REFERENCE_STORAGE_KEY = 'chain_warden_active_combatant_reference_v1';
	const STR_DEBUG_STORAGE_KEY = 'chain_warden_str_debug_v1';
	const STR_DEBUG_ENABLED = String(window.localStorage?.getItem(STR_DEBUG_STORAGE_KEY) ?? '1') !== '0';
	let strDebugSequence = 0;

	const fallbackText = 'No active combatant in buffer. Use CREATE/LOAD to load a character.';

	function logStrDebug(stage, payload = null) {
		if (!STR_DEBUG_ENABLED) return;
		strDebugSequence += 1;
		const timestampIso = new Date().toISOString();
		const heading = `[STR-DEBUG ${strDebugSequence}] ${timestampIso} ${stage}`;
		if (payload && typeof payload === 'object') {
			console.groupCollapsed(heading);
			console.log(payload);
			console.groupEnd();
			return;
		}
		console.log(heading, payload ?? '');
	}

	function sanitizeText(value, emptyFallback = '---') {
		if (value === null || value === undefined) return emptyFallback;
		const next = String(value).trim();
		return next || emptyFallback;
	}

	function clampImportedNumeric(value) {
		const parsed = Number(value);
		if (!Number.isFinite(parsed)) return null;
		return Math.trunc(parsed);
	}

	function clampDisplayNumeric(value) {
		const parsed = Number(value);
		if (!Number.isFinite(parsed)) return null;
		const truncated = Math.trunc(parsed);
		return Math.max(PLAYER_INFO_DISPLAY_MIN, Math.min(PLAYER_INFO_DISPLAY_MAX, truncated));
	}

	function sanitizeNumeric(value, emptyFallback = '---') {
		const importedSafe = clampImportedNumeric(value);
		if (!Number.isFinite(importedSafe)) return emptyFallback;
		const displaySafe = clampDisplayNumeric(importedSafe);
		if (!Number.isFinite(displaySafe)) return emptyFallback;
		return String(displaySafe);
	}

	function extractFirstFiniteNumber(candidates) {
		for (const candidate of candidates) {
			const parsed = clampImportedNumeric(candidate);
			if (Number.isFinite(parsed)) return parsed;
		}
		return null;
	}

	function extractTotalLevelFromClasses(classEntries) {
		if (!Array.isArray(classEntries) || classEntries.length === 0) return null;
		let total = 0;
		let foundAny = false;
		for (const classEntry of classEntries) {
			if (!classEntry || typeof classEntry !== 'object') continue;
			const classLevel = extractFirstFiniteNumber([
				classEntry.level,
				classEntry.classLevel,
				classEntry.lv,
				classEntry.lvl
			]);
			if (!Number.isFinite(classLevel)) continue;
			foundAny = true;
			total += Math.max(0, Math.trunc(classLevel));
		}
		if (!foundAny) return null;
		return total;
	}

	function extractTotalLevelFromClassText(rawValue) {
		if (rawValue === null || rawValue === undefined) return null;
		const value = String(rawValue);
		const matches = value.match(/\d+/g);
		if (!Array.isArray(matches) || matches.length === 0) return null;
		let total = 0;
		let foundAny = false;
		for (const token of matches) {
			const parsed = Number(token);
			if (!Number.isFinite(parsed)) continue;
			foundAny = true;
			total += Math.max(0, Math.trunc(parsed));
		}
		if (!foundAny) return null;
		return total;
	}

	function extractCharacterLevel(characterData) {
		const characterInfo = characterData?.character || {};
		const combatInfo = characterData?.combat || {};
		const classTotalLevel = extractTotalLevelFromClasses(characterData?.classes);
		const classTextTotalLevel = extractTotalLevelFromClassText(
			characterInfo.classLevel
			?? characterInfo.class_level
			?? characterInfo.classAndLevel
			?? characterInfo.class
			?? ''
		);
		const parsedLevel = extractFirstFiniteNumber([
			characterInfo.level,
			characterInfo.characterLevel,
			combatInfo.level,
			characterData?.level,
			classTotalLevel,
			classTextTotalLevel
		]);
		if (!Number.isFinite(parsedLevel)) return null;
		return Math.max(1, Math.min(20, Math.trunc(parsedLevel)));
	}

	function getExpectedProficiencyBonusForLevel(level) {
		// Core 5e progression for playable characters.
		if (!Number.isFinite(level)) return null;
		const safeLevel = Math.max(1, Math.min(20, Math.trunc(level)));
		return 2 + Math.floor((safeLevel - 1) / 4);
	}

	function getAbilityModifierFromScore(scoreValue) {
		const parsedScore = Number(scoreValue);
		if (!Number.isFinite(parsedScore)) return null;
		return Math.floor((Math.trunc(parsedScore) - 10) / 2);
	}

	function isValidStrengthScore(scoreValue) {
		const parsedScore = Number(scoreValue);
		if (!Number.isFinite(parsedScore)) return false;
		const truncatedScore = Math.trunc(parsedScore);
		return truncatedScore >= PLAYER_INFO_STR_SCORE_MIN
			&& truncatedScore <= PLAYER_INFO_STR_SCORE_MAX;
	}

	function normalizeStrengthScore(scoreValue) {
		if (!isValidStrengthScore(scoreValue)) return null;
		return Math.trunc(Number(scoreValue));
	}

	function isValidDexterityScore(scoreValue) {
		const parsedScore = Number(scoreValue);
		if (!Number.isFinite(parsedScore)) return false;
		const truncatedScore = Math.trunc(parsedScore);
		return truncatedScore >= PLAYER_INFO_DEX_SCORE_MIN
			&& truncatedScore <= PLAYER_INFO_DEX_SCORE_MAX;
	}

	function normalizeDexterityScore(scoreValue) {
		if (!isValidDexterityScore(scoreValue)) return null;
		return Math.trunc(Number(scoreValue));
	}

	function isValidStandardAbilityScore(scoreValue) {
		const parsedScore = Number(scoreValue);
		if (!Number.isFinite(parsedScore)) return false;
		const truncatedScore = Math.trunc(parsedScore);
		return truncatedScore >= PLAYER_INFO_STD_ABILITY_SCORE_MIN
			&& truncatedScore <= PLAYER_INFO_STD_ABILITY_SCORE_MAX;
	}

	function normalizeStandardAbilityScore(scoreValue) {
		if (!isValidStandardAbilityScore(scoreValue)) return null;
		return Math.trunc(Number(scoreValue));
	}

	function getAbilityShortKey(abilityKey) {
		const normalized = String(abilityKey || '').toLowerCase().trim();
		if (!normalized) return '';
		return normalized.slice(0, 3);
	}

	function getAbilityOverrideFieldName(abilityKey, suffix) {
		const normalized = String(abilityKey || '').trim();
		if (!normalized) return '';
		return `${normalized}${suffix}`;
	}

	function resolveProficiencyBonusProfile(characterData) {
		const characterInfo = characterData?.character || {};
		const combatInfo = characterData?.combat || {};
		const playerSheetOriginals = (characterData?.playerSheetOriginals && typeof characterData.playerSheetOriginals === 'object')
			? characterData.playerSheetOriginals
			: null;
		const committedBonusRaw = extractFirstFiniteNumber([
			characterData?.playerSheetOverrides?.proficiencyBonus,
			combatInfo.proficiencyBonusCommitted,
			combatInfo.proficiencyBonusOverride
		]);
		const committedBonus = Number.isFinite(committedBonusRaw) ? Math.trunc(committedBonusRaw) : null;
		const level = extractCharacterLevel(characterData);
		const expectedBonus = getExpectedProficiencyBonusForLevel(level);
		const importedBonusRaw = extractFirstFiniteNumber([
			combatInfo.proficiencyBonus,
			combatInfo.profBonus,
			combatInfo.proficiency,
			characterData?.proficiencyBonus,
			characterData?.proficiency,
			characterInfo.proficiencyBonus,
			characterInfo.proficiency
		]);
		const importedBonus = Number.isFinite(importedBonusRaw) ? Math.trunc(importedBonusRaw) : null;
		const importedLooksCanonical = Number.isFinite(importedBonus) && importedBonus >= 2 && importedBonus <= 6;
		const originalBonusRaw = extractFirstFiniteNumber([
			playerSheetOriginals?.proficiencyBonus,
			combatInfo.proficiencyBonusOriginal
		]);
		let originalBonus = Number.isFinite(originalBonusRaw) ? Math.trunc(originalBonusRaw) : null;

		let resolvedBonus = null;
		let source = 'none';
		let hasMismatch = false;

		if (Number.isFinite(committedBonus)) {
			resolvedBonus = committedBonus;
			source = 'committed-override';
		}

		if (!Number.isFinite(resolvedBonus) && importedLooksCanonical) {
			resolvedBonus = importedBonus;
			source = 'imported';
		}

		// Keep level-authoritative behavior for imported/raw sources, but preserve
		// explicitly committed player-sheet overrides as the active gold standard.
		if (Number.isFinite(expectedBonus)) {
			if (!Number.isFinite(resolvedBonus)) {
				resolvedBonus = expectedBonus;
				source = 'level-derived';
			} else if (source !== 'committed-override' && resolvedBonus !== expectedBonus) {
				hasMismatch = true;
				resolvedBonus = expectedBonus;
				source = 'level-verified';
			} else if (source === 'committed-override' && resolvedBonus !== expectedBonus) {
				hasMismatch = true;
			}
		}

		// When level is missing, use imported PROF as a soft fallback.
		// Edge-case note: explicit PB modifiers from items/homebrew (for example
		// Ioun Stone of Mastery) should be represented upstream in data if desired.
		if (!Number.isFinite(resolvedBonus) && Number.isFinite(importedBonus)) {
			resolvedBonus = importedBonus;
			source = 'imported-unverified';
		}

		if (!Number.isFinite(originalBonus)) {
			const bootstrapOriginalBonus = extractFirstFiniteNumber([
				importedBonus,
				expectedBonus,
				resolvedBonus
			]);
			if (Number.isFinite(bootstrapOriginalBonus) && characterData && typeof characterData === 'object') {
				if (!characterData.playerSheetOriginals || typeof characterData.playerSheetOriginals !== 'object') {
					characterData.playerSheetOriginals = {};
				}
				characterData.playerSheetOriginals.proficiencyBonus = Math.trunc(bootstrapOriginalBonus);
				originalBonus = Math.trunc(bootstrapOriginalBonus);
			}
		}

		const hasPersistentDirty = Number.isFinite(originalBonus)
			&& Number.isFinite(committedBonus)
			&& committedBonus !== originalBonus;

		return {
			level,
			expectedBonus,
			committedBonus,
			originalBonus,
			importedBonus,
			resolvedBonus,
			source,
			hasMismatch,
			hasPersistentDirty,
			display: Number.isFinite(resolvedBonus) ? formatSignedModifier(resolvedBonus) : '---'
		};
	}

	function resolveInitiativeProfile(characterData) {
		const combatInfo = (characterData?.combat && typeof characterData.combat === 'object')
			? characterData.combat
			: null;
		const playerSheetOriginals = (characterData?.playerSheetOriginals && typeof characterData.playerSheetOriginals === 'object')
			? characterData.playerSheetOriginals
			: null;
		const committedRaw = extractFirstFiniteNumber([
			characterData?.playerSheetOverrides?.initiative,
			combatInfo?.initiativeCommitted,
			combatInfo?.initiativeOverride
		]);
		const committedValue = Number.isFinite(committedRaw) ? Math.trunc(committedRaw) : null;
		const sourceRaw = extractFirstFiniteNumber([
			combatInfo?.initiative,
			combatInfo?.init,
			characterData?.initiative,
			characterData?.character?.initiative
		]);
		const sourceValue = Number.isFinite(sourceRaw) ? Math.trunc(sourceRaw) : null;
		const originalRaw = extractFirstFiniteNumber([
			playerSheetOriginals?.initiative,
			combatInfo?.initiativeOriginal,
			sourceValue
		]);
		let originalValue = Number.isFinite(originalRaw) ? Math.trunc(originalRaw) : null;

		let resolvedValue = Number.isFinite(committedValue)
			? Math.trunc(committedValue)
			: (Number.isFinite(sourceValue) ? Math.trunc(sourceValue) : null);

		if (!Number.isFinite(originalValue) && characterData && typeof characterData === 'object' && Number.isFinite(resolvedValue)) {
			if (!characterData.playerSheetOriginals || typeof characterData.playerSheetOriginals !== 'object') {
				characterData.playerSheetOriginals = {};
			}
			characterData.playerSheetOriginals.initiative = Math.trunc(resolvedValue);
			originalValue = Math.trunc(resolvedValue);
		}

		if (!Number.isFinite(resolvedValue)) {
			resolvedValue = Number.isFinite(originalValue) ? Math.trunc(originalValue) : null;
		}

		const hasPersistentDirty = Number.isFinite(originalValue)
			&& Number.isFinite(committedValue)
			&& Math.trunc(committedValue) !== Math.trunc(originalValue);
		const hasRuntimeDirty = Number.isFinite(originalValue)
			&& Number.isFinite(resolvedValue)
			&& Math.trunc(resolvedValue) !== Math.trunc(originalValue);

		return {
			resolvedValue,
			committedValue,
			originalValue,
			hasPersistentDirty,
			hasRuntimeDirty,
			hasAnyDirty: hasPersistentDirty || hasRuntimeDirty,
			display: Number.isFinite(resolvedValue) ? formatSignedModifier(resolvedValue) : '---'
		};
	}

	function resolveStrengthModifierProfile(characterData) {
		const abilityMap = extractAbilityMap(characterData) || {};
		const strengthEntry = abilityMap.strength ?? abilityMap.STR ?? null;
		const baselineAbilityMap = (
			characterData?.abilityScores
			&& typeof characterData.abilityScores === 'object'
			&& !Array.isArray(characterData.abilityScores)
		)
			? characterData.abilityScores
			: (characterData?.character?.abilityScores
				&& typeof characterData.character.abilityScores === 'object'
				&& !Array.isArray(characterData.character.abilityScores)
				? characterData.character.abilityScores
				: null);
		const baselineStrengthEntry = baselineAbilityMap
			? (baselineAbilityMap.strength ?? baselineAbilityMap.STR ?? null)
			: null;
		const sourceScoreRaw = extractAbilityScore(strengthEntry);
		const sourceScore = normalizeStrengthScore(sourceScoreRaw);
		const sourceModifier = extractAbilityModifier(strengthEntry);
		const sourceModifierExplicitRaw = (strengthEntry && typeof strengthEntry === 'object')
			? extractFirstFiniteNumber([
				strengthEntry.modifier,
				strengthEntry.mod,
				strengthEntry.modBonus,
				strengthEntry.modifierBonus
			])
			: null;
		const sourceModifierExplicit = Number.isFinite(sourceModifierExplicitRaw)
			? Math.trunc(sourceModifierExplicitRaw)
			: null;
		// Only explicit sheet overrides are treated as committed values.
		// Embedded "*Committed/*Override" ability fields can be stale import residue.
		const committedRaw = extractFirstFiniteNumber([
			characterData?.playerSheetOverrides?.strengthModifier
		]);
		const committedScoreRaw = extractFirstFiniteNumber([
			characterData?.playerSheetOverrides?.strengthScore
		]);
		let committedModifier = Number.isFinite(committedRaw) ? Math.trunc(committedRaw) : null;
		const committedScore = normalizeStrengthScore(committedScoreRaw);
		let resolvedScore = Number.isFinite(committedScore)
			? committedScore
			: (Number.isFinite(sourceScore) ? Math.trunc(sourceScore) : null);
		const committedModifierFromScore = getAbilityModifierFromScore(committedScore);
		let didCanonicalizeCommittedModifier = false;
		if (Number.isFinite(committedScore) && Number.isFinite(committedModifierFromScore)) {
			if (!Number.isFinite(committedModifier)) {
				committedModifier = Math.trunc(committedModifierFromScore);
				didCanonicalizeCommittedModifier = true;
				if (characterData && typeof characterData === 'object') {
					if (!characterData.playerSheetOverrides || typeof characterData.playerSheetOverrides !== 'object') {
						characterData.playerSheetOverrides = {};
					}
					characterData.playerSheetOverrides.strengthModifier = Math.trunc(committedModifierFromScore);
				}
				if (strengthEntry && typeof strengthEntry === 'object') {
					strengthEntry.modifierCommitted = Math.trunc(committedModifierFromScore);
					strengthEntry.modifier = Math.trunc(committedModifierFromScore);
					delete strengthEntry.modifierOverride;
				}
			}
		}
		const sourceModifierFromScore = getAbilityModifierFromScore(sourceScore);
		let resolvedModifier = Number.isFinite(committedModifier)
			? committedModifier
			: (Number.isFinite(committedModifierFromScore)
				? committedModifierFromScore
				: (Number.isFinite(sourceModifierFromScore)
					? sourceModifierFromScore
					: (Number.isFinite(sourceModifier) ? Math.trunc(sourceModifier) : null)));

		// Keep STR score authoritative for display/resolution unless there is an
		// explicit committed modifier override from the player sheet.
		if (!Number.isFinite(committedModifier) && Number.isFinite(resolvedScore)) {
			const derivedResolvedModifier = getAbilityModifierFromScore(resolvedScore);
			if (Number.isFinite(derivedResolvedModifier)) {
				resolvedModifier = Math.trunc(derivedResolvedModifier);
			}
		}

		const playerSheetOriginals = (characterData?.playerSheetOriginals && typeof characterData.playerSheetOriginals === 'object')
			? characterData.playerSheetOriginals
			: null;
		const baselineScoreRaw = extractAbilityScore(baselineStrengthEntry);
		const baselineScore = normalizeStrengthScore(baselineScoreRaw);
		const baselineModifierRaw = extractAbilityModifier(baselineStrengthEntry);
		const baselineModifierFromScore = getAbilityModifierFromScore(baselineScore);
		const baselineModifier = Number.isFinite(baselineModifierRaw)
			? Math.trunc(baselineModifierRaw)
			: (Number.isFinite(baselineModifierFromScore) ? Math.trunc(baselineModifierFromScore) : null);
		const originalRaw = extractFirstFiniteNumber([
			playerSheetOriginals?.strengthModifier,
			strengthEntry?.modifierOriginal,
			baselineModifier
		]);
		const originalScoreRaw = extractFirstFiniteNumber([
			playerSheetOriginals?.strengthScore,
			strengthEntry?.scoreOriginal,
			baselineScore
		]);
		let originalScore = normalizeStrengthScore(originalScoreRaw);
		const originalModifierFromScore = getAbilityModifierFromScore(originalScore);
		let originalModifier = Number.isFinite(originalRaw)
			? Math.trunc(originalRaw)
			: (Number.isFinite(originalModifierFromScore) ? originalModifierFromScore : null);

		if (!Number.isFinite(originalModifier) && characterData && typeof characterData === 'object') {
			const bootstrapOriginalModifier = extractFirstFiniteNumber([
				baselineModifier,
				(Number.isFinite(baselineScore) ? getAbilityModifierFromScore(baselineScore) : null),
				strengthEntry?.modifierOriginal
			]);
			if (Number.isFinite(bootstrapOriginalModifier)) {
			if (!characterData.playerSheetOriginals || typeof characterData.playerSheetOriginals !== 'object') {
				characterData.playerSheetOriginals = {};
			}
			characterData.playerSheetOriginals.strengthModifier = Math.trunc(bootstrapOriginalModifier);
			originalModifier = Math.trunc(bootstrapOriginalModifier);
			}
		}
		if (!Number.isFinite(originalScore) && characterData && typeof characterData === 'object') {
			const bootstrapOriginalScore = extractFirstFiniteNumber([
				baselineScore,
				strengthEntry?.scoreOriginal
			]);
			const normalizedBootstrapOriginalScore = normalizeStrengthScore(bootstrapOriginalScore);
			if (Number.isFinite(normalizedBootstrapOriginalScore)) {
			if (!characterData.playerSheetOriginals || typeof characterData.playerSheetOriginals !== 'object') {
				characterData.playerSheetOriginals = {};
			}
			characterData.playerSheetOriginals.strengthScore = normalizedBootstrapOriginalScore;
			originalScore = normalizedBootstrapOriginalScore;
			}
		}

		if (!Number.isFinite(resolvedScore)) {
			resolvedScore = extractFirstFiniteNumber([
				originalScore,
				baselineScore,
				PLAYER_INFO_STR_SCORE_MIN + 9
			]);
			resolvedScore = normalizeStrengthScore(resolvedScore);
		}

		if (!Number.isFinite(committedModifier) && Number.isFinite(resolvedScore)) {
			const derivedResolvedModifier = getAbilityModifierFromScore(resolvedScore);
			if (Number.isFinite(derivedResolvedModifier)) {
				resolvedModifier = Math.trunc(derivedResolvedModifier);
			}
		}

		// Migration guard: if original modifier was previously derived from score
		// but an explicit imported modifier exists, trust the explicit baseline.
		if (
			Number.isFinite(sourceModifierExplicit)
			&& Number.isFinite(originalScore)
			&& Number.isFinite(originalModifier)
		) {
			const derivedFromOriginalScore = getAbilityModifierFromScore(originalScore);
			if (
				Number.isFinite(derivedFromOriginalScore)
				&& Math.trunc(originalModifier) === Math.trunc(derivedFromOriginalScore)
				&& Math.trunc(sourceModifierExplicit) !== Math.trunc(originalModifier)
			) {
				originalModifier = Math.trunc(sourceModifierExplicit);
				if (characterData && typeof characterData === 'object') {
					if (!characterData.playerSheetOriginals || typeof characterData.playerSheetOriginals !== 'object') {
						characterData.playerSheetOriginals = {};
					}
					characterData.playerSheetOriginals.strengthModifier = Math.trunc(sourceModifierExplicit);
				}
			}
		}

		const hasPersistentDirtyModifier = Number.isFinite(originalModifier)
			&& Number.isFinite(committedModifier)
			&& committedModifier !== originalModifier;
		const hasPersistentDirtyScore = Number.isFinite(originalScore)
			&& Number.isFinite(committedScore)
			&& committedScore !== originalScore;
		const hasRuntimeDirtyModifier = Number.isFinite(originalModifier)
			&& Number.isFinite(resolvedModifier)
			&& Math.trunc(resolvedModifier) !== Math.trunc(originalModifier);
		const hasRuntimeDirtyScore = Number.isFinite(originalScore)
			&& Number.isFinite(resolvedScore)
			&& Math.trunc(resolvedScore) !== Math.trunc(originalScore);
		const hasPersistentDirty = hasPersistentDirtyModifier || hasPersistentDirtyScore;
		const hasAnyDirty = hasPersistentDirty || hasRuntimeDirtyModifier || hasRuntimeDirtyScore;

		logStrDebug('resolveStrengthModifierProfile', {
			characterName: characterData?.character?.name || '',
			sourceScore,
			sourceModifier,
			sourceModifierExplicit,
			committedScore,
			committedModifier,
			resolvedScore,
			resolvedModifier,
			originalScore,
			originalModifier,
			hasPersistentDirty,
			hasPersistentDirtyModifier,
			hasPersistentDirtyScore,
			hasRuntimeDirtyModifier,
			hasRuntimeDirtyScore,
			hasAnyDirty,
			didCanonicalizeCommittedModifier
		});

		return {
			resolvedModifier,
			resolvedScore,
			committedModifier,
			committedScore,
			didCanonicalizeCommittedModifier,
			originalModifier,
			originalScore,
			hasPersistentDirty,
			hasPersistentDirtyModifier,
			hasPersistentDirtyScore,
			hasRuntimeDirtyModifier,
			hasRuntimeDirtyScore,
			hasAnyDirty,
			display: Number.isFinite(resolvedModifier) ? formatSignedModifier(resolvedModifier) : '---',
			displayScore: Number.isFinite(resolvedScore) ? String(resolvedScore) : '---'
		};
	}

	function resolveDexterityModifierProfile(characterData) {
		const abilityMap = extractAbilityMap(characterData) || {};
		const dexterityEntry = abilityMap.dexterity ?? abilityMap.DEX ?? null;
		const baselineAbilityMap = (
			characterData?.abilityScores
			&& typeof characterData.abilityScores === 'object'
			&& !Array.isArray(characterData.abilityScores)
		)
			? characterData.abilityScores
			: (characterData?.character?.abilityScores
				&& typeof characterData.character.abilityScores === 'object'
				&& !Array.isArray(characterData.character.abilityScores)
				? characterData.character.abilityScores
				: null);
		const baselineDexterityEntry = baselineAbilityMap
			? (baselineAbilityMap.dexterity ?? baselineAbilityMap.DEX ?? null)
			: null;
		const sourceScoreRaw = extractAbilityScore(dexterityEntry);
		const sourceScore = normalizeDexterityScore(sourceScoreRaw);
		const sourceModifier = extractAbilityModifier(dexterityEntry);
		const sourceModifierExplicitRaw = (dexterityEntry && typeof dexterityEntry === 'object')
			? extractFirstFiniteNumber([
				dexterityEntry.modifier,
				dexterityEntry.mod,
				dexterityEntry.modBonus,
				dexterityEntry.modifierBonus
			])
			: null;
		const sourceModifierExplicit = Number.isFinite(sourceModifierExplicitRaw)
			? Math.trunc(sourceModifierExplicitRaw)
			: null;
		const committedRaw = extractFirstFiniteNumber([
			characterData?.playerSheetOverrides?.dexterityModifier
		]);
		const committedScoreRaw = extractFirstFiniteNumber([
			characterData?.playerSheetOverrides?.dexterityScore
		]);
		let committedModifier = Number.isFinite(committedRaw) ? Math.trunc(committedRaw) : null;
		const committedScore = normalizeDexterityScore(committedScoreRaw);
		let resolvedScore = Number.isFinite(committedScore)
			? committedScore
			: (Number.isFinite(sourceScore) ? Math.trunc(sourceScore) : null);
		const committedModifierFromScore = getAbilityModifierFromScore(committedScore);
		let didCanonicalizeCommittedModifier = false;
		if (Number.isFinite(committedScore) && Number.isFinite(committedModifierFromScore)) {
			if (!Number.isFinite(committedModifier)) {
				committedModifier = Math.trunc(committedModifierFromScore);
				didCanonicalizeCommittedModifier = true;
				if (characterData && typeof characterData === 'object') {
					if (!characterData.playerSheetOverrides || typeof characterData.playerSheetOverrides !== 'object') {
						characterData.playerSheetOverrides = {};
					}
					characterData.playerSheetOverrides.dexterityModifier = Math.trunc(committedModifierFromScore);
				}
				if (dexterityEntry && typeof dexterityEntry === 'object') {
					dexterityEntry.modifierCommitted = Math.trunc(committedModifierFromScore);
					dexterityEntry.modifier = Math.trunc(committedModifierFromScore);
					delete dexterityEntry.modifierOverride;
				}
			}
		}
		const sourceModifierFromScore = getAbilityModifierFromScore(sourceScore);
		let resolvedModifier = Number.isFinite(committedModifier)
			? committedModifier
			: (Number.isFinite(committedModifierFromScore)
				? committedModifierFromScore
				: (Number.isFinite(sourceModifierFromScore)
					? sourceModifierFromScore
					: (Number.isFinite(sourceModifier) ? Math.trunc(sourceModifier) : null)));

		if (!Number.isFinite(committedModifier) && Number.isFinite(resolvedScore)) {
			const derivedResolvedModifier = getAbilityModifierFromScore(resolvedScore);
			if (Number.isFinite(derivedResolvedModifier)) {
				resolvedModifier = Math.trunc(derivedResolvedModifier);
			}
		}

		const playerSheetOriginals = (characterData?.playerSheetOriginals && typeof characterData.playerSheetOriginals === 'object')
			? characterData.playerSheetOriginals
			: null;
		const baselineScoreRaw = extractAbilityScore(baselineDexterityEntry);
		const baselineScore = normalizeDexterityScore(baselineScoreRaw);
		const baselineModifierRaw = extractAbilityModifier(baselineDexterityEntry);
		const baselineModifierFromScore = getAbilityModifierFromScore(baselineScore);
		const baselineModifier = Number.isFinite(baselineModifierRaw)
			? Math.trunc(baselineModifierRaw)
			: (Number.isFinite(baselineModifierFromScore) ? Math.trunc(baselineModifierFromScore) : null);
		const originalRaw = extractFirstFiniteNumber([
			playerSheetOriginals?.dexterityModifier,
			dexterityEntry?.modifierOriginal,
			baselineModifier
		]);
		const originalScoreRaw = extractFirstFiniteNumber([
			playerSheetOriginals?.dexterityScore,
			dexterityEntry?.scoreOriginal,
			baselineScore
		]);
		let originalScore = normalizeDexterityScore(originalScoreRaw);
		const originalModifierFromScore = getAbilityModifierFromScore(originalScore);
		let originalModifier = Number.isFinite(originalRaw)
			? Math.trunc(originalRaw)
			: (Number.isFinite(originalModifierFromScore) ? originalModifierFromScore : null);

		if (!Number.isFinite(originalModifier) && characterData && typeof characterData === 'object') {
			const bootstrapOriginalModifier = extractFirstFiniteNumber([
				baselineModifier,
				(Number.isFinite(baselineScore) ? getAbilityModifierFromScore(baselineScore) : null),
				dexterityEntry?.modifierOriginal
			]);
			if (Number.isFinite(bootstrapOriginalModifier)) {
				if (!characterData.playerSheetOriginals || typeof characterData.playerSheetOriginals !== 'object') {
					characterData.playerSheetOriginals = {};
				}
				characterData.playerSheetOriginals.dexterityModifier = Math.trunc(bootstrapOriginalModifier);
				originalModifier = Math.trunc(bootstrapOriginalModifier);
			}
		}
		if (!Number.isFinite(originalScore) && characterData && typeof characterData === 'object') {
			const bootstrapOriginalScore = extractFirstFiniteNumber([
				baselineScore,
				dexterityEntry?.scoreOriginal
			]);
			const normalizedBootstrapOriginalScore = normalizeDexterityScore(bootstrapOriginalScore);
			if (Number.isFinite(normalizedBootstrapOriginalScore)) {
				if (!characterData.playerSheetOriginals || typeof characterData.playerSheetOriginals !== 'object') {
					characterData.playerSheetOriginals = {};
				}
				characterData.playerSheetOriginals.dexterityScore = normalizedBootstrapOriginalScore;
				originalScore = normalizedBootstrapOriginalScore;
			}
		}

		if (!Number.isFinite(resolvedScore)) {
			resolvedScore = extractFirstFiniteNumber([
				originalScore,
				baselineScore,
				PLAYER_INFO_DEX_SCORE_MIN + 9
			]);
			resolvedScore = normalizeDexterityScore(resolvedScore);
		}

		if (!Number.isFinite(committedModifier) && Number.isFinite(resolvedScore)) {
			const derivedResolvedModifier = getAbilityModifierFromScore(resolvedScore);
			if (Number.isFinite(derivedResolvedModifier)) {
				resolvedModifier = Math.trunc(derivedResolvedModifier);
			}
		}

		if (
			Number.isFinite(sourceModifierExplicit)
			&& Number.isFinite(originalScore)
			&& Number.isFinite(originalModifier)
		) {
			const derivedFromOriginalScore = getAbilityModifierFromScore(originalScore);
			if (
				Number.isFinite(derivedFromOriginalScore)
				&& Math.trunc(originalModifier) === Math.trunc(derivedFromOriginalScore)
				&& Math.trunc(sourceModifierExplicit) !== Math.trunc(originalModifier)
			) {
				originalModifier = Math.trunc(sourceModifierExplicit);
				if (characterData && typeof characterData === 'object') {
					if (!characterData.playerSheetOriginals || typeof characterData.playerSheetOriginals !== 'object') {
						characterData.playerSheetOriginals = {};
					}
					characterData.playerSheetOriginals.dexterityModifier = Math.trunc(sourceModifierExplicit);
				}
			}
		}

		const hasPersistentDirtyModifier = Number.isFinite(originalModifier)
			&& Number.isFinite(committedModifier)
			&& committedModifier !== originalModifier;
		const hasPersistentDirtyScore = Number.isFinite(originalScore)
			&& Number.isFinite(committedScore)
			&& committedScore !== originalScore;
		const hasRuntimeDirtyModifier = Number.isFinite(originalModifier)
			&& Number.isFinite(resolvedModifier)
			&& Math.trunc(resolvedModifier) !== Math.trunc(originalModifier);
		const hasRuntimeDirtyScore = Number.isFinite(originalScore)
			&& Number.isFinite(resolvedScore)
			&& Math.trunc(resolvedScore) !== Math.trunc(originalScore);
		const hasPersistentDirty = hasPersistentDirtyModifier || hasPersistentDirtyScore;
		const hasAnyDirty = hasPersistentDirty || hasRuntimeDirtyModifier || hasRuntimeDirtyScore;

		logStrDebug('resolveDexterityModifierProfile', {
			characterName: characterData?.character?.name || '',
			sourceScore,
			sourceModifier,
			sourceModifierExplicit,
			committedScore,
			committedModifier,
			resolvedScore,
			resolvedModifier,
			originalScore,
			originalModifier,
			hasPersistentDirty,
			hasPersistentDirtyModifier,
			hasPersistentDirtyScore,
			hasRuntimeDirtyModifier,
			hasRuntimeDirtyScore,
			hasAnyDirty,
			didCanonicalizeCommittedModifier
		});

		return {
			resolvedModifier,
			resolvedScore,
			committedModifier,
			committedScore,
			didCanonicalizeCommittedModifier,
			originalModifier,
			originalScore,
			hasPersistentDirty,
			hasPersistentDirtyModifier,
			hasPersistentDirtyScore,
			hasRuntimeDirtyModifier,
			hasRuntimeDirtyScore,
			hasAnyDirty,
			display: Number.isFinite(resolvedModifier) ? formatSignedModifier(resolvedModifier) : '---',
			displayScore: Number.isFinite(resolvedScore) ? String(resolvedScore) : '---'
		};
	}

	function resolveStandardAbilityModifierProfile(characterData, abilityKey) {
		const abilityMap = extractAbilityMap(characterData) || {};
		const shortKey = getAbilityShortKey(abilityKey).toUpperCase();
		const abilityEntry = abilityMap[abilityKey] ?? abilityMap[shortKey] ?? null;
		const baselineAbilityMap = (
			characterData?.abilityScores
			&& typeof characterData.abilityScores === 'object'
			&& !Array.isArray(characterData.abilityScores)
		)
			? characterData.abilityScores
			: (characterData?.character?.abilityScores
				&& typeof characterData.character.abilityScores === 'object'
				&& !Array.isArray(characterData.character.abilityScores)
				? characterData.character.abilityScores
				: null);
		const baselineAbilityEntry = baselineAbilityMap
			? (baselineAbilityMap[abilityKey] ?? baselineAbilityMap[shortKey] ?? null)
			: null;
		const sourceScoreRaw = extractAbilityScore(abilityEntry);
		const sourceScore = normalizeStandardAbilityScore(sourceScoreRaw);
		const sourceModifier = extractAbilityModifier(abilityEntry);
		const sourceModifierExplicitRaw = (abilityEntry && typeof abilityEntry === 'object')
			? extractFirstFiniteNumber([
				abilityEntry.modifier,
				abilityEntry.mod,
				abilityEntry.modBonus,
				abilityEntry.modifierBonus
			])
			: null;
		const sourceModifierExplicit = Number.isFinite(sourceModifierExplicitRaw)
			? Math.trunc(sourceModifierExplicitRaw)
			: null;

		const modifierField = getAbilityOverrideFieldName(abilityKey, 'Modifier');
		const scoreField = getAbilityOverrideFieldName(abilityKey, 'Score');

		const committedRaw = extractFirstFiniteNumber([
			characterData?.playerSheetOverrides?.[modifierField]
		]);
		const committedScoreRaw = extractFirstFiniteNumber([
			characterData?.playerSheetOverrides?.[scoreField]
		]);
		let committedModifier = Number.isFinite(committedRaw) ? Math.trunc(committedRaw) : null;
		const committedScore = normalizeStandardAbilityScore(committedScoreRaw);
		let resolvedScore = Number.isFinite(committedScore)
			? committedScore
			: (Number.isFinite(sourceScore) ? Math.trunc(sourceScore) : null);
		const committedModifierFromScore = getAbilityModifierFromScore(committedScore);
		let didCanonicalizeCommittedModifier = false;

		if (Number.isFinite(committedScore) && Number.isFinite(committedModifierFromScore)) {
			if (!Number.isFinite(committedModifier)) {
				committedModifier = Math.trunc(committedModifierFromScore);
				didCanonicalizeCommittedModifier = true;
				if (characterData && typeof characterData === 'object') {
					if (!characterData.playerSheetOverrides || typeof characterData.playerSheetOverrides !== 'object') {
						characterData.playerSheetOverrides = {};
					}
					characterData.playerSheetOverrides[modifierField] = Math.trunc(committedModifierFromScore);
				}
				if (abilityEntry && typeof abilityEntry === 'object') {
					abilityEntry.modifierCommitted = Math.trunc(committedModifierFromScore);
					abilityEntry.modifier = Math.trunc(committedModifierFromScore);
					delete abilityEntry.modifierOverride;
				}
			}
		}

		const sourceModifierFromScore = getAbilityModifierFromScore(sourceScore);
		let resolvedModifier = Number.isFinite(committedModifier)
			? committedModifier
			: (Number.isFinite(committedModifierFromScore)
				? committedModifierFromScore
				: (Number.isFinite(sourceModifierFromScore)
					? sourceModifierFromScore
					: (Number.isFinite(sourceModifier) ? Math.trunc(sourceModifier) : null)));

		if (!Number.isFinite(committedModifier) && Number.isFinite(resolvedScore)) {
			const derivedResolvedModifier = getAbilityModifierFromScore(resolvedScore);
			if (Number.isFinite(derivedResolvedModifier)) {
				resolvedModifier = Math.trunc(derivedResolvedModifier);
			}
		}

		const playerSheetOriginals = (characterData?.playerSheetOriginals && typeof characterData.playerSheetOriginals === 'object')
			? characterData.playerSheetOriginals
			: null;
		const baselineScoreRaw = extractAbilityScore(baselineAbilityEntry);
		const baselineScore = normalizeStandardAbilityScore(baselineScoreRaw);
		const baselineModifierRaw = extractAbilityModifier(baselineAbilityEntry);
		const baselineModifierFromScore = getAbilityModifierFromScore(baselineScore);
		const baselineModifier = Number.isFinite(baselineModifierRaw)
			? Math.trunc(baselineModifierRaw)
			: (Number.isFinite(baselineModifierFromScore) ? Math.trunc(baselineModifierFromScore) : null);

		const originalRaw = extractFirstFiniteNumber([
			playerSheetOriginals?.[modifierField],
			abilityEntry?.modifierOriginal,
			baselineModifier
		]);
		const originalScoreRaw = extractFirstFiniteNumber([
			playerSheetOriginals?.[scoreField],
			abilityEntry?.scoreOriginal,
			baselineScore
		]);
		let originalScore = normalizeStandardAbilityScore(originalScoreRaw);
		const originalModifierFromScore = getAbilityModifierFromScore(originalScore);
		let originalModifier = Number.isFinite(originalRaw)
			? Math.trunc(originalRaw)
			: (Number.isFinite(originalModifierFromScore) ? originalModifierFromScore : null);

		if (!Number.isFinite(originalModifier) && characterData && typeof characterData === 'object') {
			const bootstrapOriginalModifier = extractFirstFiniteNumber([
				baselineModifier,
				(Number.isFinite(baselineScore) ? getAbilityModifierFromScore(baselineScore) : null),
				abilityEntry?.modifierOriginal
			]);
			if (Number.isFinite(bootstrapOriginalModifier)) {
				if (!characterData.playerSheetOriginals || typeof characterData.playerSheetOriginals !== 'object') {
					characterData.playerSheetOriginals = {};
				}
				characterData.playerSheetOriginals[modifierField] = Math.trunc(bootstrapOriginalModifier);
				originalModifier = Math.trunc(bootstrapOriginalModifier);
			}
		}

		if (!Number.isFinite(originalScore) && characterData && typeof characterData === 'object') {
			const bootstrapOriginalScore = extractFirstFiniteNumber([
				baselineScore,
				abilityEntry?.scoreOriginal
			]);
			const normalizedBootstrapOriginalScore = normalizeStandardAbilityScore(bootstrapOriginalScore);
			if (Number.isFinite(normalizedBootstrapOriginalScore)) {
				if (!characterData.playerSheetOriginals || typeof characterData.playerSheetOriginals !== 'object') {
					characterData.playerSheetOriginals = {};
				}
				characterData.playerSheetOriginals[scoreField] = normalizedBootstrapOriginalScore;
				originalScore = normalizedBootstrapOriginalScore;
			}
		}

		if (!Number.isFinite(resolvedScore)) {
			resolvedScore = extractFirstFiniteNumber([
				originalScore,
				baselineScore,
				PLAYER_INFO_STD_ABILITY_SCORE_MIN + 9
			]);
			resolvedScore = normalizeStandardAbilityScore(resolvedScore);
		}

		if (!Number.isFinite(committedModifier) && Number.isFinite(resolvedScore)) {
			const derivedResolvedModifier = getAbilityModifierFromScore(resolvedScore);
			if (Number.isFinite(derivedResolvedModifier)) {
				resolvedModifier = Math.trunc(derivedResolvedModifier);
			}
		}

		if (
			Number.isFinite(sourceModifierExplicit)
			&& Number.isFinite(originalScore)
			&& Number.isFinite(originalModifier)
		) {
			const derivedFromOriginalScore = getAbilityModifierFromScore(originalScore);
			if (
				Number.isFinite(derivedFromOriginalScore)
				&& Math.trunc(originalModifier) === Math.trunc(derivedFromOriginalScore)
				&& Math.trunc(sourceModifierExplicit) !== Math.trunc(originalModifier)
			) {
				originalModifier = Math.trunc(sourceModifierExplicit);
				if (characterData && typeof characterData === 'object') {
					if (!characterData.playerSheetOriginals || typeof characterData.playerSheetOriginals !== 'object') {
						characterData.playerSheetOriginals = {};
					}
					characterData.playerSheetOriginals[modifierField] = Math.trunc(sourceModifierExplicit);
				}
			}
		}

		const hasPersistentDirtyModifier = Number.isFinite(originalModifier)
			&& Number.isFinite(committedModifier)
			&& committedModifier !== originalModifier;
		const hasPersistentDirtyScore = Number.isFinite(originalScore)
			&& Number.isFinite(committedScore)
			&& committedScore !== originalScore;
		const hasRuntimeDirtyModifier = Number.isFinite(originalModifier)
			&& Number.isFinite(resolvedModifier)
			&& Math.trunc(resolvedModifier) !== Math.trunc(originalModifier);
		const hasRuntimeDirtyScore = Number.isFinite(originalScore)
			&& Number.isFinite(resolvedScore)
			&& Math.trunc(resolvedScore) !== Math.trunc(originalScore);
		const hasPersistentDirty = hasPersistentDirtyModifier || hasPersistentDirtyScore;
		const hasAnyDirty = hasPersistentDirty || hasRuntimeDirtyModifier || hasRuntimeDirtyScore;

		return {
			abilityKey,
			modifierField,
			scoreField,
			resolvedModifier,
			resolvedScore,
			committedModifier,
			committedScore,
			didCanonicalizeCommittedModifier,
			originalModifier,
			originalScore,
			hasPersistentDirty,
			hasPersistentDirtyModifier,
			hasPersistentDirtyScore,
			hasRuntimeDirtyModifier,
			hasRuntimeDirtyScore,
			hasAnyDirty,
			display: Number.isFinite(resolvedModifier) ? formatSignedModifier(resolvedModifier) : '---',
			displayScore: Number.isFinite(resolvedScore) ? String(resolvedScore) : '---'
		};
	}

	function extractAbilityMap(characterData) {
		const candidates = [
			characterData?.abilities,
			characterData?.abilityScores,
			characterData?.character?.abilities,
			characterData?.character?.abilityScores
		];

		for (const entry of candidates) {
			if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
				return entry;
			}
		}
		return null;
	}

	function syncAbilityMapMirrors(characterData) {
		if (!characterData || typeof characterData !== 'object') return;
		const hasRootAbilities = characterData.abilities && typeof characterData.abilities === 'object' && !Array.isArray(characterData.abilities);
		const hasRootAbilityScores = characterData.abilityScores && typeof characterData.abilityScores === 'object' && !Array.isArray(characterData.abilityScores);
		const hasCharacterObject = characterData.character && typeof characterData.character === 'object' && !Array.isArray(characterData.character);

		if (hasRootAbilities) {
			characterData.abilityScores = JSON.parse(JSON.stringify(characterData.abilities));
			if (hasCharacterObject) {
				characterData.character.abilities = JSON.parse(JSON.stringify(characterData.abilities));
				characterData.character.abilityScores = JSON.parse(JSON.stringify(characterData.abilities));
			}
			return;
		}

		if (hasRootAbilityScores) {
			characterData.abilities = JSON.parse(JSON.stringify(characterData.abilityScores));
			if (hasCharacterObject) {
				characterData.character.abilities = JSON.parse(JSON.stringify(characterData.abilityScores));
				characterData.character.abilityScores = JSON.parse(JSON.stringify(characterData.abilityScores));
			}
		}
	}

	function extractAbilityModifier(abilityEntry) {
		if (abilityEntry === null || abilityEntry === undefined) return null;
		if (typeof abilityEntry === 'number') {
			const importedSafe = clampImportedNumeric(abilityEntry);
			if (!Number.isFinite(importedSafe)) return null;
			const inferredFromScore = Math.floor((importedSafe - 10) / 2);
			return Number.isFinite(inferredFromScore) ? inferredFromScore : abilityEntry;
		}
		if (typeof abilityEntry === 'string' && abilityEntry.trim()) {
			const parsed = clampImportedNumeric(abilityEntry);
			return Number.isFinite(parsed) ? parsed : null;
		}
		if (typeof abilityEntry !== 'object') return null;
		const candidates = [abilityEntry.modifier, abilityEntry.mod, abilityEntry.save, abilityEntry.savingThrow];
		for (const candidate of candidates) {
			const parsed = clampImportedNumeric(candidate);
			if (Number.isFinite(parsed)) return parsed;
		}
		const scoreCandidate = clampImportedNumeric(abilityEntry.score ?? abilityEntry.base ?? abilityEntry.total);
		if (Number.isFinite(scoreCandidate)) {
			return Math.floor((scoreCandidate - 10) / 2);
		}
		return null;
	}

	function extractAbilityScore(abilityEntry) {
		if (abilityEntry === null || abilityEntry === undefined) return null;
		if (typeof abilityEntry === 'number') return clampImportedNumeric(abilityEntry);
		if (typeof abilityEntry === 'string' && abilityEntry.trim()) {
			return clampImportedNumeric(abilityEntry);
		}
		if (typeof abilityEntry !== 'object') return null;
		const candidates = [abilityEntry.score, abilityEntry.value, abilityEntry.base, abilityEntry.total];
		for (const candidate of candidates) {
			const parsed = clampImportedNumeric(candidate);
			if (Number.isFinite(parsed)) return parsed;
		}
		return null;
	}

	function extractHeroicInspiration(characterData) {
		const candidates = [
			characterData?.combat?.heroicInspiration,
			characterData?.combat?.inspiration,
			characterData?.heroicInspiration,
			characterData?.inspiration,
			characterData?.character?.heroicInspiration,
			characterData?.character?.inspiration
		];
		for (const candidate of candidates) {
			if (typeof candidate === 'boolean') return candidate;
			if (typeof candidate === 'number') return candidate > 0;
			if (typeof candidate === 'string') {
				const normalized = candidate.trim().toLowerCase();
				if (!normalized) continue;
				if (['true', 'yes', 'on', '1'].includes(normalized)) return true;
				if (['false', 'no', 'off', '0'].includes(normalized)) return false;
			}
		}
		return false;
	}

	function formatSignedModifier(modifierValue) {
		const importedSafe = clampImportedNumeric(modifierValue);
		if (!Number.isFinite(importedSafe)) return '---';
		const displaySafe = clampDisplayNumeric(importedSafe);
		if (!Number.isFinite(displaySafe)) return '---';
		return `${displaySafe >= 0 ? '+' : ''}${displaySafe}`;
	}

	function mapObjectEntries(rawValue) {
		if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) return [];
		return Object.entries(rawValue)
			.map(([key, value]) => {
				if (value && typeof value === 'object' && !Array.isArray(value)) {
					const nestedValue = value.modifier ?? value.mod ?? value.value ?? value.total ?? value.bonus;
					return [key, nestedValue ?? value];
				}
				return [key, value];
			})
			.filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '');
	}

	function formatListValue(rawValue) {
		if (Array.isArray(rawValue)) {
			const next = rawValue
				.map((item) => sanitizeText(item, ''))
				.filter(Boolean)
				.join(', ');
			return next || '---';
		}
		if (rawValue && typeof rawValue === 'object') {
			const values = Object.values(rawValue)
				.map((item) => sanitizeText(item, ''))
				.filter(Boolean);
			return values.join(', ') || '---';
		}
		return sanitizeText(rawValue);
	}

	function buildKeyValueItem(label, value) {
		return `
			<div class="player-info-keyvalue">
				<span class="player-info-key">${label}</span>
				<span class="player-info-value">${value}</span>
			</div>
		`;
	}

	function buildListItems(entries, formatValueFn = (raw) => sanitizeText(raw)) {
		if (!Array.isArray(entries) || !entries.length) {
			return '<div class="player-info-empty">No data available.</div>';
		}
		return `<div class="player-info-list">${entries.map(([key, value]) => `
			<div class="player-info-list-item">
				<span>${sanitizeText(key)}</span>
				<span>${formatValueFn(value)}</span>
			</div>
		`).join('')}</div>`;
	}

	function buildPlayerInfoMarkup(characterData, activeBufferLabel, heroicInspirationEnabled, proficiencyProfile = null, initiativeProfile = null, strengthProfile = null, dexterityProfile = null, otherAbilityProfiles = null) {
		const characterInfo = characterData?.character || {};
		const combatInfo = characterData?.combat || {};
		const abilityMap = extractAbilityMap(characterData) || {};
		const resolvedProficiencyProfile = proficiencyProfile || resolveProficiencyBonusProfile(characterData);
		const resolvedInitiativeProfile = initiativeProfile || resolveInitiativeProfile(characterData);
		const resolvedStrengthProfile = strengthProfile || resolveStrengthModifierProfile(characterData);
		const resolvedDexterityProfile = dexterityProfile || resolveDexterityModifierProfile(characterData);
		const resolvedOtherAbilityProfiles = otherAbilityProfiles && typeof otherAbilityProfiles === 'object'
			? otherAbilityProfiles
			: Object.fromEntries(PLAYER_INFO_OTHER_ABILITY_KEYS.map((abilityKey) => [abilityKey, resolveStandardAbilityModifierProfile(characterData, abilityKey)]));

		const name = sanitizeText(characterInfo.name || activeBufferLabel || 'Unknown Character');
		const className = sanitizeText(characterInfo.class || characterInfo.className || characterInfo.characterClass);
		const level = sanitizeNumeric(
			characterInfo.level
			|| characterInfo.characterLevel
			|| combatInfo.level
			|| resolvedProficiencyProfile.level
		);
		const race = sanitizeText(characterInfo.race || characterInfo.species || characterInfo.ancestry);
		const background = sanitizeText(characterInfo.background);
		const alignment = sanitizeText(characterInfo.alignment);

		const armorClass = sanitizeNumeric(combatInfo.armorClass ?? combatInfo.ac);
		const initiative = sanitizeNumeric(combatInfo.initiative ?? combatInfo.init);
		const speed = sanitizeText(combatInfo.speed ?? combatInfo.movement);
		const proficiencyBonusText = resolvedProficiencyProfile.display;
		const profNodeClasses = [
			'player-info-vital-node',
			'player-info-prof-node',
			resolvedProficiencyProfile.hasPersistentDirty ? 'dirty-persist' : '',
			resolvedProficiencyProfile.hasManualOverride ? 'modified' : ''
		].filter(Boolean).join(' ');
		const initNodeClasses = [
			'player-info-vital-node',
			'player-info-init-node',
			resolvedInitiativeProfile.hasPersistentDirty ? 'dirty-persist' : '',
			resolvedInitiativeProfile.hasManualOverride ? 'modified' : ''
		].filter(Boolean).join(' ');
		const initiativeDisplayText = resolvedInitiativeProfile.display || initiative;
		const hpCurrent = sanitizeNumeric(combatInfo?.hitPoints?.current ?? combatInfo.currentHp, '');
		const hpMax = sanitizeNumeric(combatInfo?.hitPoints?.max ?? combatInfo.maxHp, '');
		const hp = hpCurrent && hpMax ? `${hpCurrent}/${hpMax}` : (hpCurrent || hpMax || '---');

		const abilityOrder = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
		const abilityEntries = abilityOrder.map((abilityKey) => {
			const rawAbility = abilityMap[abilityKey] ?? abilityMap[abilityKey.slice(0, 3).toUpperCase()];
			const modifier = extractAbilityModifier(rawAbility);
			const score = extractAbilityScore(rawAbility);
			const isStrength = abilityKey === 'strength';
			const isDexterity = abilityKey === 'dexterity';
			const isOtherInteractiveAbility = PLAYER_INFO_OTHER_ABILITY_KEYS.includes(abilityKey);
			const resolvedOtherProfile = isOtherInteractiveAbility ? resolvedOtherAbilityProfiles?.[abilityKey] : null;
			const displayModifier = isStrength
				? resolvedStrengthProfile.display
				: (isDexterity
					? resolvedDexterityProfile.display
					: (resolvedOtherProfile?.display || formatSignedModifier(modifier)));
			const displayScore = isStrength
				? resolvedStrengthProfile.displayScore
				: (isDexterity
					? resolvedDexterityProfile.displayScore
					: (resolvedOtherProfile?.displayScore || sanitizeNumeric(score)));
			const abilityNodeClasses = isStrength
				? [
					'player-info-ability-node',
					'player-info-str-node',
					resolvedStrengthProfile.hasPersistentDirty ? 'dirty-persist' : '',
					resolvedStrengthProfile.hasManualOverride ? 'modified' : ''
				].filter(Boolean).join(' ')
				: (isDexterity
					? [
						'player-info-ability-node',
						'player-info-dex-node',
						resolvedDexterityProfile.hasPersistentDirty ? 'dirty-persist' : '',
						resolvedDexterityProfile.hasManualOverride ? 'modified' : ''
					].filter(Boolean).join(' ')
					: (isOtherInteractiveAbility
						? [
							'player-info-ability-node',
							'player-info-dex-node',
							`player-info-${getAbilityShortKey(abilityKey)}-node`,
							resolvedOtherProfile?.hasPersistentDirty ? 'dirty-persist' : '',
							resolvedOtherProfile?.hasManualOverride ? 'modified' : ''
						].filter(Boolean).join(' ')
						: 'player-info-ability-node'));
			return {
				label: abilityKey.slice(0, 3).toUpperCase(),
				modifier: displayModifier,
				score: displayScore,
				nodeClassName: abilityNodeClasses,
				ovalClassName: (isStrength && resolvedStrengthProfile.hasPersistentDirty)
					|| (isDexterity && resolvedDexterityProfile.hasPersistentDirty)
					|| (isOtherInteractiveAbility && !!resolvedOtherProfile?.hasPersistentDirty)
					? 'player-info-ability-oval dirty-persist'
					: 'player-info-ability-oval',
				isStrength,
				isDexterity,
				isOtherInteractiveAbility,
				abilityKey
			};
		});

		const saves = mapObjectEntries(combatInfo.savingThrows || characterData?.savingThrows || characterData?.saves);
		const skills = mapObjectEntries(characterData?.skills || combatInfo.skills || characterInfo.skills);

		const sensesRaw = characterData?.senses || combatInfo.senses || characterInfo.senses;
		const proficienciesRaw = characterData?.proficiencies || characterData?.proficiency || characterInfo.proficiencies;
		const languagesRaw = characterData?.languages || characterInfo.languages;
		const traitsRaw = characterData?.features?.traits || characterData?.traits || characterData?.features;

		const profAndLang = [
			['Proficiencies', formatListValue(proficienciesRaw)],
			['Languages', formatListValue(languagesRaw)]
		];

		const sensesEntries = Array.isArray(sensesRaw)
			? sensesRaw.map((entry, idx) => [`Sense ${idx + 1}`, entry])
			: mapObjectEntries(sensesRaw);

		const featureEntries = Array.isArray(traitsRaw)
			? traitsRaw.map((entry, idx) => {
				if (entry && typeof entry === 'object') {
					return [entry.name || `Trait ${idx + 1}`, entry.description || entry.desc || entry.text || ''];
				}
				return [`Trait ${idx + 1}`, entry];
			})
			: mapObjectEntries(traitsRaw);

		return `
			<section class="player-info-hero-card">
				<div class="player-info-identity-row">
					<div class="player-info-identity-main">${name}</div>
					<div class="player-info-identity-sub">${className}  |  Level ${level}  |  ${race}</div>
					<div class="player-info-identity-sub">${background}  |  ${alignment}</div>
				</div>

				<div class="player-info-quick-abilities">
					<div class="player-info-ability-strip">
						${abilityEntries.map(({ label, modifier, score, nodeClassName, ovalClassName, isStrength, isDexterity, isOtherInteractiveAbility, abilityKey }) => `
							<div
								class="${nodeClassName}"
								${isStrength ? 'role="spinbutton" aria-label="Strength modifier" tabindex="0" data-player-info-str-adjust="true"' : ''}
								${isDexterity ? 'role="spinbutton" aria-label="Dexterity modifier" tabindex="0" data-player-info-dex-adjust="true"' : ''}
								${isOtherInteractiveAbility ? `role="spinbutton" aria-label="${label} modifier" tabindex="0" data-player-info-other-adjust="true" data-player-info-ability-key="${abilityKey}"` : ''}
								${isStrength && Number.isFinite(resolvedStrengthProfile.resolvedModifier) ? `aria-valuenow="${String(resolvedStrengthProfile.resolvedModifier)}"` : ''}
								${isDexterity && Number.isFinite(resolvedDexterityProfile.resolvedModifier) ? `aria-valuenow="${String(resolvedDexterityProfile.resolvedModifier)}"` : ''}
								${isOtherInteractiveAbility && Number.isFinite(resolvedOtherAbilityProfiles?.[abilityKey]?.resolvedModifier) ? `aria-valuenow="${String(resolvedOtherAbilityProfiles[abilityKey].resolvedModifier)}"` : ''}
							>
								<span class="player-info-ability-frame" aria-hidden="true"></span>
								<span class="${ovalClassName}" aria-hidden="true"></span>
								<span class="player-info-ability-label">${label}</span>
								<span class="player-info-ability-value">${modifier}</span>
								<span class="player-info-ability-score" ${isStrength ? 'data-player-info-str-score="true"' : ''} ${isDexterity ? 'data-player-info-dex-score="true"' : ''} ${isOtherInteractiveAbility ? `data-player-info-other-score="true" data-player-info-ability-key="${abilityKey}"` : ''}>${score}</span>
							</div>
						`).join('')}
					</div>
					<div class="player-info-quick-metrics">
						<div
							class="${profNodeClasses}"
							aria-label="Proficiency bonus"
							role="button"
							tabindex="0"
							data-player-info-prof-adjust="true"
							aria-valuenow="${Number.isFinite(resolvedProficiencyProfile.resolvedBonus) ? String(resolvedProficiencyProfile.resolvedBonus) : ''}"
						>
							<span>Prof</span>
							<strong>${proficiencyBonusText}</strong>
						</div>
						<div class="player-info-vital-node player-info-speed-node" aria-label="Speed">
							<span>Speed</span>
							<strong>${speed}</strong>
						</div>
						<div
							class="player-info-vital-node player-info-inspiration-node"
							role="button"
							tabindex="0"
							data-heroic-inspiration-toggle="true"
							aria-pressed="${heroicInspirationEnabled ? 'true' : 'false'}"
							aria-label="Heroic inspiration toggle"
						>
							<span class="player-info-inspiration-label-top">Heroic</span>
							<span class="player-info-inspiration-box ${heroicInspirationEnabled ? 'checked' : ''}" aria-hidden="true"></span>
							<span class="player-info-inspiration-label-bottom">Inspiration</span>
						</div>
						<div class="player-info-vital-node" aria-label="Armor class">
							<span>AC</span>
							<strong>${armorClass}</strong>
						</div>
					</div>
				</div>

				<div class="player-info-vitals-row">
					<div
						class="${initNodeClasses}"
						aria-label="Initiative"
						role="button"
						tabindex="0"
						data-player-info-init-adjust="true"
						aria-valuenow="${Number.isFinite(resolvedInitiativeProfile.resolvedValue) ? String(resolvedInitiativeProfile.resolvedValue) : ''}"
					>
						<span>Initiative</span>
						<strong>${initiativeDisplayText}</strong>
					</div>
					<div class="player-info-health-node" aria-label="Health node">
						<span class="player-info-health-label">Health</span>
						<span class="player-info-health-value">${hp}</span>
					</div>
				</div>
			</section>

			<section class="player-info-card">
				<div class="player-info-card-title">Active Buffer</div>
				<div class="player-info-buffer-pill">${sanitizeText(activeBufferLabel || name)}</div>
			</section>

			<section class="player-info-card">
				<div class="player-info-card-title">Saving Throws</div>
				${buildListItems(saves, formatSignedModifier)}
			</section>

			<section class="player-info-card">
				<div class="player-info-card-title">Skills</div>
				${buildListItems(skills, formatSignedModifier)}
			</section>

			<section class="player-info-card">
				<div class="player-info-card-title">Senses</div>
				${buildListItems(sensesEntries, formatListValue)}
			</section>

			<section class="player-info-card">
				<div class="player-info-card-title">Proficiencies & Languages</div>
				${buildListItems(profAndLang, formatListValue)}
			</section>

			<section class="player-info-card">
				<div class="player-info-card-title">Features & Traits</div>
				${buildListItems(featureEntries, formatListValue)}
			</section>
		`;
	}

	function initPlayerInfoWindow() {
		const toggleBtn = document.getElementById(PLAYER_INFO_TOGGLE_ID);
		const windowEl = document.getElementById(PLAYER_INFO_WINDOW_ID);
		const closeBtn = document.getElementById('close-player-info-window');
		const modeToggleBtn = document.getElementById(PLAYER_INFO_MODE_TOGGLE_ID);
		const revertBtn = document.getElementById(PLAYER_INFO_REVERT_ID);
		const commitBtn = document.getElementById(PLAYER_INFO_COMMIT_ID);
		const headerEl = windowEl?.querySelector(PLAYER_INFO_HEADER_SELECTOR) || null;
		const contentEl = document.getElementById(PLAYER_INFO_CONTENT_ID);
		const titleEl = document.getElementById(PLAYER_INFO_TITLE_ID);
		const activeBufferLabelEl = document.getElementById(ACTIVE_BUFFER_LABEL_ID);
		const narrowMediaQuery = window.matchMedia(PLAYER_INFO_NARROW_MEDIA_QUERY);

		if (!toggleBtn || !windowEl || !closeBtn || !modeToggleBtn || !contentEl || !headerEl) return;

		let lastRenderedSignature = '';
		let dragPointerId = null;
		let dragStartX = 0;
		let dragStartY = 0;
		let dragStartLeft = 0;
		let dragStartTop = 0;
		let currentMode = 'canvas';
		let isManuallyPositioned = false;
		let isBootstrappingState = true;
		let heroicInspirationEnabled = null;
		let isPlayerSheetEditMode = false;
		let profManualOverrideValue = null;
		let profDefaultValue = null;
		let initManualOverrideValue = null;
		let initDefaultValue = null;
		let strManualOverrideValue = null;
		let strModifierOffsetFromScore = null;
		let strDefaultValue = null;
		let strScoreManualOverrideValue = null;
		let strScoreDefaultValue = null;
		let dexManualOverrideValue = null;
		let dexModifierOffsetFromScore = null;
		let dexDefaultValue = null;
		let dexScoreManualOverrideValue = null;
		let dexScoreDefaultValue = null;
		let profInteractionCharacterKey = '';
		let profAdjustPointerId = null;
		let profAdjustHoldTimer = null;
		let profAdjustArmed = false;
		let profAdjustLastClientY = null;
		let profSuppressNextClick = false;
		let profInlineEditing = false;
		let profInlineInputEl = null;
		let profPressStartClientX = null;
		let profPressStartClientY = null;
		let profPressMoved = false;
		let initAdjustPointerId = null;
		let initAdjustHoldTimer = null;
		let initAdjustArmed = false;
		let initAdjustLastClientY = null;
		let initSuppressNextClick = false;
		let initInlineEditing = false;
		let initInlineInputEl = null;
		let initPressStartClientX = null;
		let initPressStartClientY = null;
		let initPressMoved = false;
		let strAdjustPointerId = null;
		let strAdjustHoldTimer = null;
		let strAdjustArmed = false;
		let strAdjustLastClientY = null;
		let strSuppressNextClick = false;
		let strInlineEditing = false;
		let strInlineInputEl = null;
		let strScoreInlineEditing = false;
		let strScoreInlineInputEl = null;
		let strPressStartClientX = null;
		let strPressStartClientY = null;
		let strPressMoved = false;
		let dexAdjustPointerId = null;
		let dexAdjustHoldTimer = null;
		let dexAdjustArmed = false;
		let dexAdjustLastClientY = null;
		let dexSuppressNextClick = false;
		let dexInlineEditing = false;
		let dexInlineInputEl = null;
		let dexScoreInlineEditing = false;
		let dexScoreInlineInputEl = null;
		let dexPressStartClientX = null;
		let dexPressStartClientY = null;
		let dexPressMoved = false;
		const otherAbilityRuntime = Object.fromEntries(
			PLAYER_INFO_OTHER_ABILITY_KEYS.map((abilityKey) => [abilityKey, {
				manualOverrideValue: null,
				modifierOffsetFromScore: null,
				defaultValue: null,
				scoreManualOverrideValue: null,
				scoreDefaultValue: null,
				inlineEditing: false,
				scoreInlineEditing: false,
				suppressNextClick: false,
				adjustArmed: false
			}])
		);
		let otherAdjustAbilityKey = '';
		let otherAdjustPointerId = null;
		let otherAdjustHoldTimer = null;
		let otherAdjustLastClientY = null;
		let otherPressStartClientX = null;
		let otherPressStartClientY = null;
		let otherPressMoved = false;
		let otherInlineAbilityKey = '';
		let otherInlineInputEl = null;
		let otherScoreInlineAbilityKey = '';
		let otherScoreInlineInputEl = null;

		function buildStrengthTraceSnapshot() {
			const activeCharacterData = getActiveCharacterData();
			const abilityMap = extractAbilityMap(activeCharacterData) || {};
			const strengthEntry = abilityMap.strength ?? abilityMap.STR ?? null;
			const overrides = (activeCharacterData?.playerSheetOverrides && typeof activeCharacterData.playerSheetOverrides === 'object')
				? activeCharacterData.playerSheetOverrides
				: {};
			const originals = (activeCharacterData?.playerSheetOriginals && typeof activeCharacterData.playerSheetOriginals === 'object')
				? activeCharacterData.playerSheetOriginals
				: {};
			const rawStrengthEntry = (strengthEntry && typeof strengthEntry === 'object')
				? {
					score: strengthEntry.score,
					value: strengthEntry.value,
					base: strengthEntry.base,
					total: strengthEntry.total,
					modifier: strengthEntry.modifier,
					mod: strengthEntry.mod,
					modifierCommitted: strengthEntry.modifierCommitted,
					scoreCommitted: strengthEntry.scoreCommitted,
					modifierOverride: strengthEntry.modifierOverride,
					scoreOverride: strengthEntry.scoreOverride,
					modifierOriginal: strengthEntry.modifierOriginal,
					scoreOriginal: strengthEntry.scoreOriginal
				}
				: strengthEntry;

			return {
				characterName: activeCharacterData?.character?.name || '',
				localState: {
					isPlayerSheetEditMode,
					profManualOverrideValue,
					profDefaultValue,
					strManualOverrideValue,
					strModifierOffsetFromScore,
					strDefaultValue,
					strScoreManualOverrideValue,
					strScoreDefaultValue,
					dexManualOverrideValue,
					dexModifierOffsetFromScore,
					dexDefaultValue,
					dexScoreManualOverrideValue,
					dexScoreDefaultValue,
					profAdjustArmed,
					strAdjustArmed,
					dexAdjustArmed,
					profInlineEditing,
					strInlineEditing,
					strScoreInlineEditing,
					dexInlineEditing,
					dexScoreInlineEditing
				},
				overrides: {
					proficiencyBonus: overrides.proficiencyBonus,
					strengthModifier: overrides.strengthModifier,
					strengthScore: overrides.strengthScore,
					dexterityModifier: overrides.dexterityModifier,
					dexterityScore: overrides.dexterityScore
				},
				originals: {
					proficiencyBonus: originals.proficiencyBonus,
					strengthModifier: originals.strengthModifier,
					strengthScore: originals.strengthScore,
					dexterityModifier: originals.dexterityModifier,
					dexterityScore: originals.dexterityScore
				},
				strengthEntry: rawStrengthEntry
			};
		}

		function logStrInteraction(stage, payload = null, event = null) {
			if (!STR_DEBUG_ENABLED) return;
			const eventMeta = event
				? {
					type: event.type,
					pointerType: event.pointerType || null,
					button: Number.isFinite(event.button) ? event.button : null,
					key: event.key || null,
					targetClass: (event.target instanceof Element) ? event.target.className : null
				}
				: null;
			logStrDebug(`interaction:${stage}`, {
				event: eventMeta,
				payload,
				snapshot: buildStrengthTraceSnapshot()
			});
		}

		/*
		PLAYER-SHEET OVERRIDE CONTROL PATTERN (REUSABLE)
		===============================================
		This PROF control is the reference implementation for future player-sheet
		override buttons. To add another override-enabled metric, mirror this flow:

		1) Resolve default value from character data in resolver helpers.
		2) Track manual override value separately in window state.
		3) Add `.modified` when override != default (yellow outline/glow only).
		4) Support input methods:
		   - click/tap inline edit (signed integer sanitize/parse)
		   - long-press arm delay
		   - wheel/drag step while armed
		   - touch tap vs hold/drag separation
		   - double-click reset to default
		5) Dirty-state gating: if any override is non-default, enable COMMIT and
		   apply `.commit-ready` yellow state to the commit button.
		6) On COMMIT:
		   - write new baseline into active character data
		   - persist to `playerSheetOverrides` and active storage reference
		   - re-apply flowchart/runtime so DM/player callers use committed values
		   - clear transient manual override so committed value becomes default

		Layout/shape/size are intentionally decoupled from this pattern; visual
		dimensions can change per-node without changing override mechanics.
		*/

		function getProfAdjustNode() {
			return contentEl.querySelector('[data-player-info-prof-adjust="true"]');
		}

		function getStrAdjustNode() {
			return contentEl.querySelector('[data-player-info-str-adjust="true"]');
		}

		function getInitAdjustNode() {
			return contentEl.querySelector('[data-player-info-init-adjust="true"]');
		}

		function getDexAdjustNode() {
			return contentEl.querySelector('[data-player-info-dex-adjust="true"]');
		}

		function getOtherAbilityAdjustNode(abilityKey) {
			return contentEl.querySelector(`[data-player-info-other-adjust="true"][data-player-info-ability-key="${abilityKey}"]`);
		}

		function getOtherAbilityScoreNode(abilityKey) {
			return contentEl.querySelector(`[data-player-info-other-score="true"][data-player-info-ability-key="${abilityKey}"]`);
		}

		function getOtherAbilityRuntime(abilityKey) {
			const normalizedKey = String(abilityKey || '').toLowerCase().trim();
			if (!normalizedKey) return null;
			return otherAbilityRuntime[normalizedKey] || null;
		}

		function sanitizeProfInputDraft(rawValue) {
			const source = String(rawValue ?? '').replace(/\s+/g, '');
			let sign = '';
			let digits = '';
			for (let index = 0; index < source.length; index++) {
				const token = source[index];
				if ((token === '+' || token === '-') && index === 0 && !sign) {
					sign = token;
					continue;
				}
				if (token >= '0' && token <= '9') {
					digits += token;
				}
			}
			return `${sign}${digits}`;
		}

		function parseProfInputValue(rawValue) {
			const sanitized = sanitizeProfInputDraft(rawValue);
			if (!/^[+-]?\d+$/.test(sanitized)) return null;
			const parsed = Number(sanitized);
			if (!Number.isFinite(parsed)) return null;
			return Math.trunc(parsed);
		}

		function sanitizeScoreInputDraft(rawValue) {
			const source = String(rawValue ?? '').replace(/\s+/g, '');
			let digits = '';
			for (let index = 0; index < source.length; index++) {
				const token = source[index];
				if (token >= '0' && token <= '9') {
					digits += token;
				}
			}
			return digits;
		}

		function parseScoreInputValue(rawValue) {
			const sanitized = sanitizeScoreInputDraft(rawValue);
			if (!/^\d+$/.test(sanitized)) return null;
			const parsed = Number(sanitized);
			if (!Number.isFinite(parsed)) return null;
			return Math.trunc(parsed);
		}

		const playerSheetRollFeedbackTimers = new WeakMap();

		function triggerPlayerSheetRollFeedback(node) {
			if (!(node instanceof HTMLElement)) return;
			node.classList.remove('roll-feedback');
			void node.offsetWidth;
			node.classList.add('roll-feedback');
			const existingTimeoutId = playerSheetRollFeedbackTimers.get(node);
			if (Number.isFinite(existingTimeoutId)) {
				window.clearTimeout(existingTimeoutId);
			}
			const timeoutId = window.setTimeout(() => {
				node.classList.remove('roll-feedback');
				playerSheetRollFeedbackTimers.delete(node);
			}, 220);
			playerSheetRollFeedbackTimers.set(node, timeoutId);
		}

		function triggerPlayerSheetRoll(rollLabel, modifierValue) {
			// Temporarily disabled per request: PROF press should not produce roll popup or log output.
			if (rollLabel === 'PROF Check Roll') {
				return;
			}
			const modifier = Number.isFinite(Number(modifierValue)) ? Math.trunc(Number(modifierValue)) : 0;
			let rollResult = null;
			if (typeof window.rollD20 === 'function') {
				rollResult = window.rollD20(modifier, rollLabel);
			} else {
				const fallbackRoll = Math.floor(Math.random() * 20) + 1;
				const fallbackTotal = fallbackRoll + modifier;
				const rollOverlay = document.getElementById('roll-display-overlay');
				const rollTypeLabel = document.getElementById('roll-type-label');
				const rollTotalVal = document.getElementById('roll-total-val');
				const rollMathVal = document.getElementById('roll-math-val');
				if (rollOverlay && rollTypeLabel && rollTotalVal && rollMathVal) {
					rollTypeLabel.textContent = rollLabel;
					rollTotalVal.textContent = String(fallbackTotal);
					rollMathVal.textContent = `${fallbackRoll} + (${modifier >= 0 ? '+' : ''}${modifier})`;
					rollOverlay.classList.remove('show');
					void rollOverlay.offsetWidth;
					rollOverlay.classList.add('show');
					if (Number.isFinite(window.__playerSheetRollOverlayTimeoutId)) {
						window.clearTimeout(window.__playerSheetRollOverlayTimeoutId);
					}
					window.__playerSheetRollOverlayTimeoutId = window.setTimeout(() => {
						rollOverlay.classList.remove('show');
					}, 3000);
				}
				rollResult = {
					roll: fallbackRoll,
					total: fallbackTotal
				};
			}

			const rolledD20Value = Number.isFinite(Number(rollResult?.roll))
				? Math.trunc(Number(rollResult.roll))
				: (Math.floor(Math.random() * 20) + 1);
			const rolledTotalValue = Number.isFinite(Number(rollResult?.total))
				? Math.trunc(Number(rollResult.total))
				: Math.trunc(rolledD20Value + modifier);

			if (typeof window.addLogEntry === 'function') {
				const signedModifier = modifier >= 0 ? `+${modifier}` : `${modifier}`;
				window.addLogEntry(
					`<b>${rollLabel}:</b> 1d20${signedModifier} = <b>${rolledTotalValue}</b>`,
					'normal',
					{
						detailHtml: `<b>Roll Formula:</b> 1d20 ${modifier >= 0 ? '+' : '-'} ${Math.abs(modifier)}<br><b>d20 Roll:</b> ${rolledD20Value}<br><b>Total:</b> ${rolledTotalValue}`
					}
				);
			}
		}

		function isProfOverrideActive() {
			return Number.isFinite(profManualOverrideValue)
				&& Number.isFinite(profDefaultValue)
				&& profManualOverrideValue !== profDefaultValue;
		}

		function isInitOverrideActive() {
			return Number.isFinite(initManualOverrideValue)
				&& Number.isFinite(initDefaultValue)
				&& initManualOverrideValue !== initDefaultValue;
		}

		function isStrOverrideActive() {
			return Number.isFinite(strManualOverrideValue)
				&& Number.isFinite(strDefaultValue)
				&& strManualOverrideValue !== strDefaultValue;
		}

		function isDexOverrideActive() {
			return Number.isFinite(dexManualOverrideValue)
				&& Number.isFinite(dexDefaultValue)
				&& dexManualOverrideValue !== dexDefaultValue;
		}

		function isOtherAbilityOverrideActive(abilityKey) {
			const runtime = getOtherAbilityRuntime(abilityKey);
			if (!runtime) return false;
			return Number.isFinite(runtime.manualOverrideValue)
				&& Number.isFinite(runtime.defaultValue)
				&& runtime.manualOverrideValue !== runtime.defaultValue;
		}

		function getEffectiveStrScoreValueForEdits() {
			return Number.isFinite(strScoreManualOverrideValue)
				? Math.trunc(strScoreManualOverrideValue)
				: (Number.isFinite(strScoreDefaultValue) ? Math.trunc(strScoreDefaultValue) : null);
		}

		function getEffectiveDexScoreValueForEdits() {
			return Number.isFinite(dexScoreManualOverrideValue)
				? Math.trunc(dexScoreManualOverrideValue)
				: (Number.isFinite(dexScoreDefaultValue) ? Math.trunc(dexScoreDefaultValue) : null);
		}

		function getEffectiveOtherAbilityScoreValueForEdits(abilityKey) {
			const runtime = getOtherAbilityRuntime(abilityKey);
			if (!runtime) return null;
			return Number.isFinite(runtime.scoreManualOverrideValue)
				? Math.trunc(runtime.scoreManualOverrideValue)
				: (Number.isFinite(runtime.scoreDefaultValue) ? Math.trunc(runtime.scoreDefaultValue) : null);
		}

		function applyStrModifierOffsetFromCurrentScore(nextModifierValue) {
			if (!Number.isFinite(nextModifierValue)) {
				strModifierOffsetFromScore = null;
				return;
			}
			const effectiveScoreValue = getEffectiveStrScoreValueForEdits();
			const scoreDerivedModifier = getAbilityModifierFromScore(effectiveScoreValue);
			if (!Number.isFinite(scoreDerivedModifier)) {
				strModifierOffsetFromScore = null;
				return;
			}
			strModifierOffsetFromScore = Math.trunc(nextModifierValue) - Math.trunc(scoreDerivedModifier);
		}

		function applyDexModifierOffsetFromCurrentScore(nextModifierValue) {
			if (!Number.isFinite(nextModifierValue)) {
				dexModifierOffsetFromScore = null;
				return;
			}
			const effectiveScoreValue = getEffectiveDexScoreValueForEdits();
			const scoreDerivedModifier = getAbilityModifierFromScore(effectiveScoreValue);
			if (!Number.isFinite(scoreDerivedModifier)) {
				dexModifierOffsetFromScore = null;
				return;
			}
			dexModifierOffsetFromScore = Math.trunc(nextModifierValue) - Math.trunc(scoreDerivedModifier);
		}

		function applyOtherAbilityModifierOffsetFromCurrentScore(abilityKey, nextModifierValue) {
			const runtime = getOtherAbilityRuntime(abilityKey);
			if (!runtime) return;
			if (!Number.isFinite(nextModifierValue)) {
				runtime.modifierOffsetFromScore = null;
				return;
			}
			const effectiveScoreValue = getEffectiveOtherAbilityScoreValueForEdits(abilityKey);
			const scoreDerivedModifier = getAbilityModifierFromScore(effectiveScoreValue);
			if (!Number.isFinite(scoreDerivedModifier)) {
				runtime.modifierOffsetFromScore = null;
				return;
			}
			runtime.modifierOffsetFromScore = Math.trunc(nextModifierValue) - Math.trunc(scoreDerivedModifier);
		}

		function isStrScoreOverrideActive() {
			return Number.isFinite(strScoreManualOverrideValue)
				&& Number.isFinite(strScoreDefaultValue)
				&& strScoreManualOverrideValue !== strScoreDefaultValue;
		}

		function isDexScoreOverrideActive() {
			return Number.isFinite(dexScoreManualOverrideValue)
				&& Number.isFinite(dexScoreDefaultValue)
				&& dexScoreManualOverrideValue !== dexScoreDefaultValue;
		}

		function isOtherAbilityScoreOverrideActive(abilityKey) {
			const runtime = getOtherAbilityRuntime(abilityKey);
			if (!runtime) return false;
			return Number.isFinite(runtime.scoreManualOverrideValue)
				&& Number.isFinite(runtime.scoreDefaultValue)
				&& runtime.scoreManualOverrideValue !== runtime.scoreDefaultValue;
		}

		function hasAnyOtherAbilityPendingChanges() {
			return PLAYER_INFO_OTHER_ABILITY_KEYS.some((abilityKey) => isOtherAbilityOverrideActive(abilityKey) || isOtherAbilityScoreOverrideActive(abilityKey));
		}

		function hasPendingPlayerSheetChanges() {
			return isProfOverrideActive()
				|| isInitOverrideActive()
				|| isStrOverrideActive()
				|| isStrScoreOverrideActive()
				|| isDexOverrideActive()
				|| isDexScoreOverrideActive()
				|| hasAnyOtherAbilityPendingChanges();
		}

		function hasPersistentPlayerSheetDirtyValues() {
			const activeCharacterData = getActiveCharacterData();
			if (!activeCharacterData || typeof activeCharacterData !== 'object') return false;
			const profProfile = resolveProficiencyBonusProfile(activeCharacterData);
			const initProfile = resolveInitiativeProfile(activeCharacterData);
			const strProfile = resolveStrengthModifierProfile(activeCharacterData);
			const dexProfile = resolveDexterityModifierProfile(activeCharacterData);
			const hasOtherPersistentDirty = PLAYER_INFO_OTHER_ABILITY_KEYS.some((abilityKey) => !!resolveStandardAbilityModifierProfile(activeCharacterData, abilityKey)?.hasPersistentDirty);
			return !!profProfile?.hasPersistentDirty || !!initProfile?.hasPersistentDirty || !!strProfile?.hasPersistentDirty || !!dexProfile?.hasPersistentDirty || hasOtherPersistentDirty;
		}

		function updateCommitButtonState() {
			if (!commitBtn) return;
			const hasPendingChanges = hasPendingPlayerSheetChanges();
			if (!isPlayerSheetEditMode) {
				commitBtn.textContent = 'EDIT';
				commitBtn.disabled = false;
				commitBtn.setAttribute('aria-disabled', 'false');
				commitBtn.classList.remove('commit-ready');
			} else {
				commitBtn.textContent = hasPendingChanges ? 'COMMIT' : 'LEAVE';
				commitBtn.disabled = false;
				commitBtn.setAttribute('aria-disabled', 'false');
				commitBtn.classList.toggle('commit-ready', hasPendingChanges);
			}

			if (revertBtn) {
				const hasPersistentDirty = hasPersistentPlayerSheetDirtyValues();
				const hasVisibleDirtyOutline = hasPendingChanges || hasPersistentDirty;
				const showRevert = isPlayerSheetEditMode && hasVisibleDirtyOutline;
				revertBtn.hidden = !showRevert;
				revertBtn.disabled = !showRevert;
				revertBtn.setAttribute('aria-disabled', showRevert ? 'false' : 'true');
			}

			windowEl.classList.toggle('player-info-edit-mode', isPlayerSheetEditMode);
		}

		function setPlayerSheetEditMode(nextValue) {
			logStrInteraction('setPlayerSheetEditMode:requested', {
				requestedMode: !!nextValue,
				currentMode: !!isPlayerSheetEditMode
			});
			const nextMode = !!nextValue;
			if (isPlayerSheetEditMode === nextMode) {
				updateCommitButtonState();
				logStrInteraction('setPlayerSheetEditMode:no-op', {
					nextMode
				});
				return;
			}
			isPlayerSheetEditMode = nextMode;
			if (!isPlayerSheetEditMode) {
				endProfInlineEdit(true);
				endInitInlineEdit(true);
				endStrInlineEdit(true);
				endStrScoreInlineEdit(true);
				endDexInlineEdit(true);
				endDexScoreInlineEdit(true);
				endProfAdjustSession();
				endInitAdjustSession();
				endStrAdjustSession();
				endDexAdjustSession();
			}
			applyProfNodeVisualState();
			logStrInteraction('setPlayerSheetEditMode:applied', {
				nextMode
			});
		}

		function applyAdjustNodeInteractionState(node, options = {}) {
			if (!node) return;
			const {
				armedClass = '',
				isArmed = false,
				modifiedClass = '',
				isModified = false,
				editingClass = '',
				isEditing = false,
				extraEditingClass = '',
				isExtraEditing = false
			} = options;

			if (armedClass) {
				node.classList.toggle(armedClass, isPlayerSheetEditMode && !!isArmed);
			}
			if (modifiedClass) {
				node.classList.toggle(modifiedClass, isPlayerSheetEditMode && !!isModified);
			}
			if (editingClass) {
				node.classList.toggle(editingClass, isPlayerSheetEditMode && !!isEditing);
			}
			if (extraEditingClass) {
				node.classList.toggle(extraEditingClass, isPlayerSheetEditMode && !!isExtraEditing);
			}

			node.setAttribute('aria-disabled', isPlayerSheetEditMode ? 'false' : 'true');
			node.tabIndex = isPlayerSheetEditMode ? 0 : -1;
		}

		function applyProfNodeVisualState() {
			const profNode = getProfAdjustNode();
			applyAdjustNodeInteractionState(profNode, {
				armedClass: 'prof-adjust-armed',
				isArmed: !!profAdjustArmed,
				modifiedClass: 'modified',
				isModified: isProfOverrideActive(),
				editingClass: 'prof-editing',
				isEditing: !!profInlineEditing
			});
			const initNode = getInitAdjustNode();
			applyAdjustNodeInteractionState(initNode, {
				armedClass: 'init-adjust-armed',
				isArmed: !!initAdjustArmed,
				modifiedClass: 'modified',
				isModified: isInitOverrideActive(),
				editingClass: 'init-editing',
				isEditing: !!initInlineEditing
			});
			if (initNode) {
				initNode.classList.toggle('dirty-persist', !!resolveInitiativeProfile(getActiveCharacterData() || {})?.hasPersistentDirty);
			}
			const strNode = getStrAdjustNode();
			applyAdjustNodeInteractionState(strNode, {
				armedClass: 'str-adjust-armed',
				isArmed: !!strAdjustArmed,
				modifiedClass: 'modified',
				isModified: isStrOverrideActive() || isStrScoreOverrideActive(),
				editingClass: 'str-editing',
				isEditing: !!strInlineEditing,
				extraEditingClass: 'str-score-editing',
				isExtraEditing: !!strScoreInlineEditing
			});
			if (strNode) {
				strNode.classList.toggle('str-score-modified', isPlayerSheetEditMode && isStrScoreOverrideActive());
			}
			const dexNode = getDexAdjustNode();
			applyAdjustNodeInteractionState(dexNode, {
				armedClass: 'dex-adjust-armed',
				isArmed: !!dexAdjustArmed,
				modifiedClass: 'modified',
				isModified: isDexOverrideActive() || isDexScoreOverrideActive(),
				editingClass: 'dex-editing',
				isEditing: !!dexInlineEditing,
				extraEditingClass: 'dex-score-editing',
				isExtraEditing: !!dexScoreInlineEditing
			});
			if (dexNode) {
				dexNode.classList.toggle('dex-score-modified', isPlayerSheetEditMode && isDexScoreOverrideActive());
			}
			for (const abilityKey of PLAYER_INFO_OTHER_ABILITY_KEYS) {
				const runtime = getOtherAbilityRuntime(abilityKey);
				const abilityNode = getOtherAbilityAdjustNode(abilityKey);
				applyAdjustNodeInteractionState(abilityNode, {
					armedClass: 'dex-adjust-armed',
					isArmed: !!runtime?.adjustArmed,
					modifiedClass: 'modified',
					isModified: isOtherAbilityOverrideActive(abilityKey) || isOtherAbilityScoreOverrideActive(abilityKey),
					editingClass: 'dex-editing',
					isEditing: !!runtime?.inlineEditing,
					extraEditingClass: 'dex-score-editing',
					isExtraEditing: !!runtime?.scoreInlineEditing
				});
				if (abilityNode) {
					abilityNode.classList.toggle('dex-score-modified', isPlayerSheetEditMode && isOtherAbilityScoreOverrideActive(abilityKey));
				}
			}
			updateCommitButtonState();
		}

		function persistCommittedCharacterData(activeCharacterData) {
			if (!activeCharacterData || typeof activeCharacterData !== 'object') return;

			let activeReferenceHeading = String(window.localStorage?.getItem(ACTIVE_COMBATANT_REFERENCE_STORAGE_KEY) || '').trim();
			let importedStore = null;
			let importedStoreLoaded = false;

			const ensureImportedStore = () => {
				if (importedStoreLoaded) return importedStore;
				importedStoreLoaded = true;
				try {
					const importedStoreRaw = window.localStorage?.getItem('imported_characters');
					if (importedStoreRaw) {
						const parsedStore = JSON.parse(importedStoreRaw);
						if (parsedStore && typeof parsedStore === 'object' && !Array.isArray(parsedStore)) {
							importedStore = parsedStore;
						}
					}
				} catch {
					importedStore = null;
				}
				return importedStore;
			};

			if (!activeReferenceHeading) {
				const store = ensureImportedStore();
				const references = (store && typeof store.references === 'object' && !Array.isArray(store.references))
					? store.references
					: null;
				const order = Array.isArray(store?.order) ? store.order : [];
				if (references) {
					const activeName = String(activeCharacterData?.character?.name || '').trim();
					const activeFingerprint = String(activeCharacterData?.metadata?.sourceFingerprint || '').trim();

					if (activeFingerprint) {
						for (const referenceHeading of Object.keys(references)) {
							const candidateFingerprint = String(references[referenceHeading]?.metadata?.sourceFingerprint || '').trim();
							if (candidateFingerprint && candidateFingerprint === activeFingerprint) {
								activeReferenceHeading = String(referenceHeading || '').trim();
								break;
							}
						}
					}

					if (!activeReferenceHeading && activeName) {
						for (let index = order.length - 1; index >= 0; index -= 1) {
							const referenceHeading = String(order[index] || '').trim();
							if (!referenceHeading || !references[referenceHeading]) continue;
							const candidateName = String(references[referenceHeading]?.character?.name || '').trim();
							if (candidateName && candidateName === activeName) {
								activeReferenceHeading = referenceHeading;
								break;
							}
						}
					}

					if (!activeReferenceHeading) {
						const latestReference = order.length > 0
							? String(order[order.length - 1] || '').trim()
							: String(Object.keys(references).slice(-1)[0] || '').trim();
						if (latestReference) {
							activeReferenceHeading = latestReference;
						}
					}
				}
			}

			if (activeReferenceHeading) {
				try {
					window.localStorage?.setItem(ACTIVE_COMBATANT_REFERENCE_STORAGE_KEY, activeReferenceHeading);
				} catch {
				}
			}

			// Keep a generic snapshot updated so storage-based fallbacks stay current.
			try {
				window.localStorage?.setItem('characterData', JSON.stringify(activeCharacterData));
			} catch {
			}

			try {
				if (activeReferenceHeading) {
					const store = ensureImportedStore();
					if (store && typeof store === 'object' && !Array.isArray(store)) {
						const nextImportedStore = {
							...store,
							references: {
								...(store.references && typeof store.references === 'object' ? store.references : {})
							}
						};
						nextImportedStore.references[activeReferenceHeading] = activeCharacterData;
						if (!Array.isArray(nextImportedStore.order)) {
							nextImportedStore.order = [];
						}
						if (!nextImportedStore.order.includes(activeReferenceHeading)) {
							nextImportedStore.order.push(activeReferenceHeading);
						}
						window.localStorage?.setItem('imported_characters', JSON.stringify(nextImportedStore, null, 2));
					}
				}
			} catch {
			}

			try {
				if (activeReferenceHeading) {
					window.localStorage?.setItem(activeReferenceHeading, JSON.stringify(activeCharacterData));
				}
			} catch {
			}
		}

		function setHeroicInspirationEnabled(nextValue, source = 'player-info:heroic-toggle') {
			heroicInspirationEnabled = !!nextValue;
			const activeCharacterData = getActiveCharacterData();
			if (activeCharacterData && typeof activeCharacterData === 'object') {
				if (!activeCharacterData.combat || typeof activeCharacterData.combat !== 'object') {
					activeCharacterData.combat = {};
				}
				if (!activeCharacterData.character || typeof activeCharacterData.character !== 'object') {
					activeCharacterData.character = {};
				}
				activeCharacterData.combat.heroicInspiration = heroicInspirationEnabled;
				activeCharacterData.combat.inspiration = heroicInspirationEnabled;
				activeCharacterData.heroicInspiration = heroicInspirationEnabled;
				activeCharacterData.inspiration = heroicInspirationEnabled;
				activeCharacterData.character.heroicInspiration = heroicInspirationEnabled;
				activeCharacterData.character.inspiration = heroicInspirationEnabled;

				if (window.characterLoader && typeof window.characterLoader.setCharacterData === 'function') {
					window.characterLoader.setCharacterData(activeCharacterData, source);
				} else if (window.characterLoader) {
					window.characterLoader.characterData = activeCharacterData;
				}
				persistCommittedCharacterData(activeCharacterData);
			}

			window.dispatchEvent(new CustomEvent('player-info:heroic-inspiration-changed', {
				detail: {
					enabled: heroicInspirationEnabled,
					characterName: activeCharacterData?.character?.name || ''
				}
			}));
			renderPlayerInfoContent(true);
			writePersistedWindowState();
		}

		function commitPlayerSheetChanges() {
			logStrInteraction('commit:clicked-or-invoked');
			if (!isPlayerSheetEditMode) return;
			if (!hasPendingPlayerSheetChanges()) return;
			const activeCharacterData = getActiveCharacterData();
			if (!activeCharacterData || typeof activeCharacterData !== 'object') return;

			const hasProfCommitOverride = isProfOverrideActive();
			const hasInitCommitOverride = isInitOverrideActive();
			const hasStrScoreCommitOverride = isStrScoreOverrideActive();
			const hasStrModCommitOverride = isStrOverrideActive();
			const hasDexScoreCommitOverride = isDexScoreOverrideActive();
			const hasDexModCommitOverride = isDexOverrideActive();
			const otherAbilityCommitState = Object.fromEntries(PLAYER_INFO_OTHER_ABILITY_KEYS.map((abilityKey) => {
				const runtime = getOtherAbilityRuntime(abilityKey);
				const hasScoreCommitOverride = isOtherAbilityScoreOverrideActive(abilityKey);
				const hasModCommitOverride = isOtherAbilityOverrideActive(abilityKey);
				const committedScoreValue = hasScoreCommitOverride && runtime
					? Math.trunc(runtime.scoreManualOverrideValue)
					: null;
				const committedModifierValue = hasModCommitOverride && runtime
					? Math.trunc(runtime.manualOverrideValue)
					: (Number.isFinite(committedScoreValue)
						? getAbilityModifierFromScore(committedScoreValue)
						: null);
				return [abilityKey, {
					hasScoreCommitOverride,
					hasModCommitOverride,
					committedScoreValue,
					committedModifierValue
				}];
			}));
			const committedProfValue = hasProfCommitOverride
				? Math.trunc(profManualOverrideValue)
				: null;
			const committedInitValue = hasInitCommitOverride
				? Math.trunc(initManualOverrideValue)
				: null;
			const committedStrScoreValue = hasStrScoreCommitOverride
				? Math.trunc(strScoreManualOverrideValue)
				: null;
			const committedStrValue = hasStrModCommitOverride
				? Math.trunc(strManualOverrideValue)
				: (Number.isFinite(committedStrScoreValue)
					? getAbilityModifierFromScore(committedStrScoreValue)
					: null);
			const committedDexScoreValue = hasDexScoreCommitOverride
				? Math.trunc(dexScoreManualOverrideValue)
				: null;
			const committedDexValue = hasDexModCommitOverride
				? Math.trunc(dexManualOverrideValue)
				: (Number.isFinite(committedDexScoreValue)
					? getAbilityModifierFromScore(committedDexScoreValue)
					: null);
			logStrDebug('commit:start', {
				characterName: activeCharacterData?.character?.name || '',
				hasProfCommitOverride,
				hasInitCommitOverride,
				hasStrScoreCommitOverride,
				hasStrModCommitOverride,
				hasDexScoreCommitOverride,
				hasDexModCommitOverride,
				committedProfValue,
				committedInitValue,
				committedStrScoreValue,
				committedStrValue,
				committedDexScoreValue,
				committedDexValue,
				otherAbilityCommitState,
				strManualOverrideValue,
				strScoreManualOverrideValue,
				strModifierOffsetFromScore,
				dexManualOverrideValue,
				dexScoreManualOverrideValue,
				dexModifierOffsetFromScore
			});
			if (
				!Number.isFinite(committedProfValue)
				&& !Number.isFinite(committedInitValue)
				&& !Number.isFinite(committedStrValue)
				&& !Number.isFinite(committedStrScoreValue)
				&& !Number.isFinite(committedDexValue)
				&& !Number.isFinite(committedDexScoreValue)
				&& !PLAYER_INFO_OTHER_ABILITY_KEYS.some((abilityKey) => {
					const state = otherAbilityCommitState[abilityKey];
					return Number.isFinite(state?.committedModifierValue) || Number.isFinite(state?.committedScoreValue);
				})
			) return;

			if (!activeCharacterData.combat || typeof activeCharacterData.combat !== 'object') {
				activeCharacterData.combat = {};
			}
			if (!activeCharacterData.playerSheetOverrides || typeof activeCharacterData.playerSheetOverrides !== 'object') {
				activeCharacterData.playerSheetOverrides = {};
			}
			if (!activeCharacterData.playerSheetOriginals || typeof activeCharacterData.playerSheetOriginals !== 'object') {
				activeCharacterData.playerSheetOriginals = {};
			}
			if (!Number.isFinite(Number(activeCharacterData.playerSheetOriginals.proficiencyBonus))) {
				const profileBeforeCommit = resolveProficiencyBonusProfile(activeCharacterData);
				const bootstrapOriginal = Number.isFinite(profileBeforeCommit?.originalBonus)
					? Math.trunc(profileBeforeCommit.originalBonus)
					: Math.trunc(profileBeforeCommit?.resolvedBonus ?? committedProfValue);
				activeCharacterData.playerSheetOriginals.proficiencyBonus = bootstrapOriginal;
			}
			if (!Number.isFinite(Number(activeCharacterData.playerSheetOriginals.initiative))) {
				const initProfileBeforeCommit = resolveInitiativeProfile(activeCharacterData);
				const bootstrapOriginal = Number.isFinite(initProfileBeforeCommit?.originalValue)
					? Math.trunc(initProfileBeforeCommit.originalValue)
					: Math.trunc(initProfileBeforeCommit?.resolvedValue ?? committedInitValue ?? 0);
				activeCharacterData.playerSheetOriginals.initiative = bootstrapOriginal;
			}
			if (!Number.isFinite(Number(activeCharacterData.playerSheetOriginals.strengthModifier))) {
				const strProfileBeforeCommit = resolveStrengthModifierProfile(activeCharacterData);
				const bootstrapOriginal = Number.isFinite(strProfileBeforeCommit?.originalModifier)
					? Math.trunc(strProfileBeforeCommit.originalModifier)
					: Math.trunc(strProfileBeforeCommit?.resolvedModifier ?? committedStrValue ?? 0);
				activeCharacterData.playerSheetOriginals.strengthModifier = bootstrapOriginal;
			}
			if (!isValidStrengthScore(activeCharacterData.playerSheetOriginals.strengthScore)) {
				const strProfileBeforeCommit = resolveStrengthModifierProfile(activeCharacterData);
				const bootstrapOriginal = normalizeStrengthScore(
					Number.isFinite(strProfileBeforeCommit?.originalScore)
						? Math.trunc(strProfileBeforeCommit.originalScore)
						: Math.trunc(strProfileBeforeCommit?.resolvedScore ?? committedStrScoreValue ?? 10)
				) ?? 10;
				activeCharacterData.playerSheetOriginals.strengthScore = bootstrapOriginal;
			}
			if (!Number.isFinite(Number(activeCharacterData.playerSheetOriginals.dexterityModifier))) {
				const dexProfileBeforeCommit = resolveDexterityModifierProfile(activeCharacterData);
				const bootstrapOriginal = Number.isFinite(dexProfileBeforeCommit?.originalModifier)
					? Math.trunc(dexProfileBeforeCommit.originalModifier)
					: Math.trunc(dexProfileBeforeCommit?.resolvedModifier ?? committedDexValue ?? 0);
				activeCharacterData.playerSheetOriginals.dexterityModifier = bootstrapOriginal;
			}
			if (!isValidDexterityScore(activeCharacterData.playerSheetOriginals.dexterityScore)) {
				const dexProfileBeforeCommit = resolveDexterityModifierProfile(activeCharacterData);
				const bootstrapOriginal = normalizeDexterityScore(
					Number.isFinite(dexProfileBeforeCommit?.originalScore)
						? Math.trunc(dexProfileBeforeCommit.originalScore)
						: Math.trunc(dexProfileBeforeCommit?.resolvedScore ?? committedDexScoreValue ?? 10)
				) ?? 10;
				activeCharacterData.playerSheetOriginals.dexterityScore = bootstrapOriginal;
			}
			for (const abilityKey of PLAYER_INFO_OTHER_ABILITY_KEYS) {
				const profileBeforeCommit = resolveStandardAbilityModifierProfile(activeCharacterData, abilityKey);
				const modifierField = getAbilityOverrideFieldName(abilityKey, 'Modifier');
				const scoreField = getAbilityOverrideFieldName(abilityKey, 'Score');
				if (!Number.isFinite(Number(activeCharacterData.playerSheetOriginals[modifierField]))) {
					const bootstrapOriginal = Number.isFinite(profileBeforeCommit?.originalModifier)
						? Math.trunc(profileBeforeCommit.originalModifier)
						: Math.trunc(profileBeforeCommit?.resolvedModifier ?? otherAbilityCommitState?.[abilityKey]?.committedModifierValue ?? 0);
					activeCharacterData.playerSheetOriginals[modifierField] = bootstrapOriginal;
				}
				if (!isValidStandardAbilityScore(activeCharacterData.playerSheetOriginals[scoreField])) {
					const bootstrapOriginal = normalizeStandardAbilityScore(
						Number.isFinite(profileBeforeCommit?.originalScore)
							? Math.trunc(profileBeforeCommit.originalScore)
							: Math.trunc(profileBeforeCommit?.resolvedScore ?? otherAbilityCommitState?.[abilityKey]?.committedScoreValue ?? 10)
					) ?? 10;
					activeCharacterData.playerSheetOriginals[scoreField] = bootstrapOriginal;
				}
			}

			if (Number.isFinite(committedProfValue)) {
				activeCharacterData.combat.proficiencyBonus = committedProfValue;
				activeCharacterData.combat.profBonus = committedProfValue;
				activeCharacterData.combat.proficiencyBonusCommitted = committedProfValue;
				activeCharacterData.playerSheetOverrides.proficiencyBonus = committedProfValue;
			}

			if (Number.isFinite(committedInitValue)) {
				activeCharacterData.combat.initiative = committedInitValue;
				activeCharacterData.combat.init = committedInitValue;
				activeCharacterData.combat.initiativeCommitted = committedInitValue;
				activeCharacterData.playerSheetOverrides.initiative = committedInitValue;
			}

			if (Number.isFinite(committedStrValue)) {
				activeCharacterData.playerSheetOverrides.strengthModifier = committedStrValue;
				const abilityMap = extractAbilityMap(activeCharacterData);
				if (abilityMap && typeof abilityMap === 'object') {
					let strengthEntry = abilityMap.strength ?? abilityMap.STR;
					if (strengthEntry === null || strengthEntry === undefined) {
						abilityMap.strength = {};
						strengthEntry = abilityMap.strength;
					} else if (typeof strengthEntry !== 'object') {
						const inferredScore = extractAbilityScore(strengthEntry);
						const normalizedEntry = {};
						const normalizedInferredScore = normalizeStrengthScore(inferredScore);
						if (Number.isFinite(normalizedInferredScore)) {
							normalizedEntry.score = normalizedInferredScore;
						}
						abilityMap.strength = normalizedEntry;
						strengthEntry = normalizedEntry;
					}
					if (strengthEntry && typeof strengthEntry === 'object') {
						strengthEntry.modifier = committedStrValue;
						strengthEntry.modifierCommitted = committedStrValue;
						delete strengthEntry.modifierOverride;
						if (!Number.isFinite(committedStrScoreValue)) {
							delete strengthEntry.scoreCommitted;
							delete strengthEntry.scoreOverride;
						}
					}
				}
				if (!Number.isFinite(committedStrScoreValue)) {
					delete activeCharacterData.playerSheetOverrides.strengthScore;
				}
			}

			if (Number.isFinite(committedStrScoreValue)) {
				activeCharacterData.playerSheetOverrides.strengthScore = committedStrScoreValue;
				const abilityMap = extractAbilityMap(activeCharacterData);
				if (abilityMap && typeof abilityMap === 'object') {
					let strengthEntry = abilityMap.strength ?? abilityMap.STR;
					if (strengthEntry === null || strengthEntry === undefined) {
						abilityMap.strength = {};
						strengthEntry = abilityMap.strength;
					} else if (typeof strengthEntry !== 'object') {
						const normalizedEntry = { score: committedStrScoreValue };
						abilityMap.strength = normalizedEntry;
						strengthEntry = normalizedEntry;
					}
					if (strengthEntry && typeof strengthEntry === 'object') {
						strengthEntry.score = committedStrScoreValue;
						strengthEntry.scoreCommitted = committedStrScoreValue;
						delete strengthEntry.scoreOverride;
					}
				}
			}

			if (Number.isFinite(committedDexValue)) {
				activeCharacterData.playerSheetOverrides.dexterityModifier = committedDexValue;
				const abilityMap = extractAbilityMap(activeCharacterData);
				if (abilityMap && typeof abilityMap === 'object') {
					let dexterityEntry = abilityMap.dexterity ?? abilityMap.DEX;
					if (dexterityEntry === null || dexterityEntry === undefined) {
						abilityMap.dexterity = {};
						dexterityEntry = abilityMap.dexterity;
					} else if (typeof dexterityEntry !== 'object') {
						const inferredScore = extractAbilityScore(dexterityEntry);
						const normalizedEntry = {};
						const normalizedInferredScore = normalizeDexterityScore(inferredScore);
						if (Number.isFinite(normalizedInferredScore)) {
							normalizedEntry.score = normalizedInferredScore;
						}
						abilityMap.dexterity = normalizedEntry;
						dexterityEntry = normalizedEntry;
					}
					if (dexterityEntry && typeof dexterityEntry === 'object') {
						dexterityEntry.modifier = committedDexValue;
						dexterityEntry.modifierCommitted = committedDexValue;
						delete dexterityEntry.modifierOverride;
						if (!Number.isFinite(committedDexScoreValue)) {
							delete dexterityEntry.scoreCommitted;
							delete dexterityEntry.scoreOverride;
						}
					}
				}
				if (!Number.isFinite(committedDexScoreValue)) {
					delete activeCharacterData.playerSheetOverrides.dexterityScore;
				}
			}

			if (Number.isFinite(committedDexScoreValue)) {
				activeCharacterData.playerSheetOverrides.dexterityScore = committedDexScoreValue;
				const abilityMap = extractAbilityMap(activeCharacterData);
				if (abilityMap && typeof abilityMap === 'object') {
					let dexterityEntry = abilityMap.dexterity ?? abilityMap.DEX;
					if (dexterityEntry === null || dexterityEntry === undefined) {
						abilityMap.dexterity = {};
						dexterityEntry = abilityMap.dexterity;
					} else if (typeof dexterityEntry !== 'object') {
						const normalizedEntry = { score: committedDexScoreValue };
						abilityMap.dexterity = normalizedEntry;
						dexterityEntry = normalizedEntry;
					}
					if (dexterityEntry && typeof dexterityEntry === 'object') {
						dexterityEntry.score = committedDexScoreValue;
						dexterityEntry.scoreCommitted = committedDexScoreValue;
						delete dexterityEntry.scoreOverride;
					}
				}
			}

			for (const abilityKey of PLAYER_INFO_OTHER_ABILITY_KEYS) {
				const state = otherAbilityCommitState[abilityKey] || {};
				const committedOtherValue = state.committedModifierValue;
				const committedOtherScoreValue = state.committedScoreValue;
				const modifierField = getAbilityOverrideFieldName(abilityKey, 'Modifier');
				const scoreField = getAbilityOverrideFieldName(abilityKey, 'Score');
				const shortKey = getAbilityShortKey(abilityKey).toUpperCase();

				if (Number.isFinite(committedOtherValue)) {
					activeCharacterData.playerSheetOverrides[modifierField] = Math.trunc(committedOtherValue);
					const abilityMap = extractAbilityMap(activeCharacterData);
					if (abilityMap && typeof abilityMap === 'object') {
						let abilityEntry = abilityMap[abilityKey] ?? abilityMap[shortKey];
						if (abilityEntry === null || abilityEntry === undefined) {
							abilityMap[abilityKey] = {};
							abilityEntry = abilityMap[abilityKey];
						} else if (typeof abilityEntry !== 'object') {
							const inferredScore = extractAbilityScore(abilityEntry);
							const normalizedEntry = {};
							const normalizedInferredScore = normalizeStandardAbilityScore(inferredScore);
							if (Number.isFinite(normalizedInferredScore)) {
								normalizedEntry.score = normalizedInferredScore;
							}
							abilityMap[abilityKey] = normalizedEntry;
							abilityEntry = normalizedEntry;
						}
						if (abilityEntry && typeof abilityEntry === 'object') {
							abilityEntry.modifier = Math.trunc(committedOtherValue);
							abilityEntry.modifierCommitted = Math.trunc(committedOtherValue);
							delete abilityEntry.modifierOverride;
							if (!Number.isFinite(committedOtherScoreValue)) {
								delete abilityEntry.scoreCommitted;
								delete abilityEntry.scoreOverride;
							}
						}
					}
					if (!Number.isFinite(committedOtherScoreValue)) {
						delete activeCharacterData.playerSheetOverrides[scoreField];
					}
				}

				if (Number.isFinite(committedOtherScoreValue)) {
					activeCharacterData.playerSheetOverrides[scoreField] = Math.trunc(committedOtherScoreValue);
					const abilityMap = extractAbilityMap(activeCharacterData);
					if (abilityMap && typeof abilityMap === 'object') {
						let abilityEntry = abilityMap[abilityKey] ?? abilityMap[shortKey];
						if (abilityEntry === null || abilityEntry === undefined) {
							abilityMap[abilityKey] = {};
							abilityEntry = abilityMap[abilityKey];
						} else if (typeof abilityEntry !== 'object') {
							const normalizedEntry = { score: Math.trunc(committedOtherScoreValue) };
							abilityMap[abilityKey] = normalizedEntry;
							abilityEntry = normalizedEntry;
						}
						if (abilityEntry && typeof abilityEntry === 'object') {
							abilityEntry.score = Math.trunc(committedOtherScoreValue);
							abilityEntry.scoreCommitted = Math.trunc(committedOtherScoreValue);
							delete abilityEntry.scoreOverride;
						}
					}
				}
			}

			syncAbilityMapMirrors(activeCharacterData);

			if (window.characterLoader && typeof window.characterLoader.setCharacterData === 'function') {
				window.characterLoader.setCharacterData(activeCharacterData, 'player-info:commit');
			} else if (window.characterLoader) {
				window.characterLoader.characterData = activeCharacterData;
			}

			if (window.characterLoader && typeof window.characterLoader.applyToFlowchart === 'function') {
				window.characterLoader.applyToFlowchart();
			}

			persistCommittedCharacterData(activeCharacterData);
			logStrDebug('commit:persisted', {
				characterName: activeCharacterData?.character?.name || '',
				overrides: activeCharacterData?.playerSheetOverrides || null,
				originals: activeCharacterData?.playerSheetOriginals || null,
				strength: extractAbilityMap(activeCharacterData)?.strength ?? extractAbilityMap(activeCharacterData)?.STR ?? null
			});
			logStrInteraction('commit:after-persist', {
				committedProfValue,
				committedInitValue,
				committedStrValue,
				committedStrScoreValue,
				committedDexValue,
				committedDexScoreValue
			});
			profManualOverrideValue = null;
			initManualOverrideValue = null;
			strManualOverrideValue = null;
			strModifierOffsetFromScore = null;
			strScoreManualOverrideValue = null;
			dexManualOverrideValue = null;
			dexModifierOffsetFromScore = null;
			dexScoreManualOverrideValue = null;
			for (const abilityKey of PLAYER_INFO_OTHER_ABILITY_KEYS) {
				const runtime = getOtherAbilityRuntime(abilityKey);
				if (!runtime) continue;
				runtime.manualOverrideValue = null;
				runtime.modifierOffsetFromScore = null;
				runtime.scoreManualOverrideValue = null;
				runtime.inlineEditing = false;
				runtime.scoreInlineEditing = false;
				runtime.adjustArmed = false;
				runtime.suppressNextClick = false;
			}
			endOtherAbilityInlineEdit(false);
			endOtherAbilityScoreInlineEdit(false);
			endOtherAbilityAdjustSession();
			setPlayerSheetEditMode(false);
			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
			window.dispatchEvent(new CustomEvent('player-info:committed', {
				detail: {
					proficiencyBonus: Number.isFinite(committedProfValue) ? committedProfValue : null,
						initiative: Number.isFinite(committedInitValue) ? committedInitValue : null,
					strengthModifier: Number.isFinite(committedStrValue) ? committedStrValue : null,
					strengthScore: Number.isFinite(committedStrScoreValue) ? committedStrScoreValue : null,
					dexterityModifier: Number.isFinite(committedDexValue) ? committedDexValue : null,
					dexterityScore: Number.isFinite(committedDexScoreValue) ? committedDexScoreValue : null,
					constitutionModifier: Number.isFinite(otherAbilityCommitState?.constitution?.committedModifierValue) ? otherAbilityCommitState.constitution.committedModifierValue : null,
					constitutionScore: Number.isFinite(otherAbilityCommitState?.constitution?.committedScoreValue) ? otherAbilityCommitState.constitution.committedScoreValue : null,
					intelligenceModifier: Number.isFinite(otherAbilityCommitState?.intelligence?.committedModifierValue) ? otherAbilityCommitState.intelligence.committedModifierValue : null,
					intelligenceScore: Number.isFinite(otherAbilityCommitState?.intelligence?.committedScoreValue) ? otherAbilityCommitState.intelligence.committedScoreValue : null,
					wisdomModifier: Number.isFinite(otherAbilityCommitState?.wisdom?.committedModifierValue) ? otherAbilityCommitState.wisdom.committedModifierValue : null,
					wisdomScore: Number.isFinite(otherAbilityCommitState?.wisdom?.committedScoreValue) ? otherAbilityCommitState.wisdom.committedScoreValue : null,
					charismaModifier: Number.isFinite(otherAbilityCommitState?.charisma?.committedModifierValue) ? otherAbilityCommitState.charisma.committedModifierValue : null,
					charismaScore: Number.isFinite(otherAbilityCommitState?.charisma?.committedScoreValue) ? otherAbilityCommitState.charisma.committedScoreValue : null,
					characterName: activeCharacterData?.character?.name || ''
				}
			}));
		}

		function revertPlayerSheetDirtyValues() {
			logStrInteraction('revert:clicked-or-invoked');
			if (!isPlayerSheetEditMode) return;
			const activeCharacterData = getActiveCharacterData();
			if (!activeCharacterData || typeof activeCharacterData !== 'object') return;
			// Ensure inline editors/drag sessions do not race with revert state writes.
			endProfInlineEdit(false);
			endInitInlineEdit(false);
			endStrInlineEdit(false);
			endStrScoreInlineEdit(false);
			endDexInlineEdit(false);
			endDexScoreInlineEdit(false);
			endOtherAbilityInlineEdit(false);
			endOtherAbilityScoreInlineEdit(false);
			endProfAdjustSession();
			endInitAdjustSession();
			endStrAdjustSession();
			endDexAdjustSession();
			endOtherAbilityAdjustSession();

			const profProfile = resolveProficiencyBonusProfile(activeCharacterData);
			const initProfile = resolveInitiativeProfile(activeCharacterData);
			const strProfile = resolveStrengthModifierProfile(activeCharacterData);
			const dexProfile = resolveDexterityModifierProfile(activeCharacterData);
			const overrides = (activeCharacterData.playerSheetOverrides && typeof activeCharacterData.playerSheetOverrides === 'object')
				? activeCharacterData.playerSheetOverrides
				: null;
			const hasStoredProfOverride = Number.isFinite(Number(overrides?.proficiencyBonus));
			const hasStoredInitOverride = Number.isFinite(Number(overrides?.initiative));
			const hasStoredStrModifierOverride = Number.isFinite(Number(overrides?.strengthModifier));
			const hasStoredStrScoreOverride = isValidStrengthScore(overrides?.strengthScore);
			const hasStoredDexModifierOverride = Number.isFinite(Number(overrides?.dexterityModifier));
			const hasStoredDexScoreOverride = isValidDexterityScore(overrides?.dexterityScore);
			const hasInvalidStoredStrScoreOverride = Number.isFinite(Number(overrides?.strengthScore))
				&& !isValidStrengthScore(overrides?.strengthScore);
			const hasInvalidStoredDexScoreOverride = Number.isFinite(Number(overrides?.dexterityScore))
				&& !isValidDexterityScore(overrides?.dexterityScore);
			const shouldResetProf = hasStoredProfOverride || !!profProfile?.hasPersistentDirty;
			const shouldResetInit = hasStoredInitOverride || !!initProfile?.hasPersistentDirty;
			const shouldResetStrScore = hasStoredStrScoreOverride
				|| hasInvalidStoredStrScoreOverride
				|| !!strProfile?.hasPersistentDirtyScore
				|| !!strProfile?.hasRuntimeDirtyScore;
			const shouldResetStrModifier = hasStoredStrModifierOverride
				|| !!strProfile?.hasPersistentDirtyModifier
				|| !!strProfile?.hasRuntimeDirtyModifier
				|| shouldResetStrScore;
			const canRevertProf = shouldResetProf && Number.isFinite(profProfile?.originalBonus);
			const canRevertInit = shouldResetInit && Number.isFinite(initProfile?.originalValue);
			const canRevertStr = shouldResetStrModifier && Number.isFinite(strProfile?.originalModifier);
			const canRevertStrScore = shouldResetStrScore && Number.isFinite(strProfile?.originalScore);
			const shouldResetDexScore = hasStoredDexScoreOverride
				|| hasInvalidStoredDexScoreOverride
				|| !!dexProfile?.hasPersistentDirtyScore
				|| !!dexProfile?.hasRuntimeDirtyScore;
			const shouldResetDexModifier = hasStoredDexModifierOverride
				|| !!dexProfile?.hasPersistentDirtyModifier
				|| !!dexProfile?.hasRuntimeDirtyModifier
				|| shouldResetDexScore;
			const canRevertDex = shouldResetDexModifier && Number.isFinite(dexProfile?.originalModifier);
			const canRevertDexScore = shouldResetDexScore && Number.isFinite(dexProfile?.originalScore);
			const otherRevertState = Object.fromEntries(PLAYER_INFO_OTHER_ABILITY_KEYS.map((abilityKey) => {
				const profile = resolveStandardAbilityModifierProfile(activeCharacterData, abilityKey);
				const modifierField = getAbilityOverrideFieldName(abilityKey, 'Modifier');
				const scoreField = getAbilityOverrideFieldName(abilityKey, 'Score');
				const hasStoredModifierOverride = Number.isFinite(Number(overrides?.[modifierField]));
				const hasStoredScoreOverride = isValidStandardAbilityScore(overrides?.[scoreField]);
				const hasInvalidStoredScoreOverride = Number.isFinite(Number(overrides?.[scoreField])) && !isValidStandardAbilityScore(overrides?.[scoreField]);
				const shouldResetScore = hasStoredScoreOverride || hasInvalidStoredScoreOverride || !!profile?.hasPersistentDirtyScore || !!profile?.hasRuntimeDirtyScore;
				const shouldResetModifier = hasStoredModifierOverride || !!profile?.hasPersistentDirtyModifier || !!profile?.hasRuntimeDirtyModifier || shouldResetScore;
				const canRevertModifier = shouldResetModifier && Number.isFinite(profile?.originalModifier);
				const canRevertScore = shouldResetScore && Number.isFinite(profile?.originalScore);
				return [abilityKey, {
					profile,
					modifierField,
					scoreField,
					hasStoredModifierOverride,
					hasStoredScoreOverride,
					hasInvalidStoredScoreOverride,
					shouldResetModifier,
					shouldResetScore,
					canRevertModifier,
					canRevertScore,
					originalModifierValue: canRevertModifier ? Math.trunc(profile.originalModifier) : null,
					originalScoreValue: canRevertScore ? Math.trunc(profile.originalScore) : null
				}];
			}));
			logStrDebug('revert:start', {
				characterName: activeCharacterData?.character?.name || '',
				hasStoredProfOverride,
				hasStoredInitOverride,
				hasStoredStrModifierOverride,
				hasStoredStrScoreOverride,
				hasStoredDexModifierOverride,
				hasStoredDexScoreOverride,
				shouldResetProf,
				shouldResetInit,
				shouldResetStrModifier,
				shouldResetStrScore,
				shouldResetDexModifier,
				shouldResetDexScore,
				hasInvalidStoredStrScoreOverride,
				hasInvalidStoredDexScoreOverride,
				canRevertProf,
				canRevertInit,
				canRevertStr,
				canRevertStrScore,
				canRevertDex,
				canRevertDexScore,
				profile: strProfile,
				dexProfile
			});
			if (!shouldResetProf && !shouldResetInit && !shouldResetStrModifier && !shouldResetStrScore && !shouldResetDexModifier && !shouldResetDexScore && !PLAYER_INFO_OTHER_ABILITY_KEYS.some((abilityKey) => otherRevertState?.[abilityKey]?.shouldResetModifier || otherRevertState?.[abilityKey]?.shouldResetScore)) {
				profManualOverrideValue = null;
				initManualOverrideValue = null;
				strManualOverrideValue = null;
				strModifierOffsetFromScore = null;
				strScoreManualOverrideValue = null;
				dexManualOverrideValue = null;
				dexModifierOffsetFromScore = null;
				dexScoreManualOverrideValue = null;
				for (const abilityKey of PLAYER_INFO_OTHER_ABILITY_KEYS) {
					const runtime = getOtherAbilityRuntime(abilityKey);
					if (!runtime) continue;
					runtime.manualOverrideValue = null;
					runtime.modifierOffsetFromScore = null;
					runtime.scoreManualOverrideValue = null;
					runtime.inlineEditing = false;
					runtime.scoreInlineEditing = false;
					runtime.adjustArmed = false;
					runtime.suppressNextClick = false;
				}
				renderPlayerInfoContent(true);
				applyProfNodeVisualState();
				return;
			}

			const originalProfValue = canRevertProf ? Math.trunc(profProfile.originalBonus) : null;
			const originalInitValue = canRevertInit ? Math.trunc(initProfile.originalValue) : null;
			const originalStrValue = canRevertStr ? Math.trunc(strProfile.originalModifier) : null;
			const originalStrScoreValue = canRevertStrScore ? Math.trunc(strProfile.originalScore) : null;
			const originalDexValue = canRevertDex ? Math.trunc(dexProfile.originalModifier) : null;
			const originalDexScoreValue = canRevertDexScore ? Math.trunc(dexProfile.originalScore) : null;
			if (!activeCharacterData.combat || typeof activeCharacterData.combat !== 'object') {
				activeCharacterData.combat = {};
			}

			if (canRevertProf) {
				activeCharacterData.combat.proficiencyBonus = originalProfValue;
				activeCharacterData.combat.profBonus = originalProfValue;
				delete activeCharacterData.combat.proficiencyBonusCommitted;
				delete activeCharacterData.combat.proficiencyBonusOverride;
			}

			if (canRevertInit) {
				activeCharacterData.combat.initiative = originalInitValue;
				activeCharacterData.combat.init = originalInitValue;
				delete activeCharacterData.combat.initiativeCommitted;
				delete activeCharacterData.combat.initiativeOverride;
			}

			if (activeCharacterData.playerSheetOverrides && typeof activeCharacterData.playerSheetOverrides === 'object') {
				if (shouldResetProf) {
					delete activeCharacterData.playerSheetOverrides.proficiencyBonus;
				}
				if (shouldResetInit) {
					delete activeCharacterData.playerSheetOverrides.initiative;
				}
				if (shouldResetStrModifier) {
					delete activeCharacterData.playerSheetOverrides.strengthModifier;
				}
				if (shouldResetStrScore) {
					delete activeCharacterData.playerSheetOverrides.strengthScore;
				}
				if (shouldResetDexModifier) {
					delete activeCharacterData.playerSheetOverrides.dexterityModifier;
				}
				if (shouldResetDexScore) {
					delete activeCharacterData.playerSheetOverrides.dexterityScore;
				}
				for (const abilityKey of PLAYER_INFO_OTHER_ABILITY_KEYS) {
					const state = otherRevertState[abilityKey];
					if (!state) continue;
					if (state.shouldResetModifier) {
						delete activeCharacterData.playerSheetOverrides[state.modifierField];
					}
					if (state.shouldResetScore) {
						delete activeCharacterData.playerSheetOverrides[state.scoreField];
					}
				}
			}

			if (shouldResetStrModifier || shouldResetStrScore) {
				const abilityMap = extractAbilityMap(activeCharacterData);
				const strengthEntry = abilityMap && typeof abilityMap === 'object'
					? (abilityMap.strength ?? abilityMap.STR)
					: null;
				if (strengthEntry && typeof strengthEntry === 'object') {
					if (canRevertStrScore) {
						strengthEntry.score = originalStrScoreValue;
					}
					if (shouldResetStrScore) {
						delete strengthEntry.scoreCommitted;
						delete strengthEntry.scoreOverride;
					}

					const snapshotOriginalModifier = Number.isFinite(strProfile?.originalModifier)
						? Math.trunc(strProfile.originalModifier)
						: (Number.isFinite(originalStrValue) ? originalStrValue : null);
					if (canRevertStr || canRevertStrScore) {
						if (Number.isFinite(snapshotOriginalModifier)) {
							strengthEntry.modifier = snapshotOriginalModifier;
						} else if (canRevertStrScore) {
							const derivedOriginalModifier = getAbilityModifierFromScore(originalStrScoreValue);
							if (Number.isFinite(derivedOriginalModifier)) {
								strengthEntry.modifier = Math.trunc(derivedOriginalModifier);
							}
						}
					}
					if (shouldResetStrModifier) {
						delete strengthEntry.modifierCommitted;
						delete strengthEntry.modifierOverride;
					}
				}
			}

			if (shouldResetDexModifier || shouldResetDexScore) {
				const abilityMap = extractAbilityMap(activeCharacterData);
				const dexterityEntry = abilityMap && typeof abilityMap === 'object'
					? (abilityMap.dexterity ?? abilityMap.DEX)
					: null;
				if (dexterityEntry && typeof dexterityEntry === 'object') {
					if (canRevertDexScore) {
						dexterityEntry.score = originalDexScoreValue;
					}
					if (shouldResetDexScore) {
						delete dexterityEntry.scoreCommitted;
						delete dexterityEntry.scoreOverride;
					}

					const snapshotOriginalModifier = Number.isFinite(dexProfile?.originalModifier)
						? Math.trunc(dexProfile.originalModifier)
						: (Number.isFinite(originalDexValue) ? originalDexValue : null);
					if (canRevertDex || canRevertDexScore) {
						if (Number.isFinite(snapshotOriginalModifier)) {
							dexterityEntry.modifier = snapshotOriginalModifier;
						} else if (canRevertDexScore) {
							const derivedOriginalModifier = getAbilityModifierFromScore(originalDexScoreValue);
							if (Number.isFinite(derivedOriginalModifier)) {
								dexterityEntry.modifier = Math.trunc(derivedOriginalModifier);
							}
						}
					}
					if (shouldResetDexModifier) {
						delete dexterityEntry.modifierCommitted;
						delete dexterityEntry.modifierOverride;
					}
				}
			}

			for (const abilityKey of PLAYER_INFO_OTHER_ABILITY_KEYS) {
				const state = otherRevertState[abilityKey];
				if (!state || (!state.shouldResetModifier && !state.shouldResetScore)) continue;
				const shortKey = getAbilityShortKey(abilityKey).toUpperCase();
				const abilityMap = extractAbilityMap(activeCharacterData);
				const abilityEntry = abilityMap && typeof abilityMap === 'object'
					? (abilityMap[abilityKey] ?? abilityMap[shortKey])
					: null;
				if (!abilityEntry || typeof abilityEntry !== 'object') continue;

				if (state.canRevertScore) {
					abilityEntry.score = state.originalScoreValue;
				}
				if (state.shouldResetScore) {
					delete abilityEntry.scoreCommitted;
					delete abilityEntry.scoreOverride;
				}

				const snapshotOriginalModifier = Number.isFinite(state?.profile?.originalModifier)
					? Math.trunc(state.profile.originalModifier)
					: (Number.isFinite(state.originalModifierValue) ? state.originalModifierValue : null);
				if (state.canRevertModifier || state.canRevertScore) {
					if (Number.isFinite(snapshotOriginalModifier)) {
						abilityEntry.modifier = snapshotOriginalModifier;
					} else if (state.canRevertScore) {
						const derivedOriginalModifier = getAbilityModifierFromScore(state.originalScoreValue);
						if (Number.isFinite(derivedOriginalModifier)) {
							abilityEntry.modifier = Math.trunc(derivedOriginalModifier);
						}
					}
				}
				if (state.shouldResetModifier) {
					delete abilityEntry.modifierCommitted;
					delete abilityEntry.modifierOverride;
				}
			}

			syncAbilityMapMirrors(activeCharacterData);

			if (window.characterLoader && typeof window.characterLoader.setCharacterData === 'function') {
				window.characterLoader.setCharacterData(activeCharacterData, 'player-info:revert');
			} else if (window.characterLoader) {
				window.characterLoader.characterData = activeCharacterData;
			}

			if (window.characterLoader && typeof window.characterLoader.applyToFlowchart === 'function') {
				window.characterLoader.applyToFlowchart();
			}

			persistCommittedCharacterData(activeCharacterData);
			logStrDebug('revert:persisted', {
				characterName: activeCharacterData?.character?.name || '',
				overrides: activeCharacterData?.playerSheetOverrides || null,
				originals: activeCharacterData?.playerSheetOriginals || null,
				strength: extractAbilityMap(activeCharacterData)?.strength ?? extractAbilityMap(activeCharacterData)?.STR ?? null
			});
			logStrInteraction('revert:after-persist', {
				canRevertProf,
				canRevertInit,
				canRevertStr,
				canRevertStrScore,
				canRevertDex,
				canRevertDexScore,
				originalProfValue,
				originalInitValue,
				originalStrValue,
				originalStrScoreValue,
				originalDexValue,
				originalDexScoreValue
			});
			profManualOverrideValue = null;
			initManualOverrideValue = null;
			strManualOverrideValue = null;
			strModifierOffsetFromScore = null;
			strScoreManualOverrideValue = null;
			dexManualOverrideValue = null;
			dexModifierOffsetFromScore = null;
			dexScoreManualOverrideValue = null;
			for (const abilityKey of PLAYER_INFO_OTHER_ABILITY_KEYS) {
				const runtime = getOtherAbilityRuntime(abilityKey);
				if (!runtime) continue;
				runtime.manualOverrideValue = null;
				runtime.modifierOffsetFromScore = null;
				runtime.scoreManualOverrideValue = null;
				runtime.inlineEditing = false;
				runtime.scoreInlineEditing = false;
				runtime.adjustArmed = false;
				runtime.suppressNextClick = false;
			}
			endOtherAbilityInlineEdit(false);
			endOtherAbilityScoreInlineEdit(false);
			endOtherAbilityAdjustSession();
			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
			window.dispatchEvent(new CustomEvent('player-info:reverted', {
				detail: {
					proficiencyBonus: canRevertProf ? originalProfValue : null,
						initiative: canRevertInit ? originalInitValue : null,
					strengthModifier: canRevertStr ? originalStrValue : null,
					strengthScore: canRevertStrScore ? originalStrScoreValue : null,
					dexterityModifier: canRevertDex ? originalDexValue : null,
					dexterityScore: canRevertDexScore ? originalDexScoreValue : null,
					constitutionModifier: otherRevertState?.constitution?.canRevertModifier ? otherRevertState.constitution.originalModifierValue : null,
					constitutionScore: otherRevertState?.constitution?.canRevertScore ? otherRevertState.constitution.originalScoreValue : null,
					intelligenceModifier: otherRevertState?.intelligence?.canRevertModifier ? otherRevertState.intelligence.originalModifierValue : null,
					intelligenceScore: otherRevertState?.intelligence?.canRevertScore ? otherRevertState.intelligence.originalScoreValue : null,
					wisdomModifier: otherRevertState?.wisdom?.canRevertModifier ? otherRevertState.wisdom.originalModifierValue : null,
					wisdomScore: otherRevertState?.wisdom?.canRevertScore ? otherRevertState.wisdom.originalScoreValue : null,
					charismaModifier: otherRevertState?.charisma?.canRevertModifier ? otherRevertState.charisma.originalModifierValue : null,
					charismaScore: otherRevertState?.charisma?.canRevertScore ? otherRevertState.charisma.originalScoreValue : null,
					characterName: activeCharacterData?.character?.name || ''
				}
			}));
		}

		function clearProfHoldTimer() {
			if (!profAdjustHoldTimer) return;
			window.clearTimeout(profAdjustHoldTimer);
			profAdjustHoldTimer = null;
		}

		function setProfAdjustArmed(nextValue) {
			profAdjustArmed = !!nextValue;
			applyProfNodeVisualState();
		}

		function endProfAdjustSession() {
			clearProfHoldTimer();
			profAdjustPointerId = null;
			profAdjustLastClientY = null;
			profPressStartClientX = null;
			profPressStartClientY = null;
			profPressMoved = false;
			setProfAdjustArmed(false);
		}

		function stepProfAdjustValue(stepDelta) {
			if (!isPlayerSheetEditMode) return;
			const parsedStep = Number(stepDelta);
			if (!Number.isFinite(parsedStep) || parsedStep === 0) return;
			const baseValue = Number.isFinite(profDefaultValue) ? Math.trunc(profDefaultValue) : 0;
			const currentValue = Number.isFinite(profManualOverrideValue)
				? Math.trunc(profManualOverrideValue)
				: baseValue;
			const nextValue = Math.max(
				PLAYER_INFO_PROF_MIN,
				Math.min(PLAYER_INFO_PROF_MAX, currentValue + Math.trunc(parsedStep))
			);
			profManualOverrideValue = (nextValue === baseValue) ? null : nextValue;
			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function endProfInlineEdit(commitValue = true) {
			if (!profInlineEditing || !profInlineInputEl) return;
			const rawInputValue = profInlineInputEl.value;
			profInlineEditing = false;
			profInlineInputEl = null;

			if (commitValue) {
				const parsedValue = parseProfInputValue(rawInputValue);
				if (Number.isFinite(parsedValue)) {
					const clampedValue = Math.max(PLAYER_INFO_PROF_MIN, Math.min(PLAYER_INFO_PROF_MAX, parsedValue));
					const baseValue = Number.isFinite(profDefaultValue) ? Math.trunc(profDefaultValue) : 0;
					profManualOverrideValue = clampedValue === baseValue ? null : clampedValue;
				}
			}

			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function startProfInlineEdit() {
			if (!isPlayerSheetEditMode) return;
			if (profInlineEditing || profAdjustArmed || profAdjustPointerId !== null) return;
			const profNode = getProfAdjustNode();
			if (!profNode) return;
			const valueEl = profNode.querySelector('strong');
			if (!valueEl) return;

			const fallbackValue = Number.isFinite(profDefaultValue) ? Math.trunc(profDefaultValue) : 0;
			const currentValue = Number.isFinite(profManualOverrideValue)
				? Math.trunc(profManualOverrideValue)
				: fallbackValue;

			const nextInput = document.createElement('input');
			nextInput.type = 'text';
			nextInput.inputMode = 'numeric';
			nextInput.autocomplete = 'off';
			nextInput.spellcheck = false;
			nextInput.className = 'player-info-prof-input';
			nextInput.setAttribute('aria-label', 'Edit proficiency bonus');
			nextInput.value = formatSignedModifier(currentValue);

			valueEl.replaceWith(nextInput);
			profInlineEditing = true;
			profInlineInputEl = nextInput;
			applyProfNodeVisualState();

			nextInput.addEventListener('input', () => {
				if (!profInlineInputEl) return;
				const sanitized = sanitizeProfInputDraft(profInlineInputEl.value);
				if (profInlineInputEl.value !== sanitized) {
					profInlineInputEl.value = sanitized;
				}
			});

			nextInput.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') {
					endProfInlineEdit(true);
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				if (event.key === 'Escape') {
					endProfInlineEdit(false);
					event.preventDefault();
					event.stopPropagation();
				}
			});

			nextInput.addEventListener('blur', () => {
				endProfInlineEdit(true);
			});

			window.requestAnimationFrame(() => {
				if (!profInlineInputEl) return;
				profInlineInputEl.focus();
				profInlineInputEl.select();
			});
		}

		function resetProfAdjustToDefault() {
			if (!isPlayerSheetEditMode) return;
			endProfInlineEdit(false);
			profManualOverrideValue = null;
			endProfAdjustSession();
			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function clearInitHoldTimer() {
			if (!initAdjustHoldTimer) return;
			window.clearTimeout(initAdjustHoldTimer);
			initAdjustHoldTimer = null;
		}

		function setInitAdjustArmed(nextValue) {
			initAdjustArmed = !!nextValue;
			applyProfNodeVisualState();
		}

		function endInitAdjustSession() {
			clearInitHoldTimer();
			initAdjustPointerId = null;
			initAdjustLastClientY = null;
			initPressStartClientX = null;
			initPressStartClientY = null;
			initPressMoved = false;
			setInitAdjustArmed(false);
		}

		function stepInitAdjustValue(stepDelta) {
			if (!isPlayerSheetEditMode) return;
			const parsedStep = Number(stepDelta);
			if (!Number.isFinite(parsedStep) || parsedStep === 0) return;
			const baseValue = Number.isFinite(initDefaultValue) ? Math.trunc(initDefaultValue) : 0;
			const currentValue = Number.isFinite(initManualOverrideValue)
				? Math.trunc(initManualOverrideValue)
				: baseValue;
			const nextValue = Math.max(
				PLAYER_INFO_INIT_MIN,
				Math.min(PLAYER_INFO_INIT_MAX, currentValue + Math.trunc(parsedStep))
			);
			initManualOverrideValue = (nextValue === baseValue) ? null : nextValue;
			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function endInitInlineEdit(commitValue = true) {
			if (!initInlineEditing || !initInlineInputEl) return;
			const rawInputValue = initInlineInputEl.value;
			initInlineEditing = false;
			initInlineInputEl = null;

			if (commitValue) {
				const parsedValue = parseProfInputValue(rawInputValue);
				if (Number.isFinite(parsedValue)) {
					const clampedValue = Math.max(PLAYER_INFO_INIT_MIN, Math.min(PLAYER_INFO_INIT_MAX, parsedValue));
					const baseValue = Number.isFinite(initDefaultValue) ? Math.trunc(initDefaultValue) : 0;
					initManualOverrideValue = clampedValue === baseValue ? null : clampedValue;
				}
			}

			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function startInitInlineEdit() {
			if (!isPlayerSheetEditMode) return;
			if (initInlineEditing || initAdjustArmed || initAdjustPointerId !== null) return;
			const initNode = getInitAdjustNode();
			if (!initNode) return;
			const valueEl = initNode.querySelector('strong');
			if (!valueEl) return;

			const fallbackValue = Number.isFinite(initDefaultValue) ? Math.trunc(initDefaultValue) : 0;
			const currentValue = Number.isFinite(initManualOverrideValue)
				? Math.trunc(initManualOverrideValue)
				: fallbackValue;

			const nextInput = document.createElement('input');
			nextInput.type = 'text';
			nextInput.inputMode = 'numeric';
			nextInput.autocomplete = 'off';
			nextInput.spellcheck = false;
			nextInput.className = 'player-info-init-input';
			nextInput.setAttribute('aria-label', 'Edit initiative');
			nextInput.value = formatSignedModifier(currentValue);

			valueEl.replaceWith(nextInput);
			initInlineEditing = true;
			initInlineInputEl = nextInput;
			applyProfNodeVisualState();

			nextInput.addEventListener('input', () => {
				if (!initInlineInputEl) return;
				const sanitized = sanitizeProfInputDraft(initInlineInputEl.value);
				if (initInlineInputEl.value !== sanitized) {
					initInlineInputEl.value = sanitized;
				}
			});

			nextInput.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') {
					endInitInlineEdit(true);
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				if (event.key === 'Escape') {
					endInitInlineEdit(false);
					event.preventDefault();
					event.stopPropagation();
				}
			});

			nextInput.addEventListener('blur', () => {
				endInitInlineEdit(true);
			});

			window.requestAnimationFrame(() => {
				if (!initInlineInputEl) return;
				initInlineInputEl.focus();
				initInlineInputEl.select();
			});
		}

		function resetInitAdjustToDefault() {
			if (!isPlayerSheetEditMode) return;
			endInitInlineEdit(false);
			initManualOverrideValue = null;
			endInitAdjustSession();
			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function clearStrHoldTimer() {
			if (!strAdjustHoldTimer) return;
			window.clearTimeout(strAdjustHoldTimer);
			strAdjustHoldTimer = null;
		}

		function setStrAdjustArmed(nextValue) {
			strAdjustArmed = !!nextValue;
			applyProfNodeVisualState();
		}

		function endStrAdjustSession() {
			clearStrHoldTimer();
			strAdjustPointerId = null;
			strAdjustLastClientY = null;
			strPressStartClientX = null;
			strPressStartClientY = null;
			strPressMoved = false;
			setStrAdjustArmed(false);
		}

		function stepStrAdjustValue(stepDelta) {
			logStrInteraction('str-mod-step:entry', { stepDelta });
			if (!isPlayerSheetEditMode) return;
			const parsedStep = Number(stepDelta);
			if (!Number.isFinite(parsedStep) || parsedStep === 0) return;
			const baseValue = Number.isFinite(strDefaultValue) ? Math.trunc(strDefaultValue) : 0;
			const currentValue = Number.isFinite(strManualOverrideValue)
				? Math.trunc(strManualOverrideValue)
				: baseValue;
			const nextValue = Math.max(
				PLAYER_INFO_STR_MIN,
				Math.min(PLAYER_INFO_STR_MAX, currentValue + Math.trunc(parsedStep))
			);
			strManualOverrideValue = (nextValue === baseValue) ? null : nextValue;
			if (Number.isFinite(strManualOverrideValue)) {
				applyStrModifierOffsetFromCurrentScore(strManualOverrideValue);
			} else {
				strModifierOffsetFromScore = null;
			}
			logStrDebug('stepStrAdjustValue', {
				stepDelta: Math.trunc(parsedStep),
				baseValue,
				currentValue,
				nextValue,
				strManualOverrideValue,
				strModifierOffsetFromScore
			});
			logStrInteraction('str-mod-step:applied', {
				stepDelta: Math.trunc(parsedStep),
				nextValue,
				strManualOverrideValue
			});
			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function endStrInlineEdit(commitValue = true) {
			logStrInteraction('str-mod-inline:end:entry', {
				commitValue,
				rawInputValue: strInlineInputEl?.value ?? null
			});
			if (!strInlineEditing || !strInlineInputEl) return;
			const rawInputValue = strInlineInputEl.value;
			strInlineEditing = false;
			strInlineInputEl = null;

			if (commitValue) {
				const parsedValue = parseProfInputValue(rawInputValue);
				logStrInteraction('str-mod-inline:end:parsed', {
					rawInputValue,
					parsedValue
				});
				if (Number.isFinite(parsedValue)) {
					const clampedValue = Math.max(PLAYER_INFO_STR_MIN, Math.min(PLAYER_INFO_STR_MAX, parsedValue));
					const baseValue = Number.isFinite(strDefaultValue) ? Math.trunc(strDefaultValue) : 0;
					strManualOverrideValue = clampedValue === baseValue ? null : clampedValue;
					if (Number.isFinite(strManualOverrideValue)) {
						applyStrModifierOffsetFromCurrentScore(strManualOverrideValue);
					} else {
						strModifierOffsetFromScore = null;
					}
				}
			}
			logStrInteraction('str-mod-inline:end:applied', {
				commitValue,
				rawInputValue
			});

			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function endStrScoreInlineEdit(commitValue = true) {
			logStrInteraction('str-score-inline:end:entry', {
				commitValue,
				rawInputValue: strScoreInlineInputEl?.value ?? null
			});
			if (!strScoreInlineEditing || !strScoreInlineInputEl) return;
			const rawInputValue = strScoreInlineInputEl.value;
			strScoreInlineEditing = false;
			strScoreInlineInputEl = null;

			if (commitValue) {
				const previousEffectiveScoreValue = getEffectiveStrScoreValueForEdits();
				const previousScoreDerivedModifier = getAbilityModifierFromScore(previousEffectiveScoreValue);
				if (!Number.isFinite(strModifierOffsetFromScore) && Number.isFinite(previousScoreDerivedModifier)) {
					const currentEffectiveModifier = Number.isFinite(strManualOverrideValue)
						? Math.trunc(strManualOverrideValue)
						: (Number.isFinite(strDefaultValue) ? Math.trunc(strDefaultValue) : null);
					if (Number.isFinite(currentEffectiveModifier)) {
						strModifierOffsetFromScore = Math.trunc(currentEffectiveModifier) - Math.trunc(previousScoreDerivedModifier);
					}
				}
				const parsedValue = parseScoreInputValue(rawInputValue);
				logStrInteraction('str-score-inline:end:parsed', {
					rawInputValue,
					parsedValue
				});
				if (Number.isFinite(parsedValue)) {
					const clampedValue = Math.max(PLAYER_INFO_STR_SCORE_MIN, Math.min(PLAYER_INFO_STR_SCORE_MAX, parsedValue));
					const baseValue = Number.isFinite(strScoreDefaultValue) ? Math.trunc(strScoreDefaultValue) : 10;
					strScoreManualOverrideValue = clampedValue === baseValue ? null : clampedValue;
					const nextEffectiveScoreValue = Number.isFinite(strScoreManualOverrideValue)
						? Math.trunc(strScoreManualOverrideValue)
						: baseValue;
					const nextScoreDerivedModifier = getAbilityModifierFromScore(nextEffectiveScoreValue);

					if (Number.isFinite(strModifierOffsetFromScore) && Number.isFinite(nextScoreDerivedModifier)) {
						strManualOverrideValue = Math.max(
							PLAYER_INFO_STR_MIN,
							Math.min(PLAYER_INFO_STR_MAX, Math.trunc(nextScoreDerivedModifier + Math.trunc(strModifierOffsetFromScore)))
						);
					} else if (
						Number.isFinite(strManualOverrideValue)
						&& Number.isFinite(previousScoreDerivedModifier)
						&& Number.isFinite(nextScoreDerivedModifier)
					) {
						const scoreModifierDelta = Math.trunc(nextScoreDerivedModifier) - Math.trunc(previousScoreDerivedModifier);
						strManualOverrideValue = Math.max(
							PLAYER_INFO_STR_MIN,
							Math.min(PLAYER_INFO_STR_MAX, Math.trunc(strManualOverrideValue + scoreModifierDelta))
						);
						applyStrModifierOffsetFromCurrentScore(strManualOverrideValue);
					}
				}
			}
			logStrInteraction('str-score-inline:end:applied', {
				commitValue,
				rawInputValue
			});

			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function startStrInlineEdit() {
			logStrInteraction('str-mod-inline:start:requested');
			if (!isPlayerSheetEditMode) return;
			if (strInlineEditing || strScoreInlineEditing || strAdjustArmed || strAdjustPointerId !== null) return;
			const strNode = getStrAdjustNode();
			if (!strNode) return;
			const valueEl = strNode.querySelector('.player-info-ability-value');
			if (!valueEl) return;

			const fallbackValue = Number.isFinite(strDefaultValue) ? Math.trunc(strDefaultValue) : 0;
			const currentValue = Number.isFinite(strManualOverrideValue)
				? Math.trunc(strManualOverrideValue)
				: fallbackValue;

			const nextInput = document.createElement('input');
			nextInput.type = 'text';
			nextInput.inputMode = 'numeric';
			nextInput.autocomplete = 'off';
			nextInput.spellcheck = false;
			nextInput.className = 'player-info-str-input';
			nextInput.setAttribute('aria-label', 'Edit strength modifier');
			nextInput.value = formatSignedModifier(currentValue);

			valueEl.replaceWith(nextInput);
			strInlineEditing = true;
			strInlineInputEl = nextInput;
			logStrInteraction('str-mod-inline:start:applied', {
				currentValue
			});
			applyProfNodeVisualState();

			nextInput.addEventListener('input', () => {
				if (!strInlineInputEl) return;
				const beforeSanitize = strInlineInputEl.value;
				const sanitized = sanitizeProfInputDraft(strInlineInputEl.value);
				if (strInlineInputEl.value !== sanitized) {
					strInlineInputEl.value = sanitized;
				}
				logStrInteraction('str-mod-inline:input', {
					beforeSanitize,
					afterSanitize: sanitized
				});
			});

			nextInput.addEventListener('keydown', (event) => {
				logStrInteraction('str-mod-inline:keydown', {
					key: event.key,
					value: strInlineInputEl?.value ?? null
				}, event);
				if (event.key === 'Enter') {
					endStrInlineEdit(true);
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				if (event.key === 'Escape') {
					endStrInlineEdit(false);
					event.preventDefault();
					event.stopPropagation();
				}
			});

			nextInput.addEventListener('blur', () => {
				endStrInlineEdit(true);
			});

			window.requestAnimationFrame(() => {
				if (!strInlineInputEl) return;
				strInlineInputEl.focus();
				strInlineInputEl.select();
			});
		}

		function startStrScoreInlineEdit() {
			logStrInteraction('str-score-inline:start:requested');
			if (!isPlayerSheetEditMode) return;
			if (strInlineEditing || strScoreInlineEditing || strAdjustArmed || strAdjustPointerId !== null) return;
			const strNode = getStrAdjustNode();
			if (!strNode) return;
			const valueEl = strNode.querySelector('.player-info-ability-score');
			if (!valueEl) return;

			const fallbackValue = Number.isFinite(strScoreDefaultValue) ? Math.trunc(strScoreDefaultValue) : 10;
			const currentValue = Number.isFinite(strScoreManualOverrideValue)
				? Math.trunc(strScoreManualOverrideValue)
				: fallbackValue;

			const nextInput = document.createElement('input');
			nextInput.type = 'text';
			nextInput.inputMode = 'numeric';
			nextInput.autocomplete = 'off';
			nextInput.spellcheck = false;
			nextInput.className = 'player-info-str-score-input';
			nextInput.setAttribute('aria-label', 'Edit strength score');
			nextInput.value = String(currentValue);

			valueEl.replaceWith(nextInput);
			strScoreInlineEditing = true;
			strScoreInlineInputEl = nextInput;
			logStrInteraction('str-score-inline:start:applied', {
				currentValue
			});
			applyProfNodeVisualState();

			nextInput.addEventListener('input', () => {
				if (!strScoreInlineInputEl) return;
				const beforeSanitize = strScoreInlineInputEl.value;
				const sanitized = sanitizeScoreInputDraft(strScoreInlineInputEl.value);
				if (strScoreInlineInputEl.value !== sanitized) {
					strScoreInlineInputEl.value = sanitized;
				}
				logStrInteraction('str-score-inline:input', {
					beforeSanitize,
					afterSanitize: sanitized
				});
			});

			nextInput.addEventListener('keydown', (event) => {
				logStrInteraction('str-score-inline:keydown', {
					key: event.key,
					value: strScoreInlineInputEl?.value ?? null
				}, event);
				if (event.key === 'Enter') {
					endStrScoreInlineEdit(true);
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				if (event.key === 'Escape') {
					endStrScoreInlineEdit(false);
					event.preventDefault();
					event.stopPropagation();
				}
			});

			nextInput.addEventListener('blur', () => {
				endStrScoreInlineEdit(true);
			});

			window.requestAnimationFrame(() => {
				if (!strScoreInlineInputEl) return;
				strScoreInlineInputEl.focus();
				strScoreInlineInputEl.select();
			});
		}

		function resetStrAdjustToDefault() {
			if (!isPlayerSheetEditMode) return;
			endStrInlineEdit(false);
			endStrScoreInlineEdit(false);
			strManualOverrideValue = null;
			strModifierOffsetFromScore = null;
			strScoreManualOverrideValue = null;
			endStrAdjustSession();
			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function clearDexHoldTimer() {
			if (!dexAdjustHoldTimer) return;
			window.clearTimeout(dexAdjustHoldTimer);
			dexAdjustHoldTimer = null;
		}

		function setDexAdjustArmed(nextValue) {
			dexAdjustArmed = !!nextValue;
			applyProfNodeVisualState();
		}

		function endDexAdjustSession() {
			clearDexHoldTimer();
			dexAdjustPointerId = null;
			dexAdjustLastClientY = null;
			dexPressStartClientX = null;
			dexPressStartClientY = null;
			dexPressMoved = false;
			setDexAdjustArmed(false);
		}

		function stepDexAdjustValue(stepDelta) {
			if (!isPlayerSheetEditMode) return;
			const parsedStep = Number(stepDelta);
			if (!Number.isFinite(parsedStep) || parsedStep === 0) return;
			const baseValue = Number.isFinite(dexDefaultValue) ? Math.trunc(dexDefaultValue) : 0;
			const currentValue = Number.isFinite(dexManualOverrideValue)
				? Math.trunc(dexManualOverrideValue)
				: baseValue;
			const nextValue = Math.max(
				PLAYER_INFO_DEX_MIN,
				Math.min(PLAYER_INFO_DEX_MAX, currentValue + Math.trunc(parsedStep))
			);
			dexManualOverrideValue = (nextValue === baseValue) ? null : nextValue;
			if (Number.isFinite(dexManualOverrideValue)) {
				applyDexModifierOffsetFromCurrentScore(dexManualOverrideValue);
			} else {
				dexModifierOffsetFromScore = null;
			}
			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function endDexInlineEdit(commitValue = true) {
			if (!dexInlineEditing || !dexInlineInputEl) return;
			const rawInputValue = dexInlineInputEl.value;
			dexInlineEditing = false;
			dexInlineInputEl = null;

			if (commitValue) {
				const parsedValue = parseProfInputValue(rawInputValue);
				if (Number.isFinite(parsedValue)) {
					const clampedValue = Math.max(PLAYER_INFO_DEX_MIN, Math.min(PLAYER_INFO_DEX_MAX, parsedValue));
					const baseValue = Number.isFinite(dexDefaultValue) ? Math.trunc(dexDefaultValue) : 0;
					dexManualOverrideValue = clampedValue === baseValue ? null : clampedValue;
					if (Number.isFinite(dexManualOverrideValue)) {
						applyDexModifierOffsetFromCurrentScore(dexManualOverrideValue);
					} else {
						dexModifierOffsetFromScore = null;
					}
				}
			}

			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function endDexScoreInlineEdit(commitValue = true) {
			if (!dexScoreInlineEditing || !dexScoreInlineInputEl) return;
			const rawInputValue = dexScoreInlineInputEl.value;
			dexScoreInlineEditing = false;
			dexScoreInlineInputEl = null;

			if (commitValue) {
				const previousEffectiveScoreValue = getEffectiveDexScoreValueForEdits();
				const previousScoreDerivedModifier = getAbilityModifierFromScore(previousEffectiveScoreValue);
				if (!Number.isFinite(dexModifierOffsetFromScore) && Number.isFinite(previousScoreDerivedModifier)) {
					const currentEffectiveModifier = Number.isFinite(dexManualOverrideValue)
						? Math.trunc(dexManualOverrideValue)
						: (Number.isFinite(dexDefaultValue) ? Math.trunc(dexDefaultValue) : null);
					if (Number.isFinite(currentEffectiveModifier)) {
						dexModifierOffsetFromScore = Math.trunc(currentEffectiveModifier) - Math.trunc(previousScoreDerivedModifier);
					}
				}
				const parsedValue = parseScoreInputValue(rawInputValue);
				if (Number.isFinite(parsedValue)) {
					const clampedValue = Math.max(PLAYER_INFO_DEX_SCORE_MIN, Math.min(PLAYER_INFO_DEX_SCORE_MAX, parsedValue));
					const baseValue = Number.isFinite(dexScoreDefaultValue) ? Math.trunc(dexScoreDefaultValue) : 10;
					dexScoreManualOverrideValue = clampedValue === baseValue ? null : clampedValue;
					const nextEffectiveScoreValue = Number.isFinite(dexScoreManualOverrideValue)
						? Math.trunc(dexScoreManualOverrideValue)
						: baseValue;
					const nextScoreDerivedModifier = getAbilityModifierFromScore(nextEffectiveScoreValue);

					if (Number.isFinite(dexModifierOffsetFromScore) && Number.isFinite(nextScoreDerivedModifier)) {
						dexManualOverrideValue = Math.max(
							PLAYER_INFO_DEX_MIN,
							Math.min(PLAYER_INFO_DEX_MAX, Math.trunc(nextScoreDerivedModifier + Math.trunc(dexModifierOffsetFromScore)))
						);
					} else if (
						Number.isFinite(dexManualOverrideValue)
						&& Number.isFinite(previousScoreDerivedModifier)
						&& Number.isFinite(nextScoreDerivedModifier)
					) {
						const scoreModifierDelta = Math.trunc(nextScoreDerivedModifier) - Math.trunc(previousScoreDerivedModifier);
						dexManualOverrideValue = Math.max(
							PLAYER_INFO_DEX_MIN,
							Math.min(PLAYER_INFO_DEX_MAX, Math.trunc(dexManualOverrideValue + scoreModifierDelta))
						);
						applyDexModifierOffsetFromCurrentScore(dexManualOverrideValue);
					}
				}
			}

			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function startDexInlineEdit() {
			if (!isPlayerSheetEditMode) return;
			if (dexInlineEditing || dexScoreInlineEditing || dexAdjustArmed || dexAdjustPointerId !== null) return;
			const dexNode = getDexAdjustNode();
			if (!dexNode) return;
			const valueEl = dexNode.querySelector('.player-info-ability-value');
			if (!valueEl) return;

			const fallbackValue = Number.isFinite(dexDefaultValue) ? Math.trunc(dexDefaultValue) : 0;
			const currentValue = Number.isFinite(dexManualOverrideValue)
				? Math.trunc(dexManualOverrideValue)
				: fallbackValue;

			const nextInput = document.createElement('input');
			nextInput.type = 'text';
			nextInput.inputMode = 'numeric';
			nextInput.autocomplete = 'off';
			nextInput.spellcheck = false;
			nextInput.className = 'player-info-dex-input';
			nextInput.setAttribute('aria-label', 'Edit dexterity modifier');
			nextInput.value = formatSignedModifier(currentValue);

			valueEl.replaceWith(nextInput);
			dexInlineEditing = true;
			dexInlineInputEl = nextInput;
			applyProfNodeVisualState();

			nextInput.addEventListener('input', () => {
				if (!dexInlineInputEl) return;
				const sanitized = sanitizeProfInputDraft(dexInlineInputEl.value);
				if (dexInlineInputEl.value !== sanitized) {
					dexInlineInputEl.value = sanitized;
				}
			});

			nextInput.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') {
					endDexInlineEdit(true);
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				if (event.key === 'Escape') {
					endDexInlineEdit(false);
					event.preventDefault();
					event.stopPropagation();
				}
			});

			nextInput.addEventListener('blur', () => {
				endDexInlineEdit(true);
			});

			window.requestAnimationFrame(() => {
				if (!dexInlineInputEl) return;
				dexInlineInputEl.focus();
				dexInlineInputEl.select();
			});
		}

		function startDexScoreInlineEdit() {
			if (!isPlayerSheetEditMode) return;
			if (dexInlineEditing || dexScoreInlineEditing || dexAdjustArmed || dexAdjustPointerId !== null) return;
			const dexNode = getDexAdjustNode();
			if (!dexNode) return;
			const valueEl = dexNode.querySelector('.player-info-ability-score');
			if (!valueEl) return;

			const fallbackValue = Number.isFinite(dexScoreDefaultValue) ? Math.trunc(dexScoreDefaultValue) : 10;
			const currentValue = Number.isFinite(dexScoreManualOverrideValue)
				? Math.trunc(dexScoreManualOverrideValue)
				: fallbackValue;

			const nextInput = document.createElement('input');
			nextInput.type = 'text';
			nextInput.inputMode = 'numeric';
			nextInput.autocomplete = 'off';
			nextInput.spellcheck = false;
			nextInput.className = 'player-info-dex-score-input';
			nextInput.setAttribute('aria-label', 'Edit dexterity score');
			nextInput.value = String(currentValue);

			valueEl.replaceWith(nextInput);
			dexScoreInlineEditing = true;
			dexScoreInlineInputEl = nextInput;
			applyProfNodeVisualState();

			nextInput.addEventListener('input', () => {
				if (!dexScoreInlineInputEl) return;
				const sanitized = sanitizeScoreInputDraft(dexScoreInlineInputEl.value);
				if (dexScoreInlineInputEl.value !== sanitized) {
					dexScoreInlineInputEl.value = sanitized;
				}
			});

			nextInput.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') {
					endDexScoreInlineEdit(true);
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				if (event.key === 'Escape') {
					endDexScoreInlineEdit(false);
					event.preventDefault();
					event.stopPropagation();
				}
			});

			nextInput.addEventListener('blur', () => {
				endDexScoreInlineEdit(true);
			});

			window.requestAnimationFrame(() => {
				if (!dexScoreInlineInputEl) return;
				dexScoreInlineInputEl.focus();
				dexScoreInlineInputEl.select();
			});
		}

		function resetDexAdjustToDefault() {
			if (!isPlayerSheetEditMode) return;
			endDexInlineEdit(false);
			endDexScoreInlineEdit(false);
			dexManualOverrideValue = null;
			dexModifierOffsetFromScore = null;
			dexScoreManualOverrideValue = null;
			endDexAdjustSession();
			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function clearOtherAbilityHoldTimer() {
			if (!otherAdjustHoldTimer) return;
			window.clearTimeout(otherAdjustHoldTimer);
			otherAdjustHoldTimer = null;
		}

		function setOtherAbilityAdjustArmed(abilityKey, nextValue) {
			const runtime = getOtherAbilityRuntime(abilityKey);
			if (!runtime) return;
			runtime.adjustArmed = !!nextValue;
			applyProfNodeVisualState();
		}

		function endOtherAbilityAdjustSession() {
			clearOtherAbilityHoldTimer();
			if (otherAdjustAbilityKey) {
				setOtherAbilityAdjustArmed(otherAdjustAbilityKey, false);
			}
			otherAdjustAbilityKey = '';
			otherAdjustPointerId = null;
			otherAdjustLastClientY = null;
			otherPressStartClientX = null;
			otherPressStartClientY = null;
			otherPressMoved = false;
		}

		function stepOtherAbilityAdjustValue(abilityKey, stepDelta) {
			if (!isPlayerSheetEditMode) return;
			const runtime = getOtherAbilityRuntime(abilityKey);
			if (!runtime) return;
			const parsedStep = Number(stepDelta);
			if (!Number.isFinite(parsedStep) || parsedStep === 0) return;
			const baseValue = Number.isFinite(runtime.defaultValue) ? Math.trunc(runtime.defaultValue) : 0;
			const currentValue = Number.isFinite(runtime.manualOverrideValue)
				? Math.trunc(runtime.manualOverrideValue)
				: baseValue;
			const nextValue = Math.max(
				PLAYER_INFO_STD_ABILITY_MIN,
				Math.min(PLAYER_INFO_STD_ABILITY_MAX, currentValue + Math.trunc(parsedStep))
			);
			runtime.manualOverrideValue = (nextValue === baseValue) ? null : nextValue;
			if (Number.isFinite(runtime.manualOverrideValue)) {
				applyOtherAbilityModifierOffsetFromCurrentScore(abilityKey, runtime.manualOverrideValue);
			} else {
				runtime.modifierOffsetFromScore = null;
			}
			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function endOtherAbilityInlineEdit(commitValue = true) {
			if (!otherInlineAbilityKey || !otherInlineInputEl) return;
			const abilityKey = otherInlineAbilityKey;
			const runtime = getOtherAbilityRuntime(abilityKey);
			const rawInputValue = otherInlineInputEl.value;
			otherInlineAbilityKey = '';
			otherInlineInputEl = null;
			if (runtime) {
				runtime.inlineEditing = false;
				if (commitValue) {
					const parsedValue = parseProfInputValue(rawInputValue);
					if (Number.isFinite(parsedValue)) {
						const clampedValue = Math.max(PLAYER_INFO_STD_ABILITY_MIN, Math.min(PLAYER_INFO_STD_ABILITY_MAX, parsedValue));
						const baseValue = Number.isFinite(runtime.defaultValue) ? Math.trunc(runtime.defaultValue) : 0;
						runtime.manualOverrideValue = clampedValue === baseValue ? null : clampedValue;
						if (Number.isFinite(runtime.manualOverrideValue)) {
							applyOtherAbilityModifierOffsetFromCurrentScore(abilityKey, runtime.manualOverrideValue);
						} else {
							runtime.modifierOffsetFromScore = null;
						}
					}
				}
			}
			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function endOtherAbilityScoreInlineEdit(commitValue = true) {
			if (!otherScoreInlineAbilityKey || !otherScoreInlineInputEl) return;
			const abilityKey = otherScoreInlineAbilityKey;
			const runtime = getOtherAbilityRuntime(abilityKey);
			const rawInputValue = otherScoreInlineInputEl.value;
			otherScoreInlineAbilityKey = '';
			otherScoreInlineInputEl = null;
			if (runtime) {
				runtime.scoreInlineEditing = false;
				if (commitValue) {
					const previousEffectiveScoreValue = getEffectiveOtherAbilityScoreValueForEdits(abilityKey);
					const previousScoreDerivedModifier = getAbilityModifierFromScore(previousEffectiveScoreValue);
					if (!Number.isFinite(runtime.modifierOffsetFromScore) && Number.isFinite(previousScoreDerivedModifier)) {
						const currentEffectiveModifier = Number.isFinite(runtime.manualOverrideValue)
							? Math.trunc(runtime.manualOverrideValue)
							: (Number.isFinite(runtime.defaultValue) ? Math.trunc(runtime.defaultValue) : null);
						if (Number.isFinite(currentEffectiveModifier)) {
							runtime.modifierOffsetFromScore = Math.trunc(currentEffectiveModifier) - Math.trunc(previousScoreDerivedModifier);
						}
					}
					const parsedValue = parseScoreInputValue(rawInputValue);
					if (Number.isFinite(parsedValue)) {
						const clampedValue = Math.max(PLAYER_INFO_STD_ABILITY_SCORE_MIN, Math.min(PLAYER_INFO_STD_ABILITY_SCORE_MAX, parsedValue));
						const baseValue = Number.isFinite(runtime.scoreDefaultValue) ? Math.trunc(runtime.scoreDefaultValue) : 10;
						runtime.scoreManualOverrideValue = clampedValue === baseValue ? null : clampedValue;
						const nextEffectiveScoreValue = Number.isFinite(runtime.scoreManualOverrideValue)
							? Math.trunc(runtime.scoreManualOverrideValue)
							: baseValue;
						const nextScoreDerivedModifier = getAbilityModifierFromScore(nextEffectiveScoreValue);

						if (Number.isFinite(runtime.modifierOffsetFromScore) && Number.isFinite(nextScoreDerivedModifier)) {
							runtime.manualOverrideValue = Math.max(
								PLAYER_INFO_STD_ABILITY_MIN,
								Math.min(PLAYER_INFO_STD_ABILITY_MAX, Math.trunc(nextScoreDerivedModifier + Math.trunc(runtime.modifierOffsetFromScore)))
							);
						} else if (
							Number.isFinite(runtime.manualOverrideValue)
							&& Number.isFinite(previousScoreDerivedModifier)
							&& Number.isFinite(nextScoreDerivedModifier)
						) {
							const scoreModifierDelta = Math.trunc(nextScoreDerivedModifier) - Math.trunc(previousScoreDerivedModifier);
							runtime.manualOverrideValue = Math.max(
								PLAYER_INFO_STD_ABILITY_MIN,
								Math.min(PLAYER_INFO_STD_ABILITY_MAX, Math.trunc(runtime.manualOverrideValue + scoreModifierDelta))
							);
							applyOtherAbilityModifierOffsetFromCurrentScore(abilityKey, runtime.manualOverrideValue);
						}
					}
				}
			}
			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function startOtherAbilityInlineEdit(abilityKey) {
			if (!isPlayerSheetEditMode) return;
			const runtime = getOtherAbilityRuntime(abilityKey);
			if (!runtime) return;
			if (runtime.inlineEditing || runtime.scoreInlineEditing || runtime.adjustArmed || (otherAdjustPointerId !== null && otherAdjustAbilityKey === abilityKey)) return;
			const abilityNode = getOtherAbilityAdjustNode(abilityKey);
			if (!abilityNode) return;
			const valueEl = abilityNode.querySelector('.player-info-ability-value');
			if (!valueEl) return;

			const fallbackValue = Number.isFinite(runtime.defaultValue) ? Math.trunc(runtime.defaultValue) : 0;
			const currentValue = Number.isFinite(runtime.manualOverrideValue)
				? Math.trunc(runtime.manualOverrideValue)
				: fallbackValue;

			const nextInput = document.createElement('input');
			nextInput.type = 'text';
			nextInput.inputMode = 'numeric';
			nextInput.autocomplete = 'off';
			nextInput.spellcheck = false;
			nextInput.className = 'player-info-dex-input';
			nextInput.setAttribute('aria-label', `Edit ${abilityKey} modifier`);
			nextInput.value = formatSignedModifier(currentValue);

			valueEl.replaceWith(nextInput);
			runtime.inlineEditing = true;
			otherInlineAbilityKey = abilityKey;
			otherInlineInputEl = nextInput;
			applyProfNodeVisualState();

			nextInput.addEventListener('input', () => {
				if (otherInlineInputEl !== nextInput) return;
				const sanitized = sanitizeProfInputDraft(nextInput.value);
				if (nextInput.value !== sanitized) {
					nextInput.value = sanitized;
				}
			});

			nextInput.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') {
					endOtherAbilityInlineEdit(true);
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				if (event.key === 'Escape') {
					endOtherAbilityInlineEdit(false);
					event.preventDefault();
					event.stopPropagation();
				}
			});

			nextInput.addEventListener('blur', () => {
				endOtherAbilityInlineEdit(true);
			});

			window.requestAnimationFrame(() => {
				if (otherInlineInputEl !== nextInput) return;
				nextInput.focus();
				nextInput.select();
			});
		}

		function startOtherAbilityScoreInlineEdit(abilityKey) {
			if (!isPlayerSheetEditMode) return;
			const runtime = getOtherAbilityRuntime(abilityKey);
			if (!runtime) return;
			if (runtime.inlineEditing || runtime.scoreInlineEditing || runtime.adjustArmed || (otherAdjustPointerId !== null && otherAdjustAbilityKey === abilityKey)) return;
			const scoreEl = getOtherAbilityScoreNode(abilityKey);
			if (!scoreEl) return;

			const fallbackValue = Number.isFinite(runtime.scoreDefaultValue) ? Math.trunc(runtime.scoreDefaultValue) : 10;
			const currentValue = Number.isFinite(runtime.scoreManualOverrideValue)
				? Math.trunc(runtime.scoreManualOverrideValue)
				: fallbackValue;

			const nextInput = document.createElement('input');
			nextInput.type = 'text';
			nextInput.inputMode = 'numeric';
			nextInput.autocomplete = 'off';
			nextInput.spellcheck = false;
			nextInput.className = 'player-info-dex-score-input';
			nextInput.setAttribute('aria-label', `Edit ${abilityKey} score`);
			nextInput.value = String(currentValue);

			scoreEl.replaceWith(nextInput);
			runtime.scoreInlineEditing = true;
			otherScoreInlineAbilityKey = abilityKey;
			otherScoreInlineInputEl = nextInput;
			applyProfNodeVisualState();

			nextInput.addEventListener('input', () => {
				if (otherScoreInlineInputEl !== nextInput) return;
				const sanitized = sanitizeScoreInputDraft(nextInput.value);
				if (nextInput.value !== sanitized) {
					nextInput.value = sanitized;
				}
			});

			nextInput.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') {
					endOtherAbilityScoreInlineEdit(true);
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				if (event.key === 'Escape') {
					endOtherAbilityScoreInlineEdit(false);
					event.preventDefault();
					event.stopPropagation();
				}
			});

			nextInput.addEventListener('blur', () => {
				endOtherAbilityScoreInlineEdit(true);
			});

			window.requestAnimationFrame(() => {
				if (otherScoreInlineInputEl !== nextInput) return;
				nextInput.focus();
				nextInput.select();
			});
		}

		function resetOtherAbilityAdjustToDefault(abilityKey) {
			if (!isPlayerSheetEditMode) return;
			const runtime = getOtherAbilityRuntime(abilityKey);
			if (!runtime) return;
			if (otherInlineAbilityKey === abilityKey) endOtherAbilityInlineEdit(false);
			if (otherScoreInlineAbilityKey === abilityKey) endOtherAbilityScoreInlineEdit(false);
			runtime.manualOverrideValue = null;
			runtime.modifierOffsetFromScore = null;
			runtime.scoreManualOverrideValue = null;
			if (otherAdjustAbilityKey === abilityKey) {
				endOtherAbilityAdjustSession();
			}
			renderPlayerInfoContent(true);
			applyProfNodeVisualState();
		}

		function readPersistedWindowState() {
			try {
				const raw = window.localStorage?.getItem(PLAYER_INFO_STATE_STORAGE_KEY);
				if (!raw) return null;
				const parsed = JSON.parse(raw);
				return parsed && typeof parsed === 'object' ? parsed : null;
			} catch {
				return null;
			}
		}

		function writePersistedWindowState() {
			if (isBootstrappingState) return;
			const overlayLeft = Number.parseFloat(windowEl.style.left);
			const overlayTop = Number.parseFloat(windowEl.style.top);
			const canvasLeft = Number.parseFloat(windowEl.style.left);
			const canvasTop = Number.parseFloat(windowEl.style.top);
			const nextState = {
				buttonActive: toggleBtn.classList.contains('active'),
				visible: windowEl.classList.contains('visible'),
				mode: currentMode,
				heroicInspiration: !!heroicInspirationEnabled,
				overlay: {
					left: Number.isFinite(overlayLeft) ? Math.round(overlayLeft) : null,
					top: Number.isFinite(overlayTop) ? Math.round(overlayTop) : null,
					manuallyPositioned: !!isManuallyPositioned
				},
				canvas: {
					left: Number.isFinite(canvasLeft) ? Math.round(canvasLeft) : null,
					top: Number.isFinite(canvasTop) ? Math.round(canvasTop) : null,
					canvasType: getCurrentCanvasType()
				}
			};
			try {
				window.localStorage?.setItem(PLAYER_INFO_STATE_STORAGE_KEY, JSON.stringify(nextState));
			} catch {
			}
		}

		function isNarrowMode() {
			return !!narrowMediaQuery?.matches;
		}

		function promoteOverlayWindow() {
			if (currentMode !== 'overlay') return;
			if (typeof window.setFloatingWindowPrimary === 'function') {
				window.setFloatingWindowPrimary('sticky-note', windowEl);
			}
			enforceDecoupledLayerScheme();
		}

		function readComputedZIndex(element) {
			if (!(element instanceof Element)) return null;
			const parsed = Number.parseInt(window.getComputedStyle(element).zIndex, 10);
			return Number.isFinite(parsed) ? parsed : null;
		}

		function enforceDecoupledLayerScheme() {
			// This layering is intentionally only for decoupled (overlay) player sheet mode.
			if (currentMode !== 'overlay') return;
			const footerEl = document.querySelector('footer');
			const actionIndicatorEl = document.getElementById('action-indicator-window');
			const footerZ = readComputedZIndex(footerEl);
			const actionIndicatorZ = readComputedZIndex(actionIndicatorEl);

			let targetZ = Number.isFinite(actionIndicatorZ)
				? actionIndicatorZ
				: (Number.isFinite(footerZ) ? footerZ - 1 : 1002);

			if (Number.isFinite(footerZ)) {
				const maxBelowFooter = footerZ - 1;
				if (Number.isFinite(actionIndicatorZ) && maxBelowFooter > actionIndicatorZ) {
					// Prefer one layer above action indicator when there is space under footer.
					targetZ = Math.min(maxBelowFooter, actionIndicatorZ + 1);
				} else {
					targetZ = Math.min(targetZ, maxBelowFooter);
				}
			}

			if (Number.isFinite(targetZ)) {
				windowEl.style.setProperty('z-index', String(Math.trunc(targetZ)), 'important');
			}
		}

		function getCurrentCanvasType() {
			return window.dmModeManager?.isActive ? 'dm' : 'player';
		}

		function getActiveCanvasElement() {
			return getCurrentCanvasType() === 'dm'
				? document.getElementById('dm-canvas-container')
				: document.getElementById('world');
		}

		function getActiveCanvasTransform() {
			const canvasEl = getActiveCanvasElement();
			if (!canvasEl) return { scale: 1, panX: 0, panY: 0 };
			const transform = window.getComputedStyle(canvasEl).transform;
			if (!transform || transform === 'none') {
				return { scale: 1, panX: 0, panY: 0 };
			}
			try {
				let matrix = null;
				if (typeof DOMMatrixReadOnly !== 'undefined') {
					matrix = new DOMMatrixReadOnly(transform);
				} else if (typeof WebKitCSSMatrix !== 'undefined') {
					matrix = new WebKitCSSMatrix(transform);
				}
				if (matrix) {
					return {
						scale: Number.isFinite(matrix.a) && matrix.a !== 0 ? matrix.a : 1,
						panX: Number.isFinite(matrix.e) ? matrix.e : 0,
						panY: Number.isFinite(matrix.f) ? matrix.f : 0
					};
				}
			} catch {
			}
			return { scale: 1, panX: 0, panY: 0 };
		}

		function toWorldCoords(clientX, clientY, scale = 1, panX = 0, panY = 0) {
			return {
				x: (clientX - panX) / scale,
				y: (clientY - panY) / scale
			};
		}

		function updateModeToggleButton() {
			const isCanvasMode = currentMode === 'canvas';
			modeToggleBtn.textContent = isCanvasMode ? 'DECOUPLE' : 'COUPLE';
			modeToggleBtn.setAttribute('aria-pressed', isCanvasMode ? 'false' : 'true');
		}

		function updateWidgetStateMetadata() {
			windowEl.dataset.playerInfoWidgetState = currentMode;
			windowEl.dataset.playerInfoCanvasCoupled = currentMode === 'canvas' ? 'true' : 'false';
		}

		function syncCanvasDebugLineState() {
			const debugCanvasEnabled = document.body.classList.contains('debug-canvas-buttons-highlights');
			const shouldShowDebugLine = debugCanvasEnabled
				&& currentMode === 'canvas'
				&& windowEl.classList.contains('visible');
			if (shouldShowDebugLine) {
				windowEl.style.outline = '2px dashed #22c55e';
				windowEl.style.outlineOffset = '2px';
				windowEl.dataset.playerInfoCanvasDebugLine = 'active';
				return;
			}
			windowEl.style.outline = '';
			windowEl.style.outlineOffset = '';
			windowEl.dataset.playerInfoCanvasDebugLine = 'inactive';
		}

		function clampWindowToViewport() {
			if (currentMode !== 'overlay') return;
			if (!isManuallyPositioned) return;
			const currentLeft = Number.parseFloat(windowEl.style.left);
			const currentTop = Number.parseFloat(windowEl.style.top);
			if (!Number.isFinite(currentLeft) || !Number.isFinite(currentTop)) return;
			const { left: clampedLeft, top: clampedTop } = clampOverlayRecoverablePosition(currentLeft, currentTop);
			windowEl.style.left = `${Math.round(clampedLeft)}px`;
			windowEl.style.top = `${Math.round(clampedTop)}px`;
		}

		function getFooterTopBoundary() {
			const footerEl = document.querySelector('footer');
			if (!footerEl) return window.innerHeight;
			const footerRect = footerEl.getBoundingClientRect();
			if (!footerRect || footerRect.height <= 0) return window.innerHeight;
			return footerRect.top;
		}

		function getHeaderRevealHeight() {
			return Math.max(1, headerEl?.offsetHeight || 36);
		}

		function clampOverlayRecoverablePosition(leftPx, topPx) {
			const width = windowEl.offsetWidth || PLAYER_INFO_BASE_WIDTH;
			const headerHeight = getHeaderRevealHeight();
			const footerTop = getFooterTopBoundary();
			const narrowMode = isNarrowMode();
			const minVisibleX = narrowMode ? PLAYER_INFO_NARROW_MIN_VISIBLE_X : PLAYER_INFO_MIN_HEADER_VISIBLE_X;
			const minVisibleY = narrowMode ? PLAYER_INFO_NARROW_MIN_VISIBLE_Y : PLAYER_INFO_MIN_HEADER_VISIBLE_Y;

			const minLeft = minVisibleX - width;
			const maxLeft = window.innerWidth - minVisibleX;
			const minTop = minVisibleY - headerHeight;
			const maxTopFromViewport = window.innerHeight - headerHeight;
			const maxTopFromFooter = footerTop - headerHeight;
			const maxTop = Math.max(minTop, Math.min(maxTopFromViewport, maxTopFromFooter));

			return {
				left: Math.min(maxLeft, Math.max(minLeft, leftPx)),
				top: Math.min(maxTop, Math.max(minTop, topPx))
			};
		}

		function updateResponsiveScale() {
			if (currentMode !== 'overlay') {
				windowEl.classList.remove('player-info-narrow-mode');
				windowEl.style.setProperty('--player-info-scale', '1');
				return;
			}
			if (!isNarrowMode()) {
				windowEl.classList.remove('player-info-narrow-mode');
				windowEl.style.width = '';
				windowEl.style.height = '';
				windowEl.style.maxHeight = '';
				windowEl.style.setProperty('--player-info-scale', '1');
				return;
			}

			windowEl.classList.add('player-info-narrow-mode');

			const viewportWidth = Math.max(240, window.innerWidth - (PLAYER_INFO_NARROW_VIEWPORT_MARGIN_X * 2));
			const widthRatio = viewportWidth / PLAYER_INFO_BASE_WIDTH;
			if (!Number.isFinite(widthRatio) || widthRatio <= 0) {
				windowEl.style.setProperty('--player-info-scale', '1');
				return;
			}

			// Narrow mode defaults to a full-sheet proportional fit.
			const nextScale = Math.min(1, Math.max(PLAYER_INFO_MIN_NARROW_SCALE, widthRatio));
			const scaledWidth = Math.round(PLAYER_INFO_BASE_WIDTH * nextScale);
			const viewportHeightCap = Math.max(320, window.innerHeight - (PLAYER_INFO_NARROW_VIEWPORT_MARGIN_Y * 2));
			const scaledHeight = Math.round(Math.min(viewportHeightCap, PLAYER_INFO_BASE_HEIGHT * nextScale));

			windowEl.style.width = `${scaledWidth}px`;
			windowEl.style.height = `${scaledHeight}px`;
			windowEl.style.maxHeight = `${scaledHeight}px`;
			windowEl.style.setProperty('--player-info-scale', String(nextScale));
		}

		function normalizeWindowPositionForDrag() {
			if (currentMode !== 'overlay') return;
			const rect = windowEl.getBoundingClientRect();
			windowEl.style.left = `${Math.round(rect.left)}px`;
			windowEl.style.top = `${Math.round(rect.top)}px`;
			windowEl.style.transform = 'none';
			isManuallyPositioned = true;
		}

		function stopDrag() {
			if (dragPointerId !== null && headerEl.hasPointerCapture?.(dragPointerId)) {
				try {
					headerEl.releasePointerCapture(dragPointerId);
				} catch {
				}
			}
			dragPointerId = null;
			windowEl.classList.remove('dragging');
			writePersistedWindowState();
		}

		function clampPointerToViewport(clientX, clientY, margin = 2) {
			const safeMargin = Number.isFinite(margin) ? Math.max(0, margin) : 0;
			const maxX = Math.max(safeMargin, window.innerWidth - safeMargin);
			const maxY = Math.max(safeMargin, window.innerHeight - safeMargin);
			return {
				x: Math.min(maxX, Math.max(safeMargin, Number(clientX) || 0)),
				y: Math.min(maxY, Math.max(safeMargin, Number(clientY) || 0))
			};
		}

		function startDrag(event) {
			if (event.pointerType === 'mouse' && event.button !== undefined && event.button !== 0) return;
			if (event.target.closest('.close-btn') || event.target.closest('.player-info-mode-btn')) return;
			const clampedPoint = clampPointerToViewport(event.clientX, event.clientY);
			windowEl.classList.add('dragging');
			if (currentMode === 'overlay') {
				promoteOverlayWindow();
				normalizeWindowPositionForDrag();
			}
			dragPointerId = event.pointerId;
			dragStartX = currentMode === 'canvas' ? event.clientX : clampedPoint.x;
			dragStartY = currentMode === 'canvas' ? event.clientY : clampedPoint.y;
			dragStartLeft = Number.parseFloat(windowEl.style.left) || 0;
			dragStartTop = Number.parseFloat(windowEl.style.top) || 0;
			isManuallyPositioned = true;
			if (headerEl.setPointerCapture && dragPointerId !== undefined) {
				try {
					headerEl.setPointerCapture(dragPointerId);
				} catch {
				}
			}
			event.stopPropagation();
			event.preventDefault();
		}

		function onDragMove(event) {
			if (dragPointerId !== event.pointerId) return;
			if (currentMode === 'canvas') {
				const { scale } = getActiveCanvasTransform();
				const safeScale = Math.max(0.001, Number(scale) || 1);
				const deltaX = (event.clientX - dragStartX) / safeScale;
				const deltaY = (event.clientY - dragStartY) / safeScale;
				windowEl.style.left = `${Math.round(dragStartLeft + deltaX)}px`;
				windowEl.style.top = `${Math.round(dragStartTop + deltaY)}px`;
				event.stopPropagation();
				event.preventDefault();
				return;
			}
			const clampedPoint = clampPointerToViewport(event.clientX, event.clientY);
			const deltaX = clampedPoint.x - dragStartX;
			const deltaY = clampedPoint.y - dragStartY;
			const attemptedLeft = dragStartLeft + deltaX;
			const attemptedTop = dragStartTop + deltaY;
			const { left: nextLeft, top: nextTop } = clampOverlayRecoverablePosition(attemptedLeft, attemptedTop);
			windowEl.style.left = `${Math.round(nextLeft)}px`;
			windowEl.style.top = `${Math.round(nextTop)}px`;
			event.stopPropagation();
			event.preventDefault();
		}

		function getWheelDeltaPixels(event) {
			if (!event) return 0;
			if (event.deltaMode === 1) return (event.deltaY || 0) * 16;
			if (event.deltaMode === 2) return (event.deltaY || 0) * window.innerHeight;
			return event.deltaY || 0;
		}

		function onCanvasCoupledWheel(event) {
			if (currentMode !== 'canvas') return;
			if (!windowEl.classList.contains('visible')) return;
			if (!(event.target instanceof Element)) return;
			if (!event.target.closest(`#${PLAYER_INFO_WINDOW_ID}`)) return;

			const deltaPixels = getWheelDeltaPixels(event);
			contentEl.scrollTop += deltaPixels;

			// Keep wheel input local to player info in canvas mode.
			event.preventDefault();
			event.stopImmediatePropagation();
		}

		function getActiveCharacterData() {
			return window.characterLoader?.characterData || null;
		}

		function applyOverlayDefaults() {
			windowEl.classList.remove('player-info-canvas-mode');
			windowEl.style.width = '';
			windowEl.style.height = '';
			windowEl.style.maxHeight = '';
			windowEl.style.left = '';
			windowEl.style.top = '';
			windowEl.style.transform = '';
			windowEl.style.zIndex = '';
			isManuallyPositioned = false;
			updateResponsiveScale();
			updateWidgetStateMetadata();
			syncCanvasDebugLineState();
			writePersistedWindowState();
		}

		function moveToOverlayMode() {
			if (windowEl.parentElement !== document.body) {
				document.body.appendChild(windowEl);
			}
			currentMode = 'overlay';
			applyOverlayDefaults();
			updateModeToggleButton();
			promoteOverlayWindow();
			enforceDecoupledLayerScheme();
			syncCanvasDebugLineState();
			writePersistedWindowState();
		}

		function moveToCanvasMode(spawnAtViewportCenter = false) {
			const activeCanvasEl = getActiveCanvasElement();
			if (!activeCanvasEl) {
				moveToOverlayMode();
				return;
			}

			const sourceRect = windowEl.getBoundingClientRect();
			if (windowEl.parentElement !== activeCanvasEl) {
				activeCanvasEl.appendChild(windowEl);
			}

			currentMode = 'canvas';
			windowEl.classList.add('player-info-canvas-mode');
			windowEl.style.removeProperty('z-index');
			windowEl.style.width = `${PLAYER_INFO_BASE_WIDTH}px`;
			windowEl.style.height = `${PLAYER_INFO_BASE_HEIGHT}px`;
			windowEl.style.maxHeight = `${PLAYER_INFO_BASE_HEIGHT}px`;
			windowEl.style.transform = 'none';
			windowEl.style.zIndex = String(PLAYER_INFO_CANVAS_Z);
			windowEl.style.setProperty('--player-info-scale', '1');

			const { scale, panX, panY } = getActiveCanvasTransform();
			const safeScale = Math.max(0.001, Number(scale) || 1);
			let worldLeft = Number.parseFloat(windowEl.style.left);
			let worldTop = Number.parseFloat(windowEl.style.top);

			if (!Number.isFinite(worldLeft) || !Number.isFinite(worldTop) || spawnAtViewportCenter) {
				const centerX = spawnAtViewportCenter
					? window.innerWidth / 2
					: sourceRect.left + (sourceRect.width / 2);
				const centerY = spawnAtViewportCenter
					? window.innerHeight / 2
					: sourceRect.top + (sourceRect.height / 2);
				const worldCenter = toWorldCoords(centerX, centerY, safeScale, panX, panY);
				worldLeft = worldCenter.x - (PLAYER_INFO_BASE_WIDTH / 2);
				worldTop = worldCenter.y - (PLAYER_INFO_BASE_HEIGHT / 2);
			}

			windowEl.style.left = `${Math.round(worldLeft)}px`;
			windowEl.style.top = `${Math.round(worldTop)}px`;
			isManuallyPositioned = true;
			updateWidgetStateMetadata();
			updateModeToggleButton();
			syncCanvasDebugLineState();
			writePersistedWindowState();
		}

		function getActiveBufferLabel() {
			if (!activeBufferLabelEl) return '';
			if (activeBufferLabelEl.classList.contains('placeholder')) return '';
			return String(activeBufferLabelEl.textContent || '').trim();
		}

		function renderPlayerInfoContent(forceRender = false) {
			const activeCharacterData = getActiveCharacterData();
			const activeBufferLabel = getActiveBufferLabel();
			const proficiencyProfile = resolveProficiencyBonusProfile(activeCharacterData || {});
			const initiativeProfile = resolveInitiativeProfile(activeCharacterData || {});
			const strengthProfile = resolveStrengthModifierProfile(activeCharacterData || {});
			const dexterityProfile = resolveDexterityModifierProfile(activeCharacterData || {});
			const otherAbilityProfiles = Object.fromEntries(
				PLAYER_INFO_OTHER_ABILITY_KEYS.map((abilityKey) => [abilityKey, resolveStandardAbilityModifierProfile(activeCharacterData || {}, abilityKey)])
			);
			const hasCanonicalizedOtherAbility = PLAYER_INFO_OTHER_ABILITY_KEYS.some((abilityKey) => !!otherAbilityProfiles?.[abilityKey]?.didCanonicalizeCommittedModifier);
			if ((strengthProfile?.didCanonicalizeCommittedModifier || dexterityProfile?.didCanonicalizeCommittedModifier || hasCanonicalizedOtherAbility) && activeCharacterData && typeof activeCharacterData === 'object') {
				persistCommittedCharacterData(activeCharacterData);
			}
			const profCharacterKey = JSON.stringify({
				name: activeCharacterData?.character?.name || '',
				level: proficiencyProfile.level ?? '',
				init: initiativeProfile.resolvedValue ?? '',
				str: strengthProfile.resolvedModifier ?? '',
				strScore: strengthProfile.resolvedScore ?? '',
				dex: dexterityProfile.resolvedModifier ?? '',
				dexScore: dexterityProfile.resolvedScore ?? '',
				con: otherAbilityProfiles?.constitution?.resolvedModifier ?? '',
				conScore: otherAbilityProfiles?.constitution?.resolvedScore ?? '',
				int: otherAbilityProfiles?.intelligence?.resolvedModifier ?? '',
				intScore: otherAbilityProfiles?.intelligence?.resolvedScore ?? '',
				wis: otherAbilityProfiles?.wisdom?.resolvedModifier ?? '',
				wisScore: otherAbilityProfiles?.wisdom?.resolvedScore ?? '',
				cha: otherAbilityProfiles?.charisma?.resolvedModifier ?? '',
				chaScore: otherAbilityProfiles?.charisma?.resolvedScore ?? '',
				buffer: activeBufferLabel || ''
			});
			if (profCharacterKey !== profInteractionCharacterKey) {
				profInteractionCharacterKey = profCharacterKey;
				endProfInlineEdit(false);
				endInitInlineEdit(false);
				endStrInlineEdit(false);
				endStrScoreInlineEdit(false);
				endDexInlineEdit(false);
				endDexScoreInlineEdit(false);
				profManualOverrideValue = null;
				initManualOverrideValue = null;
				strManualOverrideValue = null;
				strModifierOffsetFromScore = null;
				strScoreManualOverrideValue = null;
				dexManualOverrideValue = null;
				dexModifierOffsetFromScore = null;
				dexScoreManualOverrideValue = null;
				for (const abilityKey of PLAYER_INFO_OTHER_ABILITY_KEYS) {
					const runtime = getOtherAbilityRuntime(abilityKey);
					if (!runtime) continue;
					runtime.manualOverrideValue = null;
					runtime.modifierOffsetFromScore = null;
					runtime.scoreManualOverrideValue = null;
					runtime.inlineEditing = false;
					runtime.scoreInlineEditing = false;
					runtime.adjustArmed = false;
					runtime.suppressNextClick = false;
				}
				endOtherAbilityInlineEdit(false);
				endOtherAbilityScoreInlineEdit(false);
				endOtherAbilityAdjustSession();
				endProfAdjustSession();
				endInitAdjustSession();
				endStrAdjustSession();
				endDexAdjustSession();
			}

			profDefaultValue = Number.isFinite(proficiencyProfile.resolvedBonus)
				? Math.trunc(proficiencyProfile.resolvedBonus)
				: null;
			const effectiveProfValue = Number.isFinite(profManualOverrideValue)
				? Math.trunc(profManualOverrideValue)
				: proficiencyProfile.resolvedBonus;
			const proficiencyProfileForRender = {
				...proficiencyProfile,
				resolvedBonus: Number.isFinite(effectiveProfValue) ? Math.trunc(effectiveProfValue) : null,
				display: Number.isFinite(effectiveProfValue) ? formatSignedModifier(effectiveProfValue) : '---',
				hasManualOverride: isProfOverrideActive(),
				hasPersistentDirty: !!proficiencyProfile.hasPersistentDirty
			};
			initDefaultValue = Number.isFinite(initiativeProfile.resolvedValue)
				? Math.trunc(initiativeProfile.resolvedValue)
				: null;
			const effectiveInitValue = Number.isFinite(initManualOverrideValue)
				? Math.trunc(initManualOverrideValue)
				: initiativeProfile.resolvedValue;
			const initiativeProfileForRender = {
				...initiativeProfile,
				resolvedValue: Number.isFinite(effectiveInitValue) ? Math.trunc(effectiveInitValue) : null,
				display: Number.isFinite(effectiveInitValue) ? formatSignedModifier(effectiveInitValue) : '---',
				hasManualOverride: isInitOverrideActive(),
				hasPersistentDirty: !!initiativeProfile.hasPersistentDirty
			};
			strDefaultValue = Number.isFinite(strengthProfile.resolvedModifier)
				? Math.trunc(strengthProfile.resolvedModifier)
				: null;
			strScoreDefaultValue = Number.isFinite(strengthProfile.resolvedScore)
				? Math.trunc(strengthProfile.resolvedScore)
				: null;
			const effectiveStrScoreValue = Number.isFinite(strScoreManualOverrideValue)
				? Math.trunc(strScoreManualOverrideValue)
				: strengthProfile.resolvedScore;
			const derivedStrValueFromScore = Number.isFinite(effectiveStrScoreValue)
				? getAbilityModifierFromScore(effectiveStrScoreValue)
				: null;
			let effectiveStrValue = null;
			if (Number.isFinite(strModifierOffsetFromScore) && Number.isFinite(derivedStrValueFromScore)) {
				effectiveStrValue = Math.trunc(derivedStrValueFromScore + Math.trunc(strModifierOffsetFromScore));
			} else if (isStrOverrideActive()) {
				effectiveStrValue = Math.trunc(strManualOverrideValue);
			} else if (Number.isFinite(strScoreManualOverrideValue)) {
				effectiveStrValue = Number.isFinite(derivedStrValueFromScore) ? Math.trunc(derivedStrValueFromScore) : null;
			} else {
				effectiveStrValue = strengthProfile.resolvedModifier;
			}
			const strengthProfileForRender = {
				...strengthProfile,
				resolvedModifier: Number.isFinite(effectiveStrValue) ? Math.trunc(effectiveStrValue) : null,
				display: Number.isFinite(effectiveStrValue) ? formatSignedModifier(effectiveStrValue) : '---',
				hasManualOverride: isStrOverrideActive() || isStrScoreOverrideActive(),
				hasPersistentDirty: !!strengthProfile.hasPersistentDirty
			};
			logStrDebug('renderPlayerInfoContent', {
				characterName: activeCharacterData?.character?.name || '',
				forceRender: !!forceRender,
				strDefaultValue,
				strManualOverrideValue,
				strScoreDefaultValue,
				strScoreManualOverrideValue,
				effectiveStrScoreValue,
				derivedStrValueFromScore,
				effectiveStrValue,
				resolvedStrengthProfile: strengthProfile,
				strengthProfileForRender
			});
			strengthProfileForRender.resolvedScore = Number.isFinite(effectiveStrScoreValue) ? Math.trunc(effectiveStrScoreValue) : null;
			strengthProfileForRender.displayScore = sanitizeNumeric(effectiveStrScoreValue);
			dexDefaultValue = Number.isFinite(dexterityProfile.resolvedModifier)
				? Math.trunc(dexterityProfile.resolvedModifier)
				: null;
			dexScoreDefaultValue = Number.isFinite(dexterityProfile.resolvedScore)
				? Math.trunc(dexterityProfile.resolvedScore)
				: null;
			const effectiveDexScoreValue = Number.isFinite(dexScoreManualOverrideValue)
				? Math.trunc(dexScoreManualOverrideValue)
				: dexterityProfile.resolvedScore;
			const derivedDexValueFromScore = Number.isFinite(effectiveDexScoreValue)
				? getAbilityModifierFromScore(effectiveDexScoreValue)
				: null;
			let effectiveDexValue = null;
			if (Number.isFinite(dexModifierOffsetFromScore) && Number.isFinite(derivedDexValueFromScore)) {
				effectiveDexValue = Math.trunc(derivedDexValueFromScore + Math.trunc(dexModifierOffsetFromScore));
			} else if (isDexOverrideActive()) {
				effectiveDexValue = Math.trunc(dexManualOverrideValue);
			} else if (Number.isFinite(dexScoreManualOverrideValue)) {
				effectiveDexValue = Number.isFinite(derivedDexValueFromScore) ? Math.trunc(derivedDexValueFromScore) : null;
			} else {
				effectiveDexValue = dexterityProfile.resolvedModifier;
			}
			const dexterityProfileForRender = {
				...dexterityProfile,
				resolvedModifier: Number.isFinite(effectiveDexValue) ? Math.trunc(effectiveDexValue) : null,
				display: Number.isFinite(effectiveDexValue) ? formatSignedModifier(effectiveDexValue) : '---',
				hasManualOverride: isDexOverrideActive() || isDexScoreOverrideActive(),
				hasPersistentDirty: !!dexterityProfile.hasPersistentDirty,
				resolvedScore: Number.isFinite(effectiveDexScoreValue) ? Math.trunc(effectiveDexScoreValue) : null,
				displayScore: sanitizeNumeric(effectiveDexScoreValue)
			};
			const otherAbilityProfilesForRender = Object.fromEntries(PLAYER_INFO_OTHER_ABILITY_KEYS.map((abilityKey) => {
				const profile = otherAbilityProfiles?.[abilityKey] || resolveStandardAbilityModifierProfile(activeCharacterData || {}, abilityKey);
				const runtime = getOtherAbilityRuntime(abilityKey);
				if (runtime) {
					runtime.defaultValue = Number.isFinite(profile?.resolvedModifier) ? Math.trunc(profile.resolvedModifier) : null;
					runtime.scoreDefaultValue = Number.isFinite(profile?.resolvedScore) ? Math.trunc(profile.resolvedScore) : null;
				}
				const effectiveScoreValue = runtime && Number.isFinite(runtime.scoreManualOverrideValue)
					? Math.trunc(runtime.scoreManualOverrideValue)
					: profile?.resolvedScore;
				const derivedValueFromScore = Number.isFinite(effectiveScoreValue)
					? getAbilityModifierFromScore(effectiveScoreValue)
					: null;
				let effectiveValue = null;
				if (runtime && Number.isFinite(runtime.modifierOffsetFromScore) && Number.isFinite(derivedValueFromScore)) {
					effectiveValue = Math.trunc(derivedValueFromScore + Math.trunc(runtime.modifierOffsetFromScore));
				} else if (runtime && isOtherAbilityOverrideActive(abilityKey)) {
					effectiveValue = Math.trunc(runtime.manualOverrideValue);
				} else if (runtime && Number.isFinite(runtime.scoreManualOverrideValue)) {
					effectiveValue = Number.isFinite(derivedValueFromScore) ? Math.trunc(derivedValueFromScore) : null;
				} else {
					effectiveValue = profile?.resolvedModifier;
				}
				return [abilityKey, {
					...profile,
					resolvedModifier: Number.isFinite(effectiveValue) ? Math.trunc(effectiveValue) : null,
					display: Number.isFinite(effectiveValue) ? formatSignedModifier(effectiveValue) : '---',
					hasManualOverride: isOtherAbilityOverrideActive(abilityKey) || isOtherAbilityScoreOverrideActive(abilityKey),
					hasPersistentDirty: !!profile?.hasPersistentDirty,
					resolvedScore: Number.isFinite(effectiveScoreValue) ? Math.trunc(effectiveScoreValue) : null,
					displayScore: sanitizeNumeric(effectiveScoreValue)
				}];
			}));
			if (heroicInspirationEnabled === null) {
				heroicInspirationEnabled = extractHeroicInspiration(activeCharacterData);
			}
			const signature = JSON.stringify({
				name: activeCharacterData?.character?.name || '',
				level: proficiencyProfileForRender.level ?? '',
				prof: proficiencyProfileForRender.resolvedBonus ?? '',
				profSource: proficiencyProfileForRender.source,
				profOverride: proficiencyProfileForRender.hasManualOverride ? 1 : 0,
				profDirty: proficiencyProfileForRender.hasPersistentDirty ? 1 : 0,
				init: initiativeProfileForRender.resolvedValue ?? '',
				initOverride: initiativeProfileForRender.hasManualOverride ? 1 : 0,
				initDirty: initiativeProfileForRender.hasPersistentDirty ? 1 : 0,
				str: strengthProfileForRender.resolvedModifier ?? '',
				strScore: strengthProfileForRender.resolvedScore ?? '',
				strOverride: strengthProfileForRender.hasManualOverride ? 1 : 0,
				strScoreOverride: isStrScoreOverrideActive() ? 1 : 0,
				strDirty: strengthProfileForRender.hasPersistentDirty ? 1 : 0,
				dex: dexterityProfileForRender.resolvedModifier ?? '',
				dexScore: dexterityProfileForRender.resolvedScore ?? '',
				dexOverride: dexterityProfileForRender.hasManualOverride ? 1 : 0,
				dexScoreOverride: isDexScoreOverrideActive() ? 1 : 0,
				dexDirty: dexterityProfileForRender.hasPersistentDirty ? 1 : 0,
				con: otherAbilityProfilesForRender?.constitution?.resolvedModifier ?? '',
				conScore: otherAbilityProfilesForRender?.constitution?.resolvedScore ?? '',
				conOverride: otherAbilityProfilesForRender?.constitution?.hasManualOverride ? 1 : 0,
				conDirty: otherAbilityProfilesForRender?.constitution?.hasPersistentDirty ? 1 : 0,
				int: otherAbilityProfilesForRender?.intelligence?.resolvedModifier ?? '',
				intScore: otherAbilityProfilesForRender?.intelligence?.resolvedScore ?? '',
				intOverride: otherAbilityProfilesForRender?.intelligence?.hasManualOverride ? 1 : 0,
				intDirty: otherAbilityProfilesForRender?.intelligence?.hasPersistentDirty ? 1 : 0,
				wis: otherAbilityProfilesForRender?.wisdom?.resolvedModifier ?? '',
				wisScore: otherAbilityProfilesForRender?.wisdom?.resolvedScore ?? '',
				wisOverride: otherAbilityProfilesForRender?.wisdom?.hasManualOverride ? 1 : 0,
				wisDirty: otherAbilityProfilesForRender?.wisdom?.hasPersistentDirty ? 1 : 0,
				cha: otherAbilityProfilesForRender?.charisma?.resolvedModifier ?? '',
				chaScore: otherAbilityProfilesForRender?.charisma?.resolvedScore ?? '',
				chaOverride: otherAbilityProfilesForRender?.charisma?.hasManualOverride ? 1 : 0,
				chaDirty: otherAbilityProfilesForRender?.charisma?.hasPersistentDirty ? 1 : 0,
				ac: activeCharacterData?.combat?.armorClass ?? activeCharacterData?.combat?.ac ?? '',
				hp: activeCharacterData?.combat?.hitPoints ?? activeCharacterData?.combat?.currentHp ?? '',
				speed: activeCharacterData?.combat?.speed ?? '',
				initiative: activeCharacterData?.combat?.initiative ?? '',
				bufferLabel: activeBufferLabel,
				visible: windowEl.classList.contains('visible')
			});

			if (!forceRender && signature === lastRenderedSignature) return;
			lastRenderedSignature = signature;

			const activeName = sanitizeText(activeCharacterData?.character?.name || activeBufferLabel || 'Player Info');
			if (titleEl) {
				titleEl.textContent = `${activeName}`;
			}

			if (!activeCharacterData) {
				endProfInlineEdit(false);
				endInitInlineEdit(false);
				endStrInlineEdit(false);
				endStrScoreInlineEdit(false);
				endDexInlineEdit(false);
				endDexScoreInlineEdit(false);
				endOtherAbilityInlineEdit(false);
				endOtherAbilityScoreInlineEdit(false);
				endProfAdjustSession();
				endInitAdjustSession();
				endStrAdjustSession();
				endDexAdjustSession();
				endOtherAbilityAdjustSession();
				contentEl.innerHTML = `<div class="player-info-empty">${fallbackText}</div>`;
				return;
			}

			contentEl.innerHTML = buildPlayerInfoMarkup(
				activeCharacterData,
				activeBufferLabel,
				!!heroicInspirationEnabled,
				proficiencyProfileForRender,
				initiativeProfileForRender,
				strengthProfileForRender,
				dexterityProfileForRender,
				otherAbilityProfilesForRender
			);
			applyProfNodeVisualState();
		}

		function setWindowVisible(nextVisible) {
			const shouldShow = !!nextVisible;
			windowEl.classList.toggle('visible', shouldShow);
			toggleBtn.classList.toggle('active', shouldShow);
			toggleBtn.setAttribute('aria-pressed', shouldShow ? 'true' : 'false');
			windowEl.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
			if (shouldShow) {
				moveToOverlayMode();
				enforceDecoupledLayerScheme();
				renderPlayerInfoContent(true);
				updateResponsiveScale();
				clampWindowToViewport();
			} else {
				setPlayerSheetEditMode(false);
				stopDrag();
				syncCanvasDebugLineState();
			}
			writePersistedWindowState();
		}

		function restorePersistedWindowState() {
			const savedState = readPersistedWindowState();
			if (!savedState || typeof savedState !== 'object') return;
			if (typeof savedState.heroicInspiration === 'boolean') {
				heroicInspirationEnabled = savedState.heroicInspiration;
			}

			const parseStoredCoordinate = (rawValue) => {
				if (rawValue === null || rawValue === undefined || rawValue === '') return NaN;
				const parsed = Number.parseFloat(rawValue);
				return Number.isFinite(parsed) ? parsed : NaN;
			};

			const savedMode = savedState.mode === 'canvas' ? 'canvas' : 'overlay';
			const savedButtonActive = typeof savedState.buttonActive === 'boolean'
				? savedState.buttonActive
				: !!savedState.visible;

			if (savedMode === 'canvas') {
				const savedCanvasLeft = parseStoredCoordinate(savedState?.canvas?.left);
				const savedCanvasTop = parseStoredCoordinate(savedState?.canvas?.top);
				if (Number.isFinite(savedCanvasLeft) && Number.isFinite(savedCanvasTop)) {
					windowEl.style.left = `${Math.round(savedCanvasLeft)}px`;
					windowEl.style.top = `${Math.round(savedCanvasTop)}px`;
				}
				moveToCanvasMode(!Number.isFinite(savedCanvasLeft) || !Number.isFinite(savedCanvasTop));
			} else {
				moveToOverlayMode();
				const savedOverlayLeft = parseStoredCoordinate(savedState?.overlay?.left);
				const savedOverlayTop = parseStoredCoordinate(savedState?.overlay?.top);
				if (Number.isFinite(savedOverlayLeft) && Number.isFinite(savedOverlayTop)) {
					windowEl.style.left = `${Math.round(savedOverlayLeft)}px`;
					windowEl.style.top = `${Math.round(savedOverlayTop)}px`;
					windowEl.style.transform = 'none';
					isManuallyPositioned = true;
					clampWindowToViewport();
				}
			}

			if (savedButtonActive) {
				windowEl.classList.add('visible');
				toggleBtn.classList.add('active');
				toggleBtn.setAttribute('aria-pressed', 'true');
				windowEl.setAttribute('aria-hidden', 'false');
				renderPlayerInfoContent(true);
			} else {
				windowEl.classList.remove('visible');
				toggleBtn.classList.remove('active');
				toggleBtn.setAttribute('aria-pressed', 'false');
				windowEl.setAttribute('aria-hidden', 'true');
			}

			syncCanvasDebugLineState();
			writePersistedWindowState();
		}

		toggleBtn.addEventListener('click', () => {
			setWindowVisible(!windowEl.classList.contains('visible'));
		});

		closeBtn.addEventListener('click', () => {
			setWindowVisible(false);
		});

		modeToggleBtn.addEventListener('click', () => {
			if (currentMode === 'canvas') {
				moveToOverlayMode();
				return;
			}
			moveToCanvasMode(false);
		});

		if (commitBtn) {
			commitBtn.addEventListener('click', (event) => {
				logStrInteraction('commit-button:click', {
					isPlayerSheetEditMode,
					hasPendingPlayerSheetChanges: hasPendingPlayerSheetChanges()
				}, event);
				if (!isPlayerSheetEditMode) {
					setPlayerSheetEditMode(true);
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				if (!hasPendingPlayerSheetChanges()) {
					setPlayerSheetEditMode(false);
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				commitPlayerSheetChanges();
				event.preventDefault();
				event.stopPropagation();
			});
		}

		if (revertBtn) {
			revertBtn.addEventListener('click', (event) => {
				logStrInteraction('revert-button:click', null, event);
				revertPlayerSheetDirtyValues();
				event.preventDefault();
				event.stopPropagation();
			});
		}

		contentEl.addEventListener('click', (event) => {
			logStrInteraction('content:click', null, event);
			const eventElement = event.target instanceof Element
				? event.target
				: (event.target && event.target.parentElement ? event.target.parentElement : null);
			if (profSuppressNextClick) {
				profSuppressNextClick = false;
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			if (initSuppressNextClick) {
				initSuppressNextClick = false;
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			if (strSuppressNextClick) {
				strSuppressNextClick = false;
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			if (dexSuppressNextClick) {
				dexSuppressNextClick = false;
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			if (eventElement) {
				const otherAdjustTarget = eventElement.closest('[data-player-info-other-adjust="true"]');
				const otherAbilityKey = String(otherAdjustTarget?.getAttribute('data-player-info-ability-key') || '').toLowerCase().trim();
				if (otherAbilityKey) {
					const runtime = getOtherAbilityRuntime(otherAbilityKey);
					if (runtime?.suppressNextClick) {
						runtime.suppressNextClick = false;
						event.preventDefault();
						event.stopPropagation();
						return;
					}
				}
			}

			const profTarget = eventElement
				? eventElement.closest('[data-player-info-prof-adjust="true"]')
				: null;
			if (profTarget) {
				if (!isPlayerSheetEditMode) {
					// Keep tactile press feedback, but do not roll/pop up for PROF in non-edit mode.
					triggerPlayerSheetRollFeedback(profTarget);
					// triggerPlayerSheetRoll('PROF Check Roll', profProfile?.resolvedBonus ?? 0);
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				endInitInlineEdit(true);
				endInitAdjustSession();
				endOtherAbilityInlineEdit(true);
				endOtherAbilityScoreInlineEdit(true);
				endOtherAbilityAdjustSession();
				startProfInlineEdit();
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const initTarget = eventElement
				? eventElement.closest('[data-player-info-init-adjust="true"]')
				: null;
			if (initTarget) {
				if (!isPlayerSheetEditMode) {
					const activeCharacterData = getActiveCharacterData() || {};
					const initProfile = resolveInitiativeProfile(activeCharacterData);
					triggerPlayerSheetRollFeedback(initTarget);
					triggerPlayerSheetRoll('Initiative Roll', initProfile?.resolvedValue ?? 0);
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				endProfInlineEdit(true);
				endProfAdjustSession();
				endOtherAbilityInlineEdit(true);
				endOtherAbilityScoreInlineEdit(true);
				endOtherAbilityAdjustSession();
				startInitInlineEdit();
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const strTarget = eventElement
				? eventElement.closest('[data-player-info-str-adjust="true"]')
				: null;
			if (strTarget) {
				if (!isPlayerSheetEditMode) {
					const activeCharacterData = getActiveCharacterData() || {};
					const strengthProfile = resolveStrengthModifierProfile(activeCharacterData);
					triggerPlayerSheetRollFeedback(strTarget);
					triggerPlayerSheetRoll('STR Check Roll', strengthProfile?.resolvedModifier ?? 0);
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				endInitInlineEdit(true);
				endInitAdjustSession();
				endOtherAbilityInlineEdit(true);
				endOtherAbilityScoreInlineEdit(true);
				endOtherAbilityAdjustSession();
				endDexInlineEdit(true);
				endDexScoreInlineEdit(true);
				endDexAdjustSession();
				const scoreTarget = eventElement
					? eventElement.closest('[data-player-info-str-score="true"]')
					: null;
				if (scoreTarget) {
					logStrInteraction('str-score:click-open-inline', null, event);
					startStrScoreInlineEdit();
				} else {
					logStrInteraction('str-mod:click-open-inline', null, event);
					startStrInlineEdit();
				}
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const dexTarget = eventElement
				? eventElement.closest('[data-player-info-dex-adjust="true"]')
				: null;
			if (dexTarget) {
				if (!isPlayerSheetEditMode) {
					const activeCharacterData = getActiveCharacterData() || {};
					const dexterityProfile = resolveDexterityModifierProfile(activeCharacterData);
					triggerPlayerSheetRollFeedback(dexTarget);
					triggerPlayerSheetRoll('DEX Check Roll', dexterityProfile?.resolvedModifier ?? 0);
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				endInitInlineEdit(true);
				endInitAdjustSession();
				endOtherAbilityInlineEdit(true);
				endOtherAbilityScoreInlineEdit(true);
				endOtherAbilityAdjustSession();
				endStrInlineEdit(true);
				endStrScoreInlineEdit(true);
				endStrAdjustSession();
				const scoreTarget = eventElement
					? eventElement.closest('[data-player-info-dex-score="true"]')
					: null;
				if (scoreTarget) {
					startDexScoreInlineEdit();
				} else {
					startDexInlineEdit();
				}
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const otherTarget = eventElement
				? eventElement.closest('[data-player-info-other-adjust="true"]')
				: null;
			if (otherTarget) {
				const abilityKey = String(otherTarget.getAttribute('data-player-info-ability-key') || '').toLowerCase().trim();
				if (!abilityKey) return;
				if (!isPlayerSheetEditMode) {
					const activeCharacterData = getActiveCharacterData() || {};
					const otherAbilityProfile = resolveStandardAbilityModifierProfile(activeCharacterData, abilityKey);
					const abilityLabel = getAbilityShortKey(abilityKey).toUpperCase();
					triggerPlayerSheetRollFeedback(otherTarget);
					triggerPlayerSheetRoll(`${abilityLabel} Check Roll`, otherAbilityProfile?.resolvedModifier ?? 0);
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				endInitInlineEdit(true);
				endInitAdjustSession();
				endStrInlineEdit(true);
				endStrScoreInlineEdit(true);
				endDexInlineEdit(true);
				endDexScoreInlineEdit(true);
				endStrAdjustSession();
				endDexAdjustSession();
				const scoreTarget = eventElement
					? eventElement.closest('[data-player-info-other-score="true"]')
					: null;
				if (scoreTarget) {
					startOtherAbilityScoreInlineEdit(abilityKey);
				} else {
					startOtherAbilityInlineEdit(abilityKey);
				}
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const toggleTarget = eventElement
				? eventElement.closest('[data-heroic-inspiration-toggle="true"]')
				: null;
			if (!toggleTarget) return;
			setHeroicInspirationEnabled(!heroicInspirationEnabled, 'player-info:heroic-toggle-click');
			event.preventDefault();
		});

		contentEl.addEventListener('keydown', (event) => {
			if (event.target instanceof Element && (event.target.closest('.player-info-prof-input') || event.target.closest('.player-info-init-input') || event.target.closest('.player-info-str-input') || event.target.closest('.player-info-str-score-input') || event.target.closest('.player-info-dex-input') || event.target.closest('.player-info-dex-score-input'))) {
				return;
			}

			const profTarget = event.target instanceof Element
				? event.target.closest('[data-player-info-prof-adjust="true"]')
				: null;
			if (profTarget && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
				if (!isPlayerSheetEditMode) return;
				stepProfAdjustValue(event.key === 'ArrowUp' ? 1 : -1);
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const initTarget = event.target instanceof Element
				? event.target.closest('[data-player-info-init-adjust="true"]')
				: null;
			if (initTarget && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
				if (!isPlayerSheetEditMode) return;
				stepInitAdjustValue(event.key === 'ArrowUp' ? 1 : -1);
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const isInitActivationKey = event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar';
			if (initTarget && isInitActivationKey) {
				if (!isPlayerSheetEditMode) return;
				startInitInlineEdit();
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const strTarget = event.target instanceof Element
				? event.target.closest('[data-player-info-str-adjust="true"]')
				: null;
			if (strTarget && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
				if (!isPlayerSheetEditMode) return;
				stepStrAdjustValue(event.key === 'ArrowUp' ? 1 : -1);
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const isStrActivationKey = event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar';
			if (strTarget && isStrActivationKey) {
				if (!isPlayerSheetEditMode) return;
				logStrInteraction('str-mod:keyboard-open-inline', {
					key: event.key
				}, event);
				startStrInlineEdit();
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const dexTarget = event.target instanceof Element
				? event.target.closest('[data-player-info-dex-adjust="true"]')
				: null;
			if (dexTarget && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
				if (!isPlayerSheetEditMode) return;
				stepDexAdjustValue(event.key === 'ArrowUp' ? 1 : -1);
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const isDexActivationKey = event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar';
			if (dexTarget && isDexActivationKey) {
				if (!isPlayerSheetEditMode) return;
				startDexInlineEdit();
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const otherTarget = event.target instanceof Element
				? event.target.closest('[data-player-info-other-adjust="true"]')
				: null;
			if (otherTarget && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
				if (!isPlayerSheetEditMode) return;
				const abilityKey = String(otherTarget.getAttribute('data-player-info-ability-key') || '').toLowerCase().trim();
				if (!abilityKey) return;
				stepOtherAbilityAdjustValue(abilityKey, event.key === 'ArrowUp' ? 1 : -1);
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const isOtherActivationKey = event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar';
			if (otherTarget && isOtherActivationKey) {
				if (!isPlayerSheetEditMode) return;
				const abilityKey = String(otherTarget.getAttribute('data-player-info-ability-key') || '').toLowerCase().trim();
				if (!abilityKey) return;
				startOtherAbilityInlineEdit(abilityKey);
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const isToggleKey = event.key === 'Enter' || event.key === ' ';
			if (!isToggleKey) return;
			const toggleTarget = event.target instanceof Element
				? event.target.closest('[data-heroic-inspiration-toggle="true"]')
				: null;
			if (!toggleTarget) return;
			setHeroicInspirationEnabled(!heroicInspirationEnabled, 'player-info:heroic-toggle-keyboard');
			event.preventDefault();
		});

		contentEl.addEventListener('dblclick', (event) => {
			logStrInteraction('content:dblclick', null, event);
			if (!(event.target instanceof Element)) return;
			const profTarget = event.target.closest('[data-player-info-prof-adjust="true"]');
			if (profTarget) {
				if (!isPlayerSheetEditMode) return;
				resetProfAdjustToDefault();
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			const initTarget = event.target.closest('[data-player-info-init-adjust="true"]');
			if (initTarget) {
				if (!isPlayerSheetEditMode) return;
				resetInitAdjustToDefault();
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			const strTarget = event.target.closest('[data-player-info-str-adjust="true"]');
			if (strTarget) {
				if (!isPlayerSheetEditMode) return;
				resetStrAdjustToDefault();
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			const dexTarget = event.target.closest('[data-player-info-dex-adjust="true"]');
			if (dexTarget) {
				if (!isPlayerSheetEditMode) return;
				resetDexAdjustToDefault();
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			const otherTarget = event.target.closest('[data-player-info-other-adjust="true"]');
			if (!otherTarget) return;
			if (!isPlayerSheetEditMode) return;
			const abilityKey = String(otherTarget.getAttribute('data-player-info-ability-key') || '').toLowerCase().trim();
			if (!abilityKey) return;
			resetOtherAbilityAdjustToDefault(abilityKey);
			event.preventDefault();
			event.stopPropagation();
		});

		contentEl.addEventListener('contextmenu', (event) => {
			if (!(event.target instanceof Element)) return;
			const abilityTarget = event.target.closest('[data-player-info-init-adjust="true"], .player-info-init-input, [data-player-info-str-adjust="true"], [data-player-info-str-score="true"], .player-info-str-input, .player-info-str-score-input, [data-player-info-dex-adjust="true"], [data-player-info-dex-score="true"], .player-info-dex-input, .player-info-dex-score-input, [data-player-info-other-adjust="true"], [data-player-info-other-score="true"]');
			if (!abilityTarget) return;
			event.preventDefault();
			event.stopPropagation();
		});

		contentEl.addEventListener('pointerdown', (event) => {
			logStrInteraction('content:pointerdown', null, event);
			if (!(event.target instanceof Element)) return;
			if (event.target.closest('.player-info-prof-input')) return;
			if (event.target.closest('.player-info-init-input')) return;
			if (event.target.closest('.player-info-str-input')) return;
			if (event.target.closest('.player-info-str-score-input')) return;
			if (event.target.closest('.player-info-dex-input')) return;
			if (event.target.closest('.player-info-dex-score-input')) return;
			const isTouchPointer = String(event.pointerType || '').toLowerCase() === 'touch';
			const strScoreTarget = event.target.closest('[data-player-info-str-score="true"]');
			if (strScoreTarget) {
				if (!isPlayerSheetEditMode) return;
				logStrInteraction('str-score:pointerdown-open-inline', null, event);
				endOtherAbilityInlineEdit(true);
				endOtherAbilityScoreInlineEdit(true);
				endOtherAbilityAdjustSession();
				endDexInlineEdit(true);
				endDexScoreInlineEdit(true);
				endDexAdjustSession();
				endStrInlineEdit(true);
				endStrAdjustSession();
				startStrScoreInlineEdit();
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			const dexScoreTarget = event.target.closest('[data-player-info-dex-score="true"]');
			if (dexScoreTarget) {
				if (!isPlayerSheetEditMode) return;
				endOtherAbilityInlineEdit(true);
				endOtherAbilityScoreInlineEdit(true);
				endOtherAbilityAdjustSession();
				endStrInlineEdit(true);
				endStrScoreInlineEdit(true);
				endStrAdjustSession();
				endDexInlineEdit(true);
				endDexAdjustSession();
				startDexScoreInlineEdit();
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			const otherScoreTarget = event.target.closest('[data-player-info-other-score="true"]');
			if (otherScoreTarget) {
				if (!isPlayerSheetEditMode) return;
				const abilityKey = String(otherScoreTarget.getAttribute('data-player-info-ability-key') || '').toLowerCase().trim();
				if (!abilityKey) return;
				endStrInlineEdit(true);
				endStrScoreInlineEdit(true);
				endDexInlineEdit(true);
				endDexScoreInlineEdit(true);
				endStrAdjustSession();
				endDexAdjustSession();
				if (otherInlineAbilityKey && otherInlineAbilityKey !== abilityKey) {
					endOtherAbilityInlineEdit(true);
				}
				if (otherScoreInlineAbilityKey && otherScoreInlineAbilityKey !== abilityKey) {
					endOtherAbilityScoreInlineEdit(true);
				}
				if (otherAdjustAbilityKey && otherAdjustAbilityKey !== abilityKey) {
					endOtherAbilityAdjustSession();
				}
				startOtherAbilityScoreInlineEdit(abilityKey);
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			const profTarget = event.target.closest('[data-player-info-prof-adjust="true"]');
			const initTarget = event.target.closest('[data-player-info-init-adjust="true"]');
			const strTarget = event.target.closest('[data-player-info-str-adjust="true"]');
			const dexTarget = event.target.closest('[data-player-info-dex-adjust="true"]');
			const otherTarget = event.target.closest('[data-player-info-other-adjust="true"]');
			if (!profTarget && !initTarget && !strTarget && !dexTarget && !otherTarget) return;
			if (!isPlayerSheetEditMode) return;
			if (event.pointerType === 'mouse' && event.button !== 0) return;
			if (isTouchPointer) {
				event.preventDefault();
			}

			if (profTarget) {
				endInitInlineEdit(true);
				endInitAdjustSession();
				endOtherAbilityInlineEdit(true);
				endOtherAbilityScoreInlineEdit(true);
				endOtherAbilityAdjustSession();
				endProfInlineEdit(true);
				profSuppressNextClick = false;
				endProfAdjustSession();
				profAdjustPointerId = event.pointerId;
				profPressStartClientX = Number.isFinite(event.clientX) ? event.clientX : null;
				profPressStartClientY = Number.isFinite(event.clientY) ? event.clientY : null;
				profPressMoved = false;
				profAdjustLastClientY = Number.isFinite(event.clientY) ? event.clientY : null;
				profAdjustHoldTimer = window.setTimeout(() => {
					if (profAdjustPointerId !== event.pointerId) return;
					setProfAdjustArmed(true);
				}, PLAYER_INFO_PROF_HOLD_DELAY_MS);

				if (typeof profTarget.setPointerCapture === 'function') {
					try {
						profTarget.setPointerCapture(event.pointerId);
					} catch {
					}
				}
				return;
			}

			if (initTarget) {
				endProfInlineEdit(true);
				endProfAdjustSession();
				endOtherAbilityInlineEdit(true);
				endOtherAbilityScoreInlineEdit(true);
				endOtherAbilityAdjustSession();
				endStrInlineEdit(true);
				endStrScoreInlineEdit(true);
				endDexInlineEdit(true);
				endDexScoreInlineEdit(true);
				endStrAdjustSession();
				endDexAdjustSession();
				endInitInlineEdit(true);
				initSuppressNextClick = false;
				endInitAdjustSession();
				initAdjustPointerId = event.pointerId;
				initPressStartClientX = Number.isFinite(event.clientX) ? event.clientX : null;
				initPressStartClientY = Number.isFinite(event.clientY) ? event.clientY : null;
				initPressMoved = false;
				initAdjustLastClientY = Number.isFinite(event.clientY) ? event.clientY : null;
				initAdjustHoldTimer = window.setTimeout(() => {
					if (initAdjustPointerId !== event.pointerId) return;
					setInitAdjustArmed(true);
				}, PLAYER_INFO_INIT_HOLD_DELAY_MS);

				if (typeof initTarget?.setPointerCapture === 'function') {
					try {
						initTarget.setPointerCapture(event.pointerId);
					} catch {
					}
				}
				return;
			}

			if (strTarget) {
				endInitInlineEdit(true);
				endInitAdjustSession();
				endOtherAbilityInlineEdit(true);
				endOtherAbilityScoreInlineEdit(true);
				endOtherAbilityAdjustSession();
				endDexInlineEdit(true);
				endDexScoreInlineEdit(true);
				endDexAdjustSession();
				endStrInlineEdit(true);
				endStrScoreInlineEdit(true);
				strSuppressNextClick = false;
				endStrAdjustSession();
				strAdjustPointerId = event.pointerId;
				strPressStartClientX = Number.isFinite(event.clientX) ? event.clientX : null;
				strPressStartClientY = Number.isFinite(event.clientY) ? event.clientY : null;
				strPressMoved = false;
				strAdjustLastClientY = Number.isFinite(event.clientY) ? event.clientY : null;
				strAdjustHoldTimer = window.setTimeout(() => {
					if (strAdjustPointerId !== event.pointerId) return;
					setStrAdjustArmed(true);
				}, PLAYER_INFO_STR_HOLD_DELAY_MS);

				if (typeof strTarget?.setPointerCapture === 'function') {
					try {
						strTarget.setPointerCapture(event.pointerId);
					} catch {
					}
				}
				return;
			}

			if (otherTarget) {
				const abilityKey = String(otherTarget.getAttribute('data-player-info-ability-key') || '').toLowerCase().trim();
				if (!abilityKey) return;
				if (otherInlineAbilityKey && otherInlineAbilityKey !== abilityKey) {
					endOtherAbilityInlineEdit(true);
				}
				if (otherScoreInlineAbilityKey && otherScoreInlineAbilityKey !== abilityKey) {
					endOtherAbilityScoreInlineEdit(true);
				}
				if (otherAdjustAbilityKey && otherAdjustAbilityKey !== abilityKey) {
					endOtherAbilityAdjustSession();
				}
				endDexInlineEdit(true);
				endDexScoreInlineEdit(true);
				endInitInlineEdit(true);
				endInitAdjustSession();
				endStrInlineEdit(true);
				endStrScoreInlineEdit(true);
				endStrAdjustSession();
				endDexAdjustSession();
				const runtime = getOtherAbilityRuntime(abilityKey);
				if (!runtime) return;
				runtime.suppressNextClick = false;
				endOtherAbilityAdjustSession();
				otherAdjustAbilityKey = abilityKey;
				otherAdjustPointerId = event.pointerId;
				otherPressStartClientX = Number.isFinite(event.clientX) ? event.clientX : null;
				otherPressStartClientY = Number.isFinite(event.clientY) ? event.clientY : null;
				otherPressMoved = false;
				otherAdjustLastClientY = Number.isFinite(event.clientY) ? event.clientY : null;
				otherAdjustHoldTimer = window.setTimeout(() => {
					if (otherAdjustPointerId !== event.pointerId || otherAdjustAbilityKey !== abilityKey) return;
					setOtherAbilityAdjustArmed(abilityKey, true);
				}, PLAYER_INFO_STD_ABILITY_HOLD_DELAY_MS);

				if (typeof otherTarget?.setPointerCapture === 'function') {
					try {
						otherTarget.setPointerCapture(event.pointerId);
					} catch {
					}
				}
				return;
			}

			endDexInlineEdit(true);
			endDexScoreInlineEdit(true);
			endInitInlineEdit(true);
			endInitAdjustSession();
			endStrInlineEdit(true);
			endStrScoreInlineEdit(true);
			endOtherAbilityInlineEdit(true);
			endOtherAbilityScoreInlineEdit(true);
			endOtherAbilityAdjustSession();
			endStrAdjustSession();
			dexSuppressNextClick = false;
			endDexAdjustSession();
			dexAdjustPointerId = event.pointerId;
			dexPressStartClientX = Number.isFinite(event.clientX) ? event.clientX : null;
			dexPressStartClientY = Number.isFinite(event.clientY) ? event.clientY : null;
			dexPressMoved = false;
			dexAdjustLastClientY = Number.isFinite(event.clientY) ? event.clientY : null;
			dexAdjustHoldTimer = window.setTimeout(() => {
				if (dexAdjustPointerId !== event.pointerId) return;
				setDexAdjustArmed(true);
			}, PLAYER_INFO_DEX_HOLD_DELAY_MS);

			if (typeof dexTarget?.setPointerCapture === 'function') {
				try {
					dexTarget.setPointerCapture(event.pointerId);
				} catch {
				}
			}
		});

		contentEl.addEventListener('pointermove', (event) => {
			if (profAdjustPointerId === event.pointerId || initAdjustPointerId === event.pointerId || strAdjustPointerId === event.pointerId || dexAdjustPointerId === event.pointerId || otherAdjustPointerId === event.pointerId) {
				logStrInteraction('content:pointermove-active-adjust', {
					clientX: event.clientX,
					clientY: event.clientY
				}, event);
			}
			if (profAdjustPointerId === event.pointerId) {
				if (Number.isFinite(profPressStartClientX) && Number.isFinite(profPressStartClientY)) {
					const movedX = Math.abs(event.clientX - profPressStartClientX);
					const movedY = Math.abs(event.clientY - profPressStartClientY);
					if (Math.max(movedX, movedY) > PLAYER_INFO_PROF_TAP_MOVE_THRESHOLD_PX) {
						profPressMoved = true;
					}
				}

				if (!profAdjustArmed) return;
				if (!Number.isFinite(profAdjustLastClientY)) {
					profAdjustLastClientY = event.clientY;
					return;
				}

				const deltaY = profAdjustLastClientY - event.clientY;
				if (Math.abs(deltaY) < PLAYER_INFO_PROF_DRAG_STEP_PX) return;
				const steps = Math.trunc(Math.abs(deltaY) / PLAYER_INFO_PROF_DRAG_STEP_PX);
				const direction = deltaY > 0 ? 1 : -1;
				if (steps > 0) {
					stepProfAdjustValue(direction * steps);
					profAdjustLastClientY = event.clientY;
				}

				event.preventDefault();
				event.stopPropagation();
				return;
			}

			if (strAdjustPointerId === event.pointerId) {
				if (Number.isFinite(strPressStartClientX) && Number.isFinite(strPressStartClientY)) {
					const movedX = Math.abs(event.clientX - strPressStartClientX);
					const movedY = Math.abs(event.clientY - strPressStartClientY);
					if (Math.max(movedX, movedY) > PLAYER_INFO_STR_TAP_MOVE_THRESHOLD_PX) {
						strPressMoved = true;
					}
				}

				if (!strAdjustArmed) return;
				if (!Number.isFinite(strAdjustLastClientY)) {
					strAdjustLastClientY = event.clientY;
					return;
				}

				const deltaY = strAdjustLastClientY - event.clientY;
				if (Math.abs(deltaY) < PLAYER_INFO_STR_DRAG_STEP_PX) return;
				const steps = Math.trunc(Math.abs(deltaY) / PLAYER_INFO_STR_DRAG_STEP_PX);
				const direction = deltaY > 0 ? 1 : -1;
				if (steps > 0) {
					stepStrAdjustValue(direction * steps);
					strAdjustLastClientY = event.clientY;
				}

				event.preventDefault();
				event.stopPropagation();
				return;
			}

			if (initAdjustPointerId === event.pointerId) {
				if (Number.isFinite(initPressStartClientX) && Number.isFinite(initPressStartClientY)) {
					const movedX = Math.abs(event.clientX - initPressStartClientX);
					const movedY = Math.abs(event.clientY - initPressStartClientY);
					if (Math.max(movedX, movedY) > PLAYER_INFO_INIT_TAP_MOVE_THRESHOLD_PX) {
						initPressMoved = true;
					}
				}

				if (!initAdjustArmed) return;
				if (!Number.isFinite(initAdjustLastClientY)) {
					initAdjustLastClientY = event.clientY;
					return;
				}

				const deltaY = initAdjustLastClientY - event.clientY;
				if (Math.abs(deltaY) < PLAYER_INFO_INIT_DRAG_STEP_PX) return;
				const steps = Math.trunc(Math.abs(deltaY) / PLAYER_INFO_INIT_DRAG_STEP_PX);
				const direction = deltaY > 0 ? 1 : -1;
				if (steps > 0) {
					stepInitAdjustValue(direction * steps);
					initAdjustLastClientY = event.clientY;
				}

				event.preventDefault();
				event.stopPropagation();
				return;
			}

			if (dexAdjustPointerId === event.pointerId) {
				if (Number.isFinite(dexPressStartClientX) && Number.isFinite(dexPressStartClientY)) {
					const movedX = Math.abs(event.clientX - dexPressStartClientX);
					const movedY = Math.abs(event.clientY - dexPressStartClientY);
					if (Math.max(movedX, movedY) > PLAYER_INFO_DEX_TAP_MOVE_THRESHOLD_PX) {
						dexPressMoved = true;
					}
				}

				if (!dexAdjustArmed) return;
				if (!Number.isFinite(dexAdjustLastClientY)) {
					dexAdjustLastClientY = event.clientY;
					return;
				}

				const deltaY = dexAdjustLastClientY - event.clientY;
				if (Math.abs(deltaY) < PLAYER_INFO_DEX_DRAG_STEP_PX) return;
				const steps = Math.trunc(Math.abs(deltaY) / PLAYER_INFO_DEX_DRAG_STEP_PX);
				const direction = deltaY > 0 ? 1 : -1;
				if (steps > 0) {
					stepDexAdjustValue(direction * steps);
					dexAdjustLastClientY = event.clientY;
				}

				event.preventDefault();
				event.stopPropagation();
				return;
			}

			if (otherAdjustPointerId !== event.pointerId) return;
			if (Number.isFinite(otherPressStartClientX) && Number.isFinite(otherPressStartClientY)) {
				const movedX = Math.abs(event.clientX - otherPressStartClientX);
				const movedY = Math.abs(event.clientY - otherPressStartClientY);
				if (Math.max(movedX, movedY) > PLAYER_INFO_STD_ABILITY_TAP_MOVE_THRESHOLD_PX) {
					otherPressMoved = true;
				}
			}

			const runtime = getOtherAbilityRuntime(otherAdjustAbilityKey);
			if (!runtime?.adjustArmed) return;
			if (!Number.isFinite(otherAdjustLastClientY)) {
				otherAdjustLastClientY = event.clientY;
				return;
			}

			const deltaY = otherAdjustLastClientY - event.clientY;
			if (Math.abs(deltaY) < PLAYER_INFO_STD_ABILITY_DRAG_STEP_PX) return;
			const steps = Math.trunc(Math.abs(deltaY) / PLAYER_INFO_STD_ABILITY_DRAG_STEP_PX);
			const direction = deltaY > 0 ? 1 : -1;
			if (steps > 0 && otherAdjustAbilityKey) {
				stepOtherAbilityAdjustValue(otherAdjustAbilityKey, direction * steps);
				otherAdjustLastClientY = event.clientY;
			}

			event.preventDefault();
			event.stopPropagation();
		});

		const endProfPointerSession = (event) => {
			if (profAdjustPointerId === null) return;
			if (event && Number.isFinite(event.pointerId) && event.pointerId !== profAdjustPointerId) return;
			if (!isPlayerSheetEditMode) {
				endProfAdjustSession();
				return;
			}
			const wasArmed = profAdjustArmed;
			const wasMoved = profPressMoved;
			const isTouchPointer = String(event?.pointerType || '').toLowerCase() === 'touch';

			if (wasArmed || wasMoved) {
				profSuppressNextClick = true;
			}

			endProfAdjustSession();

			// Touch tap should open text entry directly with no synthetic-click dependency.
			if (isTouchPointer && !wasArmed && !wasMoved) {
				profSuppressNextClick = true;
				startProfInlineEdit();
			}
		};

		contentEl.addEventListener('pointerup', endProfPointerSession);
		contentEl.addEventListener('pointercancel', endProfPointerSession);
		contentEl.addEventListener('pointerleave', endProfPointerSession);

		const endInitPointerSession = (event) => {
			if (initAdjustPointerId === null) return;
			if (event && Number.isFinite(event.pointerId) && event.pointerId !== initAdjustPointerId) return;
			if (!isPlayerSheetEditMode) {
				endInitAdjustSession();
				return;
			}
			const wasArmed = initAdjustArmed;
			const wasMoved = initPressMoved;
			const isTouchPointer = String(event?.pointerType || '').toLowerCase() === 'touch';

			if (wasArmed || wasMoved) {
				initSuppressNextClick = true;
			}

			endInitAdjustSession();

			if (isTouchPointer && !wasArmed && !wasMoved) {
				initSuppressNextClick = true;
				startInitInlineEdit();
			}
		};

		contentEl.addEventListener('pointerup', endInitPointerSession);
		contentEl.addEventListener('pointercancel', endInitPointerSession);
		contentEl.addEventListener('pointerleave', endInitPointerSession);

		const endStrPointerSession = (event, options = {}) => {
			logStrInteraction('str-adjust:pointer-session-end', {
				allowTouchTapEdit: options.allowTouchTapEdit !== false
			}, event);
			const allowTouchTapEdit = options.allowTouchTapEdit !== false;
			if (strAdjustPointerId === null) return;
			if (event && Number.isFinite(event.pointerId) && event.pointerId !== strAdjustPointerId) return;
			if (!isPlayerSheetEditMode) {
				endStrAdjustSession();
				return;
			}
			const wasArmed = strAdjustArmed;
			const wasMoved = strPressMoved;
			const isTouchPointer = String(event?.pointerType || '').toLowerCase() === 'touch';

			if (wasArmed || wasMoved) {
				strSuppressNextClick = true;
			}

			endStrAdjustSession();

			if (allowTouchTapEdit && isTouchPointer && !wasArmed && !wasMoved) {
				strSuppressNextClick = true;
				startStrInlineEdit();
			}
		};

		contentEl.addEventListener('pointerup', (event) => {
			endStrPointerSession(event, { allowTouchTapEdit: true });
		});
		contentEl.addEventListener('pointercancel', (event) => {
			endStrPointerSession(event, { allowTouchTapEdit: false });
		});
		contentEl.addEventListener('pointerleave', (event) => {
			endStrPointerSession(event, { allowTouchTapEdit: false });
		});

		const endDexPointerSession = (event, options = {}) => {
			const allowTouchTapEdit = options.allowTouchTapEdit !== false;
			if (dexAdjustPointerId === null) return;
			if (event && Number.isFinite(event.pointerId) && event.pointerId !== dexAdjustPointerId) return;
			if (!isPlayerSheetEditMode) {
				endDexAdjustSession();
				return;
			}
			const wasArmed = dexAdjustArmed;
			const wasMoved = dexPressMoved;
			const isTouchPointer = String(event?.pointerType || '').toLowerCase() === 'touch';

			if (wasArmed || wasMoved) {
				dexSuppressNextClick = true;
			}

			endDexAdjustSession();

			if (allowTouchTapEdit && isTouchPointer && !wasArmed && !wasMoved) {
				dexSuppressNextClick = true;
				startDexInlineEdit();
			}
		};

		contentEl.addEventListener('pointerup', (event) => {
			endDexPointerSession(event, { allowTouchTapEdit: true });
		});
		contentEl.addEventListener('pointercancel', (event) => {
			endDexPointerSession(event, { allowTouchTapEdit: false });
		});
		contentEl.addEventListener('pointerleave', (event) => {
			endDexPointerSession(event, { allowTouchTapEdit: false });
		});

		const endOtherPointerSession = (event, options = {}) => {
			const allowTouchTapEdit = options.allowTouchTapEdit !== false;
			if (otherAdjustPointerId === null) return;
			if (event && Number.isFinite(event.pointerId) && event.pointerId !== otherAdjustPointerId) return;
			if (!isPlayerSheetEditMode) {
				endOtherAbilityAdjustSession();
				return;
			}
			const abilityKey = otherAdjustAbilityKey;
			const runtime = getOtherAbilityRuntime(abilityKey);
			const wasArmed = !!runtime?.adjustArmed;
			const wasMoved = otherPressMoved;
			const isTouchPointer = String(event?.pointerType || '').toLowerCase() === 'touch';

			if (runtime && (wasArmed || wasMoved)) {
				runtime.suppressNextClick = true;
			}

			endOtherAbilityAdjustSession();

			if (allowTouchTapEdit && isTouchPointer && !wasArmed && !wasMoved && abilityKey) {
				const resolvedRuntime = getOtherAbilityRuntime(abilityKey);
				if (resolvedRuntime) {
					resolvedRuntime.suppressNextClick = true;
				}
				startOtherAbilityInlineEdit(abilityKey);
			}
		};

		contentEl.addEventListener('pointerup', (event) => {
			endOtherPointerSession(event, { allowTouchTapEdit: true });
		});
		contentEl.addEventListener('pointercancel', (event) => {
			endOtherPointerSession(event, { allowTouchTapEdit: false });
		});
		contentEl.addEventListener('pointerleave', (event) => {
			endOtherPointerSession(event, { allowTouchTapEdit: false });
		});

		contentEl.addEventListener('wheel', (event) => {
			logStrInteraction('content:wheel', {
				deltaY: event.deltaY,
				deltaMode: event.deltaMode
			}, event);
			if (!(event.target instanceof Element)) return;
			if (event.target.closest('.player-info-prof-input')) return;
			if (event.target.closest('.player-info-init-input')) return;
			if (event.target.closest('.player-info-str-input')) return;
			if (event.target.closest('.player-info-str-score-input')) return;
			if (event.target.closest('.player-info-dex-input')) return;
			if (event.target.closest('.player-info-dex-score-input')) return;
			if (!isPlayerSheetEditMode) return;
			const profTarget = event.target.closest('[data-player-info-prof-adjust="true"]');
			if (profTarget && profAdjustArmed) {
				const deltaPixels = getWheelDeltaPixels(event);
				if (!Number.isFinite(deltaPixels) || deltaPixels === 0) return;
				stepProfAdjustValue(deltaPixels < 0 ? 1 : -1);
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const initTarget = event.target.closest('[data-player-info-init-adjust="true"]');
			if (initTarget && initAdjustArmed) {
				const deltaPixels = getWheelDeltaPixels(event);
				if (!Number.isFinite(deltaPixels) || deltaPixels === 0) return;
				stepInitAdjustValue(deltaPixels < 0 ? 1 : -1);
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const strTarget = event.target.closest('[data-player-info-str-adjust="true"]');
			if (strTarget && strAdjustArmed) {
				const deltaPixels = getWheelDeltaPixels(event);
				if (!Number.isFinite(deltaPixels) || deltaPixels === 0) return;
				stepStrAdjustValue(deltaPixels < 0 ? 1 : -1);
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const dexTarget = event.target.closest('[data-player-info-dex-adjust="true"]');
			if (dexTarget && dexAdjustArmed) {
				const deltaPixels = getWheelDeltaPixels(event);
				if (!Number.isFinite(deltaPixels) || deltaPixels === 0) return;
				stepDexAdjustValue(deltaPixels < 0 ? 1 : -1);
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			const otherTarget = event.target.closest('[data-player-info-other-adjust="true"]');
			if (!otherTarget) return;
			const abilityKey = String(otherTarget.getAttribute('data-player-info-ability-key') || '').toLowerCase().trim();
			if (!abilityKey) return;
			const runtime = getOtherAbilityRuntime(abilityKey);
			if (!runtime?.adjustArmed) return;
			const deltaPixels = getWheelDeltaPixels(event);
			if (!Number.isFinite(deltaPixels) || deltaPixels === 0) return;
			stepOtherAbilityAdjustValue(abilityKey, deltaPixels < 0 ? 1 : -1);
			event.preventDefault();
			event.stopPropagation();
		}, { passive: false });

		document.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') return;
			if (!windowEl.classList.contains('visible')) return;
			endProfInlineEdit(false);
			endInitInlineEdit(false);
			endStrInlineEdit(false);
			endStrScoreInlineEdit(false);
			endDexInlineEdit(false);
			endDexScoreInlineEdit(false);
			endOtherAbilityInlineEdit(false);
			endOtherAbilityScoreInlineEdit(false);
			endProfAdjustSession();
			endInitAdjustSession();
			endStrAdjustSession();
			endDexAdjustSession();
			endOtherAbilityAdjustSession();
			setPlayerSheetEditMode(false);
			setWindowVisible(false);
		});

		headerEl.addEventListener('pointerdown', startDrag);
		headerEl.addEventListener('pointermove', onDragMove);
		headerEl.addEventListener('pointerup', stopDrag);
		headerEl.addEventListener('pointercancel', stopDrag);
		windowEl.addEventListener('pointerdown', () => {
			promoteOverlayWindow();
		}, true);
		document.addEventListener('wheel', onCanvasCoupledWheel, { capture: true, passive: false });
		window.addEventListener('blur', stopDrag);
		window.addEventListener('blur', endProfAdjustSession);
		window.addEventListener('blur', endInitAdjustSession);
		window.addEventListener('blur', endStrAdjustSession);
		window.addEventListener('blur', endDexAdjustSession);
		window.addEventListener('blur', endOtherAbilityAdjustSession);

		window.addEventListener('resize', () => {
			updateResponsiveScale();
			clampWindowToViewport();
			syncCanvasDebugLineState();
			writePersistedWindowState();
		});

		if (typeof narrowMediaQuery?.addEventListener === 'function') {
			narrowMediaQuery.addEventListener('change', () => {
				updateResponsiveScale();
				clampWindowToViewport();
			});
		} else if (typeof narrowMediaQuery?.addListener === 'function') {
			narrowMediaQuery.addListener(() => {
				updateResponsiveScale();
				clampWindowToViewport();
			});
		}

		if (typeof ResizeObserver === 'function') {
			const resizeObserver = new ResizeObserver(() => {
				updateResponsiveScale();
			});
			resizeObserver.observe(windowEl);
		}

		const mutationTargets = [
			document.getElementById('active-combatant-buffer-value'),
			document.getElementById('available-combatant-buffer-list-box')
		].filter(Boolean);

		if (typeof MutationObserver === 'function' && mutationTargets.length) {
			const observer = new MutationObserver(() => {
				renderPlayerInfoContent();
			});
			mutationTargets.forEach((target) => {
				observer.observe(target, {
					childList: true,
					subtree: true,
					characterData: true,
					attributes: true,
					attributeFilter: ['class']
				});
			});
		}

		setInterval(() => {
			if (!windowEl.classList.contains('visible')) return;
			renderPlayerInfoContent();
		}, 1200);

		window.renderPlayerInfoWindow = () => renderPlayerInfoContent(true);
		window.togglePlayerInfoWindow = () => setWindowVisible(!windowEl.classList.contains('visible'));
		window.playerInfoStrDebug = {
			getSnapshot: () => buildStrengthTraceSnapshot(),
			getProfile: () => resolveStrengthModifierProfile(getActiveCharacterData() || {}),
			clearOverrides: () => {
				const activeCharacterData = getActiveCharacterData();
				if (!activeCharacterData || typeof activeCharacterData !== 'object') return false;
				if (!activeCharacterData.playerSheetOverrides || typeof activeCharacterData.playerSheetOverrides !== 'object') {
					activeCharacterData.playerSheetOverrides = {};
				}
				delete activeCharacterData.playerSheetOverrides.strengthModifier;
				delete activeCharacterData.playerSheetOverrides.strengthScore;
				persistCommittedCharacterData(activeCharacterData);
				renderPlayerInfoContent(true);
				applyProfNodeVisualState();
				logStrInteraction('manual-debug:clearOverrides');
				return true;
			}
		};
		window.resetPlayerInfoWindowPosition = () => {
			if (currentMode === 'canvas') {
				moveToCanvasMode(true);
				writePersistedWindowState();
				return;
			}
			moveToOverlayMode();
			writePersistedWindowState();
		};

		if (typeof MutationObserver === 'function') {
			const debugBodyClassObserver = new MutationObserver(() => {
				syncCanvasDebugLineState();
			});
			debugBodyClassObserver.observe(document.body, {
				attributes: true,
				attributeFilter: ['class']
			});
		}

		moveToOverlayMode();
		updateResponsiveScale();
		renderPlayerInfoContent(true);
		updateCommitButtonState();
		updateWidgetStateMetadata();
		syncCanvasDebugLineState();
		restorePersistedWindowState();
		isBootstrappingState = false;
		writePersistedWindowState();
		window.addEventListener('beforeunload', writePersistedWindowState);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initPlayerInfoWindow, { once: true });
	} else {
		initPlayerInfoWindow();
	}
})();
