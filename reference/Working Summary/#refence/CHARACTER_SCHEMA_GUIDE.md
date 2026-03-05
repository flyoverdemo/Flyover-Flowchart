# Character Data Schema v2.0

## Overview
The character data schema has been completely reorganized to be **top-down, coherent, and scalable** for supporting multiple classes, multiclassing, and homebrew content. Data is organized into logical groupings that reflect both D&D 5e rules and future expansion capabilities.

## Architecture Principles

1. **Top-Down Organization** - Metadata → Identity → Mechanics → Resources → Traits
2. **Clear Separation of Concerns** - Each section has a specific purpose
3. **Multiclass Support** - Classes are stored in an array for easy multiclassing
4. **Homebrew Ready** - Custom fields and extensibility baked in
5. **Future Proof** - Easy to add new features without breaking existing data

---

## Top-Level Structure

```javascript
{
  metadata: { ... },        // Record information
  character: { ... },       // Character identity & demographics
  classes: [ ... ],         // Class(es) - supports multiclassing
  abilities: { ... },       // Six D&D ability scores (STR, DEX, etc.)
  combat: { ... },          // Combat mechanics (AC, HP, Speed, etc.)
  actions: { ... },         // Attack and ability actions
  features: { ... },        // Traits, features, and personality
  spellcasting: { ... },    // Spellcasting info (if applicable)
  resources: { ... },       // Equipment, currency, proficiencies
  social: { ... },          // Allies, enemies, organizations
  notes: { ... }            // Custom notes and backstory
}
```

---

## Section Details

### 1. METADATA

Stores **information about the character record itself**, not the character.

```javascript
metadata: {
  schema: 'chain_warden_v1',         // Schema version identifier
  schemaVersion: '2.0',              // Full version number
  created: '2026-02-28T...',         // ISO timestamp
  lastUpdated: '2026-02-28T...',     // ISO timestamp
  source: 'pdf_import',              // 'pdf_import' | 'manual_entry' | 'json_import' | 'homebrew'
  sourcePath: 'chain_warden.pdf',    // Original file if imported
  parseMethod: 'form_fields',        // 'form_fields' | 'text_extraction' | 'manual'
  parserVersion: '2.0.0',            // Parser version that created this
  needsReview: false,                // Flag if human verification needed
  notes: 'Parsed from PDF'           // Any parsing warnings/notes
}
```

**Usage**: Track where data came from, when it was updated, and if it needs verification.

---

### 2. CHARACTER (Identity & Demographics)

**Core character identity** - who the character is.

```javascript
character: {
  name: 'Thrall',
  alignment: 'Chaotic Good',
  xp: 0,
  
  demographics: {
    age: null,
    gender: 'Male',
    height: null,
    weight: null,
    size: 'Medium',               // Small, Medium, Large, etc.
    race: 'Half-Orc',
    subrace: null,                // e.g., 'Wood Elf', 'Mountain Dwarf'
    background: 'Criminal',
    faith: null                   // Religious affiliation
  },
  
  appearance: {
    skinColor: 'Green',
    hairColor: 'Black',
    eyeColor: 'Brown',
    distinguishingFeatures: 'Tusks'
  }
}
```

**Organization**:
- Top level: Core identity (name, alignment, XP)
- `demographics`: Basic biographical info
- `appearance`: Physical description

**Supports**: Any race/background (including homebrew)

---

### 3. CLASSES (Supports Multiclassing)

**One or more classes** the character has. Array structure supports multiclassing.

```javascript
classes: [
  {
    name: 'Rogue',                 // Class name (e.g., 'Rogue', 'Wizard', 'Cleric')
    subclass: 'Arcane Trickster',  // Subclass/Archetype (empty string if none)
    level: 5,                      // Current level in this class (1-20)
    hitDiceType: 'd8'              // Hit die for this class (d6, d8, d10, d12)
    classFeatures: []              // Class-specific features (future)
  }
  // For multiclass characters, add more entries:
  // { name: 'Wizard', subclass: '', level: 2, hitDiceType: 'd6' }
]
```

**Examples**:

Single class (Rogue 5):
```javascript
classes: [{ name: 'Rogue', subclass: 'Arcane Trickster', level: 5, hitDiceType: 'd8' }]
```

Multiclass (Rogue 3 / Wizard 2):
```javascript
classes: [
  { name: 'Rogue', subclass: 'Thief', level: 3, hitDiceType: 'd8' },
  { name: 'Wizard', subclass: '', level: 2, hitDiceType: 'd6' }
]
```

**Features**:
- Calculate total character level: `classes.reduce((sum, c) => sum + c.level, 0)`
- Calculate proficiency bonus from any class level: `Math.ceil(totalLevel / 4) + 1`
- Support for any custom/homebrew class

---

### 4. ABILITIES (Core Ability Scores)

**D&D 5e six core ability scores** with modifiers and associated skills.

```javascript
abilities: {
  strength: {
    score: 14,                     // Raw ability score (3-20)
    modifier: 2,                   // Calculated modifier: floor((score-10)/2)
    savingThrow: 2,                // Base saving throw (+ proficiency if applicable)
    proficiency: false,            // Is this a proficient saving throw?
    skills: ['Athletics']          // Associated skills for this ability
  },
  dexterity: {
    score: 16,
    modifier: 3,
    savingThrow: 3,
    proficiency: false,
    skills: ['Acrobatics', 'Sleight of Hand', 'Stealth']
  },
  // ... constitution, intelligence, wisdom, charisma
}
```

**Skill Associations** (auto-filled by default):
- **Strength**: Athletics
- **Dexterity**: Acrobatics, Sleight of Hand, Stealth
- **Constitution**: (No default skills)
- **Intelligence**: Arcana, History, Investigation, Nature, Religion
- **Wisdom**: Animal Handling, Insight, Medicine, Perception, Survival
- **Charisma**: Deception, Intimidation, Performance, Persuasion

**Usage**:
- Determine attack/damage bonuses
- Calculate saving throws (score + proficiency bonus if proficient)
- Resolve ability checks
- Spellcasting DC and attack bonuses

---

### 5. COMBAT (Battle Mechanics)

**All combat-related statistics**.

```javascript
combat: {
  armorClass: 15,                 // Armor Class (10 + DEX modifier + armor bonus)
  hitPoints: {
    max: 32,                       // Maximum HP
    current: 28,                   // Current HP
    temporary: 0                   // Temporary HP (from spells, features, etc.)
  },
  hitDice: [
    // { dice: '1d8', current: 1, max: 1, type: 'Rogue' }
  ],
  speed: 30,                       // Movement speed in feet per round
  initiative: 0,                   // Initiative modifier (usually DEX modifier)
  proficiencyBonus: 2              // Proficiency bonus (+2 = levels 1-4)
}
```

**Calculation Helpers**:
- **Proficiency Bonus**: `Math.ceil(totalCharacterLevel / 4) + 1`
- **Initiative**: Usually = `abilities.dexterity.modifier`
- **AC**: Varies by armor type (10 + DEX is typical light armor)
- **Max HP per level**: `baseMaxHP + (constitutionModifier × levels)`

---

### 6. ACTIONS (Combat Abilities)

**All types of actions** available in combat.

```javascript
actions: {
  weapons: [],                     // Weapon attacks (sword, bow, etc.)
  spellAttacks: [],                // Spell attacks (Fire Bolt, Shocking Grasp, etc.)
  cantrips: [],                    // 0-level spells / class abilities
  abilities: [],                   // Special abilities beyond standard combat
  bonusActions: [],                // Actions available as bonus action
  reactions: []                    // Reactions (Protection reaction, etc.)
}
```

**Weapon Attack Example**:
```javascript
{
  id: 'longsword_01',
  name: 'Longsword',
  type: 'weapon_attack',
  cost: '1_action',
  range: 'Melee',
  toHit: 4,                        // Attack bonus (STR+PROF, or DEX+PROF)
  damage: { 
    dice: '1d8',
    modifier: 2,                   // Ability modifier
    type: 'slashing' 
  }
}
```

---

### 7. FEATURES (Abilities & Personality)

**Class features, racial traits, and personality information**.

```javascript
features: {
  classFeatures: [],               // Class-specific abilities (Sneak Attack, etc.)
  raceTraits: [],                  // Racial traits (Darkvision, etc.)
  backgroundFeatures: [],          // Background features (Criminal Contact, etc.)
  customAbilities: [],             // Homebrew/custom features
  
  personality: {
    traits: 'I´m always looking for a way...',      // 2-4 personality traits
    ideals: 'I believe freedom is every...',        // Character ideals
    bonds: 'I owe my life to the...',               // Character bonds
    flaws: 'I have a weakness for...'               // Character flaws
  }
}
```

**Usage**: Define what makes the character unique and their role-playing personality.

---

### 8. SPELLCASTING (If Applicable)

**All spell-related information** for spellcasting classes.

```javascript
spellcasting: {
  isSpellcaster: true,
  spellcastingClass: 'Wizard',       // Class that casts spells
  spellcastingAbility: 'intelligence', // 'intelligence' | 'wisdom' | 'charisma'
  spellSaveDC: 14,                    // Spell Save DC
  spellAttackBonus: 4,                // Spell Attack Bonus
  
  cantrips: [
    // { name: 'Fire Bolt', castingTime: '1 action', range: '120 ft', ... }
  ],
  
  spells: {
    slots1: { max: 4, current: 3, spells: [] },     // 1st level spell slots
    slots2: { max: 2, current: 1, spells: [] },     // 2nd level spell slots
    slots3: { max: 0, current: 0, spells: [] },     // ... etc
    // ... slots4 through slots9
  },
  
  // Class-specific resources:
  pactSlots: { max: 0, current: 0 },                // Warlock
  sorceryPoints: { max: 0, current: 0 },            // Sorcerer
  bardInspirations: { max: 0, current: 0, diceType: 'd6' }  // Bard
}
```

**Usage**: Determine spellcasting DC and attack bonuses, track spell slots.

---

### 9. RESOURCES (Equipment & Proficiencies)

**Everything the character carries, has access to, or is proficient with**.

```javascript
resources: {
  // Equipment & Inventory
  equipment: [
    // { name: 'Longsword', qty: 1, weight: 3, equipped: true }
  ],
  
  // Money
  currency: {
    cp: 0,      // Copper pieces
    sp: 0,      // Silver pieces
    ep: 0,      // Electrum pieces
    gp: 50,     // Gold pieces
    pp: 0       // Platinum pieces
  },

  // Carrying Capacity
  carrying: {
    itemsCount: 12,
    weight: 45,
    maxWeight: 150,                  // Usually STR score × 15
    encumbered: false,
    heavilyEncumbered: false
  },

  // Magic Items & Attunement
  magicItems: [],                    // Magic items character possesses
  attunementSlots: { current: 0, max: 3 },

  // Proficiencies & Expertise
  proficiencies: {
    armor: ['Light armor', 'Medium armor', 'Shields'],
    weapons: ['Simple melee weapons', 'Hand crossbows'],
    tools: ['Thieves tools'],
    languages: ['Common', 'Draconic'],
    expertise: []                    // Rogue expertise, Bard master skills, etc.
  },

  // Passive Abilities
  passive: {
    perception: 12,                  // 10 + WIS modifier + proficiency (if applicable)
    investigation: 11,               // 10 + INT modifier + proficiency
    insight: 12                      // 10 + WIS modifier + proficiency
  },

  // Special Senses & Movement
  senses: {
    darkvision: 0,                   // Feet (0 = none)
    truesight: 0,
    specialMovement: []              // ['Climbing speed 15 ft', 'Flying speed 30 ft', ...]
  }
}
```

---

### 10. SOCIAL (Relationships)

**Connections to NPCs and factions**.

```javascript
social: {
  allies: [
    // { name: 'Aragorn', relationship: 'Traveling companion' }
  ],
  enemies: [
    // { name: 'The Black Count', relationship: 'Attempted killer' }
  ],
  organizations: [
    // { name: 'Thieves Guild', rank: 'Member' }
  ]
}
```

---

### 11. NOTES (Custom Content)

**Backstory and extensible custom fields**.

```javascript
notes: {
  backstory: 'Born in the slums of Waterdeep...',
  additionalNotes: 'Any other notes from player...',
  customContent: {
    // Completely open for homebrew data
    homebrewClass: { ... },
    magicalPatron: { ... },
    // etc.
  }
}
```

---

## Working with the Schema

### Example: Creating a New Character

```javascript
const parser = new CharacterPDFParser();
const blankCharacter = parser.createCharacterDataTemplate();

// Fill in basic info
blankCharacter.character.name = 'Sir Galahad';
blankCharacter.character.demographics.race = 'Human';
blankCharacter.character.demographics.background = 'Knight';
blankCharacter.character.alignment = 'Lawful Good';

// Add class
blankCharacter.classes.push({
  name: 'Paladin',
  subclass: 'Oath of Devotion',
  level: 5,
  hitDiceType: 'd10'
});

// Set ability scores
blankCharacter.abilities.strength.score = 15;
blankCharacter.abilities.strength.modifier = 2;
blankCharacter.abilities.charisma.score = 16;
blankCharacter.abilities.charisma.modifier = 3;
// ... etc

// Export
parser.exportToJSON(blankCharacter);
```

### Example: Multiclassing

```javascript
// Character starts as Rogue 5
character.classes = [{ name: 'Rogue', subclass: 'Thief', level: 5, hitDiceType: 'd8' }];

// Gains a level of Wizard
character.classes.push({ 
  name: 'Wizard', 
  subclass: '', 
  level: 1, 
  hitDiceType: 'd6' 
});

// Total character level = 5 + 1 = 6
const totalLevel = character.classes.reduce((sum, c) => sum + c.level, 0); // 6
```

### Example: Reading Data

```javascript
// Get character name
const name = character.character.name;

// Get all ability modifiers
const modifiers = Object.entries(character.abilities).map(([name, ability]) => ({
  name: name.charAt(0).toUpperCase() + name.slice(1),
  modifier: ability.modifier
}));

// Get total character level
const totalLevel = character.classes.reduce((sum, c) => sum + c.level, 0);

// Check if spellcaster
const isSpellcaster = character.spellcasting.isSpellcaster;

// Get armor proficiencies
const armorProfs = character.resources.proficiencies.armor;

// Access custom homebrew data
const customData = character.notes.customContent.homebrewClass;
```

---

## Migration from v1.0

If you have existing v1.0 character data:

| v1.0 | v2.0 |
|------|------|
| `character.name` | `character.name` |
| `character.class` | `classes[0].name` |
| `character.level` | `classes[0].level` |
| `character.race` | `character.demographics.race` |
| `character.background` | `character.demographics.background` |
| `character.alignment` | `character.alignment` |
| `abilityScores[ability]` | `abilities[ability]` |
| `combat.*` | `combat.*` (same) |
| `actions.primary` | `actions.weapons`, `actions.spellAttacks`, `actions.cantrips` |
| N/A | Now have proper spellcasting section |

---

## Best Practices

1. **Always validate metadata** - Check `parseMethod` to understand data quality
2. **Handle null values** - PDFs may not have all fields, so check before using
3. **Calculate derived values** - profBonus, initiative, passive skills  are often calculated, not stored
4. **Use class array properly** - Don't assume one class, iterate through all
5. **Keep custom content organized** - Use `notes.customContent` for any homebrew extensions
6. **Maintain backwards compatibility** - V2.0 data will have all v1.0 fields properly mapped

---

## Future Extensions

The schema is designed to support:
- **Multiclassing** ✓ (already supported)
- **Homebrew content** ✓ (notes.customContent)
- **Feat tracking** (add to features as needed)
- **Condition tracking** (add to combat if needed)
- **Character advancement tracking** (timeline in notes)
- **Inventory weight calculations** (carrying section)
- **Skill proficiency tracking** (expertise array)
- **Custom actions/homebrew abilities** (actions arrays)
