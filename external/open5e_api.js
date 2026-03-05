/**
 * Open5e API Integration
 * Fetches D&D 5e SRD data to validate and enrich character data
 * API: https://api.open5e.com/
 */

class Open5eAPI {
  constructor() {
    this.baseUrl = 'https://api.open5e.com';
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Fetch data from Open5e API with caching
   */
  async fetch(endpoint, params = {}) {
    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log(`[Open5e] Cache hit: ${endpoint}`);
      return cached.data;
    }
    
    try {
      const url = new URL(`${this.baseUrl}/${endpoint}`);
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
      
      console.log(`[Open5e] Fetching: ${url}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Open5e API error: ${response.status}`);
      }
      
      const data = await response.json();
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      
      return data;
    } catch (error) {
      console.error(`[Open5e] Error fetching ${endpoint}:`, error);
      return null;
    }
  }

  /**
   * Search for a spell by name
   */
  async searchSpell(name) {
    const slug = this.toSlug(name);
    return await this.fetch(`spells/${slug}`);
  }

  /**
   * Search for a monster by name
   */
  async searchMonster(name) {
    const slug = this.toSlug(name);
    return await this.fetch(`monsters/${slug}`);
  }

  /**
   * Get class data
   */
  async getClass(className) {
    const slug = this.toSlug(className);
    return await this.fetch(`classes/${slug}`);
  }

  /**
   * Get feat data
   */
  async getFeat(featName) {
    const slug = this.toSlug(featName);
    return await this.fetch(`feats/${slug}`);
  }

  /**
   * Get magic item data
   */
  async getMagicItem(itemName) {
    const slug = this.toSlug(itemName);
    return await this.fetch(`magic-items/${slug}`);
  }

  /**
   * Search for any document by name
   */
  async search(query, endpoint = 'spells') {
    return await this.fetch(endpoint, { search: query });
  }

  /**
   * Enrich action data with Open5e information
   */
  async enrichAction(action) {
    if (!action) return action;
    
    const enriched = { ...action };
    
    // Try to find matching spell
    if (action.type === 'spell' || action.type === 'class_feature') {
      const spellData = await this.searchSpell(action.name);
      if (spellData) {
        enriched.open5eData = spellData;
        enriched.externalLink = `/spells/${spellData.slug}`;
        enriched.description = spellData.desc?.full || action.description;
        enriched.school = spellData.school;
        enriched.level = spellData.level;
      }
    }
    
    // Try to find matching monster attack
    if (action.type === 'monster_attack') {
      // Monster attacks are typically homebrew
      enriched.externalLink = null;
    }
    
    return enriched;
  }

  /**
   * Validate action data against Open5e
   */
  async validateAction(action) {
    const issues = [];
    
    // Check if spell exists in SRD
    if (action.type === 'spell') {
      const spellData = await this.searchSpell(action.name);
      if (!spellData) {
        issues.push({
          field: 'name',
          message: `Spell "${action.name}" not found in SRD. May be homebrew or from non-SRD source.`,
          severity: 'warning'
        });
      } else {
        // Validate damage
        if (action.damage && spellData.damage) {
          // Compare damage dice
          if (!this.damageMatches(action.damage, spellData.damage)) {
            issues.push({
              field: 'damage',
              message: `Damage "${action.damage}" differs from SRD "${spellData.damage}"`,
              severity: 'info'
            });
          }
        }
      }
    }
    
    // Check class features
    if (action.type === 'class_feature') {
      // Class features aren't well documented in Open5e
      // Just add a note
      issues.push({
        field: 'source',
        message: 'Class feature - verify against official source',
        severity: 'info'
      });
    }
    
    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues
    };
  }

  /**
   * Check if damage strings match (rough comparison)
   */
  damageMatches(local, srd) {
    if (!local || !srd) return false;
    
    // Extract dice from both
    const localDice = local.dice?.match(/(\d+)d(\d+)/i);
    const srdDice = srd.match(/(\d+)d(\d+)/i);
    
    if (!localDice || !srdDice) return false;
    
    return localDice[1] === srdDice[1] && localDice[2] === srdDice[2];
  }

  /**
   * Generate external link URL
   */
  getExternalLink(type, slug) {
    return `${this.baseUrl}/${type}/${slug}`;
  }

  /**
   * Convert name to URL slug
   */
  toSlug(name) {
    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[Open5e] Cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }

  /**
   * Get character data from imported_characters.json
   */
  getFromImportedCharacters() {
    try {
      const json = localStorage.getItem('imported_characters');
      if (json) {
        const parsed = JSON.parse(json);

        // New structured storage format:
        // { references: { char_01: {...} }, order: ['char_01', ...] }
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.references) {
          const order = Array.isArray(parsed.order) ? parsed.order : [];
          if (order.length > 0) {
            const latestRef = order[order.length - 1];
            return parsed.references?.[latestRef] || null;
          }

          const refKeys = Object.keys(parsed.references || {});
          if (refKeys.length > 0) {
            return parsed.references[refKeys[refKeys.length - 1]];
          }

          return null;
        }

        // Backward compatible: previously stored raw character data object
        return parsed;
      }
    } catch (e) {
      console.warn('[Open5eAPI] Could not load from imported_characters:', e);
    }
    return null;
  }

  /**
   * Import from imported_characters.json file
   */
  async importImportedCharactersFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          localStorage.setItem('imported_characters', JSON.stringify(data, null, 2));
          console.log('[Open5eAPI] imported_characters.json imported');
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

// Create global instance
window.open5eAPI = new Open5eAPI();
