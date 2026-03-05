/**
 * AideDD Integration Adapter
 * Reference-first helper for linking/searching AideDD content.
 * Note: AideDD does not expose a documented public JSON API contract here,
 * so this adapter focuses on URL construction and optional page fetch attempts.
 */

class AideDDAPI {
  constructor() {
    this.baseUrl = 'https://www.aidedd.org';
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000;
  }

  async fetchPage(path = '/') {
    const normalizedPath = String(path || '/').startsWith('/') ? String(path || '/') : `/${String(path || '')}`;
    const cacheKey = `page:${normalizedPath}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      const response = await fetch(`${this.baseUrl}${normalizedPath}`);
      if (!response.ok) {
        throw new Error(`AideDD page fetch failed: ${response.status}`);
      }
      const text = await response.text();
      this.cache.set(cacheKey, { data: text, timestamp: Date.now() });
      return text;
    } catch (error) {
      console.warn('[AideDD] fetchPage unavailable or blocked by CORS/policy:', error);
      return null;
    }
  }

  buildSpellSearchUrl(query) {
    const q = encodeURIComponent(String(query || '').trim());
    return `${this.baseUrl}/dnd-filters/sorts.php?search=${q}`;
  }

  buildMonsterSearchUrl(query) {
    const q = encodeURIComponent(String(query || '').trim());
    return `${this.baseUrl}/dnd-filters/monstres.php?search=${q}`;
  }

  buildConditionReferenceUrl() {
    return `${this.baseUrl}/regles/conditions/`;
  }

  buildRulesReferenceUrl() {
    return `${this.baseUrl}/regles/`;
  }

  getExternalLink(type, slugOrQuery = '') {
    const normalizedType = String(type || '').toLowerCase();
    const value = String(slugOrQuery || '').trim();

    if (normalizedType === 'spell') return this.buildSpellSearchUrl(value);
    if (normalizedType === 'monster') return this.buildMonsterSearchUrl(value);
    if (normalizedType === 'conditions') return this.buildConditionReferenceUrl();
    if (normalizedType === 'rules') return this.buildRulesReferenceUrl();

    return `${this.baseUrl}/`;
  }

  clearCache() {
    this.cache.clear();
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

window.aideDDAPI = new AideDDAPI();
