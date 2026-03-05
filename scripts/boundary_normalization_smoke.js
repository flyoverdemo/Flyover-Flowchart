const fs = require('fs');
const vm = require('vm');

global.window = global;
global.document = {};
global.localStorage = {
  _map: new Map(),
  getItem(key) { return this._map.has(key) ? this._map.get(key) : null; },
  setItem(key, value) { this._map.set(key, String(value)); },
  removeItem(key) { this._map.delete(key); }
};

global.fetch = async () => ({
  ok: true,
  json: async () => ({})
});

global.FileReader = class {
  readAsText() {
    if (typeof this.onerror === 'function') {
      this.onerror(new Error('FileReader smoke stub only'));
    }
  }
};

vm.runInThisContext(fs.readFileSync('character_loader.js', 'utf8'));

const loader = global.window?.characterLoader;
if (!loader || typeof loader.normalizeBoundaryCharacterData !== 'function') {
  console.log(JSON.stringify({
    ok: false,
    failedChecks: ['characterLoader_unavailable'],
    checks: { characterLoaderAvailable: false }
  }, null, 2));
  process.exit(1);
}

const raw = {
  combat: {
    ac: 16,
    hp: { max: 22, current: 18, temp: 4 },
    profBonus: 3
  },
  actions: {
    bonus: [{ name: 'Offhand', attackBonus: 5, magical: true }],
    reaction: [{ name: 'Riposte', to_hit: 6, damage: { value: '1d8', silvered: true } }],
    abilities: [{ name: 'Fear Pulse', saveDC: 14 }]
  }
};

const normalized = loader.normalizeBoundaryCharacterData(raw);

const checks = {
  armorClassCanonical: normalized?.combat?.armorClass === 16,
  acCompatibility: normalized?.combat?.ac === 16,
  hitPointsCanonical: normalized?.combat?.hitPoints?.max === 22
    && normalized?.combat?.hitPoints?.current === 18
    && normalized?.combat?.hitPoints?.temporary === 4,
  hpCompatibility: normalized?.combat?.hp?.max === 22
    && normalized?.combat?.hp?.current === 18
    && normalized?.combat?.hp?.temporary === 4,
  proficiencyCanonical: normalized?.combat?.proficiencyBonus === 3,
  profBonusCompatibility: normalized?.combat?.profBonus === 3,
  bonusActionsCanonical: Array.isArray(normalized?.actions?.bonusActions)
    && normalized.actions.bonusActions.length === 1,
  reactionCanonical: Array.isArray(normalized?.actions?.reactions)
    && normalized.actions.reactions.length === 1,
  canonicalActionFields: normalized?.actions?.bonusActions?.[0]?.toHit === 5
    && normalized?.actions?.bonusActions?.[0]?.isMagical === true
    && normalized?.actions?.reactions?.[0]?.toHit === 6
    && normalized?.actions?.reactions?.[0]?.damage?.isSilvered === true,
  saveDcCanonical: normalized?.actions?.abilities?.[0]?.saveDc === 14
};

const failedChecks = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
const ok = failedChecks.length === 0;

console.log(JSON.stringify({ ok, failedChecks, checks }, null, 2));
if (!ok) process.exit(1);
