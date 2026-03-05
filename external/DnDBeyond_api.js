/**
 * DnDBeyond Integration Adapter
 * Reference-first helper for constructing links to official D&D Beyond resources.
 * Note: This adapter intentionally avoids direct rules-content scraping/API assumptions.
 */

class DnDBeyondAPI {
  constructor() {
    this.baseUrl = 'https://www.dndbeyond.com';
  }

  buildRulesUrl() {
    return `${this.baseUrl}/srd`;
  }

  buildSearchUrl(query) {
    const q = encodeURIComponent(String(query || '').trim());
    return `${this.baseUrl}/search?q=${q}`;
  }

  buildSpellsUrl(query = '') {
    const q = encodeURIComponent(String(query || '').trim());
    return `${this.baseUrl}/spells${q ? `?filter-search=${q}` : ''}`;
  }

  buildMonstersUrl(query = '') {
    const q = encodeURIComponent(String(query || '').trim());
    return `${this.baseUrl}/monsters${q ? `?filter-search=${q}` : ''}`;
  }

  buildConditionsUrl() {
    return `${this.baseUrl}/srd/appendix-a-conditions`;
  }

  getExternalLink(type, query = '') {
    const normalizedType = String(type || '').toLowerCase();
    if (normalizedType === 'srd' || normalizedType === 'rules') return this.buildRulesUrl();
    if (normalizedType === 'spell') return this.buildSpellsUrl(query);
    if (normalizedType === 'monster') return this.buildMonstersUrl(query);
    if (normalizedType === 'conditions') return this.buildConditionsUrl();
    return this.buildSearchUrl(query);
  }

  async fetchReferenceHint() {
    return {
      ok: true,
      mode: 'reference_only',
      message: 'DnDBeyond adapter is configured for link/reference integration, not automated rules ingestion.'
    };
  }
}

window.dndBeyondAPI = new DnDBeyondAPI();
