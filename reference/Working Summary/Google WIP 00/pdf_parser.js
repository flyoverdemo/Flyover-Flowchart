/**
 * PDF Parser for Chain Warden Character Sheets
 * Uses pdf.js to extract character data from PDF templates
 * 
 * Usage: 
 *   const parser = new CharacterPDFParser();
 *   const data = await parser.parsePDF('chain_warden.pdf');
 */

class CharacterPDFParser {
  constructor() {
    this.pdfjsLib = null;
    this.initialized = false;
  }

  /**
   * Initialize PDF.js library
   */
  async init() {
    if (this.initialized) return;
    
    // Load PDF.js from CDN
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    document.head.appendChild(script);
    
    await new Promise((resolve) => {
      script.onload = resolve;
    });
    
    this.pdfjsLib = window.pdfjsLib;
    this.pdfjsLib.GlobalWorkerOptions.workerSrc = 
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    this.initialized = true;
  }

  /**
   * Parse a PDF file and extract character data
   * @param {string} pdfPath - Path to the PDF file
   * @returns {Promise<Object>} - Parsed character data
   */
  async parsePDF(pdfPath) {
    await this.init();
    
    try {
      const loadingTask = this.pdfjsLib.getDocument(pdfPath);
      const pdf = await loadingTask.promise;
      
      const characterData = {
        schema: 'chain_warden_v1',
        lastUpdated: new Date().toISOString(),
        character: {},
        abilityScores: {},
        combat: {},
        actions: { primary: [], bonus: [], reaction: [] },
        features: [],
        spellSlots: {},
        spells: [],
        equipment: {},
        proficiencies: {},
        metadata: {
          pdfSource: pdfPath,
          parserVersion: '1.0.0',
          needsReview: false,
          notes: ''
        }
      };
      
      // Extract pages with position data
      const pages = await this.extractTextFromPDF(pdf);
      
      // Parse different sections
      await this.parseCharacterSection(pages, characterData);
      await this.parseAbilityScores(pages, characterData);
      await this.parseCombatSection(pages, characterData);
      await this.parseActionsSection(pages, characterData);
      await this.parseFeaturesSection(pages, characterData);
      await this.parseSpellsSection(pages, characterData);
      
      return characterData;
      
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw error;
    }
  }

  /**
   * Extract text from PDF with better structure
   */
  async extractTextFromPDF(pdf) {
    const pages = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Extract items with position information
      const items = textContent.items.map(item => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height
      }));
      
      // Sort items by position (top to bottom, left to right)
      items.sort((a, b) => {
        // First by Y (top to bottom)
        const yDiff = b.y - a.y;
        if (Math.abs(yDiff) > 10) return yDiff;
        // Then by X (left to right)
        return a.x - b.x;
      });
      
      pages.push({ pageNum, items });
    }

    return pages;
  }

  /**
   * Find value in positioned text - D&D Beyond sheet format
   */
  findValueInBox(items, label) {
    // Find the label item
    const labelItem = items.find(item => 
      item.str.toLowerCase().includes(label.toLowerCase()) &&
      item.str.length < 50 // Skip long labels
    );

    if (!labelItem) return null;

    // For D&D Beyond sheets, values are usually:
    // 1. To the right of the label (same Y, higher X)
    // 2. In a box below the label
    
    // Look for value to the right (within 200px)
    const valueItem = items.find(item => {
      const sameLine = Math.abs(item.y - labelItem.y) < 8;
      const toTheRight = item.x > labelItem.x + 10 && item.x < labelItem.x + 200;
      const notLabel = item.str.toLowerCase() !== labelItem.str.toLowerCase();
      const hasContent = item.str.length > 0 && item.str.length < 100;
      
      return sameLine && toTheRight && notLabel && hasContent;
    });

    if (valueItem) {
      // Clean up the value
      return valueItem.str.trim().replace(/[^a-zA-Z0-9\s+-]/g, '');
    }

    return null;
  }

  /**
   * Find numeric value in box (for abilities, AC, HP, etc.)
   */
  findNumericValue(items, label) {
    const labelItem = items.find(item => 
      item.str.toLowerCase().includes(label.toLowerCase())
    );

    if (!labelItem) return null;

    // Look for a number near the label
    const numberItem = items.find(item => {
      const nearLabel = Math.abs(item.x - labelItem.x) < 50 && Math.abs(item.y - labelItem.y) < 30;
      const isNumber = /^\d+$/.test(item.str);
      const notTooLong = item.str.length <= 3;
      
      return nearLabel && isNumber && notTooLong && item.str !== labelItem.str;
    });

    return numberItem ? parseInt(numberItem.str) : null;
  }

  /**
   * Parse character info section - D&D Beyond specific
   */
  async parseCharacterSection(pages, data) {
    const allItems = pages.flatMap(p => p.items);
    
    console.log('[PDF Parser] Total items:', allItems.length);
    
    // D&D Beyond sheets have a specific layout
    // We need to find text boxes by their position and content patterns
    
    // Filter out noise (copyright, labels, etc.)
    const noisePatterns = [
      /TM & ©/i,
      /Wizards of the Coast/i,
      /D&D Beyond/i,
      /Permission is granted/i,
      /EXPERIENCE POINTS/i,
      /PASSIVE PERCEPTION/i,
      /WEAPON ATTACKS/i,
      /CANTRIPS/i,
      /DAMAGE\/TYPE/i,
      /INITIATIVE/i,
      /SAVING THROWS/i,
      /PASSIVE INSIGHT/i,
      /PASSIVE INVESTIGATION/i,
      /Acrobatics/i,
      /Animal Handling/i,
      /Arcana/i,
      /Athletics/i,
      /Deception/i,
      /History/i,
      /Insight/i,
      /Intimidation/i,
      /Investigation/i,
      /Medicine/i,
      /Nature/i,
      /Perception/i,
      /Performance/i,
      /Persuasion/i,
      /Religion/i,
      /Sleight of Hand/i,
      /Stealth/i,
      /Survival/i,
      /Saving Throw Modifiers/i,
      /NOTES/i,
      /ACTIONS/i,
      /HEROIC INSPIRATION/i,
      /PROFICIENCIES/i,
      /TRAINING/i,
      /DEFENSES/i,
      /DEATH SAVES/i,
      /HIT DICE/i,
      /Total/i,
      /SUCCESSES/i,
      /FAILURES/i,
      /Max HP/i,
      /Current HP/i,
      /Temp HP/i,
      /SPEED/i,
      /ARMOR CLASS/i,
      /PROFICIENCY BONUS/i,
      /ABILITY SAVE DC/i,
      /PLAYER NAME/i,
      /CHARACTER NAME/i,
      /SENSES/i,
      /HIT/i,
      /NAME/i
    ];
    
    // Get meaningful text items
    const meaningfulItems = allItems.filter(item => {
      // Skip very short or very long strings
      if (item.str.length < 2 || item.str.length > 50) return false;
      
      // Skip noise patterns
      for (const pattern of noisePatterns) {
        if (pattern.test(item.str)) return false;
      }
      
      return true;
    });
    
    console.log('[PDF Parser] Meaningful items:', meaningfulItems.length);
    console.log('[PDF Parser] Sample:', meaningfulItems.slice(0, 10).map(i => i.str));
    
    // Group items by Y position (same line)
    const lines = [];
    let currentLine = [];
    let lastY = null;
    
    meaningfulItems.sort((a, b) => b.y - a.y || a.x - b.x);
    
    for (const item of meaningfulItems) {
      if (lastY === null || Math.abs(item.y - lastY) < 10) {
        currentLine.push(item);
      } else {
        if (currentLine.length > 0) {
          lines.push(currentLine);
        }
        currentLine = [item];
      }
      lastY = item.y;
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    
    console.log('[PDF Parser] Lines found:', lines.length);
    
    // Find character name (usually first meaningful text at top)
    let characterName = 'Unknown';
    let charClass = 'Fighter';
    let level = 1;
    let background = '';
    let race = '';
    let alignment = '';
    
    // Look for patterns in lines
    for (const line of lines) {
      const lineText = line.map(i => i.str).join(' ');
      
      // Character name is often on its own line near the top
      if (line.length === 1 && line[0].str.length > 3 && line[0].str.length < 30 && 
          !line[0].str.match(/\d/) && characterName === 'Unknown') {
        // Check if it's a proper name (capitalized, no special chars)
        if (line[0].str.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/)) {
          characterName = line[0].str;
          continue;
        }
      }
      
      // Class and level pattern: "Fighter 5" or "Paladin 9"
      const classMatch = lineText.match(/([A-Z][a-z]+)\s+(\d+)/);
      if (classMatch && !charClass.includes('Fighter')) {
        charClass = classMatch[1];
        level = parseInt(classMatch[2]);
      }
      
      // Background
      const backgroundPatterns = [/Soldier/i, /Acolyte/i, /Criminal/i, /Folk Hero/i, /Noble/i, /Sage/i];
      for (const pattern of backgroundPatterns) {
        if (lineText.match(pattern)) {
          background = pattern.source.replace(/[\/i]/g, '');
        }
      }
      
      // Race
      const racePatterns = [/Human/i, /Elf/i, /Dwarf/i, /Halfling/i, /Dragonborn/i, /Tiefling/i, /Gnome/i, /Half-Elf/i, /Half-Orc/i];
      for (const pattern of racePatterns) {
        if (lineText.match(pattern)) {
          race = pattern.source.replace(/[\/i]/g, '');
        }
      }
      
      // Alignment
      const alignmentPatterns = [/Lawful Good/i, /Neutral Good/i, /Chaotic Good/i, /Lawful Neutral/i, /True Neutral/i, /Chaotic Neutral/i, /Lawful Evil/i, /Neutral Evil/i, /Chaotic Evil/i];
      for (const pattern of alignmentPatterns) {
        if (lineText.match(pattern)) {
          alignment = pattern.source.replace(/[\/i]/g, '');
        }
      }
    }

    data.character = {
      name: characterName,
      class: charClass,
      subclass: '',
      level: level,
      background: background,
      race: race,
      alignment: alignment,
      experiencePoints: 0
    };
    
    console.log('[PDF Parser] Final character:', data.character);
  }

  /**
   * Parse ability scores section
   */
  async parseAbilityScores(pages, data) {
    const allItems = pages.flatMap(p => p.items);
    
    const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    
    for (const ability of abilities) {
      // Look for the ability score box value
      const score = this.findValueInBox(allItems, ability);
      
      if (score) {
        const scoreNum = parseInt(score);
        const modifier = Math.floor((scoreNum - 10) / 2);
        
        data.abilityScores[ability] = {
          score: scoreNum || 10,
          modifier: modifier,
          savingThrow: modifier,
          skills: []
        };
      } else {
        // Default values
        data.abilityScores[ability] = {
          score: 10,
          modifier: 0,
          savingThrow: 0,
          skills: []
        };
      }
    }
  }

  /**
   * Parse combat section (AC, HP, etc.)
   */
  async parseCombatSection(pages, data) {
    const allItems = pages.flatMap(p => p.items);
    
    // Find AC
    const ac = this.findValueInBox(allItems, 'AC') || 
               this.findValueInBox(allItems, 'Armor Class');
    
    // Find HP
    const hp = this.findValueInBox(allItems, 'Hit Points') ||
               this.findValueInBox(allItems, 'HP');
    
    // Find Speed
    const speed = this.findValueInBox(allItems, 'Speed');
    
    // Find Proficiency Bonus
    const profBonus = this.findValueInBox(allItems, 'Proficiency Bonus');

    data.combat = {
      armorClass: ac ? parseInt(ac) : 10,
      hitPoints: { 
        max: hp ? parseInt(hp) : 10, 
        current: hp ? parseInt(hp) : 10, 
        temp: 0 
      },
      hitDice: '1d10',
      speed: speed ? parseInt(speed) : 30,
      initiative: 0,
      proficiencyBonus: profBonus ? parseInt(profBonus) : 2
    };
  }

  /**
   * Parse actions section (attacks, abilities)
   */
  async parseActionsSection(pages, data) {
    const allItems = pages.flatMap(p => p.items);
    
    // Look for attack sections
    const attacks = [];
    let currentAttack = null;
    
    for (const item of allItems) {
      const str = item.str;
      
      // Detect attack names (typically followed by hit bonus)
      if (str.match(/^[A-Z][a-z]+.*Attack$/) || str.match(/^[A-Z][a-z]+\s+\d+d\d+/)) {
        if (currentAttack) attacks.push(currentAttack);
        currentAttack = {
          id: this.generateId(str),
          name: str,
          type: 'weapon_attack',
          cost: '1_action',
          range: '5ft',
          toHit: 0,
          damage: { dice: '1d4', modifier: 0, type: 'bludgeoning' },
          description: str,
          source: 'PDF',
          externalLink: null
        };
      }
      
      // Look for to-hit values near attacks
      if (currentAttack && str.match(/^[+-]?\d+$/)) {
        const num = parseInt(str);
        if (num >= -5 && num <= 20) {
          currentAttack.toHit = num;
        }
      }
    }
    
    if (currentAttack) attacks.push(currentAttack);
    
    data.actions.primary = attacks.length > 0 ? attacks : [
      {
        id: 'unarmed_strike',
        name: 'Unarmed Strike',
        type: 'weapon_attack',
        cost: '1_action',
        range: '5ft',
        toHit: 3,
        damage: { dice: '1d4', modifier: 0, type: 'bludgeoning' },
        description: 'Melee Weapon Attack',
        source: 'PHB',
        externalLink: null
      }
    ];
  }

  /**
   * Parse features and traits section
   */
  async parseFeaturesSection(pages, data) {
    data.features = [];
    // Features parsing is complex - skip for now
  }

  /**
   * Parse spells section
   */
  async parseSpellsSection(pages, data) {
    data.spells = [];
    // Spells parsing requires better structure detection - skip for now
  }

  /**
   * Generate ID from name
   */
  generateId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  }

  /**
   * Export parsed data to JSON file (optional, silent)
   */
  exportToJSON(data, filename = 'character_data.json') {
    const json = JSON.stringify(data, null, 2);
    // Store in localStorage for future use
    try {
      localStorage.setItem('chainWardenCharacter', json);
      console.log('[PDF Parser] Character data saved to localStorage');
    } catch (e) {
      console.warn('[PDF Parser] Could not save to localStorage:', e);
    }
    return json;
  }

  /**
   * Import JSON file and return parsed data
   */
  async importFromJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
        } catch (error) {
          reject(new Error('Invalid JSON file: ' + error.message));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
  
  /**
   * Get character data from localStorage
   */
  getFromStorage() {
    try {
      const json = localStorage.getItem('chainWardenCharacter');
      if (json) {
        return JSON.parse(json);
      }
    } catch (e) {
      console.warn('[PDF Parser] Could not load from localStorage:', e);
    }
    return null;
  }
}

// Export for use in browser
window.CharacterPDFParser = CharacterPDFParser;

// Export for use in other modules (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CharacterPDFParser;
}
