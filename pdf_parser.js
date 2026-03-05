/**
 * PDF Parser for Character Sheets
 * Uses pdf.js to extract character data from PDF templates
 *
 * Usage:
 *   const parser = new CharacterPDFParser();
 *   const data = await parser.parsePDF('character.pdf');
 */

class CharacterPDFParser {
  constructor() {
    this.pdfjsLib = null;
    this.initialized = false;
  }

  /**
   * PIPELINE MAP (Parser)
   *
   * Entry:
   *   - parsePDF(pdfPath, options)
   *
   * Strategy order (form-first):
   *   1) parseFormFields(...)
   *      a) extractFieldsFromRawPdf(pdfPath)   // scans /Subtype/Widget + /T + /V
   *      b) pdf.getFieldObjects()              // pdf.js form API
   *      c) extractFieldsFromAnnotations(...)  // annotation fallback
   *      -> processFormFields(fields, data)
   *
   * Fallback (no form fields):
   *   - extractTextFromPDF(...)
   *   - parseCharacterSection / parseAbilityScores / parseCombatSection
   *
   * Final normalization:
   *   - parseActionsSection / parseFeaturesSection / parseSpellsSection
   *
   * Key metadata fields for downstream UI/logging:
   *   - metadata.parseMethod
   *   - metadata.sourceTotalPages / processedPages / pageLimitExceeded
   *   - rawFields (canonical extracted field-value map)
   */

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
   * Create a default character data structure with all expected fields
   * Organized top-down: metadata → character → mechanics → resources → traits
   * Supports multiclass and homebrew content
   */
  createCharacterDataTemplate() {
    return {
      // ============ METADATA (Record info) ============
      metadata: {
        schema: 'character_v1',
        schemaVersion: '2.0',
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        source: 'pdf_import',         // 'pdf_import' | 'manual_entry' | 'json_import' | 'homebrew'
        sourcePath: '',               // Original file name if imported
        parseMethod: 'unknown',       // 'form_fields' | 'text_extraction' | 'manual'
        parserVersion: '2.0.0',
        needsReview: false,           // Flag if data needs human verification
        notes: ''                     // Any parsing notes/warnings
      },

      // ============ CHARACTER IDENTITY ============
      character: {
        name: 'Unknown',
        alignment: null,
        xp: 0,
        
        // Basic demographics
        demographics: {
          age: null,
          gender: null,
          height: null,
          weight: null,
          size: 'Medium',               // Small, Medium, Large, etc.
          race: null,
          subrace: null,
          background: null,
          faith: null
        },

        // Appearance
        appearance: {
          skinColor: null,
          hairColor: null,
          eyeColor: null,
          distinguishingFeatures: ''
        }
      },

      // ============ CLASSES (supports multiclass) ============
      classes: [
        // {
        //   name: 'Rogue',
        //   subclass: 'Arcane Trickster',
        //   level: 5,
        //   hitDiceType: 'd8',          // d6, d8, d10, d12
        //   classFeatures: []
        // }
      ],

      // ============ ABILITIES (D&D 6 core attributes) ============
      abilities: {
        strength: {
          score: null,
          modifier: 0,
          savingThrow: 0,
          proficiency: false,
          skills: ['Athletics']
        },
        dexterity: {
          score: null,
          modifier: 0,
          savingThrow: 0,
          proficiency: false,
          skills: ['Acrobatics', 'Sleight of Hand', 'Stealth']
        },
        constitution: {
          score: null,
          modifier: 0,
          savingThrow: 0,
          proficiency: false,
          skills: []
        },
        intelligence: {
          score: null,
          modifier: 0,
          savingThrow: 0,
          proficiency: false,
          skills: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion']
        },
        wisdom: {
          score: null,
          modifier: 0,
          savingThrow: 0,
          proficiency: false,
          skills: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival']
        },
        charisma: {
          score: null,
          modifier: 0,
          savingThrow: 0,
          proficiency: false,
          skills: ['Deception', 'Intimidation', 'Performance', 'Persuasion']
        }
      },

      // ============ COMBAT MECHANICS ============
      combat: {
        armorClass: null,
        hitPoints: {
          max: null,
          current: null,
          temporary: 0
        },
        hitDice: [
          // { dice: '1d8', current: 1, max: 1, type: 'Rogue' }
        ],
        speed: 30,                    // feet per round
        initiative: 0,
        proficiencyBonus: 2
      },

      // ============ ACTIONS & ABILITIES ============
      actions: {
        weapons: [],                  // Weapon attacks (sword, bow, etc.)
        spellAttacks: [],             // Spell attacks (not cantrips)
        cantrips: [],                 // 0-level spells / class abilities
        abilities: [],                // Special abilities beyond combat
        bonusActions: [],             // Actions available as bonus action
        reactions: []                 // Reaction actions
      },

      // ============ FEATURES & TRAITS ============
      features: {
        classFeatures: [],            // Class-specific abilities
        raceTraits: [],               // Racial abilities
        backgroundFeatures: [],       // Background features
        customAbilities: [],          // Homebrew/custom features
        
        personality: {
          traits: '',                 // "I'm always cheerful..."
          ideals: '',                 // "I believe in freedom..."
          bonds: '',                  // "I owe my life to..."
          flaws: ''                   // "I have a weakness for..."
        }
      },

      // ============ SPELLCASTING (if applicable) ============
      spellcasting: {
        isSpellcaster: false,
        spellcastingClass: null,      // 'Wizard' | 'Cleric' | 'Warlock', etc.
        spellcastingAbility: null,    // 'intelligence' | 'wisdom' | 'charisma'
        spellSaveDC: null,
        spellAttackBonus: null,
        
        cantrips: [],                 // 0-level spells
        spells: {
          slots1: { max: 0, current: 0, spells: [] },
          slots2: { max: 0, current: 0, spells: [] },
          slots3: { max: 0, current: 0, spells: [] },
          slots4: { max: 0, current: 0, spells: [] },
          slots5: { max: 0, current: 0, spells: [] },
          slots6: { max: 0, current: 0, spells: [] },
          slots7: { max: 0, current: 0, spells: [] },
          slots8: { max: 0, current: 0, spells: [] },
          slots9: { max: 0, current: 0, spells: [] }
        },
        
        // Warlock-specific
        pactSlots: { max: 0, current: 0 },
        pactSlotLevel: 0,
        
        // Sorcerer-specific
        sorceryPoints: { max: 0, current: 0 },
        
        // Bard-specific
        bardInspirations: { max: 0, current: 0, diceType: 'd6' }
      },

      // ============ RESOURCES ============
      resources: {
        // Equipment & Inventory
        equipment: [],                // { name, qty, weight, equipped }
        
        // Currency
        currency: {
          cp: 0,                      // Copper pieces
          sp: 0,                      // Silver pieces
          ep: 0,                      // Electrum pieces
          gp: 0,                      // Gold pieces
          pp: 0                       // Platinum pieces
        },

        // Carrying Capacity
        carrying: {
          itemsCount: 0,
          weight: 0,
          maxWeight: 0,
          encumbered: false,
          heavilyEncumbered: false
        },

        // Magic Items & Attunement
        magicItems: [],               // { name, rarity, attuned, attunementSlots }
        attunementSlots: { current: 0, max: 3 },

        // Proficiencies & Expertise
        proficiencies: {
          armor: [],
          weapons: [],
          tools: [],
          languages: [],
          expertise: []               // Rogue expertise, Bard jack of all trades, etc.
        },

        // Passive Abilities (Perception, Investigation, Insight)
        passive: {
          perception: null,
          investigation: null,
          insight: null
        },

        // Senses & Special Movement
        senses: {
          darkvision: 0,              // feet
          truesight: 0,
          specialMovement: []         // 'climb speed', 'fly speed', 'swim speed', etc.
        }
      },

      // ============ ALLIES & ENEMIES ============
      social: {
        allies: [],
        enemies: [],
        organizations: []
      },

      // ============ CUSTOM NOTES (for future use) ============
      notes: {
        backstory: '',
        additionalNotes: '',
        customContent: {}             // For homebrew/extensibility
      }
    };
  }

  /**
   * Parse a PDF file and extract character data
   * Handles both fillable forms and text-based PDFs
   * @param {string} pdfPath - Path to the PDF file
   * @returns {Promise<Object>} - Parsed character data
   */
  async parsePDF(pdfPath, options = {}) {
    await this.init();
    
    try {
      const loadingTask = this.pdfjsLib.getDocument(pdfPath);
      const pdf = await loadingTask.promise;

      // Pipeline guardrail: we always cap parsing to a maximum page count so
      // oversized character exports cannot stall UI import.
      const maxPages = Number.isFinite(options.maxPages) ? options.maxPages : 20;
      const pagesToProcess = Math.min(pdf.numPages, maxPages);
      
      // Use new organized template
      const characterData = this.createCharacterDataTemplate();
      characterData.metadata.sourcePath = pdfPath;
      characterData.metadata.sourceTotalPages = pdf.numPages;
      characterData.metadata.processedPages = pagesToProcess;
      characterData.metadata.pageLimit = maxPages;
      characterData.metadata.pageLimitExceeded = pdf.numPages > maxPages;
      if (characterData.metadata.pageLimitExceeded) {
        console.warn(`[PDF Parser] Page limit applied: processing first ${pagesToProcess} of ${pdf.numPages} pages.`);
      }
      
      // Primary strategy: form-field extraction (best fidelity for D&D PDFs).
      // Fallback strategy: text extraction when form fields are unavailable.
      console.log('[PDF Parser] Attempting to extract form field data...');
      let pages = null;
      const formSuccess = await this.parseFormFields(pdf, characterData, pdfPath, pagesToProcess);
      
      if (formSuccess) {
        characterData.metadata.parseMethod = 'form_fields';
        console.log('[PDF Parser] ✓ Successfully extracted form field data');
      } else {
        // Fallback to text extraction
        console.log('[PDF Parser] No form fields found, attempting text extraction...');
        characterData.metadata.parseMethod = 'text_extraction';
        
        pages = await this.extractTextFromPDF(pdf, pagesToProcess);
        await this.parseCharacterSection(pages, characterData);
        await this.parseAbilityScores(pages, characterData);
        await this.parseCombatSection(pages, characterData);
      }
      
      // Section parsing is shared by both strategies. If form fields succeed,
      // we still normalize defaults via empty page arrays.
      if (pages) {
        await this.parseActionsSection(pages, characterData);
        await this.parseFeaturesSection(pages, characterData);
        await this.parseSpellsSection(pages, characterData);
      } else {
        // Add default actions when using form fields
        await this.parseActionsSection([], characterData);
        await this.parseFeaturesSection([], characterData);
        await this.parseSpellsSection([], characterData);
      }
      
      return characterData;
      
    } catch (error) {
      console.error('[PDF Parser] Error parsing PDF:', error);
      throw error;
    }
  }

  /**
   * Extract text from page content streams
   * Captures form field appearances and all rendered content
   */
  async extractTextFromContentStream(pdf) {
    const allText = {};

    for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 7); pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        
        // Get enhanced text content with all sources
        const textContent = await page.getTextContent();
        
        if (textContent && textContent.items) {
          let pageText = textContent.items
            .map(item => item.str)
            .join(' ');
          
          if (pageText.trim()) {
            allText[`page_${pageNum}`] = pageText.trim();
            console.log(`[PDF Parser]   Page ${pageNum}: "${pageText.substring(0, 100)}${pageText.length > 100 ? '...' : ''}"`);
          }
        }
      } catch (e) {
        console.log(`[PDF Parser]   Page ${pageNum} error:`, e.message);
      }
    }

    return allText;
  }

  /**
   * Extract form field values from fillable PDF
   * Tries multiple methods in sequence to extract form fields
   * Returns true if form fields were found and extracted
   */
  extractPdfLiteralString(text, openParenIndex) {
    if (openParenIndex < 0 || text[openParenIndex] !== '(') {
      return { value: '', endIndex: openParenIndex };
    }

    let i = openParenIndex + 1;
    let depth = 1;
    let value = '';

    while (i < text.length && depth > 0) {
      const ch = text[i];
      const prev = text[i - 1];

      if (ch === '(' && prev !== '\\') {
        depth++;
        value += ch;
      } else if (ch === ')' && prev !== '\\') {
        depth--;
        if (depth > 0) value += ch;
      } else {
        value += ch;
      }

      i++;
    }

    return { value, endIndex: i - 1 };
  }

  decodePdfEscapes(str) {
    return str
      .replace(/\\r/g, '\r')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\b/g, '\b')
      .replace(/\\f/g, '\f')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async extractFieldsFromRawPdf(pdfPath) {
    const fields = {};

    try {
      const response = await fetch(pdfPath);
      if (!response.ok) return fields;

      const buffer = await response.arrayBuffer();
      const text = new TextDecoder('latin1').decode(new Uint8Array(buffer));

      // D&D Beyond-compatible extractor:
      // scan object streams directly for widget fields (/Subtype/Widget) and
      // parse /T (field name) + /V (field value) pairs.
      const objectRegex = /\d+\s+\d+\s+obj([\s\S]*?)endobj/g;
      let match;

      while ((match = objectRegex.exec(text)) !== null) {
        const obj = match[1];
        if (!obj.includes('/Subtype/Widget')) continue;

        const tMatch = /\/T\s*\(/.exec(obj);
        const vMatch = /\/V\s*\(/.exec(obj);
        if (!tMatch || !vMatch) continue;

        const tOpen = tMatch.index + tMatch[0].length - 1;
        const vOpen = vMatch.index + vMatch[0].length - 1;

        const fieldNameRaw = this.extractPdfLiteralString(obj, tOpen).value;
        const fieldValueRaw = this.extractPdfLiteralString(obj, vOpen).value;

        const fieldName = this.decodePdfEscapes(fieldNameRaw);
        const fieldValue = this.decodePdfEscapes(fieldValueRaw);

        if (!fieldName || !fieldValue) continue;

        fields[fieldName] = [{ V: fieldValue, AS: fieldValue }];
      }
    } catch (error) {
      console.warn('[PDF Parser] Raw PDF field extraction failed:', error?.message || error);
    }

    return fields;
  }

  async parseFormFields(pdf, data, pdfPath = '', maxPagesToProcess = 20) {
    try {
      console.log('[PDF Parser] === FORM FIELD EXTRACTION ===');

      // Ordered extraction strategy (highest reliability first):
      // 1) raw PDF byte scan for /T + /V widgets,
      // 2) pdf.js getFieldObjects(),
      // 3) annotation pass.
      if (pdfPath) {
        const rawPdfFields = await this.extractFieldsFromRawPdf(pdfPath);
        if (Object.keys(rawPdfFields).length > 0) {
          console.log('[PDF Parser] ✓ Raw-byte extraction success:', Object.keys(rawPdfFields).length, 'fields');
          data.rawFields = Object.fromEntries(
            Object.entries(rawPdfFields).map(([key, arr]) => [key, String(arr?.[0]?.V || arr?.[0]?.AS || '').trim()])
          );
          return await this.processFormFields(rawPdfFields, data);
        }
      }

      if (pdf.getFieldObjects && typeof pdf.getFieldObjects === 'function') {
        const fields = await pdf.getFieldObjects();
        if (fields && Object.keys(fields).length > 0) {
          console.log('[PDF Parser] ✓ getFieldObjects() success:', Object.keys(fields).length, 'fields');
          data.rawFields = Object.fromEntries(
            Object.entries(fields).map(([key, arr]) => [key, String(arr?.[0]?.V || arr?.[0]?.AS || '').trim()])
          );
          return await this.processFormFields(fields, data);
        }
      }

      const annotationFields = await this.extractFieldsFromAnnotations(pdf, maxPagesToProcess);
      if (annotationFields && Object.keys(annotationFields).length > 0) {
        console.log('[PDF Parser] ✓ Annotation extraction success:', Object.keys(annotationFields).length, 'fields');
        data.rawFields = Object.fromEntries(
          Object.entries(annotationFields).map(([key, arr]) => [key, String(arr?.[0]?.V || arr?.[0]?.AS || '').trim()])
        );
        return await this.processFormFields(annotationFields, data);
      }

      console.log('[PDF Parser] ✗ No form fields found by any method');
      return false;
    } catch (error) {
      console.warn('[PDF Parser] Critical error in parseFormFields:', error);
      return false;
    }
  }

  /**
   * Extract fields from PDF catalog and AcroForm
   */
  async extractFieldsFromCatalog(pdf) {
    try {
      const catalog = await pdf.getCatalog();
      if (!catalog.acroForm) {
        console.log('[PDF Parser]   No AcroForm in catalog');
        return {};
      }

      console.log('[PDF Parser]   Found AcroForm in catalog');
      const acroForm = catalog.acroForm;
      
      // Try to get fields from AcroForm
      if (acroForm.Fields) {
        console.log('[PDF Parser]   AcroForm has Fields property');
        const fields = {};
        
        // Fields might be an array of references
        if (Array.isArray(acroForm.Fields)) {
          for (const field of acroForm.Fields) {
            try {
              // Resolve reference if needed
              const resolvedField = field.getResolved ? await field.getResolved() : field;
              if (resolvedField && resolvedField.T) {
                const fieldName = resolvedField.T;
                const fieldValue = resolvedField.V || resolvedField.AS || resolvedField.DefaultValue || '';
                fields[fieldName] = [{ V: fieldValue, AS: fieldValue }];
              }
            } catch (e) {
              // Skip problematic fields
            }
          }
        }
        
        console.log('[PDF Parser]   Extracted', Object.keys(fields).length, 'fields from AcroForm.Fields');
        return fields;
      }

      return {};
    } catch (e) {
      console.log('[PDF Parser]   Catalog inspection error:', e.message);
      return {};
    }
  }

  /**
   * Extract fields from page annotations
   * D&D Beyond PDFs store values in annotation /V property
   */
  async extractFieldsFromAnnotations(pdf, maxPagesToProcess = 20) {
    const fields = {};

    const pageLimit = Math.min(pdf.numPages, maxPagesToProcess);
    for (let pageNum = 1; pageNum <= pageLimit; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const annotations = await page.getAnnotations();

        if (!annotations || annotations.length === 0) continue;

        console.log(`[PDF Parser]   Page ${pageNum}: Found ${annotations.length} annotations`);

        for (const annotation of annotations) {
          // Look for widget annotations (form fields)
          if (annotation.subtype === 'Widget') {
            const fieldName = annotation.fieldName || annotation.T || `field_${Object.keys(fields).length}`;
            
            let fieldValue = '';
            let valueSource = '';
            
            // Try to get the value from the annotation
            if (annotation.V) {
              fieldValue = String(annotation.V);
              valueSource = 'V';
            }
            else if (annotation.fieldValue) {
              fieldValue = String(annotation.fieldValue);
              valueSource = 'fieldValue';
            }
            else if (annotation.AS) {
              fieldValue = String(annotation.AS);
              valueSource = 'AS';
            }
            else if (annotation.DefaultValue) {
              fieldValue = String(annotation.DefaultValue);
              valueSource = 'DefaultValue';
            }
            
            // If we found a value, store it
            if (fieldValue) {
              fields[fieldName] = [{ V: fieldValue, AS: fieldValue }];
              console.log(`[PDF Parser]     Widget "${fieldName}" (${valueSource}) = "${fieldValue}"`);
            }
          }
        }
      } catch (e) {
        console.log(`[PDF Parser]   Page ${pageNum} annotation error:`, e.message);
      }
    }

    console.log(`[PDF Parser]   Total fields extracted from annotations: ${Object.keys(fields).length}`);
    return fields;
  }

  /**
   * Process extracted form fields and populate character data
   */
  async processFormFields(fields, data) {
    console.log('[PDF Parser] Processing', Object.keys(fields).length, 'form fields...');

    let foundData = false;
    let classData = {
      name: null,
      subclass: null,
      level: 1,
      hitDiceType: 'd6'
    };

    const applyAbilityFieldValue = (abilityKey, rawValue) => {
      const parsed = Number.parseInt(String(rawValue || '').trim(), 10);
      if (!Number.isFinite(parsed)) return;

      // Form PDFs sometimes label ability modifier fields as STR/DEX/etc.
      // Treat low-magnitude values as modifiers to avoid score=1 -> mod=-5.
      if (parsed >= 3 && parsed <= 30) {
        data.abilities[abilityKey].score = parsed;
        data.abilities[abilityKey].modifier = Math.floor((parsed - 10) / 2);
        return;
      }

      if (parsed >= -10 && parsed <= 10) {
        data.abilities[abilityKey].modifier = parsed;
      }
    };

    for (const [fieldName, fieldObj] of Object.entries(fields)) {
      const value = fieldObj[0]?.V || fieldObj[0]?.AS || '';
      
      if (!value) continue;

      foundData = true;

      // Normalize the value
      const processedValue = String(value).trim();
      const lowerName = fieldName.toLowerCase();

      // CHARACTER IDENTITY
      if (lowerName === 'charactername' || lowerName === 'character name') {
        data.character.name = processedValue;
      } else if (lowerName.includes('alignment')) {
        data.character.alignment = processedValue;
      } else if (lowerName.includes('age')) {
        data.character.demographics.age = processedValue;
      } else if (lowerName.includes('gender')) {
        data.character.demographics.gender = processedValue;
      } else if (lowerName.includes('height')) {
        data.character.demographics.height = processedValue;
      } else if (lowerName.includes('weight')) {
        data.character.demographics.weight = processedValue;
      } else if (lowerName === 'race' || lowerName === 'species') {
        data.character.demographics.race = processedValue;
      } else if (lowerName === 'background') {
        data.character.demographics.background = processedValue;
      } else if (lowerName.includes('faith')) {
        data.character.demographics.faith = processedValue;
      } else if (lowerName.includes('skin')) {
        data.character.appearance.skinColor = processedValue;
      } else if (lowerName.includes('hair')) {
        data.character.appearance.hairColor = processedValue;
      } else if (lowerName.includes('eyes')) {
        data.character.appearance.eyeColor = processedValue;
      } else if (lowerName.includes('xp') || lowerName.includes('experience')) {
        const xpNum = parseInt(processedValue, 10);
        if (!isNaN(xpNum)) data.character.xp = xpNum;
      }
      // CLASS INFORMATION
      else if (lowerName === 'class  level' || lowerName === 'class & level' || lowerName === 'class level') {
        const levelMatch = processedValue.match(/\d+/);
        classData.level = levelMatch ? parseInt(levelMatch[0], 10) : classData.level;
        classData.name = processedValue.replace(/\d+/g, '').trim() || classData.name;
      } else if (lowerName.includes('class') && !lowerName.includes('saving')) {
        classData.name = processedValue;
      } else if (lowerName.includes('subclass') || lowerName.includes('archetype')) {
        classData.subclass = processedValue;
      } else if (lowerName.includes('level')) {
        const levelNum = parseInt(processedValue);
        if (!isNaN(levelNum)) classData.level = levelNum;
      }
      // ABILITY SCORES
      else if (lowerName === 'str' || lowerName === 'strength') {
        applyAbilityFieldValue('strength', processedValue);
      } else if (lowerName === 'dex' || lowerName === 'dexterity') {
        applyAbilityFieldValue('dexterity', processedValue);
      } else if (lowerName === 'con' || lowerName === 'constitution') {
        applyAbilityFieldValue('constitution', processedValue);
      } else if (lowerName === 'int' || lowerName === 'intelligence') {
        applyAbilityFieldValue('intelligence', processedValue);
      } else if (lowerName === 'wis' || lowerName === 'wisdom') {
        applyAbilityFieldValue('wisdom', processedValue);
      } else if (lowerName === 'cha' || lowerName === 'charisma') {
        applyAbilityFieldValue('charisma', processedValue);
      }
      // COMBAT STATS
      else if ((lowerName.includes('armor') && lowerName.includes('class')) || lowerName === 'ac') {
        const acNum = parseInt(processedValue);
        if (!isNaN(acNum)) data.combat.armorClass = acNum;
      } else if (lowerName.includes('hp') || lowerName.includes('hit point')) {
        const hpNum = parseInt(processedValue);
        if (!isNaN(hpNum)) {
          data.combat.hitPoints.max = hpNum;
          data.combat.hitPoints.current = hpNum;
        }
      } else if (lowerName.includes('speed')) {
        const speedNum = parseInt(processedValue);
        if (!isNaN(speedNum)) data.combat.speed = speedNum;
      } else if (lowerName.includes('proficiency') && lowerName.includes('bonus')) {
        const profNum = parseInt(processedValue);
        if (!isNaN(profNum)) data.combat.proficiencyBonus = profNum;
      } else if (lowerName.includes('initiative')) {
        const initNum = parseInt(processedValue);
        if (!isNaN(initNum)) data.combat.initiative = initNum;
      }
      // PERSONALITY TRAITS (Role-playing info)
      else if (lowerName.includes('trait')) {
        data.features.personality.traits = processedValue;
      } else if (lowerName.includes('ideal')) {
        data.features.personality.ideals = processedValue;
      } else if (lowerName.includes('bond')) {
        data.features.personality.bonds = processedValue;
      } else if (lowerName.includes('flaw')) {
        data.features.personality.flaws = processedValue;
      }
      // RESOURCES - CURRENCY
      else if (lowerName.includes('cp')) {
        const cpNum = parseInt(processedValue);
        if (!isNaN(cpNum)) data.resources.currency.cp = cpNum;
      } else if (lowerName.includes('sp')) {
        const spNum = parseInt(processedValue);
        if (!isNaN(spNum)) data.resources.currency.sp = spNum;
      } else if (lowerName.includes('ep')) {
        const epNum = parseInt(processedValue);
        if (!isNaN(epNum)) data.resources.currency.ep = epNum;
      } else if (lowerName.includes('gp')) {
        const gpNum = parseInt(processedValue);
        if (!isNaN(gpNum)) data.resources.currency.gp = gpNum;
      } else if (lowerName.includes('pp')) {
        const ppNum = parseInt(processedValue);
        if (!isNaN(ppNum)) data.resources.currency.pp = ppNum;
      }
      // RESOURCES - LANGUAGES & PROFICIENCIES
      else if (lowerName.includes('language')) {
        if (!data.resources.proficiencies.languages.includes(processedValue)) {
          data.resources.proficiencies.languages.push(processedValue);
        }
      }
      // SPELLCASTING
      else if (lowerName.includes('spell') && lowerName.includes('save')) {
        const dcNum = parseInt(processedValue);
        if (!isNaN(dcNum)) data.spellcasting.spellSaveDC = dcNum;
      } else if (lowerName.includes('spell') && lowerName.includes('attack')) {
        const bonusNum = parseInt(processedValue);
        if (!isNaN(bonusNum)) data.spellcasting.spellAttackBonus = bonusNum;
      }
      // PASSIVE PERCEPTIONS
      else if (lowerName.includes('passive') && lowerName.includes('perception')) {
        const passNum = parseInt(processedValue);
        if (!isNaN(passNum)) data.resources.passive.perception = passNum;
      } else if (lowerName.includes('passive') && lowerName.includes('investigation')) {
        const passNum = parseInt(processedValue);
        if (!isNaN(passNum)) data.resources.passive.investigation = passNum;
      } else if (lowerName.includes('passive') && lowerName.includes('insight')) {
        const passNum = parseInt(processedValue);
        if (!isNaN(passNum)) data.resources.passive.insight = passNum;
      }
    }

    // Add class to classes array if we found class data
    if (classData.name) {
      data.classes.push({
        name: classData.name,
        subclass: classData.subclass || '',
        level: classData.level,
        hitDiceType: classData.hitDiceType
      });
    }

    // Ensure combat speed has a default
    if (!data.combat.speed) {
      data.combat.speed = 30;
    }

    console.log('[PDF Parser] === END FORM FIELD EXTRACTION ===');
    return foundData;
  }

  /**
   * Extract text from PDF with better structure
   */
  async extractTextFromPDF(pdf, maxPagesToProcess = 20) {
    const pages = [];

    const pageLimit = Math.min(pdf.numPages, maxPagesToProcess);
    for (let pageNum = 1; pageNum <= pageLimit; pageNum++) {
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

    console.log('[PDF Parser] Text extraction completed for', pages.length, 'pages');

    return pages;
  }

  async parseCharacterSection(pages, data) {
    const allItems = pages.flatMap(p => p.items);
    
    // D&D 5e standard field labels to skip - comprehensive list
    const fieldLabels = new Set([
      'CHARACTER NAME', 'PLAYER NAME', 'CLASS & LEVEL', 'BACKGROUND', 'RACE', 'ALIGNMENT',
      'EXPERIENCE POINTS', 'INSPIRATION', 'PROFICIENCY BONUS', 'ARMOR CLASS', 'HIT POINTS',
      'SPEED', 'HIT DICE', 'DEATH SAVES', 'STRENGTH', 'DEXTERITY', 'CONSTITUTION',
      'INTELLIGENCE', 'WISDOM', 'CHARISMA', 'SAVING THROWS', 'SKILLS', 'PROFICIENCIES',
      'LANGUAGES', 'FEATURES & TRAITS', 'SPELLCASTING ABILITY', 'SPELL SAVE DC',
      'SPELL ATTACK BONUS', 'CANTRIPS', 'SPELLS', 'EQUIPMENT', 'CURRENCY', 'ALLIES',
      'ORGANIZATIONS', 'ENEMIES', 'BACKSTORY', 'TRAITS', 'IDEALS', 'BONDS', 'FLAWS',
      'FEATURES', 'PERSONALITY', 'APPEARANCE', 'WEAPON ATTACKS', 'QTY', 'WEIGHT',
      'DAMAGE TYPE', 'RANGE', 'PROPERTIES', 'INITIATIVE', 'SENSES', 'PASSIVE PERCEPTION',
      'PASSIVE INVESTIGATION', 'PASSIVE INSIGHT', 'ADDITIONAL FEATURES', 'ATTUNED MAGIC ITEMS',
      'CHARACTER APPEARANCE', 'ALLIES & ORGANIZATIONS', 'ACROBATICS', 'ANIMAL HANDLING',
      'ARCANA', 'ATHLETICS', 'DECEPTION', 'HISTORY', 'INSIGHT', 'INTIMIDATION',
      'INVESTIGATION', 'MEDICINE', 'NATURE', 'PERCEPTION', 'PERFORMANCE', 'PERSUASION',
      'RELIGION', 'SLEIGHT OF HAND', 'STEALTH', 'SURVIVAL', 'CP', 'SP', 'EP', 'GP', 'PP',
      'HEROIC INSPIRATION', 'ARMOR', 'TIME', 'SOURCE', 'SAVE/ATK', 'COMP', 'DURATION',
      'PAGE REF', 'REP', 'SPELLCASTING', 'PERSONALITY TRAITS', 'CLASS', 'IDEALS',
      'DEXTERITY', 'BONDS', 'CONSTITUTION', 'FLAWS', 'INTELLIGENCE', 'WISDOM', 'CHARISMA',
      'WEIGHT CARRIED', 'ENCUMBERED', 'PUSH/DRAG/LIFT', 'GENDER', 'SIZE', 'AGE', 'HEIGHT',
      'EYES', 'SKIN', 'HAIR', 'FAITH', 'SPECIES', 'SKILLS', 'SUCCESSES', 'FAILURES',
      'ADDITI', 'NAL', 'MAGIC ITEMS', 'CANTRIPS KNOWN', 'SPELLS KNOWN', 'SPELL SLOTS',
      'SPELL ATTACK', 'BONUS', 'MODIFIER', 'HIT', 'DAMAGE', 'TO HIT', 'AC', 'HP',
      'STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA', '+', 'ABILITIES', 'STAT', 'ABILITY SCORE'
    ]);

    // Filter: keep only items that are actual character data
    const dataItems = allItems.filter(item => {
      const str = item.str.trim();
      const upper = str.toUpperCase();
      
      if (str.length < 2 || str.length > 30) return false;
      if (fieldLabels.has(upper)) return false;
      if (/^[0-9]+$/.test(str)) return false; // Skip pure numbers
      if (/^[+-]+$/.test(str)) return false; // Skip just +/- signs
      
      // Skip if it's all numbers and symbols
      if (!/[A-Za-z]/.test(str)) return false;
      
      return true;
    });

    console.log('[PDF Parser] Filtered data items:', dataItems.slice(0, 15).map(i => i.str));

    // Sort by Y position (top to bottom, then left to right)
    dataItems.sort((a, b) => b.y - a.y || a.x - b.x);

    console.log('[PDF Parser] Data items after sort (first 15):', dataItems.slice(0, 15).map(i => `"${i.str}" (y:${Math.round(i.y)}, x:${Math.round(i.x)})`));

    // Also search ALL text for key phrases (not just filtered items)
    console.log('[PDF Parser] Searching all text for key phrases...');
    const allText = pages.flatMap(page => page.items.map(i => i.str)).join(' ');
    console.log('[PDF Parser] Full text (first 500 chars):', allText.substring(0, 500));

    // Extract character data using positional logic
    let characterName = null;
    let charClass = null;
    let level = null;
    let background = null;
    let race = null;
    let alignment = null;
    
    // Standard D&D 5e races and classes
    const validRaces = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Dragonborn', 'Tiefling', 'Gnome', 'Half-Elf', 'Half-Orc', 'Orc'];
    const validClasses = ['Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'];
    const validBackgrounds = ['Acolyte', 'Charlatan', 'Criminal', 'Entertainer', 'Folk Hero', 'Gladiator', 'Guild Artisan', 'Hermit', 'Inheritor', 'Knight', 'Mercenary Veteran', 'Mob Enforcer', 'Nobble', 'Outlander', 'Sage', 'Sailor', 'Soldier', 'Spy', 'Urchin'];
    const validAlignments = ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'];

    // FIRST: Look for multiword-class matching in filtered items or combined text
    // e.g., "Cleric 15" or "Cleric Lv. 15" anywhere in text
    console.log('[PDF Parser] Looking for Class/Level combinations...');
    for (const cls of validClasses) {
      // Try to find "Class Level" pattern
      const patterns = [
        new RegExp(`${cls}\\s+(\\d+)`, 'i'),     // "Cleric 15"
        new RegExp(`${cls}\\s+Lv\\.?\\s+(\\d+)`, 'i'), // "Cleric Lv. 15"
        new RegExp(`${cls}\\s+L(\\d+)`, 'i'),    // "Cleric L15"
        new RegExp(`${cls}\\s+Level\\s+(\\d+)`, 'i'), // "Cleric Level 15"
      ];

      for (const pattern of patterns) {
        const match = allText.match(pattern);
        if (match) {
          charClass = cls;
          level = parseInt(match[1]);
          console.log(`[PDF Parser] ✓ Found class/level: ${charClass} ${level}`);
          break;
        }
      }
      if (charClass) break;
    }

    // SECOND: Look for character name - check items that don't match known tables/headers
    console.log('[PDF Parser] Searching for character name...');
    const nameBlacklist = new Set(['STRENGTH', 'DEXTERITY', 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM', 'CHARISMA', 
                                   'CHARACTER NAME', 'PLAYER NAME', 'CLASS', 'LEVEL', 'BACKGROUND', 'SPECIES',
                                   'AC', 'HP', 'MAX HP', 'ARMOR CLASS', 'HIT POINTS', 'INITIATIVE', 'SPEED',
                                   'SKILLS', 'ACTIONS', 'PROFICIENCY', 'ABILITY SAVE DC', 'SPELL SAVE DC',
                                   'Max HP', 'Current HP', 'Temp HP']);
    
    // Search for any capitalized word that's not in blacklist and is 3+ chars
    for (let i = 0; i < dataItems.length; i++) {
      const item = dataItems[i];
      const str = item.str.trim();
      
      if (str.length >= 3 && str.length < 25) {
        const upper = str.toUpperCase();
        
        // Skip if it's a known label
        if (nameBlacklist.has(upper) || nameBlacklist.has(str)) continue;
        
        // Skip if it's mostly numbers
        if (/^\d+$/.test(str)) continue;
        
        // If not found yet, this could be the name
        if (!characterName) {
          // Prefer items on the first page near the top (under CHARACTER NAME label)
          characterName = str;
          console.log(`[PDF Parser] ✓ Found character name: ${characterName}`);
          break;
        }
      }
    }

    // Extract remaining data from items
    for (const item of dataItems) {
      const str = item.str.trim();

      // Check for race
      if (!race) {
        for (const r of validRaces) {
          if (str.toLowerCase() === r.toLowerCase()) {
            race = r;
            break;
          }
        }
      }

      // Check for background
      if (!background) {
        for (const bg of validBackgrounds) {
          if (str.toLowerCase() === bg.toLowerCase()) {
            background = bg;
            break;
          }
        }
      }

      // Check for alignment
      if (!alignment) {
        for (const al of validAlignments) {
          if (str.toLowerCase() === al.toLowerCase()) {
            alignment = al;
            break;
          }
        }
      }
    }

    // Character name: first capitalized item that isn't a known entity
    // Names are typically proper names at the top of the sheet

    nameSearch: for (const item of dataItems) {
      const str = item.str.trim();
      const upper = str.toUpperCase();
      
      // Skip if in field labels or blacklist
      if (fieldLabels.has(upper)) {
        console.log(`[PDF Parser] Name search - skipping "${str}" (in fieldLabels)`);
        continue;
      }
      
      if (nameBlacklist.has(upper)) {
        console.log(`[PDF Parser] Name search - skipping "${str}" (in nameBlacklist)`);
        continue;
      }
      
      // Skip known entities
      if (validRaces.some(r => r.toLowerCase() === str.toLowerCase())) {
        console.log(`[PDF Parser] Name search - skipping "${str}" (is a race)`);
        continue;
      }
      if (validClasses.some(c => c.toLowerCase() === str.toLowerCase())) {
        console.log(`[PDF Parser] Name search - skipping "${str}" (is a class)`);
        continue;
      }
      if (validBackgrounds.some(b => b.toLowerCase() === str.toLowerCase())) {
        console.log(`[PDF Parser] Name search - skipping "${str}" (is a background)`);
        continue;
      }
      if (validAlignments.some(a => a.toLowerCase() === str.toLowerCase())) {
        console.log(`[PDF Parser] Name search - skipping "${str}" (is an alignment)`);
        continue;
      }
      
      // Check format
      const isProperCase = /^[A-Z][a-zA-Z\s'-\.]*$/.test(str);
      const hasLetters = /[A-Za-z]{3,}/.test(str);
      const lengthOk = str.length >= 3;
      
      if (!isProperCase) {
        console.log(`[PDF Parser] Name search - skipping "${str}" (not proper case format)`);
        continue;
      }
      if (!hasLetters) {
        console.log(`[PDF Parser] Name search - skipping "${str}" (less than 3 letters)`);
        continue;
      }
      if (!lengthOk) {
        console.log(`[PDF Parser] Name search - skipping "${str}" (too short)`);
        continue;
      }
      
      // If we get here, it's a valid name
      characterName = str;
      console.log('[PDF Parser] ✓ Found character name:', characterName);
      break nameSearch;
    }

    // If no name found, try fallback: first non-entity item
    if (!characterName) {
      console.log('[PDF Parser] No character name found in first pass, trying fallback...');
      
      fallback: for (const item of dataItems) {
        const str = item.str.trim();
        const upper = str.toUpperCase();
        
        // Super strict: must not be ANY known D&D term
        if (fieldLabels.has(upper) || nameBlacklist.has(upper)) continue;
        if (validRaces.some(r => r.toLowerCase() === str.toLowerCase())) continue;
        if (validClasses.some(c => c.toLowerCase() === str.toLowerCase())) continue;
        if (validBackgrounds.some(b => b.toLowerCase() === str.toLowerCase())) continue;
        if (validAlignments.some(a => a.toLowerCase() === str.toLowerCase())) continue;
        
        // Must have some letters
        if (!/[A-Za-z]/.test(str) || str.length < 2) continue;
        
        // Accept it as the fallback name
        characterName = str;
        console.log('[PDF Parser] ✓ Using fallback character name:', characterName);
        break fallback;
      }
    }

    // Final fallback if still nothing
    if (!characterName) {
      console.warn('[PDF Parser] Could not find any suitable character name in PDF');
      characterName = null;
    }

    // Assign to new schema structure
    data.character.name = characterName || 'Unknown';
    data.character.demographics.race = race || null;
    data.character.demographics.background = background || null;
    data.character.alignment = alignment || null;
    
    // Add class to classes array
    if (charClass) {
      data.classes.push({
        name: charClass,
        subclass: '',
        level: level || 1,
        hitDiceType: 'd6'
      });
    } else if (level) {
      // If we have a level but no class, still add it
      data.classes.push({
        name: 'Unknown',
        subclass: '',
        level: level || 1,
        hitDiceType: 'd6'
      });
    }

    console.log('[PDF Parser] Character extraction complete:');
    console.log('  Name:', characterName);
    console.log('  Class:', charClass);
    console.log('  Level:', level);
    console.log('  Race:', race);
    console.log('  Background:', background);
    console.log('  Alignment:', alignment);
    
    // If no name found, log first few data items for debugging
    if (!characterName && dataItems.length > 0) {
      console.warn('[PDF Parser] No character name found. First data items:');
      dataItems.slice(0, 10).forEach((item, idx) => {
        console.warn(`  [${idx}] "${item.str}" (y:${item.y}, x:${item.x})`);
      });
    }
  }

  /**
   * Parse ability scores section - Extract numeric values near ability labels
   */
  async parseAbilityScores(pages, data) {
    const allItems = pages.flatMap(p => p.items);
    
    // Combine all text for pattern matching
    const allText = allItems.map(i => i.str).join(' ');
    console.log('[PDF Parser] Searching for ability scores...');
    console.log('[PDF Parser] Full text chunk (500 chars):', allText.substring(0, 500));

    const abilities = {
      strength: ['strength', 'str'],
      dexterity: ['dexterity', 'dex'],
      constitution: ['constitution', 'con'],
      intelligence: ['intelligence', 'int'],
      wisdom: ['wisdom', 'wis'],
      charisma: ['charisma', 'cha']
    };

    for (const [ability, abbrevs] of Object.entries(abilities)) {
      let score = null;

      // METHOD 1: Look for pattern like "Strength: 14" or "STR 14" in combined text
      for (const abbrev of abbrevs) {
        const patterns = [
          new RegExp(`${abbrev}\\s*[:=]?\\s*(\\d+)`, 'i'),  // "Strength: 14" or "STR 14"
          new RegExp(`\\(\\s*${abbrev}\\s+(\\d+)\\s*\\)`, 'i'), // "(STR 14)"
        ];

        for (const pattern of patterns) {
          const match = allText.match(pattern);
          if (match) {
            const potentialScore = parseInt(match[1]);
            if (potentialScore >= 3 && potentialScore <= 20) {
              score = potentialScore;
              console.log(`[PDF Parser] ${ability} - PATTERN MATCH: ${score}`);
              break;
            }
          }
        }
        if (score) break;
      }

      // METHOD 2: Look for ability label in items, then find nearby number (expand range)
      if (!score) {
        const abilityItems = allItems.filter(item => 
          abbrevs.some(abbrev => item.str.toLowerCase().includes(abbrev.toLowerCase()))
        );

        console.log(`[PDF Parser] ${ability} - found ${abilityItems.length} matching items`);

        if (abilityItems.length > 0) {
          const referenceItem = abilityItems[0];
          console.log(`[PDF Parser]   Reference: "${referenceItem.str}" at x:${referenceItem.x.toFixed(1)} y:${referenceItem.y.toFixed(1)}`);
          
          // Find numbers in range 3-20 (valid ability scores) - expanded search range
          const nearbyNumbers = allItems.filter(item => {
            const numStr = item.str.trim();
            if (!/^\d+$/.test(numStr)) return false;
            
            const num = parseInt(numStr);
            if (num < 3 || num > 20) return false; // Valid ability score range
            
            // Expanded range: check multiple distance bands
            const distance = Math.abs(item.x - referenceItem.x) + Math.abs(item.y - referenceItem.y);
            return distance < 300; // Much more generous distance
          });

          console.log(`[PDF Parser]   Found ${nearbyNumbers.length} nearby ability scores in range 3-20`);
          
          if (nearbyNumbers.length > 0) {
            // Get the closest one
            nearbyNumbers.sort((a, b) => {
              const distA = Math.abs(a.x - referenceItem.x) + Math.abs(a.y - referenceItem.y);
              const distB = Math.abs(b.x - referenceItem.x) + Math.abs(b.y - referenceItem.y);
              return distA - distB;
            });
            score = parseInt(nearbyNumbers[0].str);
            console.log(`[PDF Parser]   Found score: ${score}`);
          }
        }
      }

      const modifier = score && !isNaN(score) ? Math.floor((score - 10) / 2) : 0;
      data.abilities[ability].score = score;
      data.abilities[ability].modifier = modifier;
      data.abilities[ability].savingThrow = modifier;
    }

    console.log('[PDF Parser] Final ability scores:', data.abilities);
  }

  /**
   * Parse combat section - Extract AC, HP, Speed, Prof Bonus
   */
  async parseCombatSection(pages, data) {
    const allItems = pages.flatMap(p => p.items);

    console.log('[PDF Parser] Searching for combat stats...');

    const extractNumericField = (label) => {
      // Find label item - match any item containing the label text
      const labelItems = allItems.filter(item =>
        item.str.toLowerCase().includes(label.toLowerCase())
      );

      if (labelItems.length === 0) {
        console.log(`[PDF Parser]   "${label}" - not found`);
        return null;
      }

      const labelItem = labelItems[0];
      console.log(`[PDF Parser]   "${label}" - found at (${labelItem.x}, ${labelItem.y})`);

      // Look for numbers nearby (within 200px right, 100px vertical)
      const nearbyNumbers = allItems.filter(item => {
        const isNumber = /^\d+$/.test(item.str.trim());
        const toRight = item.x >= labelItem.x && item.x < labelItem.x + 200;
        const verticalRange = Math.abs(item.y - labelItem.y) < 100;
        return isNumber && toRight && verticalRange;
      });

      console.log(`[PDF Parser]   Found ${nearbyNumbers.length} nearby numbers`);

      if (nearbyNumbers.length > 0) {
        nearbyNumbers.sort((a) => a.x - labelItem.x);
        const value = parseInt(nearbyNumbers[0].str);
        console.log(`[PDF Parser]   Extracted value: ${value}`);
        return value;
      }

      return null;
    };

    const ac = extractNumericField('armor class') || extractNumericField('ac');
    const hp = extractNumericField('hit points') || extractNumericField('hp') || extractNumericField('max hp');
    const speed = extractNumericField('speed');
    const profBonus = extractNumericField('proficiency');

    data.combat = {
      armorClass: ac,
      hitPoints: {
        max: hp,
        current: hp,
        temp: 0
      },
      hitDice: '1d10',
      speed: speed || 30,
      initiative: 0,
      proficiencyBonus: profBonus
    };

    console.log('[PDF Parser] Extracted combat data:', data.combat);
  }

  /**
   * Parse actions section - Simple version for PDF
   * Full action parsing requires manual entry due to PDF complexity
   */
  async parseActionsSection(pages, data) {
    // Default unarmed strike - users can add custom actions in the flowchart UI
    data.actions.weapons = [
      {
        id: 'unarmed_strike',
        name: 'Unarmed Strike',
        type: 'weapon_attack',
        cost: '1_action',
        range: '5ft',
        toHit: 0,
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
    // Spells are complex to extract from PDFs
    // Users can manage spells through the UI
    data.spells = [];
  }

  /**
   * Validate parsed character data and collect errors
   */
  validateCharacterData(data) {
    const errors = [];
    // Basic validation - missing critical D&D character fields
    if (!data.character?.name || data.character.name === 'Unknown') errors.push('Missing character name');
    if (!data.character?.class) errors.push('Missing class');
    if (!data.character?.race) errors.push('Missing race');
    if (!data.combat?.armorClass) errors.push('Missing Armor Class (AC)');
    if (!data.combat?.hitPoints?.max) errors.push('Missing Max HP');
    if (!data.abilityScores || Object.keys(data.abilityScores).length === 0) errors.push('Missing ability scores');
    return errors;
  }

  /**
   * Export parsed character data to localStorage (temp storage: char_01, char_02, etc.)
   */
  exportToJSON(data) {
    try {
      const MAX_TEMP_CHARACTERS = 30;
      const incomingCharacterName = (data?.character?.name || '').trim().toLowerCase();
      const parseSlotIndex = (key) => {
        const match = /^char_(\d+)$/.exec(key);
        return match ? parseInt(match[1], 10) : null;
      };

      const normalizeForDuplicateCheck = (value) => {
        if (Array.isArray(value)) {
          return value.map(item => normalizeForDuplicateCheck(item));
        }

        if (value && typeof value === 'object') {
          const normalized = {};
          const keys = Object.keys(value).sort();
          for (const key of keys) {
            if (key === 'metadata') continue;
            normalized[key] = normalizeForDuplicateCheck(value[key]);
          }

          return normalized;
        }

        return value;
      };

      const incomingSignature = JSON.stringify(normalizeForDuplicateCheck(data || {}));
      let importedCharactersStore = {
        references: {},
        order: []
      };

      try {
        const rawImportedStore = localStorage.getItem('imported_characters');
        if (rawImportedStore) {
          const parsedStore = JSON.parse(rawImportedStore);
          if (parsedStore && typeof parsedStore === 'object' && !Array.isArray(parsedStore)) {
            importedCharactersStore = {
              references: (parsedStore.references && typeof parsedStore.references === 'object') ? parsedStore.references : {},
              order: Array.isArray(parsedStore.order) ? parsedStore.order : []
            };
          }
        }
      } catch (storeError) {
        console.warn('Could not parse existing imported_characters store, rebuilding:', storeError);
      }

      const rawTempList = JSON.parse(localStorage.getItem('temp_characters') || '[]');
      const tempListKeys = Array.isArray(rawTempList)
        ? rawTempList.filter(key => /^char_\d+$/.test(key) && localStorage.getItem(key))
        : [];

      const referenceKeys = Object.keys(importedCharactersStore.references || {})
        .filter(key => /^char_\d+$/.test(key) && localStorage.getItem(key));

      const activeReferenceSet = new Set([...tempListKeys, ...referenceKeys]);

      // Remove orphaned slot keys not tracked by active references
      for (let index = 1; index <= MAX_TEMP_CHARACTERS; index++) {
        const key = `char_${String(index).padStart(2, '0')}`;
        if (localStorage.getItem(key) && !activeReferenceSet.has(key)) {
          localStorage.removeItem(key);
        }
      }

      const activeReferences = [...activeReferenceSet]
        .filter(key => localStorage.getItem(key))
        .sort((a, b) => (parseSlotIndex(a) || 999) - (parseSlotIndex(b) || 999));

      const cleanedReferences = {};
      for (const key of activeReferences) {
        const storedRaw = localStorage.getItem(key);
        if (!storedRaw) continue;

        if (importedCharactersStore.references[key] && typeof importedCharactersStore.references[key] === 'object') {
          cleanedReferences[key] = importedCharactersStore.references[key];
          continue;
        }

        try {
          cleanedReferences[key] = JSON.parse(storedRaw);
        } catch {
          // Skip broken entries
        }
      }

      const cleanedOrderFromStore = (importedCharactersStore.order || [])
        .filter(key => activeReferences.includes(key));
      const missingOrderKeys = activeReferences.filter(key => !cleanedOrderFromStore.includes(key));
      const cleanedOrder = [...cleanedOrderFromStore, ...missingOrderKeys];

      importedCharactersStore = {
        references: cleanedReferences,
        order: cleanedOrder
      };

      localStorage.setItem('temp_characters', JSON.stringify(activeReferences));
      localStorage.setItem('imported_characters', JSON.stringify(importedCharactersStore, null, 2));

      const occupiedIndexes = new Set(
        activeReferences
          .map(key => parseSlotIndex(key))
          .filter(index => Number.isInteger(index) && index >= 1 && index <= MAX_TEMP_CHARACTERS)
      );

      // Duplicate detection:
      // 1) Match candidate entries by character name
      // 2) Compare normalized JSON signatures
      if (incomingCharacterName) {
        for (const key of activeReferences) {
          const storedRaw = localStorage.getItem(key);
          if (!storedRaw) continue;

          let storedData;
          try {
            storedData = JSON.parse(storedRaw);
          } catch {
            continue;
          }

          const storedName = (storedData?.character?.name || '').trim().toLowerCase();
          if (!storedName || storedName !== incomingCharacterName) continue;

          const storedSignature = JSON.stringify(normalizeForDuplicateCheck(storedData));
          if (storedSignature === incomingSignature) {
            console.warn(`Duplicate character detected; skipping storage (${key})`);
            return {
              stored: false,
              reason: 'duplicate',
              existingReference: key,
              max: MAX_TEMP_CHARACTERS,
              total: occupiedIndexes.size
            };
          }
        }
      }

      if (occupiedIndexes.size >= MAX_TEMP_CHARACTERS) {
        console.warn(`Temporary character limit reached (${MAX_TEMP_CHARACTERS})`);
        return {
          stored: false,
          reason: 'limit_reached',
          max: MAX_TEMP_CHARACTERS,
          total: occupiedIndexes.size
        };
      }

      // Allocate lowest available slot first (char_01..char_30)
      let nextIndex = null;
      for (let index = 1; index <= MAX_TEMP_CHARACTERS; index++) {
        if (!occupiedIndexes.has(index)) {
          nextIndex = index;
          break;
        }
      }

      if (!nextIndex) {
        return {
          stored: false,
          reason: 'limit_reached',
          max: MAX_TEMP_CHARACTERS,
          total: occupiedIndexes.size
        };
      }

      const key = `char_${String(nextIndex).padStart(2, '0')}`;
      const storedAt = new Date().toISOString();
      const characterToStore = JSON.parse(JSON.stringify(data || {}));

      if (!characterToStore.metadata || typeof characterToStore.metadata !== 'object') {
        characterToStore.metadata = {};
      }

      characterToStore.metadata.referenceHeading = key;
      characterToStore.metadata.storedAt = storedAt;

      localStorage.setItem(key, JSON.stringify(characterToStore));

      const updatedList = [...activeReferences.filter(ref => ref !== key), key]
        .sort((a, b) => (parseSlotIndex(a) || 999) - (parseSlotIndex(b) || 999));
      localStorage.setItem('temp_characters', JSON.stringify(updatedList));

      importedCharactersStore.references[key] = characterToStore;
      importedCharactersStore.order = [...(importedCharactersStore.order || []).filter(ref => ref !== key), key];
      localStorage.setItem('imported_characters', JSON.stringify(importedCharactersStore, null, 2));

      console.log(`Character exported to temp storage: ${key}`);
      return {
        stored: true,
        key,
        max: MAX_TEMP_CHARACTERS,
        total: updatedList.length,
        data: characterToStore
      };
    } catch (error) {
      console.error('Error exporting to JSON:', error);
      throw error;
    }
  }

  /**
   * Get all temp characters (char_01, char_02, etc.)
   */
  getAllTempCharacters() {
    try {
      const tempList = JSON.parse(localStorage.getItem('temp_characters') || '[]');
      const characters = [];
      
      for (const key of tempList) {
        const data = localStorage.getItem(key);
        if (data) {
          characters.push({
            key: key,
            data: JSON.parse(data)
          });
        }
      }
      
      return characters;
    } catch (error) {
      console.error('Error retrieving temp characters:', error);
      return [];
    }
  }

  /**
   * Import JSON file and return parsed data (in-memory only)
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
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.CharacterPDFParser = CharacterPDFParser;
}
