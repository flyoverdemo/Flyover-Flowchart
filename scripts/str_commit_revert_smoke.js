function clampImportedNumeric(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function extractFirstFiniteNumber(candidates) {
  for (const candidate of candidates) {
    const parsed = clampImportedNumeric(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
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
  return truncatedScore >= 1 && truncatedScore <= 30;
}

function normalizeStrengthScore(scoreValue) {
  if (!isValidStrengthScore(scoreValue)) return null;
  return Math.trunc(Number(scoreValue));
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

function extractAbilityScore(abilityEntry) {
  if (abilityEntry === null || abilityEntry === undefined) return null;
  if (typeof abilityEntry === 'number') return clampImportedNumeric(abilityEntry);
  if (typeof abilityEntry === 'string' && abilityEntry.trim()) return clampImportedNumeric(abilityEntry);
  if (typeof abilityEntry !== 'object') return null;
  const candidates = [abilityEntry.score, abilityEntry.value, abilityEntry.base, abilityEntry.total];
  for (const candidate of candidates) {
    const parsed = clampImportedNumeric(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function extractAbilityModifier(abilityEntry) {
  if (abilityEntry === null || abilityEntry === undefined) return null;
  if (typeof abilityEntry === 'number') {
    const importedSafe = clampImportedNumeric(abilityEntry);
    if (!Number.isFinite(importedSafe)) return null;
    const inferredFromScore = Math.floor((importedSafe - 10) / 2);
    return Number.isFinite(inferredFromScore) ? inferredFromScore : importedSafe;
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
  if (Number.isFinite(scoreCandidate)) return Math.floor((scoreCandidate - 10) / 2);
  return null;
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

  const sourceScore = normalizeStrengthScore(extractAbilityScore(strengthEntry));
  const sourceModifier = extractAbilityModifier(strengthEntry);

  const committedModifierRaw = extractFirstFiniteNumber([
    characterData?.playerSheetOverrides?.strengthModifier
  ]);
  const committedScoreRaw = extractFirstFiniteNumber([
    characterData?.playerSheetOverrides?.strengthScore
  ]);
  const committedModifier = Number.isFinite(committedModifierRaw) ? Math.trunc(committedModifierRaw) : null;
  const committedScore = normalizeStrengthScore(committedScoreRaw);

  let resolvedScore = Number.isFinite(committedScore)
    ? committedScore
    : (Number.isFinite(sourceScore) ? Math.trunc(sourceScore) : null);

  const committedModifierFromScore = getAbilityModifierFromScore(committedScore);
  const sourceModifierFromScore = getAbilityModifierFromScore(sourceScore);
  let resolvedModifier = Number.isFinite(committedModifier)
    ? committedModifier
    : (Number.isFinite(committedModifierFromScore)
      ? committedModifierFromScore
      : (Number.isFinite(sourceModifierFromScore)
        ? sourceModifierFromScore
        : (Number.isFinite(sourceModifier) ? Math.trunc(sourceModifier) : null)));

  const playerSheetOriginals = (characterData?.playerSheetOriginals && typeof characterData.playerSheetOriginals === 'object')
    ? characterData.playerSheetOriginals
    : null;
  const baselineScore = normalizeStrengthScore(extractAbilityScore(baselineStrengthEntry));

  const originalScoreRaw = extractFirstFiniteNumber([
    playerSheetOriginals?.strengthScore,
    strengthEntry?.scoreOriginal,
    baselineScore
  ]);
  const originalScore = normalizeStrengthScore(originalScoreRaw);

  if (!Number.isFinite(resolvedScore)) {
    resolvedScore = extractFirstFiniteNumber([originalScore, baselineScore, 10]);
    resolvedScore = normalizeStrengthScore(resolvedScore);
  }

  if (!Number.isFinite(committedModifier) && Number.isFinite(resolvedScore)) {
    const derivedResolvedModifier = getAbilityModifierFromScore(resolvedScore);
    if (Number.isFinite(derivedResolvedModifier)) {
      resolvedModifier = Math.trunc(derivedResolvedModifier);
    }
  }

  return {
    resolvedScore,
    resolvedModifier,
    committedScore,
    committedModifier,
    originalScore
  };
}

function applyCommit(characterData, localState) {
  const next = JSON.parse(JSON.stringify(characterData));
  next.playerSheetOverrides = next.playerSheetOverrides || {};
  next.playerSheetOriginals = next.playerSheetOriginals || {};

  const hasStrScoreCommitOverride = Number.isFinite(localState.strScoreManualOverrideValue)
    && Number.isFinite(localState.strScoreDefaultValue)
    && localState.strScoreManualOverrideValue !== localState.strScoreDefaultValue;
  const hasStrModCommitOverride = Number.isFinite(localState.strManualOverrideValue)
    && Number.isFinite(localState.strDefaultValue)
    && localState.strManualOverrideValue !== localState.strDefaultValue;

  const committedStrScoreValue = hasStrScoreCommitOverride
    ? Math.trunc(localState.strScoreManualOverrideValue)
    : null;
  const committedStrValue = Number.isFinite(committedStrScoreValue)
    ? getAbilityModifierFromScore(committedStrScoreValue)
    : (hasStrModCommitOverride ? Math.trunc(localState.strManualOverrideValue) : null);

  if (!isValidStrengthScore(next.playerSheetOriginals.strengthScore)) {
    const profileBeforeCommit = resolveStrengthModifierProfile(next);
    next.playerSheetOriginals.strengthScore = normalizeStrengthScore(
      profileBeforeCommit.originalScore ?? profileBeforeCommit.resolvedScore ?? committedStrScoreValue ?? 10
    ) ?? 10;
  }

  if (Number.isFinite(committedStrValue)) {
    next.playerSheetOverrides.strengthModifier = committedStrValue;
    if (!Number.isFinite(committedStrScoreValue)) {
      delete next.playerSheetOverrides.strengthScore;
    }
  }

  if (Number.isFinite(committedStrScoreValue)) {
    next.playerSheetOverrides.strengthScore = committedStrScoreValue;
  }

  const profile = resolveStrengthModifierProfile(next);
  return { next, profile, committedStrScoreValue, committedStrValue };
}

function applyRevert(characterData) {
  const next = JSON.parse(JSON.stringify(characterData));
  const profile = resolveStrengthModifierProfile(next);
  next.playerSheetOverrides = next.playerSheetOverrides || {};
  delete next.playerSheetOverrides.strengthModifier;
  delete next.playerSheetOverrides.strengthScore;
  const after = resolveStrengthModifierProfile(next);
  return { next, before: profile, after };
}

function baseCharacter() {
  return {
    character: { name: 'Smoke Hero' },
    abilities: { strength: { score: 10, modifier: 0, scoreOriginal: 10, modifierOriginal: 0 } },
    abilityScores: { strength: { score: 10, modifier: 0 } },
    playerSheetOverrides: {},
    playerSheetOriginals: { strengthScore: 10, strengthModifier: 0 }
  };
}

const scenarios = [
  {
    name: 'score-11-commit-revert',
    run() {
      const state = baseCharacter();
      const pre = resolveStrengthModifierProfile(state);
      const commitResult = applyCommit(state, {
        strDefaultValue: pre.resolvedModifier,
        strManualOverrideValue: null,
        strScoreDefaultValue: pre.resolvedScore,
        strScoreManualOverrideValue: 11
      });
      const revertResult = applyRevert(commitResult.next);
      return {
        pre,
        committed: commitResult.profile,
        reverted: revertResult.after
      };
    }
  },
  {
    name: 'score-10-commit-no-op',
    run() {
      const state = baseCharacter();
      const pre = resolveStrengthModifierProfile(state);
      const commitResult = applyCommit(state, {
        strDefaultValue: pre.resolvedModifier,
        strManualOverrideValue: null,
        strScoreDefaultValue: pre.resolvedScore,
        strScoreManualOverrideValue: 10
      });
      return {
        pre,
        committed: commitResult.profile,
        overrides: commitResult.next.playerSheetOverrides
      };
    }
  },
  {
    name: 'mod-plus-3-commit-then-score-9-commit',
    run() {
      const state = baseCharacter();
      const pre = resolveStrengthModifierProfile(state);
      const commitMod = applyCommit(state, {
        strDefaultValue: pre.resolvedModifier,
        strManualOverrideValue: 3,
        strScoreDefaultValue: pre.resolvedScore,
        strScoreManualOverrideValue: null
      });
      const mid = resolveStrengthModifierProfile(commitMod.next);
      const commitScore = applyCommit(commitMod.next, {
        strDefaultValue: mid.resolvedModifier,
        strManualOverrideValue: null,
        strScoreDefaultValue: mid.resolvedScore,
        strScoreManualOverrideValue: 9
      });
      return {
        pre,
        afterModCommit: commitMod.profile,
        afterScoreCommit: commitScore.profile,
        overrides: commitScore.next.playerSheetOverrides
      };
    }
  },
  {
    name: 'corrupt-score-0-override-scrub',
    run() {
      const state = baseCharacter();
      state.playerSheetOverrides.strengthScore = 0;
      state.abilities.strength.score = 0;
      const profile = resolveStrengthModifierProfile(state);
      return {
        profile,
        hasInvalidOverride: !isValidStrengthScore(state.playerSheetOverrides.strengthScore)
      };
    }
  },
  {
    name: 'mod-16-then-score-22-coupled-delta',
    run() {
      // Equivalent to user flow: manual mod dirty to +16, then score to 22.
      // Baseline score 10 => mod 0, score 22 => mod 6, delta +6, final +22.
      const baselineScore = 10;
      const baselineScoreMod = getAbilityModifierFromScore(baselineScore);
      const manualModifier = 16;
      const offset = manualModifier - baselineScoreMod;
      const nextScore = 22;
      const nextScoreMod = getAbilityModifierFromScore(nextScore);
      const finalModifier = nextScoreMod + offset;
      return {
        baselineScore,
        baselineScoreMod,
        manualModifier,
        offset,
        nextScore,
        nextScoreMod,
        finalModifier,
        expectedFinalModifier: 22,
        matchesExpectation: finalModifier === 22
      };
    }
  },
  {
    name: 'committed-neg1-score11-to13-yields-zero',
    run() {
      const startingScore = 11;
      const startingScoreMod = getAbilityModifierFromScore(startingScore); // 0
      const startingFinalMod = -1; // committed dirty baseline in user flow
      const offset = startingFinalMod - startingScoreMod; // -1
      const nextScore = 13;
      const nextScoreMod = getAbilityModifierFromScore(nextScore); // +1
      const finalModifier = nextScoreMod + offset; // 0
      return {
        startingScore,
        startingScoreMod,
        startingFinalMod,
        offset,
        nextScore,
        nextScoreMod,
        finalModifier,
        expectedFinalModifier: 0,
        matchesExpectation: finalModifier === 0
      };
    }
  }
];

const results = scenarios.map((scenario) => {
  const output = scenario.run();
  const resolved = output?.committed ?? output?.profile ?? output?.afterScoreCommit ?? output?.reverted;
  const hasUnexpectedMinusFive = resolved?.resolvedScore === 10 && resolved?.resolvedModifier === -5;
  const hasZeroScore = resolved?.resolvedScore === 0;
  return {
    scenario: scenario.name,
    hasUnexpectedMinusFive,
    hasZeroScore,
    output
  };
});

console.log(JSON.stringify({ ok: true, scenarioCount: results.length, results }, null, 2));
