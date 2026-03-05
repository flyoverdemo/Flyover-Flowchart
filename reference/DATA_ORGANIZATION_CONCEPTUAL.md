# Character Data Organization - Conceptual Overview

## The Logic Behind the New Schema

Your character data is now organized following a **top-down, narrative flow** that mirrors how you would describe a D&D character:

```
"Tell me about this character..."

1. WHO IS THIS CHARACTER?
   → Metadata (who collected this info, when, how)
   → Name, age, appearance
   
2. WHAT CAN THEY DO?
   → Classes & abilities
   → Ability scores (their raw potential)
   
3. HOW DO THEY FIGHT?
   → Combat mechanics (AC, HP, speed)
   → Combat actions (weapons, spells, abilities)
   
4. WHAT MAKES THEM SPECIAL?
   → Features & traits
   → Skills & proficiencies
   → Personality & bonds
   
5. WHAT DO THEY HAVE?
   → Equipment & resources
   → Currency
   → Social connections
```

---

## Section Hierarchy

### Level 1: Record Information (`metadata`)
**Purpose**: Track where this character data came from and how reliable it is

Contains:
- Source (PDF import, manual entry, etc.)
- When it was created/updated
- Parsing method used
- Flags for data that needs review

**Why first?**: You need to know if this data is trustworthy before using it.

---

### Level 2: Character Identity (`character`)
**Purpose**: Answer "Who is this character?"

Contains:
- **Name**: The character's name
- **Demographics**: Biological info (age, gender, height, race, etc.)
- **Appearance**: Visual description (skin, hair, eyes, scars, etc.)
- **Alignment**: Moral/ethical alignment
- **XP**: Experience points earned

**Subdivisioning**:
- Top-level fields: Essential identity (name, alignment)
- `demographics`: Biographical information
- `appearance`: Physical description

**Why here?**: These define WHO the character IS, the foundation for everything else.

---

### Level 3: Classes (`classes`)
**Purpose**: Define what the character does and their capabilities

**Key Feature**: ARRAY! Supports multiclassing

Structure:
```javascript
classes: [
  {
    name: 'Rogue',              // The class
    subclass: 'Arcane Trickster', // Specialization
    level: 5,                   // Level in this class
    hitDiceType: 'd8'           // Type of hit die
  }
]
```

**Single Class Example**:
```javascript
classes: [{ name: 'Fighter', subclass: 'Champion', level: 8, hitDiceType: 'd10' }]
```

**Multiclass Example**:
```javascript
classes: [
  { name: 'Rogue', subclass: 'Thief', level: 3, hitDiceType: 'd8' },
  { name: 'Wizard', subclass: '', level: 2, hitDiceType: 'd6' }
]
```

**Why an array?**: Multiclassing is the future! Store as array from day one.

---

### Level 4: Abilities (`abilities`)
**Purpose**: Define the character's core capabilities as D&D ability scores

Structure:
```javascript
abilities: {
  strength: {
    score: 15,                  // Raw score (3-20)
    modifier: 2,                // Calculated from score
    savingThrow: 2,             // Base save (+ prof if proficient)
    proficiency: false,         // Is proficient in STR saves?
    skills: ['Athletics']       // Associated skills
  },
  // ... dexterity, constitution, intelligence, wisdom, charisma
}
```

**Default Skill Associations**:
- STR: Athletics
- DEX: Acrobatics, Sleight of Hand, Stealth
- CON: (no skills)
- INT: Arcana, History, Investigation, Nature, Religion
- WIS: Animal Handling, Insight, Medicine, Perception, Survival
- CHA: Deception, Intimidation, Performance, Persuasion

**Why here?**: Abilities form the foundation for all checks, saves, and attack calculations.

---

### Level 5: Combat (`combat`)
**Purpose**: Consolidate all battle-related mechanics in one place

Structure:
```javascript
combat: {
  armorClass: 15,              // AC
  hitPoints: {
    max: 32,                   // Max HP
    current: 28,               // Current HP
    temporary: 0               // Temp HP
  },
  hitDice: [],                 // Hit dice tracking
  speed: 30,                   // Movement speed (feet)
  initiative: 0,               // Initiative modifier
  proficiencyBonus: 2          // Prof bonus
}
```

**Why here?**: All combat mechanics grouped together makes resolution fast.

---

### Level 6: Actions (`actions`)
**Purpose**: Organize every type of action the character can take

Structure:
```javascript
actions: {
  weapons: [],                 // Melee/ranged weapon attacks
  spellAttacks: [],           // Spell attacks (Fireball, etc.)
  cantrips: [],               // 0-level spells / class abilities
  abilities: [],              // Special abilities (not combat-specific)
  bonusActions: [],           // Bonus action actions
  reactions: []               // Reaction actions
}
```

**Why organized this way?**: Separated by ACTION TYPE, not by action name. Makes filtering/display easy:
- "What can you do on your turn?" → weapons + spellAttacks
- "What cantrips do you know?" → cantrips
- "Do you have reactions?" → reactions

---

### Level 7: Features (`features`)
**Purpose**: Define what makes the character special and their personality

Structure:
```javascript
features: {
  classFeatures: [],          // From their class (Sneak Attack, etc.)
  raceTraits: [],             // From their race (Darkvision, etc.)
  backgroundFeatures: [],     // From their background
  customAbilities: [],        // Homebrew abilities
  
  personality: {
    traits: '...',            // 2-4 personality traits
    ideals: '...',            // What they believe in
    bonds: '...',             // What they care about
    flaws: '...'              // Their weaknesses
  }
}
```

**Why this structure?**: Separates MECHANICAL features (damage, bonuses) from ROLEPLAY features (personality).

---

### Level 8: Spellcasting (`spellcasting`)
**Purpose**: Everything spell-related in one organized section

Structure:
```javascript
spellcasting: {
  isSpellcaster: true,
  spellcastingClass: 'Wizard',        // Which class casts spells
  spellcastingAbility: 'intelligence', // Key ability (INT/WIS/CHA)
  spellSaveDC: 14,                    // Spell save DC
  spellAttackBonus: 4,                // Spell attack bonus
  
  cantrips: [],                       // 0-level spells
  spells: {
    slots1: { max: 4, current: 3, spells: [] },
    slots2: { max: 2, current: 1, spells: [] },
    // ... slots3 through slots9
  },
  
  // Class-specific resources:
  pactSlots: { max: 0, current: 0 },              // Warlock
  sorceryPoints: { max: 0, current: 0 },          // Sorcerer
  bardInspirations: { max: 0, current: 0, diceType: 'd6' }  // Bard
}
```

**Why separate?**: Spellcasting is complex enough to warrant its own section. Easy to skip for non-casters.

---

### Level 9: Resources (`resources`)
**Purpose**: Everything the character carries or has access to

Structure:
```javascript
resources: {
  equipment: [],              // What they carry
  
  currency: {                 // Money
    cp: 0, sp: 0, ep: 0, gp: 50, pp: 0
  },
  
  carrying: {                 // Inventory tracking
    itemsCount: 12,
    weight: 45,
    maxWeight: 150,
    encumbered: false
  },
  
  magicItems: [],             // Magic Item array
  attunementSlots: { current: 0, max: 3 },
  
  proficiencies: {            // What they're trained with
    armor: [],
    weapons: [],
    tools: [],
    languages: [],
    expertise: []
  },
  
  passive: {                  // Passive checks
    perception: 12,
    investigation: 11,
    insight: 12
  },
  
  senses: {                   // Special senses
    darkvision: 0,
    truesight: 0,
    specialMovement: ['climbing speed 15 ft', ...]
  }
}
```

**Why organized this way?**: 
- Equipment/currency together (what they carry)
- Proficiencies together (what they're trained in)
- Senses together (perception/awareness)
- Everything a game master needs to reference is here

---

### Level 10: Social (`social`)
**Purpose**: Track relationships and connections

Structure:
```javascript
social: {
  allies: [{ name: 'Aragorn', relationship: 'Traveling companion' }],
  enemies: [{ name: 'The Black Count', relationship: 'Tried to kill me' }],
  organizations: [{ name: 'Thieves Guild', rank: 'Member' }]
}
```

**Why here?**: Relationships are important for roleplay and story hooks, so they get their own section.

---

### Level 11: Notes (`notes`)
**Purpose**: Backstory and extensibility for homebrew content

Structure:
```javascript
notes: {
  backstory: 'Born in the slums...',
  additionalNotes: 'Any other important notes...',
  customContent: {
    // Completely open for future expansion
    homebrewClass: { ... },
    magicalPatron: { ... },
    customFeature: { ... }
  }
}
```

**Why here?**: The catchall for everything that doesn't fit neatly into other sections.

---

## Data Flow Example

When displaying a character in the UI:

```
1. Get Name from: character.name
2. Get Classes from: classes array
3. Calculate Total Level from: sum of classes[].level
4. Get Ability Modifiers from: abilities[ability].modifier
5. Get Combat Stats from: combat object
6. Get Actions from: aggregate all action types
7. Get Passive Skills from: resources.passive object
8. Get Proficiencies from: resources.proficiencies object
9. Display Personality from: features.personality object
```

Each section can be displayed independently or in combinations as needed.

---

## Why This Organization?

1. **Logical Flow**: Flows top-down like you'd describe a character
2. **Clear Ownership**: Each field belongs in exactly one place
3. **Easy to Extend**: Add new fields anywhere without breaking existing code
4. **Multiclass Support**: Built-in from the start
5. **Homebrew Ready**: `customContent` object for any future features
6. **Performance**: Quick to find any piece of data
7. **Future Proof**: Structure supports advanced D&D features (feats, conditions, etc.)

---

## Comparison: Old vs New Organization

### Old Organization (Scattered)
```
character.name
character.class
character.level
character.race
character.background
character.alignment
character.experiencePoints
abilityScores.strength
abilityScores.dexterity
combat.armorClass
combat.hitPoints
actions.primary[]
actions.bonus[]
actions.reaction[]
```

**Problem**: Related data scattered across different paths. Hard to find things. Hard to extend.

### New Organization (Coherent)
```
character {
  name,
  alignment,
  xp,
  demographics { race, background, ... },
  appearance { ... }
}
classes [{
  name,
  level,
  subclass,
  hitDiceType
}]
abilities {
  strength { score, modifier, ... },
  dexterity { score, modifier, ... },
  ...
}
combat {
  armorClass,
  hitPoints { max, current, temporary },
  speed,
  proficiencyBonus
}
actions {
  weapons [],
  spellAttacks [],
  abilities []
}
```

**Benefit**: Logical grouping. Easy to find. Easy to extend. Supports multiclassing.

---

## Working with the Schema

### For Developers
- Clear structure makes writing features easier
- Each section is self-contained
- Easy to add new fields without conflicts
- Array for classes makes multiclassing trivial

### For Homebrew Creators
- Use `notes.customContent` for anything custom
- Extend existing arrays (features, proficiencies, etc.)
- Don't modify core structure

### For Future Enhancement
- Add feats to `features.classFeatures`
- Add conditions to `combat`
- Add faction ranks to `social.organizations`
- Add timeline to `notes`
- Any expansion fits cleanly into existing structure

---

## Summary

Your character data is now organized around **WHO the character IS → WHAT they can DO → WHAT they HAVE → WHAT MAKES THEM SPECIAL**. This mirrors how you naturally think about and describe characters, making the system intuitive and extensible.
