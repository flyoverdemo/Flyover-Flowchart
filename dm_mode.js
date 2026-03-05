/**
 * DM Mode Module
 * Provides alternate canvas layout for DM encounter tracking
 * Toggles between Player and DM canvas modes within the same window
 */

class DMModeManager {
  constructor() {
    this.isActive = false;
    this.dmCanvasId = 'dm-canvas-container';
    this.playerCanvasId = 'world';
    this.viewportStorageKey = 'chainWarden_dmMode_viewStates';
    this.activeModeStorageKey = 'chainWarden_activeCanvasMode';
    
    // View state storage for both modes
    this.viewStates = {
      player: { zoom: 1, panX: 0, panY: 0 },
      dm: { zoom: 1, panX: window.innerWidth / 2 - 2500, panY: window.innerHeight / 2 - 1100 }
    };
    
    // DM mode uses same 3 zoom levels as player canvas
    this.DM_ZOOM_LEVELS = [0.5, 1.0, 1.5];
    this.DM_MIN_ZOOM = this.DM_ZOOM_LEVELS[0];
    this.DM_MAX_ZOOM = this.DM_ZOOM_LEVELS[this.DM_ZOOM_LEVELS.length - 1];
    this.dmCurrentZoomIndex = 1; // Start at default (1.0)
    
    // Button state storage for both modes
    this.buttonStates = {
      player: {
        trackActions: true,  // Default: ON
        editLayout: false    // Default: OFF
      },
      dm: {
        trackActions: true,  // Default: ON
        editLayout: false    // Default: OFF
      }
    };
    
    // DM Enemy Data (example - can be expanded)
    this.enemies = [
      {
        id: 'goblin_01',
        name: 'Goblin',
        type: 'Small Humanoid',
        alignment: 'Neutral Evil',
        cr: '1/4',
        ac: 15,
        hp: { current: 7, max: 7, formula: '2d6' },
        speed: 30,
        abilities: {
          str: { score: 8, mod: -1 },
          dex: { score: 14, mod: 2 },
          con: { score: 10, mod: 0 },
          int: { score: 10, mod: 0 },
          wis: { score: 8, mod: -1 },
          cha: { score: 8, mod: -1 }
        },
        actions: [
          { name: 'Scimitar', hit: '+4', damage: '1d6+2', type: 'melee' }
        ],
        traits: [
          { name: 'Nimble Escape', desc: 'Disengage/Hide (Bonus Action)' }
        ]
      }
    ];

    this.loadPersistedViewStates();
  }

  persistViewStates() {
    try {
      localStorage.setItem(this.viewportStorageKey, JSON.stringify(this.viewStates));
    } catch (error) {
      console.warn('[DM Mode] Failed to persist viewport state:', error);
    }
  }

  loadPersistedViewStates() {
    try {
      const savedRaw = localStorage.getItem(this.viewportStorageKey);
      if (!savedRaw) return;

      const saved = JSON.parse(savedRaw);
      if (!saved || typeof saved !== 'object') return;

      const sanitizeView = (candidate, fallback) => {
        if (!candidate || typeof candidate !== 'object') return fallback;
        const zoom = Number(candidate.zoom);
        const panX = Number(candidate.panX);
        const panY = Number(candidate.panY);
        const zoomIndex = Number(candidate.zoomIndex);
        const nextView = {
          zoom: Number.isFinite(zoom) ? zoom : fallback.zoom,
          panX: Number.isFinite(panX) ? panX : fallback.panX,
          panY: Number.isFinite(panY) ? panY : fallback.panY
        };
        if (Number.isInteger(zoomIndex) && zoomIndex >= 0) {
          nextView.zoomIndex = zoomIndex;
        }
        return nextView;
      };

      this.viewStates.player = sanitizeView(saved.player, this.viewStates.player);
      this.viewStates.dm = sanitizeView(saved.dm, this.viewStates.dm);
    } catch (error) {
      console.warn('[DM Mode] Failed to load viewport state:', error);
    }
  }

  dmDebug(message, details = null) {
    if (details && typeof details === 'object') {
      console.log(`[DM Debug] ${message}`, details);
    } else {
      console.log(`[DM Debug] ${message}`);
    }
  }

  /**
   * Initialize DM Mode
   */
  init() {
    this.injectStyles();
    this.createDMCanvas();
    this.updateFooterButtons();
    setTimeout(() => {
      const savedMode = this.loadPersistedActiveMode();
      if (savedMode === 'dm') {
        this.activate();
      }
    }, 0);
    console.log('[DM Mode] Initialized');
  }

  persistActiveMode() {
    try {
      localStorage.setItem(this.activeModeStorageKey, this.isActive ? 'dm' : 'player');
    } catch (error) {
      console.warn('[DM Mode] Failed to persist active mode:', error);
    }
  }

  loadPersistedActiveMode() {
    try {
      const saved = String(localStorage.getItem(this.activeModeStorageKey) || '').toLowerCase();
      return saved === 'dm' ? 'dm' : 'player';
    } catch (error) {
      console.warn('[DM Mode] Failed to load active mode:', error);
      return 'player';
    }
  }

  sanitizeLegacyFloatingWindowZIndexLocks(styleEl = null) {
    const styleTargets = styleEl
      ? [styleEl]
      : Array.from(document.querySelectorAll('style'));

    styleTargets.forEach((candidateStyleEl) => {
      if (!candidateStyleEl || typeof candidateStyleEl.textContent !== 'string') return;
      const originalCss = candidateStyleEl.textContent;
      if (!originalCss.includes('#log-window') || !originalCss.includes('#load-character-window')) return;
      const sanitizedCss = originalCss.replace(/z-index\s*:\s*1000\s*!important\s*;?/gi, '');
      if (sanitizedCss !== originalCss) {
        candidateStyleEl.textContent = sanitizedCss;
      }
    });
  }

  /**
   * Inject DM Mode CSS styles
   */
  injectStyles() {
    const styleId = 'dm-mode-styles';
    const existingStyles = document.getElementById(styleId);
    if (existingStyles) {
      this.sanitizeLegacyFloatingWindowZIndexLocks(existingStyles);
      return;
    }

    this.sanitizeLegacyFloatingWindowZIndexLocks();

    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
      /* DM Mode Main Container - acts as viewport mask with background grid */
      #dm-canvas-mask {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
        /* Background grid like player canvas mask */
        background-color: #ffffff;
        background-image:
          linear-gradient(#e5eef7 1px, transparent 1px),
          linear-gradient(90deg, #e5eef7 1px, transparent 1px);
        background-size: 40px 40px;
        background-position: 0 0;
      }

      /* DM Canvas Content Container - inside mask, gets transformed */
      #dm-canvas-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 5000px;
        height: 5000px;
        transform-origin: 0 0;
        display: none;
        pointer-events: auto;
        z-index: 2;
        /* No background - that's on the mask */
      }
      
      #dm-canvas-container.active {
        display: block;
      }
      
      /* DM elements on canvas - locked to canvas coordinates */
      #dm-canvas-container .dm-monster-card,
      #dm-canvas-container .dm-tactical-card,
      #dm-canvas-container #dm-tac-actions-stack {
        pointer-events: auto;
        /* //enemy card default layer: typically 'dm layer', but not always */
        z-index: 10;
        position: absolute;
        user-select: none;
      }
      
      /* Tactical card - positioned on canvas, relative for child action stack */
      #dm-canvas-container .dm-tactical-card {
        position: absolute;
        left: 0;
        top: 0;
      }
      
      /* Tactical Actions Stack - positioned relative to tactical card */
      #dm-canvas-container #dm-tac-actions-stack {
        position: absolute;
        left: calc(100% + 10px);
        top: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 50;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease, transform 0.2s ease;
        transform: translateX(-10px);
      }
      
      #dm-canvas-container #dm-tac-actions-stack.visible {
        opacity: 1;
        pointer-events: auto;
        transform: translateX(0);
      }
      
      /* Header drag handles for DM elements - exclusive drag zone */
      #dm-canvas-container .dm-card-header,
      #dm-canvas-container .dm-tactical-header {
        cursor: grab;
        user-select: none;
        /* Prevent button clicks from interfering with drag */
        pointer-events: auto;
      }
      
      #dm-canvas-container .dm-card-header:active,
      #dm-canvas-container .dm-tactical-header:active {
        cursor: grabbing;
      }
      
      /* Card body buttons - clickable, don't trigger drag */
      #dm-canvas-container .dm-action-item,
      #dm-canvas-container .dm-tac-stat-btn,
      #dm-canvas-container .dm-dot,
      #dm-canvas-container .dm-tac-action-btn {
        cursor: pointer;
        user-select: none;
      }
      
      /* DM element being dragged */
      #dm-canvas-container .dm-element-dragging {
        opacity: 0.9;
        z-index: 100 !important;
        box-shadow: 0 20px 50px rgba(0,0,0,0.3);
        pointer-events: none; /* Prevent button clicks during drag */
      }
      
      /* Ensure floating windows stay above canvas and don't affect it */
      #log-window,
      #log-calculator-window,
      .sticky-note-window,
      #character-info-window,
      #load-character-window {
        position: fixed !important;
      }
      
      /* Prevent window drag from affecting canvas elements */
      body.is-dragging-window #dm-canvas-container {
        pointer-events: none !important;
      }
      
      /* Hide character buffer display in DM mode */
      .dm-mode-hidden {
        display: none !important;
      }

      /* Enemy Info Sheet (Monster Card) - hidden by default */
      #dm-canvas-container .dm-monster-card {
        opacity: 0;
        pointer-events: none;
        transform: translateX(-20px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        /* Canvas positioning */
        position: absolute;
        left: 2080px;
        top: 1000px;
        width: 320px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        border-top: 6px solid var(--monster-red);
        overflow: hidden;
        color: var(--text-main);
        padding-bottom: 12px;
      }
      
      #dm-canvas-container .dm-monster-card.visible {
        opacity: 1;
        pointer-events: auto;
        transform: translateX(0);
      }
      
      /* Remove duplicate positioning from general selector */
      #dm-canvas-container .dm-monster-card .dm-card-header {
        display: flex;
        padding: 16px;
        gap: 16px;
        border-bottom: 1px solid #f1f5f9;
      }

      #dm-canvas-container .dm-monster-card .dm-portrait {
        width: 70px;
        height: 70px;
        background: #fee2e2;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border: 1px solid #fecaca;
      }
      
      #dm-canvas-container .dm-monster-card .dm-identity {
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      #dm-canvas-container .dm-monster-card .dm-name {
        font-size: 18px;
        font-weight: 800;
        text-transform: uppercase;
        color: var(--monster-red);
      }
      
      .dm-sub {
        font-size: 11px;
        color: #64748b;
        font-weight: 600;
      }

      #dm-canvas-container .dm-monster-card .dm-vitals-row {
        display: flex;
        justify-content: space-around;
        padding: 12px;
        background: #fffafa;
      }
      
      .dm-vital-box {
        text-align: center;
      }
      
      .dm-vital-label {
        font-size: 9px;
        font-weight: 800;
        color: #94a3b8;
        display: block;
      }
      
      .dm-vital-val {
        font-size: 16px;
        font-weight: 800;
      }

      #dm-canvas-container .dm-monster-card .dm-ability-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        padding: 12px;
        gap: 4px;
        background: white;
      }
      
      .dm-ability-box {
        text-align: center;
        border: 1px solid #f1f5f9;
        border-radius: 4px;
        padding: 4px 0;
      }
      
      .dm-ab-label {
        font-size: 8px;
        font-weight: 700;
        color: #94a3b8;
      }
      
      .dm-ab-val {
        font-size: 11px;
        font-weight: 800;
        display: block;
      }

      #dm-canvas-container .dm-monster-card .dm-action-section {
        padding: 8px 16px;
      }
      
      #dm-canvas-container .dm-monster-card .dm-section-title {
        font-size: 10px;
        font-weight: 800;
        color: #94a3b8;
        border-bottom: 1px solid #f1f5f9;
        margin-bottom: 8px;
        padding-bottom: 4px;
      }
      
      #dm-canvas-container .dm-monster-card .dm-action-item {
        background: #f8fafc;
        border-radius: 6px;
        padding: 8px;
        margin-bottom: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      #dm-canvas-container .dm-monster-card .dm-action-item:hover {
        background: #f1f5f9;
      }
      
      #dm-canvas-container .dm-monster-card .dm-act-name {
        font-size: 12px;
        font-weight: 700;
      }
      
      #dm-canvas-container .dm-monster-card .dm-act-stats {
        font-size: 11px;
        color: #64748b;
        font-weight: 600;
      }

      /* DM Canvas Sticky Notes Container - inside DM canvas for transform inheritance */
      #canvas-sticky-notes-dm {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 50;
        display: none;
      }

      #canvas-sticky-notes-dm.active {
        display: block;
      }

      /* //enemy card */
      /* Enemy Tactical Card */
      .dm-tactical-card {
        position: absolute;
        width: 240px;
        background: var(--enemy-dark-red);
        border-radius: 8px;
        box-shadow: 0 12px 30px rgba(0,0,0,0.3);
        color: white;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        cursor: pointer;
        user-select: none;
        transition: transform 0.1s;
      }
      
      .dm-tactical-card:active {
        transform: scale(0.98);
      }

      .dm-tactical-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255,255,255,0.2);
        padding-bottom: 4px;
      }

      .dm-tactical-vitals {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
        text-align: center;
      }
      
      .dm-tac-box {
        background: rgba(0,0,0,0.2);
        border-radius: 4px;
        padding: 4px 2px;
      }
      
      .dm-tac-label {
        font-size: 8px;
        text-transform: uppercase;
        opacity: 0.8;
        font-weight: 700;
        display: block;
      }
      
      .dm-tac-val {
        font-size: 12px;
        font-weight: 800;
      }

      .dm-tac-stat-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
      }

      .dm-tac-stat-btn {
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 4px;
        padding: 6px 2px;
        text-align: center;
        cursor: pointer;
        transition: background 0.15s;
      }
      
      .dm-tac-stat-btn:hover {
        background: rgba(255,255,255,0.2);
      }

      .dm-tac-move-section {
        background: rgba(0,0,0,0.3);
        border-radius: 4px;
        padding: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .dm-move-dots {
        display: flex;
        gap: 3px;
      }
      
      .dm-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.3);
        cursor: pointer;
      }
      
      .dm-dot.active {
        background: #f59e0b;
        border-color: #f59e0b;
        box-shadow: 0 0 5px #f59e0b;
      }

      /* Tactical Actions Stack */
      #dm-tac-actions-stack {
        position: absolute;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 50;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease, transform 0.2s ease;
        transform: translateX(-10px);
      }
      
      #dm-tac-actions-stack.visible {
        opacity: 1;
        pointer-events: auto;
        transform: translateX(0);
      }

      .dm-tac-action-btn {
        width: 140px;
        height: 50px;
        background: var(--primary-color);
        color: white;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 14px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        cursor: pointer;
        border: none;
        transition: transform 0.1s;
      }
      
      .dm-tac-action-btn:active {
        transform: scale(0.95);
      }

      /* DM Mode Roll Overlay */
      #dm-roll-overlay {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 15px;
        border-radius: 12px;
        box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        display: none;
        z-index: 1000;
        text-align: center;
        border: 1px solid #eee;
      }
      
      #dm-roll-overlay.show {
        display: block;
      }
      
      .dm-roll-label {
        font-size: 10px;
        font-weight: 800;
        color: #64748b;
        text-transform: uppercase;
      }
      
      .dm-roll-val {
        font-size: 28px;
        font-weight: 900;
        color: var(--monster-red);
      }
      
      .dm-roll-math {
        font-size: 12px;
        color: #94a3b8;
        margin-top: 4px;
      }
    `;
    this.sanitizeLegacyFloatingWindowZIndexLocks(styles);
    document.head.appendChild(styles);
  }

  /**
   * Create DM Canvas Container and Content
   */
  createDMCanvas() {
    // Remove existing if present
    const existing = document.getElementById(this.dmCanvasId);
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = this.dmCanvasId;
    container.className = '';

    // Append to world/main element first, then add content
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.appendChild(container);
    }

    // Set inner HTML after appending
    container.innerHTML = this.getDMCanvasHTML();

    // Move canvas sticky notes DM container inside DM canvas for transform inheritance
    const dmStickyNotesContainer = document.getElementById('canvas-sticky-notes-dm');
    if (dmStickyNotesContainer && container) {
      container.appendChild(dmStickyNotesContainer);
    }

    // Initialize DM mode interactions
    setTimeout(() => this.initDMInteractions(), 100);
  }

  /**
   * Get DM Canvas HTML Content
   */
  getDMCanvasHTML() {
    const enemy = this.enemies[0]; // First enemy for demo
    
    return `
      <!-- //enemy card -->
      <!-- Enemy Info Sheet (hidden by default) -->
      <div class="dm-monster-card" id="dm-main-sheet">
        <div class="dm-card-header">
          <div class="dm-portrait">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
          </div>
          <div class="dm-identity">
            <span class="dm-name">${enemy.name}</span>
            <span class="dm-sub">${enemy.type}, ${enemy.alignment}</span>
          </div>
        </div>
        
        <div class="dm-vitals-row">
          <div class="dm-vital-box">
            <span class="dm-vital-label">AC</span>
            <span class="dm-vital-val">${enemy.ac}</span>
          </div>
          <div class="dm-vital-box" style="color:var(--monster-red)">
            <span class="dm-vital-label">HP</span>
            <span class="dm-vital-val">${enemy.hp.current} (${enemy.hp.formula})</span>
          </div>
          <div class="dm-vital-box">
            <span class="dm-vital-label">SPD</span>
            <span class="dm-vital-val">${enemy.speed}ft</span>
          </div>
        </div>

        <div class="dm-ability-grid">
          <div class="dm-ability-box">
            <span class="dm-ab-label">STR</span>
            <span class="dm-ab-val">${enemy.abilities.str.score} (${this.formatMod(enemy.abilities.str.mod)})</span>
          </div>
          <div class="dm-ability-box">
            <span class="dm-ab-label">DEX</span>
            <span class="dm-ab-val">${enemy.abilities.dex.score} (${this.formatMod(enemy.abilities.dex.mod)})</span>
          </div>
          <div class="dm-ability-box">
            <span class="dm-ab-label">CON</span>
            <span class="dm-ab-val">${enemy.abilities.con.score} (${this.formatMod(enemy.abilities.con.mod)})</span>
          </div>
          <div class="dm-ability-box">
            <span class="dm-ab-label">INT</span>
            <span class="dm-ab-val">${enemy.abilities.int.score} (${this.formatMod(enemy.abilities.int.mod)})</span>
          </div>
          <div class="dm-ability-box">
            <span class="dm-ab-label">WIS</span>
            <span class="dm-ab-val">${enemy.abilities.wis.score} (${this.formatMod(enemy.abilities.wis.mod)})</span>
          </div>
          <div class="dm-ability-box">
            <span class="dm-ab-label">CHA</span>
            <span class="dm-ab-val">${enemy.abilities.cha.score} (${this.formatMod(enemy.abilities.cha.mod)})</span>
          </div>
        </div>

        <div class="dm-action-section">
          <div class="dm-section-title">ACTIONS</div>
          ${enemy.actions.map(action => `
            <div class="dm-action-item" onclick="window.dmModeManager.handleRoll('${action.name}', '${action.damage}', ${parseInt(action.hit)})">
              <span class="dm-act-name">${action.name}</span>
              <span class="dm-act-stats">${action.hit} / ${action.damage}</span>
            </div>
          `).join('')}
        </div>

        <div class="dm-action-section">
          <div class="dm-section-title">TRAITS</div>
          <div style="font-size: 11px; padding: 0 4px; line-height: 1.4;">
            ${enemy.traits.map(trait => `
              <div><strong>${trait.name}.</strong> ${trait.desc}</div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- //enemy card -->
      <!-- Enemy Tactical Card -->
      <div class="dm-tactical-card" id="dm-tactical-card" style="left: 2420px; top: 1000px;">
        <div class="dm-tactical-header">
          <span style="font-size: 10px; font-weight: 900; letter-spacing: 1px;">${enemy.name.toUpperCase()} #01</span>
          <span style="font-size: 9px; opacity: 0.7;">CR ${enemy.cr}</span>
        </div>

        <div class="dm-tactical-vitals">
          <div class="dm-tac-box"><span class="dm-tac-label">AC</span><span class="dm-tac-val">${enemy.ac}</span></div>
          <div class="dm-tac-box" style="color:#fecaca"><span class="dm-tac-label">HP</span><span class="dm-tac-val">${enemy.hp.current}/${enemy.hp.max}</span></div>
          <div class="dm-tac-box"><span class="dm-tac-label">INIT</span><span class="dm-tac-val">${this.formatMod(enemy.abilities.dex.mod)}</span></div>
          <div class="dm-tac-box"><span class="dm-tac-label">PRC</span><span class="dm-tac-val">${10 + enemy.abilities.wis.mod}</span></div>
        </div>

        <div class="dm-tac-stat-grid">
          <div class="dm-tac-stat-btn" onclick="window.dmModeManager.handleRoll('STR', '1d20', ${enemy.abilities.str.mod})">
            <span class="dm-tac-label">STR</span>
            <span class="dm-tac-val">${this.formatMod(enemy.abilities.str.mod)}</span>
          </div>
          <div class="dm-tac-stat-btn" onclick="window.dmModeManager.handleRoll('DEX', '1d20', ${enemy.abilities.dex.mod})">
            <span class="dm-tac-label">DEX</span>
            <span class="dm-tac-val">${this.formatMod(enemy.abilities.dex.mod)}</span>
          </div>
          <div class="dm-tac-stat-btn" onclick="window.dmModeManager.handleRoll('CON', '1d20', ${enemy.abilities.con.mod})">
            <span class="dm-tac-label">CON</span>
            <span class="dm-tac-val">${this.formatMod(enemy.abilities.con.mod)}</span>
          </div>
          <div class="dm-tac-stat-btn" onclick="window.dmModeManager.handleRoll('INT', '1d20', ${enemy.abilities.int.mod})">
            <span class="dm-tac-label">INT</span>
            <span class="dm-tac-val">${this.formatMod(enemy.abilities.int.mod)}</span>
          </div>
          <div class="dm-tac-stat-btn" onclick="window.dmModeManager.handleRoll('WIS', '1d20', ${enemy.abilities.wis.mod})">
            <span class="dm-tac-label">WIS</span>
            <span class="dm-tac-val">${this.formatMod(enemy.abilities.wis.mod)}</span>
          </div>
          <div class="dm-tac-stat-btn" onclick="window.dmModeManager.handleRoll('CHA', '1d20', ${enemy.abilities.cha.mod})">
            <span class="dm-tac-label">CHA</span>
            <span class="dm-tac-val">${this.formatMod(enemy.abilities.cha.mod)}</span>
          </div>
        </div>

        <div class="dm-tac-move-section">
          <span class="dm-tac-label">Move ${enemy.speed}ft</span>
          <div class="dm-move-dots" id="dm-move-dots"></div>
        </div>

        <!-- Tactical Actions Stack - Child of tactical card -->
        <div id="dm-tac-actions-stack">
          <div class="dm-tac-action-btn" onclick="window.dmModeManager.handleTacticalAction('move')">Move</div>
          <div class="dm-tac-action-btn" onclick="window.dmModeManager.handleTacticalAction('action')">Action</div>
          <div class="dm-tac-action-btn" onclick="window.dmModeManager.handleTacticalAction('other')">Other</div>
        </div>
      </div>

      <!-- Roll Overlay -->
      <div id="dm-roll-overlay">
        <div class="dm-roll-label">Total Roll</div>
        <div class="dm-roll-val" id="dm-roll-res">24</div>
        <div class="dm-roll-math" id="dm-roll-math">1d20 + 4</div>
      </div>
    `;
  }

  /**
   * Format modifier with + sign
   */
  formatMod(mod) {
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  /**
   * Initialize DM Mode Interactions
   */
  initDMInteractions() {
    this.initEnemyCardRuntime();
    this.setupCanvasDrag();
  }

  /**
   * Initialize Enemy Card Runtime
   */
  initEnemyCardRuntime() {
    const tacticalCard = document.getElementById('dm-tactical-card');
    const actionsStack = tacticalCard ? tacticalCard.querySelector('#dm-tac-actions-stack') : null;
    const monsterCard = document.getElementById('dm-main-sheet');
    const header = tacticalCard ? tacticalCard.querySelector('.dm-tactical-header') : null;
    const moveDotsContainer = document.getElementById('dm-move-dots');
    if (!tacticalCard || !actionsStack || !header) return;

    const enemyCardCore = window.EnemyCard || {};
    if (typeof enemyCardCore.bindEnemyCardRuntime === 'function') {
      enemyCardCore.bindEnemyCardRuntime({
        tacticalCard,
        actionsStack,
        monsterCard,
        header,
        moveDotsContainer
      });
      return;
    }

    console.warn('[DM Mode] EnemyCard.bindEnemyCardRuntime is unavailable.');
  }

  /**
   * Setup Canvas Drag for DM Mode
   */
  setupCanvasDrag() {
    const dmCanvas = document.getElementById(this.dmCanvasId);
    const dmMask = document.getElementById('dm-canvas-mask');
    if (!dmCanvas || !dmMask) return;

    // Restore zoom index from saved state
    const savedZoomIndex = this.viewStates.dm.zoomIndex;
    if (typeof savedZoomIndex === 'number' && savedZoomIndex >= 0 && savedZoomIndex < this.DM_ZOOM_LEVELS.length) {
      this.dmCurrentZoomIndex = savedZoomIndex;
    } else {
      this.dmCurrentZoomIndex = 1; // Default to middle zoom level
    }

    let dmZoom = this.viewStates.dm.zoom;
    let dmPanX = this.viewStates.dm.panX;
    let dmPanY = this.viewStates.dm.panY;
    let isPanning = false;
    let isDraggingElement = null;
    let dragStartX, dragStartY;
    let elementStartLeft, elementStartTop;
    let startX, startY;

    const updateTransform = () => {
      // Transform only the canvas content (not the mask)
      // Apply transform to DM canvas (using translate3d for GPU acceleration)
      dmCanvas.style.transform = `translate3d(${dmPanX}px, ${dmPanY}px, 0) scale(${dmZoom})`;
      // Apply background grid to mask (viewport) - matches player canvas behavior
      dmMask.style.backgroundPosition = `${dmPanX}px ${dmPanY}px`;
      dmMask.style.backgroundSize = `${40 * dmZoom}px ${40 * dmZoom}px`;
    };

    const saveState = () => {
      this.viewStates.dm = { 
        zoom: dmZoom, 
        panX: dmPanX, 
        panY: dmPanY,
        zoomIndex: this.dmCurrentZoomIndex
      };
      this.persistViewStates();
    };

    // Use dmCanvas for event handling (not the mask which has pointer-events: none)
    const mainEl = dmCanvas;
    if (!mainEl) return;

    // Check if dragging a floating window (log, sticky notes, etc.)
    const isDraggingWindow = () => {
      return window.isDraggingLog || 
             window.isDraggingCalculator || 
             window.activeDraggingStickyNoteEl ||
             window.isResizingLog ||
             window.isDraggingPanel ||
             window.isDraggingAdditionalPanel ||
             document.body.classList.contains('is-dragging-window');
    };

    // Check if clicking on interactive element (button, stat, etc.)
    const isInteractiveElement = (target) => {
      return target.closest('.dm-action-item') ||
             target.closest('.dm-tac-stat-btn') ||
             target.closest('.dm-dot') ||
             target.closest('.dm-tac-action-btn') ||
             target.closest('.dm-vital-box') ||
             target.closest('.dm-ability-box') ||
             target.closest('.canvas-sticky-note');
    };

    // Get element header if clicking on draggable header
    const getDraggableHeader = (target) => {
      const cardHeader = target.closest('.dm-monster-card .dm-card-header');
      const tacticalHeader = target.closest('.dm-tactical-card .dm-tactical-header');
      return cardHeader || tacticalHeader;
    };

    // Get parent element from header
    const getElementFromHeader = (header) => {
      if (!header) return null;
      return header.closest('.dm-monster-card') || header.closest('.dm-tactical-card');
    };

    // Handle mousedown on main element
    mainEl.addEventListener('mousedown', (e) => {
      if (!this.isActive) return;
      // Don't handle if dragging a window
      if (isDraggingWindow()) return;
      
      // Check what was clicked
      const interactiveEl = isInteractiveElement(e.target);
      const header = getDraggableHeader(e.target);
      
      if (interactiveEl) {
        // Clicked on interactive element (button, stat, etc.) - don't drag or pan
        // Let the button's own click handler deal with it
        return;
      }
      
      if (header) {
        // Clicked on card/tactical header - drag the element
        const element = getElementFromHeader(header);
        if (element) {
          isDraggingElement = element;
          dragStartX = e.clientX;
          dragStartY = e.clientY;
          elementStartLeft = element.offsetLeft;
          elementStartTop = element.offsetTop;
          element.classList.add('dm-element-dragging');
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      
      // Check if clicked on any DM card (but not header or interactive)
      if (e.target.closest('.dm-monster-card') || 
          e.target.closest('.dm-tactical-card') ||
          e.target.closest('.canvas-sticky-note')) {
        // Clicked on card body - don't pan, don't drag
        return;
      }
      
      // Clicked on empty canvas - pan
      isPanning = true;
      startX = e.clientX - dmPanX;
      startY = e.clientY - dmPanY;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isActive) return;
      
      // Stop if window drag starts
      if (isDraggingWindow()) {
        isPanning = false;
        if (isDraggingElement) {
          isDraggingElement.classList.remove('dm-element-dragging');
          isDraggingElement = null;
        }
        return;
      }
      
      if (isDraggingElement) {
        // Drag element in canvas coordinates
        const dx = (e.clientX - dragStartX) / dmZoom;
        const dy = (e.clientY - dragStartY) / dmZoom;
        isDraggingElement.style.left = (elementStartLeft + dx) + 'px';
        isDraggingElement.style.top = (elementStartTop + dy) + 'px';
      } else if (isPanning) {
        // Pan canvas
        dmPanX = e.clientX - startX;
        dmPanY = e.clientY - startY;
        updateTransform();
      }
    });

    window.addEventListener('mouseup', () => {
      if (isDraggingElement) {
        isDraggingElement.classList.remove('dm-element-dragging');
        isDraggingElement = null;
      }
      if (isPanning) {
        saveState();
      }
      isPanning = false;
    });

    mainEl.addEventListener('wheel', (e) => {
      if (!this.isActive) return;
      // Don't zoom if hovering over DM elements
      if (e.target.closest('.dm-monster-card') ||
          e.target.closest('.dm-tactical-card') ||
          e.target.closest('.dm-tac-action-btn')) return;
      e.preventDefault();
      
      const rect = mainEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate world coordinates before zoom (zoom toward mouse position)
      const worldX = (mouseX - dmPanX) / dmZoom;
      const worldY = (mouseY - dmPanY) / dmZoom;
      
      // Change zoom level (3 discrete levels like player canvas)
      if (e.deltaY < 0) {
        // Zoom in
        if (this.dmCurrentZoomIndex < this.DM_ZOOM_LEVELS.length - 1) {
          this.dmCurrentZoomIndex++;
        }
      } else {
        // Zoom out
        if (this.dmCurrentZoomIndex > 0) {
          this.dmCurrentZoomIndex--;
        }
      }
      dmZoom = this.DM_ZOOM_LEVELS[this.dmCurrentZoomIndex];
      
      // Adjust pan to keep world point under mouse
      dmPanX = mouseX - worldX * dmZoom;
      dmPanY = mouseY - worldY * dmZoom;
      
      saveState();
      updateTransform();
    }, { passive: false });

    // Touch support for DM canvas (pinch zoom + drag pan)
    let dmActiveTouchId = null;
    let dmActivePinchState = null;
    let dmLastTouchX = 0;
    let dmLastTouchY = 0;
    let dmTouchStartX = 0;
    let dmTouchStartY = 0;
    const DM_TAP_MOVE_THRESHOLD_PX = 12;
    let dmIsPanning = false;

    // Helper: Get touch distance for pinch zoom
    const getTouchDistance = (touchA, touchB) => {
      const dx = touchA.clientX - touchB.clientX;
      const dy = touchA.clientY - touchB.clientY;
      return Math.hypot(dx, dy);
    };

    // Helper: Get touch by identifier
    const getTouchByIdentifier = (touches, identifier) => {
      for (let i = 0; i < touches.length; i++) {
        if (touches[i].identifier === identifier) return touches[i];
      }
      return null;
    };

    // Helper: Check if touch target is blocked (interactive DM element)
    const isDmTouchBlockedTarget = (target) => {
      if (!target) return true;
      return target.closest('.dm-monster-card') ||
             target.closest('.dm-tactical-card') ||
             target.closest('.dm-tac-action-btn') ||
             target.closest('.dm-vital-box') ||
             target.closest('.dm-ability-box') ||
             target.closest('.dm-action-item') ||
             target.closest('.canvas-sticky-note');
    };

    mainEl.addEventListener('touchstart', (event) => {
      if (!this.isActive) return;

      // Don't handle if panel is being dragged or window drag
      if (isDraggingWindow()) return;

      // Two-finger pinch zoom
      if (event.touches.length >= 2) {
        const firstTouch = event.touches[0];
        const secondTouch = event.touches[1];
        const initialDistance = getTouchDistance(firstTouch, secondTouch);

        if (!initialDistance || isDmTouchBlockedTarget(event.target)) return;

        const rect = mainEl.getBoundingClientRect();
        const midpointClientX = (firstTouch.clientX + secondTouch.clientX) / 2;
        const midpointClientY = (firstTouch.clientY + secondTouch.clientY) / 2;
        const midpointMaskX = midpointClientX - rect.left;
        const midpointMaskY = midpointClientY - rect.top;

        isPanning = false;
        isDraggingElement = null;
        dmActiveTouchId = null;
        dmActivePinchState = {
          startDistance: initialDistance,
          startScale: dmZoom,
          worldX: (midpointMaskX - dmPanX) / dmZoom,
          worldY: (midpointMaskY - dmPanY) / dmZoom
        };

        event.preventDefault();
        return;
      }

      // Single touch pan
      if (event.touches.length !== 1) return;

      const touch = event.touches[0];
      if (isDmTouchBlockedTarget(event.target)) return;

      dmActiveTouchId = touch.identifier;
      dmTouchStartX = touch.clientX;
      dmTouchStartY = touch.clientY;
      dmIsPanning = true;
      dmLastTouchX = touch.clientX;
      dmLastTouchY = touch.clientY;
      event.preventDefault();
    }, { passive: false });

    mainEl.addEventListener('touchmove', (event) => {
      if (!this.isActive) return;

      // Pinch zoom with two fingers
      if (dmActivePinchState && event.touches.length >= 2) {
        const firstTouch = event.touches[0];
        const secondTouch = event.touches[1];
        const currentDistance = getTouchDistance(firstTouch, secondTouch);

        if (!currentDistance || !dmActivePinchState.startDistance) return;

        // Calculate new scale (continuous zoom like player canvas)
        let nextScale = dmActivePinchState.startScale * (currentDistance / dmActivePinchState.startDistance);
        nextScale = Math.min(this.DM_MAX_ZOOM, Math.max(this.DM_MIN_ZOOM, nextScale));

        // Find nearest discrete zoom level
        let nearestIndex = 0;
        let nearestDistance = Infinity;
        this.DM_ZOOM_LEVELS.forEach((zoomLevel, index) => {
          const zoomDistance = Math.abs(nextScale - zoomLevel);
          if (zoomDistance < nearestDistance) {
            nearestDistance = zoomDistance;
            nearestIndex = index;
          }
        });

        const rect = mainEl.getBoundingClientRect();
        const midpointClientX = (firstTouch.clientX + secondTouch.clientX) / 2;
        const midpointClientY = (firstTouch.clientY + secondTouch.clientY) / 2;
        const midpointMaskX = midpointClientX - rect.left;
        const midpointMaskY = midpointClientY - rect.top;

        dmZoom = this.DM_ZOOM_LEVELS[nearestIndex];
        this.dmCurrentZoomIndex = nearestIndex;

        // Adjust pan to keep world point under fingers
        dmPanX = midpointMaskX - (dmActivePinchState.worldX * dmZoom);
        dmPanY = midpointMaskY - (dmActivePinchState.worldY * dmZoom);

        updateTransform();
        event.preventDefault();
        return;
      }

      // Single touch pan
      if (!dmIsPanning) return;

      const trackedTouch = getTouchByIdentifier(event.touches, dmActiveTouchId) || event.touches[0];
      if (!trackedTouch) return;

      const travelDistance = Math.hypot(trackedTouch.clientX - dmTouchStartX, trackedTouch.clientY - dmTouchStartY);
      if (travelDistance > DM_TAP_MOVE_THRESHOLD_PX) {
        // Pan canvas
        dmPanX += (trackedTouch.clientX - dmLastTouchX);
        dmPanY += (trackedTouch.clientY - dmLastTouchY);
        dmLastTouchX = trackedTouch.clientX;
        dmLastTouchY = trackedTouch.clientY;
        updateTransform();
      }

      event.preventDefault();
    }, { passive: false });

    mainEl.addEventListener('touchend', (event) => {
      if (!this.isActive) return;

      // Handle pinch ending with one finger remaining
      if (dmActivePinchState && event.touches.length === 1) {
        const survivingTouch = event.touches[0];
        dmActiveTouchId = survivingTouch.identifier;
        dmActivePinchState = null;
        dmLastTouchX = survivingTouch.clientX;
        dmLastTouchY = survivingTouch.clientY;
        dmIsPanning = true;
        return;
      }

      // All fingers lifted
      if (event.touches.length === 0) {
        if (dmActivePinchState) {
          saveState();
        }
        dmActiveTouchId = null;
        dmActivePinchState = null;
        dmIsPanning = false;
      }
    }, { passive: true });

    mainEl.addEventListener('touchcancel', () => {
      if (!this.isActive) return;
      dmActiveTouchId = null;
      dmActivePinchState = null;
      dmIsPanning = false;
    }, { passive: true });

    // Initial transform
    updateTransform();

    // Expose reset function
    window.resetDMView = () => {
      dmZoom = 1;
      dmPanX = window.innerWidth / 2 - 2500;
      dmPanY = window.innerHeight / 2 - 1100;
      this.dmCurrentZoomIndex = 1; // Reset to default zoom level
      this.viewStates.dm = { zoom: dmZoom, panX: dmPanX, panY: dmPanY, zoomIndex: 1 };
      updateTransform();

      // Toggle off the EDIT LAYOUT button after reset
      const toggleEditBtn = document.getElementById('toggle-edit');
      if (toggleEditBtn) {
        toggleEditBtn.classList.remove('active');
        // Update button label/icon if function exists
        if (typeof window.updateEditToggleButtonLabel === 'function') {
          window.updateEditToggleButtonLabel(toggleEditBtn, false);
        }
        // Sync global editMode if function exists
        if (typeof window.setEditModeGlobal === 'function') {
          window.setEditModeGlobal(false);
        }
      }
    };
  }

  /**
   * Handle Roll Display - outputs to action log
   */
  handleRoll(name, dice, bonus) {
    const overlay = document.getElementById('dm-roll-overlay');
    const res = document.getElementById('dm-roll-res');
    const math = document.getElementById('dm-roll-math');
    
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + bonus;
    
    res.innerText = total;
    math.innerText = `${name} Check: 1d20 (${d20}) ${bonus >= 0 ? '+' : ''}${bonus}`;
    
    overlay.classList.add('show');
    setTimeout(() => {
      overlay.classList.remove('show');
    }, 3000);
    
    // Also log to action log if available (like player mode)
    if (typeof window.addLogEntry === 'function') {
      const rollType = 'Check';
      const detailText = `${d20} + ${bonus >= 0 ? bonus : bonus} = <strong>${total}</strong>`;
      window.addLogEntry(`<b>${name} ${rollType}:</b> ${d20} ${bonus >= 0 ? '+' : '-'} ${Math.abs(bonus)} = <b>${total}</b>`, 'normal', {
        detailHtml: detailText,
        entryClasses: ['dm-roll-check']
      });
    }
  }

  /**
   * Handle Tactical Action Button
   */
  handleTacticalAction(actionType) {
    console.log('[DM Mode] Tactical Action:', actionType);
    // Hide action stack after selection
    const actionsStack = document.getElementById('dm-tac-actions-stack');
    if (actionsStack) {
      actionsStack.classList.remove('visible');
    }
    // Future: Add action-specific logic here
  }

  /**
   * Save Player View State
   */
  savePlayerViewState() {
    const world = document.getElementById(this.playerCanvasId);
    if (!world) return;
    
    // Extract current transform values
    const style = window.getComputedStyle(world);
    const matrix = new WebKitCSSMatrix(style.transform);
    
    this.viewStates.player = {
      zoom: matrix.m11,
      panX: matrix.m41,
      panY: matrix.m42
    };
    this.persistViewStates();
    
    console.log('[DM Mode] Saved player view:', this.viewStates.player);
  }

  /**
   * Apply Player View State
   */
  applyPlayerViewState() {
    const world = document.getElementById(this.playerCanvasId);
    if (!world) return;
    
    const state = this.viewStates.player;
    // Apply player view state (using translate3d for GPU acceleration)
    world.style.transform = `translate3d(${state.panX}px, ${state.panY}px, 0) scale(${state.zoom})`;
    
    // Update global variables that index.html uses
    if (typeof window.panX !== 'undefined') window.panX = state.panX;
    if (typeof window.panY !== 'undefined') window.panY = state.panY;
    if (typeof window.scale !== 'undefined') window.scale = state.zoom;
    
    // Trigger drawLines if available
    if (typeof window.drawLines === 'function') {
      window.drawLines();
    }
    
    console.log('[DM Mode] Restored player view:', state);
  }

  /**
   * Save DM View State
   */
  saveDMViewState() {
    const dmCanvas = document.getElementById(this.dmCanvasId);
    if (!dmCanvas) return;
    
    // Extract current transform values
    const style = window.getComputedStyle(dmCanvas);
    const matrix = new WebKitCSSMatrix(style.transform);
    
    this.viewStates.dm = {
      zoom: matrix.m11,
      panX: matrix.m41,
      panY: matrix.m42,
      zoomIndex: this.dmCurrentZoomIndex
    };
    this.persistViewStates();
    
    console.log('[DM Mode] Saved DM view:', this.viewStates.dm);
  }

  /**
   * Apply DM View State
   */
  applyDMViewState() {
    const dmCanvas = document.getElementById(this.dmCanvasId);
    const dmMask = document.getElementById('dm-canvas-mask');
    if (!dmCanvas) return;
    
    const state = this.viewStates.dm;
    // Apply DM view state (using translate3d for GPU acceleration)
    dmCanvas.style.transform = `translate3d(${state.panX}px, ${state.panY}px, 0) scale(${state.zoom})`;
    
    // Apply background grid to mask (viewport) - matches player canvas behavior
    if (dmMask) {
      dmMask.style.backgroundPosition = `${state.panX}px ${state.panY}px`;
      dmMask.style.backgroundSize = `${40 * state.zoom}px ${40 * state.zoom}px`;
    }
    
    console.log('[DM Mode] Restored DM view:', state);
  }

  /**
   * Save Player Button States
   */
  savePlayerButtonStates() {
    const trackActionsBtn = document.getElementById('toggle-track-actions');
    const toggleEditBtn = document.getElementById('toggle-edit');
    
    if (trackActionsBtn) {
      this.buttonStates.player.trackActions = trackActionsBtn.classList.contains('active');
    }
    if (toggleEditBtn) {
      this.buttonStates.player.editLayout = toggleEditBtn.classList.contains('active');
    }
    
    console.log('[DM Mode] Saved player button states:', this.buttonStates.player);
  }

  /**
   * Save DM Button States
   */
  saveDMButtonStates() {
    const trackActionsBtn = document.getElementById('toggle-track-actions');
    const toggleEditBtn = document.getElementById('toggle-edit');
    
    if (trackActionsBtn) {
      this.buttonStates.dm.trackActions = trackActionsBtn.classList.contains('active');
    }
    if (toggleEditBtn) {
      this.buttonStates.dm.editLayout = toggleEditBtn.classList.contains('active');
    }
    
    console.log('[DM Mode] Saved DM button states:', this.buttonStates.dm);
  }

  /**
   * Restore Player Button States
   */
  restorePlayerButtonStates() {
    const trackActionsBtn = document.getElementById('toggle-track-actions');
    const toggleEditBtn = document.getElementById('toggle-edit');

    if (trackActionsBtn) {
      trackActionsBtn.classList.toggle('active', this.buttonStates.player.trackActions);
    }
    if (toggleEditBtn) {
      const editLayoutState = this.buttonStates.player.editLayout;
      toggleEditBtn.classList.toggle('active', editLayoutState);
      // Update button label icon based on state
      if (typeof window.updateEditToggleButtonLabel === 'function') {
        window.updateEditToggleButtonLabel(toggleEditBtn, editLayoutState);
      }
      // Sync global editMode
      if (typeof window.setEditModeGlobal === 'function') {
        window.setEditModeGlobal(editLayoutState);
      }
    }

    console.log('[DM Mode] Restored player button states:', this.buttonStates.player);
  }

  /**
   * Restore DM Button States
   */
  restoreDMButtonStates() {
    const trackActionsBtn = document.getElementById('toggle-track-actions');
    const toggleEditBtn = document.getElementById('toggle-edit');

    if (trackActionsBtn) {
      trackActionsBtn.classList.toggle('active', this.buttonStates.dm.trackActions);
    }
    if (toggleEditBtn) {
      const editLayoutState = this.buttonStates.dm.editLayout;
      toggleEditBtn.classList.toggle('active', editLayoutState);
      // Update button label icon based on state
      if (typeof window.updateEditToggleButtonLabel === 'function') {
        window.updateEditToggleButtonLabel(toggleEditBtn, editLayoutState);
      }
      // Sync global editMode
      if (typeof window.setEditModeGlobal === 'function') {
        window.setEditModeGlobal(editLayoutState);
      }
    }

    console.log('[DM Mode] Restored DM button states:', this.buttonStates.dm);
  }

  /**
   * Activate DM Mode
   */
  activate() {
    console.log('[DEBUG] [DM MODE] activate() called');
    console.log('[DEBUG] [DM MODE] Saving player state before switch...');
    
    // Save player view state and button states before switching
    this.savePlayerViewState();
    this.savePlayerButtonStates();
    
    // Save player sticky notes before switching
    if (typeof window.persistStickyNotesForContextKey === 'function') {
      window.persistStickyNotesForContextKey();
      console.log('[DEBUG] [DM MODE] Saved player canvas sticky notes');
      this.dmDebug('Persist player->before DM switch requested');
    }

    this.isActive = true;
    this.persistActiveMode();

    // Restore DM zoom index
    const savedZoomIndex = this.viewStates.dm.zoomIndex;
    if (typeof savedZoomIndex === 'number' && savedZoomIndex >= 0 && savedZoomIndex < this.DM_ZOOM_LEVELS.length) {
      this.dmCurrentZoomIndex = savedZoomIndex;
    } else {
      this.dmCurrentZoomIndex = 1;
    }

    const dmCanvas = document.getElementById(this.dmCanvasId);
    const dmMask = document.getElementById('dm-canvas-mask');
    const playerCanvas = document.getElementById(this.playerCanvasId);

    if (dmMask) {
      dmMask.classList.remove('hidden');
    }
    if (dmCanvas) {
      dmCanvas.classList.add('active');
      // Restore DM view state and apply grid to mask
      this.applyDMViewState();
    }
    if (playerCanvas) {
      playerCanvas.style.display = 'none';
    }

    // Activate DM canvas sticky notes container
    const dmStickyNotesContainer = document.getElementById('canvas-sticky-notes-dm');
    if (dmStickyNotesContainer) {
      dmStickyNotesContainer.classList.add('active');
      this.dmDebug('DM sticky container activated', {
        classActive: dmStickyNotesContainer.classList.contains('active'),
        childCount: dmStickyNotesContainer.children.length,
        display: window.getComputedStyle(dmStickyNotesContainer).display
      });
    }

    // Load DM sticky notes FIRST (before visibility update)
    if (typeof window.syncStickyNotesForActiveBuffer === 'function') {
      window.syncStickyNotesForActiveBuffer();
      console.log('[DEBUG] [DM MODE] Loaded DM canvas sticky notes');
      this.dmDebug('Sync sticky for DM requested', { isActive: this.isActive });
    }

    // Show/hide canvas sticky notes based on canvas type (AFTER loading)
    this.updateCanvasStickyNotesVisibility('dm');
    this.dmDebug('Post-activate visibility snapshot', {
      targetCanvas: 'dm',
      canvasNotes: Array.from(document.querySelectorAll('.canvas-sticky-note[data-sticky-note-canvas]')).map((noteEl) => ({
        id: noteEl.dataset.stickyNoteId,
        mode: noteEl.dataset.stickyNoteMode,
        canvas: noteEl.dataset.stickyNoteCanvas,
        display: noteEl.style.display || '(auto)'
      })),
      overlayNotes: Array.from(document.querySelectorAll('.sticky-note-window[data-sticky-note-id]:not(.canvas-sticky-note)')).map((noteEl) => ({
        id: noteEl.dataset.stickyNoteId,
        mode: noteEl.dataset.stickyNoteMode,
        canvas: noteEl.dataset.stickyNoteCanvas,
        hidden: noteEl.classList.contains('hidden'),
        display: window.getComputedStyle(noteEl).display
      }))
    });

    console.log('[DEBUG] [DM MODE] Final state:');
    console.log('[DEBUG] [DM MODE]   isActive:', this.isActive);
    console.log('[DEBUG] [DM MODE]   dmCanvas active:', dmCanvas?.classList.contains('active'));
    console.log('[DEBUG] [DM MODE]   playerCanvas display:', playerCanvas?.style.display);
    
    // Restore DM button states
    this.restoreDMButtonStates();

    // Update footer button states
    this.updateFooterButtons();

    if (typeof window.forceCheckConnectorLines === 'function') {
      window.forceCheckConnectorLines('dm-activate');
    }

    console.log('[DEBUG] [DM MODE] Activated');
  }

  /**
   * Deactivate DM Mode (Return to Player Mode)
   */
  deactivate() {
    console.log('[DEBUG] [PLAYER MODE] deactivate() called');
    console.log('[DEBUG] [PLAYER MODE] Saving DM state before switch...');
    
    // Save DM view state and button states before switching
    this.saveDMViewState();
    this.saveDMButtonStates();
    
    // Save DM sticky notes before switching
    if (typeof window.persistStickyNotesForContextKey === 'function') {
      window.persistStickyNotesForContextKey();
      console.log('[DEBUG] [PLAYER MODE] Saved DM canvas sticky notes');
      this.dmDebug('Persist DM->before player switch requested');
    }

    this.isActive = false;
    this.persistActiveMode();

    const dmCanvas = document.getElementById(this.dmCanvasId);
    const dmMask = document.getElementById('dm-canvas-mask');
    const playerCanvas = document.getElementById(this.playerCanvasId);

    if (dmMask) {
      dmMask.classList.add('hidden');
    }
    if (dmCanvas) {
      dmCanvas.classList.remove('active');
    }
    if (playerCanvas) {
      playerCanvas.style.display = '';
      // Restore player view state
      this.applyPlayerViewState();
    }

    // Deactivate DM canvas sticky notes container
    const dmStickyNotesContainer = document.getElementById('canvas-sticky-notes-dm');
    if (dmStickyNotesContainer) {
      dmStickyNotesContainer.classList.remove('active');
      this.dmDebug('DM sticky container deactivated', {
        classActive: dmStickyNotesContainer.classList.contains('active'),
        childCount: dmStickyNotesContainer.children.length,
        display: window.getComputedStyle(dmStickyNotesContainer).display
      });
    }

    // Load player sticky notes FIRST (before visibility update)
    if (typeof window.syncStickyNotesForActiveBuffer === 'function') {
      window.syncStickyNotesForActiveBuffer();
      console.log('[DEBUG] [PLAYER MODE] Loaded Player canvas sticky notes');
      this.dmDebug('Sync sticky for player requested', { isActive: this.isActive });
    }

    // Show/hide canvas sticky notes based on canvas type (AFTER loading)
    this.updateCanvasStickyNotesVisibility('player');
    this.dmDebug('Post-deactivate visibility snapshot', {
      targetCanvas: 'player',
      canvasNotes: Array.from(document.querySelectorAll('.canvas-sticky-note[data-sticky-note-canvas]')).map((noteEl) => ({
        id: noteEl.dataset.stickyNoteId,
        mode: noteEl.dataset.stickyNoteMode,
        canvas: noteEl.dataset.stickyNoteCanvas,
        display: noteEl.style.display || '(auto)'
      })),
      overlayNotes: Array.from(document.querySelectorAll('.sticky-note-window[data-sticky-note-id]:not(.canvas-sticky-note)')).map((noteEl) => ({
        id: noteEl.dataset.stickyNoteId,
        mode: noteEl.dataset.stickyNoteMode,
        canvas: noteEl.dataset.stickyNoteCanvas,
        hidden: noteEl.classList.contains('hidden'),
        display: window.getComputedStyle(noteEl).display
      }))
    });

    console.log('[DEBUG] [PLAYER MODE] Final state:');
    console.log('[DEBUG] [PLAYER MODE]   isActive:', this.isActive);
    console.log('[DEBUG] [PLAYER MODE]   dmCanvas active:', dmCanvas?.classList.contains('active'));
    console.log('[DEBUG] [PLAYER MODE]   playerCanvas display:', playerCanvas?.style.display);

    // Restore player button states
    this.restorePlayerButtonStates();

    // Update footer button states
    this.updateFooterButtons();

    if (typeof window.forceCheckConnectorLines === 'function') {
      window.forceCheckConnectorLines('dm-deactivate');
    }

    console.log('[DEBUG] [PLAYER MODE] Deactivated');
  }

  /**
   * Update Canvas Sticky Notes Visibility
   * Shows notes for current canvas, hides notes for other canvas
   */
  updateCanvasStickyNotesVisibility(targetCanvas = null) {
    const allCanvasNotes = document.querySelectorAll('.canvas-sticky-note[data-sticky-note-canvas]');
    const currentCanvas = targetCanvas || (this.isActive ? 'dm' : 'player');
    this.dmDebug('updateCanvasStickyNotesVisibility:start', {
      targetCanvas,
      resolvedCanvas: currentCanvas,
      totalCanvasNotes: allCanvasNotes.length
    });
    
    allCanvasNotes.forEach(note => {
      const noteCanvas = note.dataset.stickyNoteCanvas;
      if (noteCanvas === currentCanvas) {
        note.style.display = '';
      } else {
        note.style.display = 'none';
      }
    });

    this.dmDebug('updateCanvasStickyNotesVisibility:end', {
      resolvedCanvas: currentCanvas,
      noteStates: Array.from(allCanvasNotes).map((noteEl) => ({
        id: noteEl.dataset.stickyNoteId,
        canvas: noteEl.dataset.stickyNoteCanvas,
        display: noteEl.style.display || '(auto)'
      }))
    });
  }

  /**
   * Toggle DM Mode
   */
  toggle() {
    console.log('[DEBUG] ========== DM MODE TOGGLE PRESSED ==========');
    console.log('[DEBUG] Timestamp:', new Date().toLocaleTimeString());
    console.log('[DEBUG] Current state:', this.isActive ? 'ACTIVE' : 'INACTIVE');
    console.log('[DEBUG] Switching to:', this.isActive ? 'PLAYER MODE' : 'DM MODE');
    
    if (this.isActive) {
      console.log('[DEBUG] Calling deactivate()...');
      this.deactivate();
    } else {
      console.log('[DEBUG] Calling activate()...');
      this.activate();
    }
    
    console.log('[DEBUG] ========== END DM MODE TOGGLE ==========');
  }

  /**
   * Update Footer Button States
   */
  updateFooterButtons() {
    const dmBtn = document.getElementById('toggle-dm-mode');
    if (dmBtn) {
      if (this.isActive) {
        dmBtn.textContent = '← PLAYER MODE';
        dmBtn.style.background = 'var(--primary-color)';
      } else {
        dmBtn.textContent = '🎲 DM MODE';
        dmBtn.style.background = 'var(--monster-red)';
      }
    }
  }
}

// Create global instance
window.dmModeManager = new DMModeManager();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.dmModeManager.init();
  });
} else {
  window.dmModeManager.init();
}
