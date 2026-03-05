/**
 * Character Data Loader
 * Bridges character JSON data with the flowchart application
 * Loads character data and applies it to the UI
 */

class CharacterLoader {
  constructor() {
    this.characterData = null;
    this.dataPath = 'chain_warden_data.json';
    this.onDataLoaded = null;
    this.onError = null;
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
      this.characterData = await response.json();
      
      console.log('Character data loaded:', this.characterData.character.name);
      
      if (this.onDataLoaded) {
        this.onDataLoaded(this.characterData);
      }
      
      return this.characterData;
    } catch (error) {
      console.error('Error loading character data:', error);
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
          this.characterData = JSON.parse(e.target.result);
          console.log('Character data loaded from blob:', this.characterData.character.name);
          
          if (this.onDataLoaded) {
            this.onDataLoaded(this.characterData);
          }
          
          resolve(this.characterData);
        } catch (error) {
          reject(new Error('Invalid JSON: ' + error.message));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(blob);
    });
  }

  /**
   * Get character ability modifier
   */
  getModifier(abilityName) {
    if (!this.characterData || !this.characterData.abilityScores) {
      return 0;
    }
    return this.characterData.abilityScores[abilityName]?.modifier || 0;
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
      console.warn('No character data loaded');
      return;
    }

    // Apply ability scores to stat boxes
    this.applyAbilityScores();

    // Apply actions to cards
    this.applyActions();

    // Apply combat stats
    this.applyCombatStats();

    console.log('Character data applied to flowchart');
  }

  /**
   * Apply ability scores to UI
   */
  applyAbilityScores() {
    if (!this.characterData?.abilityScores) return;

    const abilities = this.characterData.abilityScores;
    
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

    const actions = this.characterData.actions.primary;
    
    // Map actions to cards
    actions.forEach((action, index) => {
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

      // Update TO HIT value
      if (action.toHit !== undefined) {
        const hitBox = card.querySelector('#hit-box .scroll-container');
        if (hitBox) {
          // Clear existing and set new value
          hitBox.innerHTML = `<div class="scroll-item">+${action.toHit}</div>`;
        }
      }

      // Update damage value
      if (action.damage) {
        const dmgBox = card.querySelector('#dmg-box .scroll-container');
        if (dmgBox && action.damage.dice) {
          dmgBox.innerHTML = `<div class="scroll-item">${action.damage.dice}</div>`;
        }
      }

      // Update range
      if (action.range) {
        const rngBox = card.querySelector('#rng-box .scroll-container');
        if (rngBox) {
          rngBox.innerHTML = `<div class="scroll-item">${action.range}</div>`;
        }
      }

      // Store action data on card for reference
      card.dataset.actionId = action.id;
      card.dataset.externalLink = action.externalLink || '';
    });

    // Update folder label if first card changed
    if (actions.length > 0) {
      const activeLabel = document.getElementById('active-label');
      if (activeLabel) {
        activeLabel.textContent = actions[0].name;
      }
    }
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
      ...this.characterData.actions.primary,
      ...this.characterData.actions.bonus,
      ...this.characterData.actions.reaction
    ];
    
    return allActions.find(a => a.id === actionId) || null;
  }

  /**
   * Get all actions of a specific type
   */
  getActionsByType(type) {
    if (!this.characterData?.actions) return [];
    
    const allActions = [
      ...this.characterData.actions.primary,
      ...this.characterData.actions.bonus,
      ...this.characterData.actions.reaction
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
      actions: this.characterData.actions.primary.length
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
