/**
 * External Link Manager
 * Handles hyperlinks to external D&D resources
 * Supports multiple sources: Open5e, D&D Beyond, AIDEDD, etc.
 */

class ExternalLinkManager {
  constructor() {
    // Available external sources
    this.sources = {
      open5e: {
        name: 'Open5e',
        baseUrl: 'https://open5e.com',
        enabled: true,
        routes: {
          spell: '/spells/:slug',
          monster: '/monsters/:slug',
          class: '/classes/:slug',
          feat: '/feats/:slug',
          magicItem: '/magic-items/:slug',
          background: '/backgrounds/:slug',
          race: '/races/:slug'
        }
      },
      dndbeyond: {
        name: 'D&D Beyond',
        baseUrl: 'https://www.dndbeyond.com',
        enabled: false, // Requires authentication
        routes: {
          spell: '/spells/:slug',
          monster: '/monsters/:slug',
          item: '/magic-items/:slug'
        }
      },
      aidedd: {
        name: 'AIDEDD',
        baseUrl: 'https://www.aidedd.org',
        enabled: true,
        routes: {
          spell: '/dnd/spell.php?name=:name',
          monster: '/dnd/monster.php?name=:name'
        }
      },
      roll20: {
        name: 'Roll20 Compendium',
        baseUrl: 'https://roll20.net/compendium/dnd5e',
        enabled: true,
        routes: {
          spell: '/Spells/:slug',
          monster: '/Monsters/:slug'
        }
      }
    };

    this.defaultSource = 'open5e';
    this.linkCache = new Map();
  }

  /**
   * Generate a link for an action/ability
   */
  generateLink(item, type = 'auto') {
    if (!item) return null;

    // Check if item has a direct external link
    if (item.externalLink) {
      if (item.externalLink.startsWith('http')) {
        return item.externalLink;
      }
      return this.sources[this.defaultSource].baseUrl + item.externalLink;
    }

    // Auto-detect type if not specified
    if (type === 'auto') {
      type = this.detectItemType(item);
    }

    // Generate link from name
    const slug = this.toSlug(item.name);
    const source = this.sources[this.defaultSource];
    
    if (!source.enabled) {
      return null;
    }

    const route = source.routes[type];
    if (!route) {
      return null;
    }

    const url = route
      .replace(':slug', slug)
      .replace(':name', encodeURIComponent(item.name));

    return source.baseUrl + url;
  }

  /**
   * Create a clickable link element
   */
  createLinkElement(item, options = {}) {
    const {
      text = '📖',
      title = `View ${item.name} in ${this.sources[this.defaultSource].name}`,
      className = 'external-link',
      openInNewTab = true
    } = options;

    const url = this.generateLink(item);
    if (!url) return null;

    const link = document.createElement('a');
    link.href = url;
    link.textContent = text;
    link.title = title;
    link.className = className;
    
    if (openInNewTab) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }

    return link;
  }

  /**
   * Inject links into card elements
   */
  injectLinksIntoCards() {
    const cards = document.querySelectorAll('.stack-card');
    
    cards.forEach(card => {
      const actionId = card.dataset.actionId;
      const externalLink = card.dataset.externalLink;
      
      if (!actionId && !externalLink) return;

      // Find or create link container
      let linkContainer = card.querySelector('.external-links');
      if (!linkContainer) {
        linkContainer = document.createElement('div');
        linkContainer.className = 'external-links';
        linkContainer.style.cssText = `
          position: absolute;
          top: 10px;
          right: 10px;
          display: flex;
          gap: 4px;
          z-index: 100;
        `;
        card.appendChild(linkContainer);
      }

      // Get action data
      const action = window.characterLoader?.getActionById(actionId);
      if (action || externalLink) {
        const link = this.createLinkElement(
          action || { name: card.dataset.label, externalLink },
          { text: '📖', className: 'card-external-link' }
        );
        
        if (link) {
          // Style the link
          link.style.cssText = `
            background: rgba(255,255,255,0.2);
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 12px;
            text-decoration: none;
            cursor: pointer;
            transition: background 0.2s;
          `;
          
          link.addEventListener('mouseenter', () => {
            link.style.background = 'rgba(255,255,255,0.4)';
          });
          
          link.addEventListener('mouseleave', () => {
            link.style.background = 'rgba(255,255,255,0.2)';
          });
          
          linkContainer.appendChild(link);
        }
      }
    });
  }

  /**
   * Detect item type from action data
   */
  detectItemType(item) {
    if (!item) return null;

    const type = item.type?.toLowerCase();
    const name = item.name?.toLowerCase();

    if (type?.includes('spell') || name?.includes('smite')) {
      return 'spell';
    }
    if (type?.includes('monster')) {
      return 'monster';
    }
    if (type?.includes('class')) {
      return 'class';
    }
    if (type?.includes('feat')) {
      return 'feat';
    }
    if (type?.includes('item') || type?.includes('magic')) {
      return 'magicItem';
    }

    return null;
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
   * Set default source
   */
  setDefaultSource(sourceName) {
    if (this.sources[sourceName]) {
      this.defaultSource = sourceName;
      console.log(`[LinkManager] Default source set to: ${sourceName}`);
    }
  }

  /**
   * Enable/disable a source
   */
  setSourceEnabled(sourceName, enabled) {
    if (this.sources[sourceName]) {
      this.sources[sourceName].enabled = enabled;
      console.log(`[LinkManager] ${sourceName} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Get all available sources
   */
  getAvailableSources() {
    return Object.entries(this.sources)
      .filter(([_, source]) => source.enabled)
      .map(([key, source]) => ({
        key,
        name: source.name,
        isDefault: key === this.defaultSource
      }));
  }

  /**
   * Generate all possible links for an item
   */
  getAllLinks(item) {
    const links = [];
    const type = this.detectItemType(item);

    for (const [key, source] of Object.entries(this.sources)) {
      if (!source.enabled) continue;

      const route = source.routes[type];
      if (!route) continue;

      const slug = this.toSlug(item.name);
      const url = route
        .replace(':slug', slug)
        .replace(':name', encodeURIComponent(item.name));

      links.push({
        source: source.name,
        url: source.baseUrl + url,
        isDefault: key === this.defaultSource
      });
    }

    return links;
  }

  /**
   * Create link dropdown menu
   */
  createLinkDropdown(item, anchorElement) {
    const links = this.getAllLinks(item);
    if (links.length === 0) return null;

    const dropdown = document.createElement('div');
    dropdown.className = 'link-dropdown';
    dropdown.style.cssText = `
      position: absolute;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      min-width: 150px;
      display: none;
    `;

    links.forEach(link => {
      const linkEl = document.createElement('a');
      linkEl.href = link.url;
      linkEl.target = '_blank';
      linkEl.rel = 'noopener noreferrer';
      linkEl.textContent = link.name;
      linkEl.style.cssText = `
        display: block;
        padding: 8px 12px;
        color: #1e293b;
        text-decoration: none;
        font-size: 13px;
        transition: background 0.2s;
      `;
      
      if (link.isDefault) {
        linkEl.style.fontWeight = '600';
      }
      
      linkEl.addEventListener('mouseenter', () => {
        linkEl.style.background = '#f1f5f9';
      });
      
      linkEl.addEventListener('mouseleave', () => {
        linkEl.style.background = 'white';
      });
      
      dropdown.appendChild(linkEl);
    });

    // Toggle dropdown on click
    anchorElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const isVisible = dropdown.style.display === 'block';
      dropdown.style.display = isVisible ? 'none' : 'block';
      dropdown.style.top = (anchorElement.offsetTop + anchorElement.offsetHeight) + 'px';
      dropdown.style.left = anchorElement.offsetLeft + 'px';
    });

    // Close dropdown when clicking elsewhere
    document.addEventListener('click', () => {
      dropdown.style.display = 'none';
    });

    return dropdown;
  }
}

// Create global instance
window.externalLinkManager = new ExternalLinkManager();
