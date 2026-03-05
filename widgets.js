/**
 * WIDGETS.JS - Sticky Notes Module
 * //widget - All sticky note functionality for canvas overlay
 *
 * CANONICAL INSTRUCTION SOURCE
 * - This file is the single source of truth for "how to make a widget".
 * - Keep widget creation instructions here. Other modules should reference this file,
 *   not duplicate widget build guidance.
 *
 * INFO WINDOW OVERLAY IMPLEMENTATION GUIDE (for new floating windows):
 * 1) Window structure
 *    - Use position: fixed on the window root element.
 *    - Provide a dedicated header drag handle area (example: .info-window-header).
 *    - Keep action buttons (close/delete/etc.) inside header but excluded from drag start.
 *
 * 2) Drag start behavior (mouse + touch)
 *    - On drag start, call preventDefault() and stopPropagation() so canvas/background handlers do not take over.
 *    - If initial placement uses centering transform (left:50%, top:50%, translate(-50%,-50%)),
 *      normalize to pixel left/top first using getBoundingClientRect() to avoid "jump on first click".
 *    - Store drag origin (pointer clientX/clientY) and element origin (left/top) at drag start.
 *
 * 3) Drag move behavior
 *    - Update with left/top pixel positioning during drag for stable pointer tracking.
 *    - Apply viewport clamping so window remains recoverable even when mostly offscreen.
 *    - Use document-level move/up listeners so drag continues smoothly if pointer leaves header area.
 *
 * 4) Footer-aware bottom bounds (required)
 *    - Compute footer top dynamically each move/clamp via document.querySelector('footer')
 *      and footer.getBoundingClientRect().top.
 *    - Clamp max top against footer top so the header can never be fully lost behind the adaptive footer.
 *    - Do not hard-code footer height; the layout adapts by browser/device/safe-area.
 *
 * 5) Drag end behavior
 *    - Remove move/up listeners and clear drag state flags.
 *    - Remove body class used to indicate active window dragging (ex: is-dragging-window).
 *
 * NEW WIDGET BLUEPRINT (USE WHEN USER SAYS: "lets create a new widget")
 * 1) Header + Handle (required)
 *    - Header text aligned left.
 *    - Header acts as drag handle for mouse + touch.
 *    - Header text supports long-press title edit (contenteditable flow + finalize on blur/enter/escape).
 *
 * 2) Header action buttons (required)
 *    - Two right-aligned controls in header: couple/decouple toggle + close.
 *    - Buttons must be excluded from drag start logic.
 *    - When creating a new widget type, also add its launch button to the widget popup menu window.
 *
 * 3) Collapse/Expand behavior (required)
 *    - Double-click (or double-tap equivalent) on header toggles collapsed/expanded state.
 *
 * 4) Layer coupling model (required)
 *    - Widget supports both canvas-coupled mode and decoupled overlay mode.
 *    - New widgets should spawn on the ACTIVE canvas view by default (player or DM).
 *    - Canvas coupling works for both player and DM canvas using active transform context.
 *    - Decoupling must move the widget to the info-window layer (overlay behavior).
 *    - Decouple/couple transitions preserve center alignment between source and target layer.
 *
 * 5) Context association + persistence (required)
 *    - Widget remembers prior canvas association when applicable.
 *    - Sticky-note-specific: use sticky note buffer + context key persistence.
 *    - Other widget types may use their own storage/state model but should preserve equivalent context continuity.
 *
 * 6) Additional required standards (commonly missed)
 *    - Use shared drag utility with mode-specific coordinate math:
 *      overlay drag in viewport px; canvas drag in world px (delta/zoom).
 *    - Keep scale math explicit when moving between canvas/world and viewport/overlay coordinates.
 *    - Clamp overlay widgets to viewport with footer-aware bottom tolerance; avoid fully losing header.
 *    - Keep drag isolated from canvas/background handlers (preventDefault + stopPropagation + is-dragging-window).
 *    - Resize is OPTIONAL (opt-in feature), not a default widget requirement.
 *      If enabled: add explicit resize handle(s), min/max bounds, and mode-aware sizing behavior.
 *    - Persist state on drag end and debounce intermediate saves.
 *    - Maintain separate z-order behavior for overlay widgets vs canvas-coupled widgets.
 *    - Decoupled widgets should participate in info-window fronting/stacking behavior.
 *    - Include keyboard/accessibility basics where practical (aria-label/title on controls).
 *
 * 7) Info-window integration checklist (required when decoupled overlay is supported)
 *    - Ensure decoupled widget selectors participate in shared info-window promotion logic
 *      (INFO_WINDOW_PROMOTE_SELECTOR / promoteSelector defaults).
 *    - Ensure decoupled widget selectors are included in canvas input block selectors
 *      so drag/scroll on the widget does not pan/zoom the canvas.
 *    - Keep decoupled widget z-order below pinned layers by default.
 *      Pinned layers currently include footer + action indicator window.
 *    - If a widget/window needs to be above pinned layers, treat it as an explicit
 *      exception with a dedicated top-layer z policy and document why.
 *
 * NEW WIDGET INTAKE QUESTIONS (ASK BEFORE IMPLEMENTATION)
 * 1) Purpose + owner
 *    - What is this widget for, and which system owns its state?
 * 2) Layer + mode
 *    - Should it start in overlay, canvas-coupled, or support both (couple/decouple)?
 * 3) Canvas scope
 *    - Should it exist in player canvas, DM canvas, or both with separate state?
 *    - Confirm default spawn = active canvas view (recommended default).
 * 4) Size + constraints
 *    - Default width/height?
 *    - Is resize enabled for this widget? (default: NO, opt-in only)
 *    - If resize enabled: min/max resize limits?
 *    - Should size remain fixed per mode or adapt by zoom/scale transforms?
 * 5) Positioning rules
 *    - Initial spawn location?
 *    - Should we center on source element during mode transfer?
 *    - On decouple, should the widget move into the info-window layer and preserve visual center?
 *    - What are bounds/clamp rules (including footer-aware bottom bounds)?
 * 6) Header behavior
 *    - Header label default text?
 *    - Long-press title editing enabled?
 *    - Double-click/double-tap collapse enabled?
 * 7) Header actions
 *    - Confirm right-side controls (couple/decouple, close, delete, etc.).
 *    - Any control-specific lock or unavailable states?
 * 8) Drag + input model
 *    - Mouse and touch required?
 *    - Any drag threshold before movement starts?
 *    - Should drag be blocked while editing title/body text?
 * 9) Persistence contract
 *    - What must persist (mode, title, body, size, position, collapsed state, canvas association)?
 *    - Storage key/schema to use?
 *    - Save cadence: live debounce vs save-on-end?
 * 10) Interactions with other systems
 *    - Which existing functions/modules are referenced?
 *    - Any log output requirements?
 *    - Any integration with buffer/list panels?
 * 11) Z-order + focus
 *    - Should click/drag raise widget to front?
 *    - Is z-order shared with other widget families or isolated?
 *    - When decoupled, should it follow info-window z-order policy? (default: YES)
 * 12) Accessibility + UX
 *    - Required aria-label/title text for controls?
 *    - Keyboard interactions needed (escape, enter, tab)?
 *    - Any mobile-specific behavior differences?
 * 13) Success criteria
 *    - What user-visible behaviors confirm this widget is complete?
 *
 * DEPENDENCIES (provided by index.html globals):
 * - scale, panX, panY: Canvas transform state
 * - dmModeManager: DM mode toggle state
 * - characterLoader: Active character data
 * - addLogEntry: Action logging function
 */

(function() {
  'use strict';

  //widget - Sticky Note Configuration Constants
  const CONFIG = {
    MAX_NOTES: 10,
    LONG_PRESS_MS: 650,
    TEXT_MAX_CHARS: 500,
    TITLE_MAX_CHARS: 32,
    TITLE_LONG_PRESS_MS: 650,
    STORAGE_KEY: 'chain_warden_sticky_notes_by_combatant_v1',
    AUTO_SAVE_DELAY_MS: 1000
  };
  
  //widget - Backwards compatibility aliases
  const STICKY_NOTE_MAX_COUNT = CONFIG.MAX_NOTES;
  const STICKY_NOTE_LONG_PRESS_MS = CONFIG.LONG_PRESS_MS;
  const STICKY_NOTE_TEXT_MAX_CHARS = CONFIG.TEXT_MAX_CHARS;
  const STICKY_NOTE_TITLE_MAX_CHARS = CONFIG.TITLE_MAX_CHARS;
  const STICKY_NOTE_TITLE_LONG_PRESS_MS = CONFIG.TITLE_LONG_PRESS_MS;
  const STICKY_NOTES_STORAGE_KEY = CONFIG.STORAGE_KEY;

  //widget - Sticky Note State Variables
  let stickyNotesVisible = false;
  //widget
  let activeDraggingStickyNoteEl = null;
  //widget - Export for index.html access
  window.activeDraggingStickyNoteEl = activeDraggingStickyNoteEl;
  //widget
  let stickyTogglePressStartTimestamp = 0;
  //widget
  let suppressNextStickyToggleClick = false;
  //widget
  let stickyDragStartX = 0;
  //widget
  let stickyDragStartY = 0;
  //widget
  let stickyStartLeft = 0;
  //widget
  let stickyStartTop = 0;
  //widget
  let activeStickyNotesContextKey = '__no_combatant__';
  //widget
  let isSyncingStickyNotesContext = false;
  //widget
  let stickyNoteDeleteUndoTokenCounter = 1;
  //widget - Active interaction lock for sticky-note body (typing/select/resize handle drag)
  let isStickyBodyInteractionActive = false;
  //widget
  const stickyNoteStateById = new Map();
  //widget
  const stickyNoteSnapshotById = new Map();
  //widget
  const stickyNoteDeleteUndoSnapshotsByToken = new Map();
  //widget
  let stickyNoteBufferUndoEntryCounter = 1;
  //widget
  const stickyNoteBufferUndoEntriesByContext = new Map();
  //widget
  let hasActionLogVisibilityListener = false;

  //widget - DOM Element References (to be set by init)
  let stickyNoteSeedEl = null;
  //widget
  let stickyNoteToggleBtn = null;
  //widget
  let canvasLayerCounter = 110;

  //widget - Helper to access global scale (with fallback)
  function getScale() {
    //widget
    return typeof window.__chainWardenScale === 'number' ? window.__chainWardenScale : 1.0;
    //widget
  }
  //widget
  function setScale(value) {
    //widget
    window.__chainWardenScale = value;
    //widget
  }
  //widget
  function getPanX() {
    //widget
    return typeof window.__chainWardenPanX === 'number' ? window.__chainWardenPanX : 0;
    //widget
  }
  //widget
  function setPanX(value) {
    //widget
    window.__chainWardenPanX = value;
    //widget
  }
  //widget
  function getPanY() {
    //widget
    return typeof window.__chainWardenPanY === 'number' ? window.__chainWardenPanY : 0;
    //widget
  }
  //widget
  function setPanY(value) {
    //widget
    window.__chainWardenPanY = value;
    //widget
  }

/**
 * //widget - Initialize Sticky Notes Module
 * Sets up DOM references and global function exports
 */
function initStickyNotes() {
  //widget
  console.log('[Sticky Notes] initStickyNotes() called');
  //widget
  
  //widget
  stickyNoteSeedEl = document.getElementById('sticky-note-window');
  //widget
  console.log('[Sticky Notes] Seed element:', stickyNoteSeedEl);
  //widget
  
  //widget
  stickyNoteToggleBtn = document.getElementById('toggle-sticky-note');
  //widget
  console.log('[Sticky Notes] Toggle button:', stickyNoteToggleBtn);
  //widget

  const widgetToggleBtn = document.getElementById('toggle-widget');
  const widgetMenuWindow = document.getElementById('widget-menu-window');
  const widgetMenuStickyNoteBtn = document.getElementById('widget-menu-sticky-note-btn');
  const debugToggleBtn = document.getElementById('toggle-debug');
  const debugMenuWindow = document.getElementById('debug-menu-window');
  const debugMenuInfoWindowBtn = document.getElementById('debug-menu-info-window-btn');
  const debugMenuCanvasButtonsBtn = document.getElementById('debug-menu-canvas-buttons-btn'); //canvas button
  const debugMenuCardsBtn = document.getElementById('debug-menu-cards-btn');
  //info window - decoupled overlay widgets are treated as info-window targets for debug/select
  let infoWindowHighlightEnabled = false;
  let canvasButtonHighlightEnabled = false; //canvas button
  let cardsHighlightEnabled = false;
  const DEBUG_INFO_WINDOW_SELECTOR = '#log-window, #log-calculator-window, #character-info-window, #load-character-window, #sticky-note-buffer, .sticky-note-window:not(.canvas-sticky-note)';
  const DEBUG_INFO_WINDOW_HANDLE_PAD = 14;
  let debugInfoWindowHandleLayerEl = null;
  let debugInfoWindowReadoutEl = null;
  let debugInfoWindowOverlayRafId = 0;

  const isElementVisibleForDebugOverlay = (element) => {
    if (!element || !element.isConnected) return false;
    const styles = window.getComputedStyle(element);
    if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  };

  const getDebugInfoWindowTargets = () => Array.from(document.querySelectorAll(DEBUG_INFO_WINDOW_SELECTOR))
    .filter(isElementVisibleForDebugOverlay);

  const ensureDebugInfoWindowReadout = () => {
    if (debugInfoWindowReadoutEl) return debugInfoWindowReadoutEl;
    const readoutEl = document.createElement('div');
    readoutEl.id = 'debug-info-window-readout';
    readoutEl.style.position = 'fixed';
    readoutEl.style.top = '10px';
    readoutEl.style.left = '10px';
    readoutEl.style.padding = '6px 8px';
    readoutEl.style.borderRadius = '6px';
    readoutEl.style.background = 'rgba(15, 23, 42, 0.9)';
    readoutEl.style.color = '#e2e8f0';
    readoutEl.style.fontSize = '11px';
    readoutEl.style.fontWeight = '600';
    readoutEl.style.zIndex = '2147483645';
    readoutEl.style.pointerEvents = 'none';
    readoutEl.style.maxWidth = '46vw';
    readoutEl.style.whiteSpace = 'nowrap';
    readoutEl.style.overflow = 'hidden';
    readoutEl.style.textOverflow = 'ellipsis';
    readoutEl.textContent = 'DEBUG: Info Window select mode';
    document.body.appendChild(readoutEl);
    debugInfoWindowReadoutEl = readoutEl;
    return readoutEl;
  };

  const updateDebugInfoWindowReadout = (windowEl) => {
    const readoutEl = ensureDebugInfoWindowReadout();
    if (!windowEl) {
      readoutEl.textContent = 'DEBUG: Info Window select mode';
      return;
    }
    const computedZ = Number.parseInt(window.getComputedStyle(windowEl).zIndex || '0', 10) || 0;
    const tag = windowEl.id ? `#${windowEl.id}` : `.${Array.from(windowEl.classList).join('.')}`;
    readoutEl.textContent = `Selected ${tag} | z=${computedZ}`;
  };

  const ensureDebugInfoWindowHandleLayer = () => {
    if (debugInfoWindowHandleLayerEl) return debugInfoWindowHandleLayerEl;
    const layerEl = document.createElement('div');
    layerEl.id = 'debug-info-window-handle-layer';
    layerEl.style.position = 'fixed';
    layerEl.style.inset = '0';
    layerEl.style.pointerEvents = 'none';
    layerEl.style.zIndex = '2147483644';
    document.body.appendChild(layerEl);
    debugInfoWindowHandleLayerEl = layerEl;
    return layerEl;
  };

  const createDebugHandleStrip = (left, top, width, height, targetWindowEl) => {
    const stripEl = document.createElement('div');
    stripEl.style.position = 'fixed';
    stripEl.style.left = `${Math.max(0, left)}px`;
    stripEl.style.top = `${Math.max(0, top)}px`;
    stripEl.style.width = `${Math.max(0, width)}px`;
    stripEl.style.height = `${Math.max(0, height)}px`;
    stripEl.style.background = 'transparent';
    stripEl.style.pointerEvents = 'auto';
    stripEl.style.cursor = 'pointer';
    stripEl.__targetWindowEl = targetWindowEl;
    stripEl.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof window.setFloatingWindowPrimary === 'function') {
        window.setFloatingWindowPrimary('debug-handle', targetWindowEl);
      }
      updateDebugInfoWindowReadout(targetWindowEl);
    }, true);
    return stripEl;
  };

  const renderDebugInfoWindowHandles = () => {
    const layerEl = ensureDebugInfoWindowHandleLayer();
    layerEl.innerHTML = '';
    const targets = getDebugInfoWindowTargets();
    targets.forEach((targetEl) => {
      const rect = targetEl.getBoundingClientRect();
      const expandedLeft = rect.left - DEBUG_INFO_WINDOW_HANDLE_PAD;
      const expandedTop = rect.top - DEBUG_INFO_WINDOW_HANDLE_PAD;
      const expandedWidth = rect.width + (DEBUG_INFO_WINDOW_HANDLE_PAD * 2);
      const expandedHeight = rect.height + (DEBUG_INFO_WINDOW_HANDLE_PAD * 2);

      const topStrip = createDebugHandleStrip(expandedLeft, expandedTop, expandedWidth, DEBUG_INFO_WINDOW_HANDLE_PAD, targetEl);
      const bottomStrip = createDebugHandleStrip(expandedLeft, rect.bottom, expandedWidth, DEBUG_INFO_WINDOW_HANDLE_PAD, targetEl);
      const leftStrip = createDebugHandleStrip(expandedLeft, rect.top, DEBUG_INFO_WINDOW_HANDLE_PAD, rect.height, targetEl);
      const rightStrip = createDebugHandleStrip(rect.right, rect.top, DEBUG_INFO_WINDOW_HANDLE_PAD, rect.height, targetEl);

      layerEl.appendChild(topStrip);
      layerEl.appendChild(bottomStrip);
      layerEl.appendChild(leftStrip);
      layerEl.appendChild(rightStrip);
    });
  };

  const stopDebugInfoWindowOverlayLoop = () => {
    if (debugInfoWindowOverlayRafId) {
      cancelAnimationFrame(debugInfoWindowOverlayRafId);
      debugInfoWindowOverlayRafId = 0;
    }
  };

  const startDebugInfoWindowOverlayLoop = () => {
    const tick = () => {
      if (!infoWindowHighlightEnabled) {
        stopDebugInfoWindowOverlayLoop();
        return;
      }
      renderDebugInfoWindowHandles();
      debugInfoWindowOverlayRafId = requestAnimationFrame(tick);
    };
    if (debugInfoWindowOverlayRafId) return;
    debugInfoWindowOverlayRafId = requestAnimationFrame(tick);
  };

  const teardownDebugInfoWindowOverlay = () => {
    stopDebugInfoWindowOverlayLoop();
    if (debugInfoWindowHandleLayerEl) {
      debugInfoWindowHandleLayerEl.remove();
      debugInfoWindowHandleLayerEl = null;
    }
    if (debugInfoWindowReadoutEl) {
      debugInfoWindowReadoutEl.remove();
      debugInfoWindowReadoutEl = null;
    }
  };

  const onDocumentDebugInfoWindowPointerDown = (event) => {
    if (!infoWindowHighlightEnabled) return;
    const targetEl = event.target instanceof Element ? event.target.closest(DEBUG_INFO_WINDOW_SELECTOR) : null;
    if (!targetEl) return;
    updateDebugInfoWindowReadout(targetEl);
  };

  document.addEventListener('pointerdown', onDocumentDebugInfoWindowPointerDown, true);

  const setInfoWindowHighlightEnabled = (shouldEnable) => {
    infoWindowHighlightEnabled = !!shouldEnable;
    document.body.classList.toggle('debug-info-window-highlights', infoWindowHighlightEnabled);
    if (debugMenuInfoWindowBtn) {
      debugMenuInfoWindowBtn.classList.toggle('active', infoWindowHighlightEnabled);
      debugMenuInfoWindowBtn.setAttribute('aria-pressed', infoWindowHighlightEnabled ? 'true' : 'false');
    }
    if (infoWindowHighlightEnabled) {
      ensureDebugInfoWindowReadout();
      updateDebugInfoWindowReadout(null);
      startDebugInfoWindowOverlayLoop();
    } else {
      teardownDebugInfoWindowOverlay();
    }
  };

  const setCanvasButtonHighlightEnabled = (shouldEnable) => { //canvas button
    canvasButtonHighlightEnabled = !!shouldEnable; //canvas button
    document.body.classList.toggle('debug-canvas-buttons-highlights', canvasButtonHighlightEnabled); //canvas button
    if (debugMenuCanvasButtonsBtn) {
      debugMenuCanvasButtonsBtn.classList.toggle('active', canvasButtonHighlightEnabled); //canvas button
      debugMenuCanvasButtonsBtn.setAttribute('aria-pressed', canvasButtonHighlightEnabled ? 'true' : 'false'); //canvas button
    }
  };

  const setCardsHighlightEnabled = (shouldEnable) => {
    cardsHighlightEnabled = !!shouldEnable;
    document.body.classList.toggle('debug-cards-highlights', cardsHighlightEnabled);
    if (debugMenuCardsBtn) {
      debugMenuCardsBtn.classList.toggle('active', cardsHighlightEnabled);
      debugMenuCardsBtn.setAttribute('aria-pressed', cardsHighlightEnabled ? 'true' : 'false');
    }
  };

  const positionWidgetMenuWindow = () => {
    if (!widgetToggleBtn || !widgetMenuWindow) return;
    const widgetRect = widgetToggleBtn.getBoundingClientRect();
    const menuWidth = widgetMenuWindow.offsetWidth || 170;
    const menuHeight = widgetMenuWindow.offsetHeight || 56;
    const targetLeft = widgetRect.left + (widgetRect.width / 2) - (menuWidth / 2);
    const targetTop = widgetRect.top - menuHeight - 8;
    const minLeft = 8;
    const maxLeft = Math.max(minLeft, window.innerWidth - menuWidth - 8);
    const minTop = 8;
    const maxTop = Math.max(minTop, window.innerHeight - menuHeight - 8);
    widgetMenuWindow.style.left = `${Math.min(maxLeft, Math.max(minLeft, targetLeft))}px`;
    widgetMenuWindow.style.top = `${Math.min(maxTop, Math.max(minTop, targetTop))}px`;
  };

  const positionDebugMenuWindow = () => {
    if (!debugToggleBtn || !debugMenuWindow) return;
    const debugRect = debugToggleBtn.getBoundingClientRect();
    const menuWidth = debugMenuWindow.offsetWidth || 170;
    const menuHeight = debugMenuWindow.offsetHeight || 56;
    const targetLeft = debugRect.left + (debugRect.width / 2) - (menuWidth / 2);
    const targetTop = debugRect.top - menuHeight - 8;
    const minLeft = 8;
    const maxLeft = Math.max(minLeft, window.innerWidth - menuWidth - 8);
    const minTop = 8;
    const maxTop = Math.max(minTop, window.innerHeight - menuHeight - 8);
    debugMenuWindow.style.left = `${Math.min(maxLeft, Math.max(minLeft, targetLeft))}px`;
    debugMenuWindow.style.top = `${Math.min(maxTop, Math.max(minTop, targetTop))}px`;
  };

  const setWidgetMenuVisible = (shouldShow) => {
    if (!widgetMenuWindow || !widgetToggleBtn) return;
    widgetMenuWindow.classList.toggle('hidden', !shouldShow);
    widgetMenuWindow.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    widgetToggleBtn.classList.toggle('active', !!shouldShow);
    widgetToggleBtn.setAttribute('aria-expanded', shouldShow ? 'true' : 'false');
    if (shouldShow) {
      positionWidgetMenuWindow();
    }
  };

  const setDebugMenuVisible = (shouldShow) => {
    if (!debugMenuWindow || !debugToggleBtn) return;
    debugMenuWindow.classList.toggle('hidden', !shouldShow);
    debugMenuWindow.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    debugToggleBtn.classList.toggle('active', !!shouldShow);
    debugToggleBtn.setAttribute('aria-expanded', shouldShow ? 'true' : 'false');
    if (shouldShow) {
      positionDebugMenuWindow();
    }
  };

  if (widgetToggleBtn && widgetMenuWindow) {
    widgetToggleBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const shouldOpen = widgetMenuWindow.classList.contains('hidden');
      setWidgetMenuVisible(shouldOpen);
    });
    window.addEventListener('resize', () => {
      if (!widgetMenuWindow.classList.contains('hidden')) {
        positionWidgetMenuWindow();
      }
    });
  }

  if (debugToggleBtn && debugMenuWindow) {
    debugToggleBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const shouldOpen = debugMenuWindow.classList.contains('hidden');
      setDebugMenuVisible(shouldOpen);
    });
    window.addEventListener('resize', () => {
      if (!debugMenuWindow.classList.contains('hidden')) {
        positionDebugMenuWindow();
      }
    });
  }

  if (widgetMenuStickyNoteBtn) {
    widgetMenuStickyNoteBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const createdNote = createStickyNote(null, true);
      if (createdNote) {
        logStickyNoteCreationFromOfficialButton(createdNote);
      }
    });
  }

  if (debugMenuInfoWindowBtn) {
    debugMenuInfoWindowBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      setInfoWindowHighlightEnabled(!infoWindowHighlightEnabled);
    });
  }

  if (debugMenuCanvasButtonsBtn) {
    debugMenuCanvasButtonsBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      setCanvasButtonHighlightEnabled(!canvasButtonHighlightEnabled); //canvas button
    });
  }

  if (debugMenuCardsBtn) {
    debugMenuCardsBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      setCardsHighlightEnabled(!cardsHighlightEnabled);
    });
  }

  // Close debug menu when clicking outside
  document.addEventListener('click', (event) => {
    if (debugMenuWindow && !debugMenuWindow.classList.contains('hidden')) {
      if (!debugMenuWindow.contains(event.target) && event.target !== debugToggleBtn) {
        setDebugMenuVisible(false);
      }
    }
  });

  //widget
  if (!stickyNoteToggleBtn) {
    //widget
    console.warn('[Sticky Notes] Footer sticky-note button not found; popup trigger remains active.');
    //widget
  }
  //widget

  //widget - Export global functions
  //widget
  window.syncStickyNotesForActiveBuffer = syncStickyNotesForActiveBuffer;
  //widget
  window.createStickyNote = createStickyNote;
  //widget
  window.toggleStickyNoteMode = toggleStickyNoteMode;
  //widget
  console.log('[Sticky Notes] Global functions exported');
  //widget

  //widget - Setup legacy sticky-note footer button listeners
  //widget
  setupStickyNoteToggleListeners();
  //widget
  console.log('[Sticky Notes] Event listeners attached');
  //widget
}

function setStickyBodyInteractionActive(isActive) {
  //mv:widget //state:overlay|canvas //rel:child=.sticky-note-body -> parent=.canvas-sticky-note|.sticky-note-window
  //widget
  isStickyBodyInteractionActive = !!isActive;
  syncStickyWindowDragClass();
}

function beginStickyBodyInteraction(event) {
  //mv:widget //state:overlay|canvas //rel:child=.sticky-note-body lock=isStickyBodyInteractionActive
  setStickyBodyInteractionActive(true);
  event?.stopPropagation?.();
}

function endStickyBodyInteraction() {
  setStickyBodyInteractionActive(false);
}

function syncStickyWindowDragClass() {
  //mv:widget //state:overlay|canvas //rel:owner=.is-dragging-window <- (activeDraggingStickyNoteEl|isStickyBodyInteractionActive)
  const shouldLockCanvasInput = !!activeDraggingStickyNoteEl || !!isStickyBodyInteractionActive || !!isDraggingBuffer;
  document.body.classList.toggle('is-dragging-window', shouldLockCanvasInput);
}

//widget - Capture-phase safeguard: prevent canvas pan while body interaction is active
//mv:widget //state:overlay|canvas //rel:blocker=canvas-pan-dispatch
document.addEventListener('mousemove', (event) => {
  //widget
  if (!isStickyBodyInteractionActive) return;
  //widget
  event.stopPropagation();
  //widget
}, true);

document.addEventListener('pointermove', (event) => {
  //widget
  if (!isStickyBodyInteractionActive) return;
  //widget
  event.stopPropagation();
  //widget
}, true);

document.addEventListener('touchmove', (event) => {
  //widget
  if (!isStickyBodyInteractionActive) return;
  //widget
  event.stopPropagation();
  //widget
  event.preventDefault();
  //widget
}, { capture: true, passive: false });

document.addEventListener('mouseup', () => {
  //widget
  if (!isStickyBodyInteractionActive) return;
  //widget
  setStickyBodyInteractionActive(false);
  //widget
}, true);

document.addEventListener('pointerup', () => {
  //widget
  if (!isStickyBodyInteractionActive) return;
  //widget
  setStickyBodyInteractionActive(false);
  //widget
}, true);

document.addEventListener('touchend', () => {
  //widget
  if (!isStickyBodyInteractionActive) return;
  //widget
  setStickyBodyInteractionActive(false);
  //widget
}, { capture: true, passive: true });

document.addEventListener('touchcancel', () => {
  //widget
  if (!isStickyBodyInteractionActive) return;
  //widget
  setStickyBodyInteractionActive(false);
  //widget
}, { capture: true, passive: true });

window.addEventListener('blur', () => {
  //widget
  if (!isStickyBodyInteractionActive) return;
  //widget
  setStickyBodyInteractionActive(false);
  //widget
});

/**
 * //widget - Get count of canvas sticky notes
 * @param {string} canvasType - 'dm' or 'player'
 * @returns {number} - Count of notes on canvas
 */
function getCanvasStickyNoteCount(canvasType) {
  //widget
  const canvasEl = canvasType === 'dm'
    //widget
    ? document.getElementById('dm-canvas-container')
    //widget
    : document.getElementById('world');
  //widget
  if (!canvasEl) return 0;
  //widget
  return canvasEl.querySelectorAll('.canvas-sticky-note').length;
  //widget
}

/**
 * //widget - Get count of overlay sticky notes
 * @returns {number} - Count of overlay notes
 */
function getOverlayStickyNoteCount() {
  //widget
  return document.querySelectorAll('.sticky-note-window:not(.canvas-sticky-note)').length;
  //widget
}

/**
 * //widget - Check if canvas note can be created
 * @param {string} canvasType - 'dm' or 'player'
 * @returns {boolean} - True if under max count
 */
function canCreateCanvasNote(canvasType) {
  //widget
  return getCanvasStickyNoteCount(canvasType) < STICKY_NOTE_MAX_COUNT;
  //widget
}

/**
 * //widget - Check if coupling to canvas is allowed
 * @param {string} canvasType - 'dm' or 'player'
 * @returns {boolean} - True if can couple
 */
function canCoupleToCanvas(canvasType) {
  //widget
  return canCreateCanvasNote(canvasType);
  //widget
}

/**
 * //widget - Find next cascade position to avoid overlapping
 * @param {string} canvasType - 'dm' or 'player'
 * @param {number} baseCenterX - Center X position
 * @param {number} baseCenterY - Center Y position
 * @returns {{x: number, y: number}} - Position coordinates
 */
function findNextCascadePosition(canvasType, baseCenterX, baseCenterY) {
  //widget
  const canvasEl = canvasType === 'dm'
    //widget
    ? document.getElementById('dm-canvas-container')
    //widget
    : document.getElementById('world');
  //widget
  if (!canvasEl) return { x: baseCenterX, y: baseCenterY };
  //widget

  //widget
  const existingNotes = canvasEl.querySelectorAll('.canvas-sticky-note');
  //widget
  const cascadeOffset = 10;
  //widget
  const tolerance = 5;
  //widget

  //widget
  let testX = baseCenterX;
  //widget
  let testY = baseCenterY;
  //widget
  let cascadeCount = 0;
  //widget

  //widget - Keep checking until we find a position with no collision
  while (true) {
    //widget
    let hasCollision = false;
    //widget

    //widget - Check if any existing note has the same center point
    for (const note of existingNotes) {
      //widget
      const noteLeft = parseFloat(note.style.left) || 0;
      //widget
      const noteTop = parseFloat(note.style.top) || 0;
      //widget
      const noteWidth = parseFloat(note.style.width) || 240;
      //widget
      const noteHeight = parseFloat(note.style.height) || 240;
      //widget
      const noteCenterX = noteLeft + noteWidth / 2;
      //widget
      const noteCenterY = noteTop + noteHeight / 2;
      //widget

      //widget - If center points match (within tolerance), we have collision
      if (Math.abs(noteCenterX - testX) < tolerance && Math.abs(noteCenterY - testY) < tolerance) {
        //widget
        hasCollision = true;
        //widget
        break;
        //widget
      }
    }

    //widget - If no collision, return this position
    if (!hasCollision) {
      //widget
      return { x: testX, y: testY };
      //widget
    }

    //widget - Otherwise, cascade further and try again
    //widget
    cascadeCount++;
    //widget
    testX = baseCenterX + (cascadeOffset * cascadeCount);
    //widget
    testY = baseCenterY + (cascadeOffset * cascadeCount);
    //widget
  }
}

function resolvePreferredInfoWindowCenter() {
  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  };
}

function findNextOverlayCascadePosition(baseLeft, baseTop) {
  const existingOverlayNotes = Array.from(document.querySelectorAll('.sticky-note-window:not(.canvas-sticky-note)'));
  const cascadeOffset = 10;
  const tolerance = 3;

  let testLeft = baseLeft;
  let testTop = baseTop;
  let cascadeCount = 0;

  while (true) {
    const hasCollision = existingOverlayNotes.some((noteEl) => {
      const noteLeft = parseFloat(noteEl.style.left) || 0;
      const noteTop = parseFloat(noteEl.style.top) || 0;
      return Math.abs(noteLeft - testLeft) < tolerance && Math.abs(noteTop - testTop) < tolerance;
    });

    if (!hasCollision) {
      return { left: testLeft, top: testTop };
    }

    cascadeCount += 1;
    testLeft = baseLeft + (cascadeOffset * cascadeCount);
    testTop = baseTop + (cascadeOffset * cascadeCount);
  }
}

function findFirstIntersectingCanvasStickyNote(canvasType, overlayRect) {
  if (!overlayRect) return null;
  const canvasEl = canvasType === 'dm'
    ? document.getElementById('dm-canvas-container')
    : document.getElementById('world');
  if (!canvasEl) return null;

  const canvasNotes = Array.from(canvasEl.querySelectorAll('.canvas-sticky-note'));
  for (const canvasNoteEl of canvasNotes) {
    const canvasRect = canvasNoteEl.getBoundingClientRect();
    const intersects = overlayRect.left < canvasRect.right
      && overlayRect.right > canvasRect.left
      && overlayRect.top < canvasRect.bottom
      && overlayRect.bottom > canvasRect.top;
    if (intersects) {
      return canvasNoteEl;
    }
  }

  return null;
}

/**
 * //widget - Clamp sticky note position to viewport
 * @param {number} leftPx - Left position
 * @param {number} topPx - Top position
 * @param {number} noteWidthPx - Note width
 * @param {number} noteHeightPx - Note height
 * @returns {{left: number, top: number}} - Clamped position
 */
function clampStickyNotePosition(leftPx, topPx, noteWidthPx, noteHeightPx) {
  //widget
  return clampInfoWindowPositionRecoverable(leftPx, topPx, noteWidthPx, noteHeightPx, 36);
}

function getFooterTopBoundary() {
  //info window - shared footer boundary utility for overlay widget/info-window clamps
  const footerEl = document.querySelector('footer');
  if (!footerEl) return window.innerHeight;
  const footerRect = footerEl.getBoundingClientRect();
  if (!footerRect || footerRect.height <= 0) return window.innerHeight;
  return footerRect.top;
}

function clampInfoWindowPositionRecoverable(leftPx, topPx, widthPx, heightPx, headerHeightPx = 36) {
  //info window - recoverable clamp for decoupled overlay widgets (header visible + footer-aware lower limit)
  const safeHeaderHeight = Math.max(1, headerHeightPx || 36);
  const minHeaderVisibleX = 24;
  const minHeaderVisibleY = 24;
  const minLeft = minHeaderVisibleX - widthPx;
  const maxLeft = window.innerWidth - minHeaderVisibleX;
  const minTop = minHeaderVisibleY - safeHeaderHeight;
  const footerTop = getFooterTopBoundary();
  const maxTopFromViewport = window.innerHeight - safeHeaderHeight;
  const maxTopFromFooter = footerTop - safeHeaderHeight;
  const maxTop = Math.max(minTop, Math.min(maxTopFromViewport, maxTopFromFooter));

  return {
    left: Math.min(maxLeft, Math.max(minLeft, leftPx)),
    top: Math.min(maxTop, Math.max(minTop, topPx))
  };
}

/**
 * //widget - Sync active dragging sticky note reference to window scope
 * @param {HTMLElement|null} noteEl - Active dragged note
 */
function setActiveDraggingStickyNote(noteEl) {
  //widget
  activeDraggingStickyNoteEl = noteEl || null;
  //widget
  window.activeDraggingStickyNoteEl = activeDraggingStickyNoteEl;
  //widget
  syncStickyWindowDragClass();
}

/**
 * //widget - Begin sticky note drag interaction
 * @param {HTMLElement} noteEl - Note element
 * @param {number} clientX - Pointer X in viewport
 * @param {number} clientY - Pointer Y in viewport
 */
function beginStickyNoteDrag(noteEl, clientX, clientY) {
  //mv:widget //state:overlay|canvas //rel:parent=noteEl child=.sticky-note-header
  //widget
  if (!noteEl) return;
  //widget
  setActiveDraggingStickyNote(noteEl);
  //widget
  stickyDragStartX = clientX;
  //widget
  stickyDragStartY = clientY;
  //widget
  stickyStartLeft = Number.parseFloat(noteEl.style.left) || noteEl.offsetLeft || 24;
  //widget
  stickyStartTop = Number.parseFloat(noteEl.style.top) || noteEl.offsetTop || 120;
}

function getStickyEventClientPoint(event) {
  if (event?.touches && event.touches.length > 0) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  if (typeof event?.clientX === 'number' && typeof event?.clientY === 'number') {
    return { x: event.clientX, y: event.clientY };
  }
  return null;
}

function tryStartStickyHeaderDrag(noteEl, titleEl, event) {
  //mv:widget //state:overlay|canvas //rel:child=.sticky-note-header -> parent=noteEl
  if (titleEl.getAttribute('contenteditable') === 'true') return;
  if (event.target.closest('.sticky-note-close')) return;
  const point = getStickyEventClientPoint(event);
  if (!point) return;
  beginStickyNoteDrag(noteEl, point.x, point.y);
  event.preventDefault();
  event.stopPropagation();
}

/**
 * //widget - Move currently dragged sticky note
 * @param {number} clientX - Pointer X in viewport
 * @param {number} clientY - Pointer Y in viewport
 */
function moveActiveStickyNoteDrag(clientX, clientY) {
  //mv:widget //state:overlay|canvas //rel:parent=noteEl mode=canvas|overlay
  //widget
  const noteEl = activeDraggingStickyNoteEl;
  //widget
  if (!noteEl) return;

  //widget
  const deltaX = clientX - stickyDragStartX;
  //widget
  const deltaY = clientY - stickyDragStartY;

  //widget
  if (noteEl.classList.contains('canvas-sticky-note')) {
    //widget - Canvas notes are positioned in world coordinates
    //widget
    const { scale: activeScale } = getActiveCanvasTransform();
    //widget
    const safeScale = Math.max(0.001, activeScale);
    //widget
    const nextLeft = stickyStartLeft + (deltaX / safeScale);
    //widget
    const nextTop = stickyStartTop + (deltaY / safeScale);
    //widget
    noteEl.style.left = `${nextLeft}px`;
    //widget
    noteEl.style.top = `${nextTop}px`;
    //widget
    return;
    //widget
  }

  //widget - Overlay notes are positioned in viewport coordinates
  //widget
  const noteWidth = noteEl.offsetWidth || 240;
  //widget
  const noteHeight = noteEl.offsetHeight || 240;
  //widget
  const nextLeft = stickyStartLeft + deltaX;
  //widget
  const nextTop = stickyStartTop + deltaY;
  //widget
  const headerHeight = noteEl.querySelector('.sticky-note-header')?.offsetHeight || 36;
  //widget
  const clamped = clampInfoWindowPositionRecoverable(nextLeft, nextTop, noteWidth, noteHeight, headerHeight);
  //widget
  noteEl.style.left = `${clamped.left}px`;
  //widget
  noteEl.style.top = `${clamped.top}px`;
  //widget
}

/**
 * //widget - End active sticky note drag
 */
function endActiveStickyNoteDrag() {
  //mv:widget //state:overlay|canvas //rel:parent=activeDraggingStickyNoteEl
  //widget
  if (!activeDraggingStickyNoteEl) return;
  //widget
  const endedNote = activeDraggingStickyNoteEl;
  //widget
  setActiveDraggingStickyNote(null);
  //widget
  saveStickyNoteSnapshot(endedNote);
  //widget
  autoSaveStickyNotes();
  //widget
}

//widget - Shared global drag listeners for sticky notes (overlay + canvas)
document.addEventListener('mousemove', (event) => {
  //widget
  if (!activeDraggingStickyNoteEl) return;
  //widget
  moveActiveStickyNoteDrag(event.clientX, event.clientY);
  //widget
  event.preventDefault();
  //widget
});

document.addEventListener('mouseup', () => {
  //widget
  endActiveStickyNoteDrag();
  //widget
});

document.addEventListener('touchmove', (event) => {
  //widget
  if (!activeDraggingStickyNoteEl) return;
  //widget
  if (!event.touches || event.touches.length === 0) return;
  //widget
  const touch = event.touches[0];
  //widget
  moveActiveStickyNoteDrag(touch.clientX, touch.clientY);
  //widget
  event.preventDefault();
  //widget
}, { passive: false });

document.addEventListener('touchend', () => {
  //widget
  endActiveStickyNoteDrag();
  //widget
}, { passive: true });

document.addEventListener('touchcancel', () => {
  //widget
  endActiveStickyNoteDrag();
  //widget
}, { passive: true });

window.addEventListener('blur', () => {
  //widget
  endActiveStickyNoteDrag();
  //widget
});

/**
 * //widget - Get sticky note ID from element
 * @param {HTMLElement} noteEl - Note element
 * @returns {number|null} - Note ID or null
 */
function getStickyNoteIdFromElement(noteEl) {
  //widget
  if (!noteEl) return null;
  //widget
  const rawIdValue = Number.parseInt(noteEl.dataset.stickyNoteId || '', 10);
  //widget
  return Number.isFinite(rawIdValue) ? rawIdValue : null;
  //widget
}

/**
 * //widget - Get all sticky note elements
 * @returns {HTMLElement[]} - Array of note elements
 */
function getStickyNoteElements() {
  //widget - Get both overlay and canvas sticky notes
  //widget
  const overlayNotes = Array.from(document.querySelectorAll('.sticky-note-window[data-sticky-note-id]'));
  //widget
  const canvasNotes = Array.from(document.querySelectorAll('.canvas-sticky-note[data-sticky-note-id]'));
  //widget
  return [...overlayNotes, ...canvasNotes];
  //widget
}

/**
 * //widget - Get lowest available sticky note ID
 * @param {number|null} preferredId - Preferred ID
 * @param {boolean} isCanvasNote - Whether this is for a canvas note
 * @returns {number|null} - Available ID or null if at max
 */
function getLowestAvailableStickyNoteId(preferredId = null, isCanvasNote = false) {
  //widget
  //widget - Canvas notes and overlay notes have separate ID pools
  //widget
  const allNotes = isCanvasNote 
    //widget
    ? Array.from(document.querySelectorAll('.canvas-sticky-note[data-sticky-note-id]'))
    //widget
    : Array.from(document.querySelectorAll('.sticky-note-window[data-sticky-note-id]:not(.canvas-sticky-note)'));
  //widget
  
  //widget
  const usedIds = new Set(
    //widget
    allNotes
      //widget
      .map((noteEl) => getStickyNoteIdFromElement(noteEl))
      //widget
      .filter((stickyNoteId) => Number.isFinite(stickyNoteId))
    //widget
  );
  //widget

  //widget
  if (Number.isFinite(preferredId) && preferredId >= 1 && preferredId <= STICKY_NOTE_MAX_COUNT && !usedIds.has(preferredId)) {
    //widget
    return preferredId;
    //widget
  }

  //widget
  for (let stickyNoteId = 1; stickyNoteId <= STICKY_NOTE_MAX_COUNT; stickyNoteId++) {
    //widget
    if (!usedIds.has(stickyNoteId)) {
      //widget
      return stickyNoteId;
      //widget
    }
  }

  //widget
  return null;
  //widget
}

/**
 * //widget - Build snapshot from sticky note element
 * @param {HTMLElement} noteEl - Note element
 * @returns {object|null} - Snapshot object or null
 */
function buildStickyNoteSnapshotFromElement(noteEl) {
  //widget
  if (!noteEl) return null;
  //widget
  const stickyNoteId = getStickyNoteIdFromElement(noteEl);
  //widget
  if (!stickyNoteId) return null;
  //widget

  //widget
  const titleEl = noteEl.querySelector('.sticky-note-title');
  //widget
  const bodyEl = noteEl.querySelector('.sticky-note-body');
  //widget

  //widget
  const decoupleCanvasWidth = Number.parseFloat(noteEl.dataset.stickyDecoupleCanvasWidth || '');
  //widget
  const decoupleCanvasHeight = Number.parseFloat(noteEl.dataset.stickyDecoupleCanvasHeight || '');
  //widget
  const decoupleDisplayWidth = Number.parseFloat(noteEl.dataset.stickyDecoupleDisplayWidth || '');
  //widget
  const decoupleDisplayHeight = Number.parseFloat(noteEl.dataset.stickyDecoupleDisplayHeight || '');
  //widget
  const decoupleZoom = Number.parseFloat(noteEl.dataset.stickyDecoupleZoom || '');
  //widget

  //widget
  return {
    //widget
    id: stickyNoteId,
    //widget
    mode: noteEl.classList.contains('canvas-sticky-note') ? 'canvas' : 'overlay',
    //widget
    canvas: (noteEl.dataset.stickyNoteCanvas === 'dm' ? 'dm' : 'player'),
    //widget
    title: normalizeStickyNoteTitle(titleEl?.textContent || 'STICKY NOTE', 'STICKY NOTE'),
    //widget
    body: String(bodyEl?.value || '').slice(0, STICKY_NOTE_TEXT_MAX_CHARS),
    //widget
    left: Number.parseFloat(noteEl.style.left) || noteEl.offsetLeft || 24,
    //widget
    top: Number.parseFloat(noteEl.style.top) || noteEl.offsetTop || 120,
    //widget
    width: noteEl.offsetWidth || 240,
    //widget
    height: noteEl.offsetHeight || 240,
    //widget
    collapsed: noteEl.classList.contains('collapsed'),
    //widget
    decoupleCanvasWidth: Number.isFinite(decoupleCanvasWidth) && decoupleCanvasWidth > 0 ? decoupleCanvasWidth : undefined,
    //widget
    decoupleCanvasHeight: Number.isFinite(decoupleCanvasHeight) && decoupleCanvasHeight > 0 ? decoupleCanvasHeight : undefined,
    //widget
    decoupleDisplayWidth: Number.isFinite(decoupleDisplayWidth) && decoupleDisplayWidth > 0 ? decoupleDisplayWidth : undefined,
    //widget
    decoupleDisplayHeight: Number.isFinite(decoupleDisplayHeight) && decoupleDisplayHeight > 0 ? decoupleDisplayHeight : undefined,
    //widget
    decoupleZoom: Number.isFinite(decoupleZoom) && decoupleZoom > 0 ? decoupleZoom : undefined
    //widget
  };
}

/**
 * //widget - Get sticky notes storage bucket from localStorage
 * @returns {object} - Storage bucket object
 */
function getStickyNotesStorageBucket() {
  //widget
  try {
    //widget
    const rawStore = localStorage.getItem(STICKY_NOTES_STORAGE_KEY);
    //widget
    if (!rawStore) return {};
    //widget
    const parsedStore = JSON.parse(rawStore);
    //widget
    if (!parsedStore || typeof parsedStore !== 'object' || Array.isArray(parsedStore)) {
      //widget
      return {};
      //widget
    }
    //widget
    return parsedStore;
    //widget
  } catch (storageError) {
    //widget
    console.warn('[Sticky Notes] Could not read sticky note storage:', storageError);
    //widget
    return {};
    //widget
  }
}

/**
 * //widget - Set sticky notes storage bucket in localStorage
 * @param {object} nextBucket - Bucket to save
 */
function setStickyNotesStorageBucket(nextBucket) {
  //widget
  try {
    //widget
    localStorage.setItem(STICKY_NOTES_STORAGE_KEY, JSON.stringify(nextBucket));
    //widget
  } catch (storageError) {
    //widget
    console.warn('[Sticky Notes] Could not write sticky note storage:', storageError);
    //widget
  }
}

/**
 * //widget - Get current canvas type (player or dm)
 * @returns {string} - 'player' or 'dm'
 */
function getCurrentCanvasType() {
  //widget
  return window.dmModeManager?.isActive ? 'dm' : 'player';
  //widget
}

/**
 * //widget - Get active canvas transform values from live DOM transform
 * @returns {{scale: number, panX: number, panY: number}} - Active canvas transform
 */
function getActiveCanvasTransform() {
  //widget
  const currentCanvasType = getCurrentCanvasType();
  //widget
  const canvasEl = currentCanvasType === 'dm'
    //widget
    ? document.getElementById('dm-canvas-container')
    //widget
    : document.getElementById('world');
  //widget

  //widget
  if (!canvasEl) {
    //widget
    return { scale: getScale(), panX: getPanX(), panY: getPanY() };
    //widget
  }

  //widget
  const transform = window.getComputedStyle(canvasEl).transform;
  //widget
  if (!transform || transform === 'none') {
    //widget
    return { scale: 1, panX: 0, panY: 0 };
    //widget
  }

  //widget
  try {
    //widget
    let matrix = null;
    //widget
    if (typeof DOMMatrixReadOnly !== 'undefined') {
      //widget
      matrix = new DOMMatrixReadOnly(transform);
      //widget
    } else if (typeof WebKitCSSMatrix !== 'undefined') {
      //widget
      matrix = new WebKitCSSMatrix(transform);
      //widget
    }
    //widget

    //widget
    if (matrix) {
      //widget
      const scale = Number.isFinite(matrix.a) && matrix.a !== 0 ? matrix.a : 1;
      //widget
      const panX = Number.isFinite(matrix.e) ? matrix.e : 0;
      //widget
      const panY = Number.isFinite(matrix.f) ? matrix.f : 0;
      //widget
      return { scale, panX, panY };
      //widget
    }
  } catch (error) {
    //widget - Fallback below
  }

  //widget
  return { scale: getScale(), panX: getPanX(), panY: getPanY() };
  //widget
}

function applyStickyDecoupleMetadataFromSnapshot(noteEl, snapshot) {
  if (!noteEl || !snapshot || typeof snapshot !== 'object') return;

  const metadataMappings = [
    ['stickyDecoupleCanvasWidth', snapshot.decoupleCanvasWidth],
    ['stickyDecoupleCanvasHeight', snapshot.decoupleCanvasHeight],
    ['stickyDecoupleDisplayWidth', snapshot.decoupleDisplayWidth],
    ['stickyDecoupleDisplayHeight', snapshot.decoupleDisplayHeight],
    ['stickyDecoupleZoom', snapshot.decoupleZoom]
  ];

  metadataMappings.forEach(([datasetKey, rawValue]) => {
    const numericValue = Number.parseFloat(rawValue);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      noteEl.dataset[datasetKey] = String(numericValue);
    }
  });
}

/**
 * //widget - Convert screen coordinates to canvas world coordinates
 * Uses same mathematical model as player canvas for consistency
 * @param {number} clientX - Screen X coordinate
 * @param {number} clientY - Screen Y coordinate
 * @param {number} scale - Current canvas scale
 * @param {number} panX - Current canvas pan X
 * @param {number} panY - Current canvas pan Y
 * @returns {{x: number, y: number}} - World coordinates
 */
function toWorldCoords(clientX, clientY, scale = 1, panX = 0, panY = 0) {
  //widget
  return {
    x: (clientX - panX) / scale,
    y: (clientY - panY) / scale
  };
  //widget
}

/**
 * //widget - Debounce helper for auto-save
 * @param {Function} func - Function to debounce
 * @param {number} wait - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, wait = 300) {
  //widget
  let timeout;
  //widget
  return function executedFunction(...args) {
    //widget
    const later = () => {
      //widget
      clearTimeout(timeout);
      //widget
      func(...args);
      //widget
    };
    //widget
    clearTimeout(timeout);
    //widget
    timeout = setTimeout(later, wait);
    //widget
  };
  //widget
}

//widget - Auto-save function with debounce
const autoSaveStickyNotes = debounce(() => {
  //widget
  if (typeof persistStickyNotesForContextKey === 'function') {
    //widget
    persistStickyNotesForContextKey();
    //widget
  }
  //widget
}, CONFIG.AUTO_SAVE_DELAY_MS);

const STICKY_OVERLAY_CONTEXT_KEY = 'overlay:global';
const STICKY_DEBUG_ENABLED = true;

function stickyDebug(message, details = null) {
  if (!STICKY_DEBUG_ENABLED) return;
  if (details && typeof details === 'object') {
    console.log(`[Sticky Debug] ${message}`, details);
  } else {
    console.log(`[Sticky Debug] ${message}`);
  }
}

function getCanvasStickyNotesContextKey(canvasType = getCurrentCanvasType()) {
  const normalizedCanvas = canvasType === 'dm' ? 'dm' : 'player';
  return `canvas:${normalizedCanvas}`;
}

function getStickySnapshotsForContext(noteSnapshots, contextKey) {
  const safeSnapshots = Array.isArray(noteSnapshots) ? noteSnapshots : [];
  if (!contextKey) return [];

  if (contextKey === STICKY_OVERLAY_CONTEXT_KEY) {
    return safeSnapshots.filter((noteSnapshot) => String(noteSnapshot?.mode || '').toLowerCase() === 'overlay');
  }

  if (contextKey.startsWith('canvas:')) {
    const targetCanvas = contextKey.slice('canvas:'.length) === 'dm' ? 'dm' : 'player';
    return safeSnapshots.filter((noteSnapshot) => {
      const mode = String(noteSnapshot?.mode || '').toLowerCase();
      const canvas = String(noteSnapshot?.canvas || '').toLowerCase();
      return mode === 'canvas' && canvas === targetCanvas;
    });
  }

  return [];
}

function writeStickyContextNotes(currentStore, contextKey, noteSnapshots) {
  if (!contextKey) return;
  const scopedNotes = getStickySnapshotsForContext(noteSnapshots, contextKey);
  if (scopedNotes.length === 0) {
    delete currentStore[contextKey];
    return;
  }

  currentStore[contextKey] = {
    updatedAt: Date.now(),
    visible: true,
    notes: scopedNotes
  };
}

/**
 * //widget - Get active sticky notes context key based on canvas type only
 * @returns {string} - Context key with canvas type
 */
function getActiveStickyNotesContextKey() {
  //widget
  const canvasType = getCurrentCanvasType();
  //widget
  //widget - Simple canvas-based key for temp memory persistence
  //widget
  return getCanvasStickyNotesContextKey(canvasType);
  //widget
}

/**
 * //widget - Clear all live sticky notes from DOM
 */
function clearLiveStickyNotes() {
  //widget
  console.log('[Sticky Notes] Clearing live sticky notes from DOM...');
  //widget
  const elements = getStickyNoteElements();
  //widget
  console.log(`[Sticky Notes] Found ${elements.length} elements to clear`);
  //widget
  elements.forEach((noteEl) => {
    //widget
    noteEl.remove();
    //widget
  });
  //widget
  stickyNoteStateById.clear();
  //widget
  stickyNoteSnapshotById.clear();
  //widget
  activeDraggingStickyNoteEl = null;
  //widget
  stickyNotesVisible = false;
  //widget
  stickyNoteToggleBtn?.classList.remove('active');
  //widget
  console.log('[Sticky Notes] Clear complete');
  //widget
}

/**
 * //widget - Persist sticky notes for context key to localStorage
 * @param {string} contextKey - Context key
 */
function persistStickyNotesForContextKey(contextKey = activeStickyNotesContextKey) {
  //widget
  if (isSyncingStickyNotesContext) return;
  //widget

  //widget
  const nextNotes = getStickyNoteElements()
    //widget
    .map((noteEl) => buildStickyNoteSnapshotFromElement(noteEl))
    //widget
    .filter((noteSnapshot) => !!noteSnapshot);
  //widget

  //widget
  const currentStore = getStickyNotesStorageBucket();

  stickyDebug('Persist start', {
    requestedContextKey: contextKey,
    activeContextKey: activeStickyNotesContextKey,
    totalLiveNotes: nextNotes.length,
    overlayLiveNotes: nextNotes.filter((noteSnapshot) => String(noteSnapshot?.mode || '').toLowerCase() === 'overlay').length,
    canvasLiveNotes: nextNotes.filter((noteSnapshot) => String(noteSnapshot?.mode || '').toLowerCase() === 'canvas').length,
    currentMode: getCurrentCanvasType()
  });

  // Separate overlay notes from canvas notes
  const overlayNotes = nextNotes.filter((noteSnapshot) => String(noteSnapshot?.mode || '').toLowerCase() === 'overlay');
  const canvasNotes = nextNotes.filter((noteSnapshot) => String(noteSnapshot?.mode || '').toLowerCase() === 'canvas');

  if (contextKey) {
    // Persist canvas notes to canvas context, overlay notes to overlay context
    writeStickyContextNotes(currentStore, contextKey, canvasNotes);
    writeStickyContextNotes(currentStore, STICKY_OVERLAY_CONTEXT_KEY, overlayNotes);
    stickyDebug('Persist scoped context complete', {
      contextKey,
      canvasCount: Array.isArray(currentStore[contextKey]?.notes) ? currentStore[contextKey].notes.length : 0,
      overlayCount: Array.isArray(currentStore[STICKY_OVERLAY_CONTEXT_KEY]?.notes) ? currentStore[STICKY_OVERLAY_CONTEXT_KEY].notes.length : 0
    });
  } else {
    const activeCanvasContextKey = getActiveStickyNotesContextKey();
    writeStickyContextNotes(currentStore, activeCanvasContextKey, canvasNotes);
    writeStickyContextNotes(currentStore, STICKY_OVERLAY_CONTEXT_KEY, overlayNotes);
    stickyDebug('Persist full context complete', {
      activeCanvasContextKey,
      activeCanvasCount: Array.isArray(currentStore[activeCanvasContextKey]?.notes) ? currentStore[activeCanvasContextKey].notes.length : 0,
      overlayContextKey: STICKY_OVERLAY_CONTEXT_KEY,
      overlayCount: Array.isArray(currentStore[STICKY_OVERLAY_CONTEXT_KEY]?.notes) ? currentStore[STICKY_OVERLAY_CONTEXT_KEY].notes.length : 0
    });
  }

  //widget
  setStickyNotesStorageBucket(currentStore);
  stickyDebug('Persist store keys', { keys: Object.keys(currentStore || {}) });
  //widget
}

/**
 * //widget - Sync sticky notes for active character buffer
 */
function syncStickyNotesForActiveBuffer() {
  //widget
  const nextContextKey = getActiveStickyNotesContextKey();
  //widget
  console.log(`[Sticky Notes] Sync requested. Current: ${activeStickyNotesContextKey}, Next: ${nextContextKey}`);
  //widget
  
  //widget - Only sync if context actually changed
  //widget
  if (nextContextKey === activeStickyNotesContextKey && !isSyncingStickyNotesContext) {
    //widget
    console.log('[Sticky Notes] Context unchanged, skipping sync');
    //widget
    return;
    //widget
  }

  //widget
  const previousContextKey = activeStickyNotesContextKey;
  //widget
  if (previousContextKey) {
    //widget
    persistStickyNotesForContextKey(previousContextKey);
    //widget
  }

  //widget
  activeStickyNotesContextKey = nextContextKey;
  //widget

  //widget
  const currentStore = getStickyNotesStorageBucket();
  stickyDebug('Sync store snapshot', {
    nextContextKey,
    activeContextKey: activeStickyNotesContextKey,
    storeKeys: Object.keys(currentStore || {})
  });
  //widget
  const storedCanvasPayload = currentStore[nextContextKey];
  const storedOverlayPayload = currentStore[STICKY_OVERLAY_CONTEXT_KEY];
  const storedCanvasNotesRaw = Array.isArray(storedCanvasPayload?.notes) ? storedCanvasPayload.notes : [];
  const storedOverlayNotesRaw = Array.isArray(storedOverlayPayload?.notes) ? storedOverlayPayload.notes : [];
  const storedCanvasNotes = getStickySnapshotsForContext(storedCanvasNotesRaw, nextContextKey);
  const storedOverlayNotes = getStickySnapshotsForContext(storedOverlayNotesRaw, STICKY_OVERLAY_CONTEXT_KEY);
  const storedNotes = [...storedOverlayNotes, ...storedCanvasNotes];
  stickyDebug('Sync resolved note sets', {
    nextContextKey,
    overlayContextKey: STICKY_OVERLAY_CONTEXT_KEY,
    overlayRaw: storedOverlayNotesRaw.length,
    overlayScoped: storedOverlayNotes.length,
    canvasRaw: storedCanvasNotesRaw.length,
    canvasScoped: storedCanvasNotes.length,
    totalToRestore: storedNotes.length,
    noteSummary: storedNotes.map((noteSnapshot) => ({
      id: noteSnapshot?.id,
      mode: noteSnapshot?.mode,
      canvas: noteSnapshot?.canvas
    }))
  });
  console.log(`[Sticky Notes] Found ${storedCanvasNotes.length} canvas notes and ${storedOverlayNotes.length} overlay notes for ${nextContextKey}`);
  //widget

  //widget
  isSyncingStickyNotesContext = true;
  window.__isStickyNotesSyncing = true;
  //widget
  try {
    clearLiveStickyNotes();

    storedNotes
      .slice(0, STICKY_NOTE_MAX_COUNT)
      .forEach((storedNoteSnapshot) => {
        stickyDebug('Sync restore note', {
          id: storedNoteSnapshot?.id,
          mode: storedNoteSnapshot?.mode,
          canvas: storedNoteSnapshot?.canvas
        });
        createStickyNote(storedNoteSnapshot);
      });

    setStickyNotesVisible(storedNotes.length > 0);
    if (storedNotes.length > 0) {
      console.log(`[Sticky Notes] Restored ${storedNotes.length} notes`);
    } else {
      console.log('[Sticky Notes] No saved notes to restore');
    }
    //widget
  } finally {
    //widget
    isSyncingStickyNotesContext = false;
    window.__isStickyNotesSyncing = false;
    //widget
  }
}

/**
 * //widget - Save snapshot of single sticky note
 * @param {HTMLElement} noteEl - Note element
 */
function saveStickyNoteSnapshot(noteEl) {
  //widget
  const nextSnapshot = buildStickyNoteSnapshotFromElement(noteEl);
  //widget
  if (!nextSnapshot) return;
  //widget

  //widget
  stickyNoteSnapshotById.set(nextSnapshot.id, nextSnapshot);
  //widget
  persistStickyNotesForContextKey();
  //widget
  //widget - Trigger debounced auto-save
  //widget
  autoSaveStickyNotes();
  //widget
}

/**
 * //widget - Save snapshots of all sticky notes
 */
function saveAllStickyNoteSnapshots() {
  //widget
  getStickyNoteElements().forEach((noteEl) => {
    //widget
    saveStickyNoteSnapshot(noteEl);
    //widget
  });
}

/**
 * //widget - Apply snapshot to sticky note element
 * @param {HTMLElement} noteEl - Note element
 */
function applyStickyNoteSnapshot(noteEl) {
  //widget
  const stickyNoteId = getStickyNoteIdFromElement(noteEl);
  //widget
  if (!stickyNoteId || !noteEl) return;
  //widget

  //widget
  const snapshot = stickyNoteSnapshotById.get(stickyNoteId);
  //widget
  if (!snapshot) {
    //widget
    return;
    //widget
  }

  //widget - Only clamp overlay sticky notes, not canvas sticky notes
  if (!noteEl.classList.contains('canvas-sticky-note')) {
    //widget
    const clamped = clampStickyNotePosition(snapshot.left, snapshot.top, snapshot.width || 240, snapshot.height || 240);
    //widget
    noteEl.style.left = `${clamped.left}px`;
    //widget
    noteEl.style.top = `${clamped.top}px`;
    //widget
  } else {
    //widget
    if (typeof snapshot.left === 'undefined' || typeof snapshot.top === 'undefined') {
      //widget
    } else {
      //widget
      noteEl.style.left = `${snapshot.left}px`;
      //widget
      noteEl.style.top = `${snapshot.top}px`;
      //widget
    }
  }

  //widget - Update decouple button state based on mode
  //widget
  const decoupleBtn = noteEl.querySelector('.sticky-note-decouple-btn');
  //widget
  if (decoupleBtn) {
    //widget
    const isDecoupled = noteEl.dataset.stickyNoteMode === 'overlay';
    //widget
    decoupleBtn.classList.toggle('active', isDecoupled);
    //widget
  }

  //widget
  if (Number.isFinite(snapshot.width) && snapshot.width > 0) {
    //widget
    noteEl.style.width = `${Math.min(420, Math.max(170, snapshot.width))}px`;
    //widget
  }
  //widget
  if (Number.isFinite(snapshot.height) && snapshot.height > 0) {
    //widget
    noteEl.style.height = `${Math.min(420, Math.max(170, snapshot.height))}px`;
    //widget
  }
  //widget
  noteEl.classList.toggle('collapsed', !!snapshot.collapsed);
  //widget

  //widget
  const titleEl = noteEl.querySelector('.sticky-note-title');
  //widget
  const bodyEl = noteEl.querySelector('.sticky-note-body');
  //widget
  if (titleEl) {
    //widget
    titleEl.textContent = normalizeStickyNoteTitle(snapshot.title || '', 'STICKY NOTE');
    //widget
  }
  //widget
  if (bodyEl) {
    //widget
    bodyEl.value = String(snapshot.body || '').slice(0, STICKY_NOTE_TEXT_MAX_CHARS);
    //widget
  }
}

/**
 * //widget - Toggle sticky note collapsed state
 * @param {HTMLElement} noteEl - Note element
 */
function toggleStickyNoteCollapsedState(noteEl) {
  //widget
  if (!noteEl) return;
  //widget
  const isCollapsed = noteEl.classList.contains('collapsed');
  //widget

  //widget
  if (!isCollapsed) {
    //widget
    noteEl.dataset.prevHeight = String(noteEl.offsetHeight || 240);
    //widget
    noteEl.classList.add('collapsed');
    //widget
    saveStickyNoteSnapshot(noteEl);
    //widget
    return;
    //widget
  }

  //widget
  noteEl.classList.remove('collapsed');
  //widget
  const previousHeight = Number.parseInt(noteEl.dataset.prevHeight || '0', 10);
  //widget
  if (Number.isFinite(previousHeight) && previousHeight > 30) {
    //widget
    noteEl.style.height = `${Math.min(420, Math.max(170, previousHeight))}px`;
    //widget
  }
  //widget
  saveStickyNoteSnapshot(noteEl);
  //widget
}

/**
 * //widget - Normalize sticky note title
 * @param {string} rawTitleText - Raw title text
 * @param {string} fallbackText - Fallback text
 * @returns {string} - Normalized title
 */
function normalizeStickyNoteTitle(rawTitleText, fallbackText) {
  //widget
  const fallback = String(fallbackText || 'STICKY NOTE');
  //widget
  const normalizedRawText = String(rawTitleText || '')
    //widget
    .replace(/^\s*sticky\s+note\s*\d+\s*$/i, 'STICKY NOTE');
  //widget
  const normalizedText = normalizedRawText
    //widget
    .replace(/\s+/g, ' ')
    //widget
    .trim()
    //widget
    .slice(0, STICKY_NOTE_TITLE_MAX_CHARS);
  //widget
  return normalizedText || fallback;
  //widget
}

/**
 * //widget - Escape sticky note text for log output
 * @param {string} rawText - Raw text
 * @returns {string} - Escaped text
 */
function escapeStickyNoteLogText(rawText) {
  //widget
  return String(rawText || '')
    //widget
    .replace(/&/g, '&amp;')
    //widget
    .replace(/</g, '&lt;')
    //widget
    .replace(/>/g, '&gt;')
    //widget
    .replace(/"/g, '&quot;')
    //widget
    .replace(/'/g, '&#39;');
  //widget
}

/**
 * //widget - Restore deleted sticky note from undo token
 * @param {string} undoToken - Undo token
 * @returns {boolean} - Success status
 */
function restoreDeletedStickyNoteFromUndoToken(undoToken) {
  //widget
  const undoPayload = stickyNoteDeleteUndoSnapshotsByToken.get(undoToken);
  //widget
  if (!undoPayload) return false;
  //widget

  //widget
  const currentContextKey = getActiveStickyNotesContextKey();
  //widget
  if (undoPayload.contextKey !== currentContextKey) {
    //widget
    return false;
    //widget
  }

  //widget
  const restoredNote = createStickyNote(undoPayload.snapshot);
  //widget
  if (!restoredNote) {
    //widget
    return false;
    //widget
  }

  //widget
  stickyNoteDeleteUndoSnapshotsByToken.delete(undoToken);
  //widget
  setStickyNotesVisible(true);
  //widget
  persistStickyNotesForContextKey();
  //widget
  return true;
  //widget
}

/**
 * //widget - Enable title editing on sticky note
 * @param {HTMLElement} noteEl - Note element
 * @param {HTMLElement} titleEl - Title element
 */
function enableStickyNoteTitleEditing(noteEl, titleEl) {
  //widget
  if (!noteEl || !titleEl) return;
  //widget
  if (titleEl.getAttribute('contenteditable') === 'true') return;
  //widget

  //widget
  titleEl.dataset.originalTitle = titleEl.textContent || '';
  //widget
  titleEl.setAttribute('contenteditable', 'true');
  //widget
  titleEl.focus();
  //widget

  //widget
  const selection = window.getSelection?.();
  //widget
  if (selection && document.createRange) {
    //widget
    const range = document.createRange();
    //widget
    range.selectNodeContents(titleEl);
    //widget
    range.collapse(false);
    //widget
    selection.removeAllRanges();
    //widget
    selection.addRange(range);
    //widget
  }
}

/**
 * //widget - Finalize title editing on sticky note
 * @param {HTMLElement} noteEl - Note element
 * @param {HTMLElement} titleEl - Title element
 * @param {boolean} shouldRestoreOriginal - Restore original title
 */
function finalizeStickyNoteTitleEditing(noteEl, titleEl, shouldRestoreOriginal = false) {
  //widget
  if (!noteEl || !titleEl) return;
  //widget
  if (titleEl.getAttribute('contenteditable') !== 'true') return;
  //widget

  //widget
  const stickyNoteId = getStickyNoteIdFromElement(noteEl);
  //widget
  const fallbackTitle = 'STICKY NOTE';
  //widget
  const sourceTitle = shouldRestoreOriginal
    //widget
    ? (titleEl.dataset.originalTitle || fallbackTitle)
    //widget
    : (titleEl.textContent || fallbackTitle);
  //widget
  titleEl.textContent = normalizeStickyNoteTitle(sourceTitle, fallbackTitle);
  //widget
  titleEl.removeAttribute('contenteditable');
  //widget
  delete titleEl.dataset.originalTitle;
  //widget
  saveStickyNoteSnapshot(noteEl);
  //widget
}

/**
 * //widget - Toggle sticky note between canvas and overlay mode
 * @param {HTMLElement} noteEl - Note element
 */
function toggleStickyNoteMode(noteEl) {
  //mv:widget //state:overlay<->canvas //rel:parent=sticky-note child=mode-conversion
  //widget
  if (!noteEl) return;
  //widget

  //widget
  const currentMode = noteEl.dataset.stickyNoteMode;
  //widget
  const noteId = noteEl.dataset.stickyNoteId;
  //widget
  const currentCanvas = noteEl.dataset.stickyNoteCanvas || 'player';
  stickyDebug('Toggle mode requested', {
    noteId,
    currentMode,
    currentCanvas,
    dmActive: !!window.dmModeManager?.isActive
  });
  //widget
  const decoupleBtn = noteEl.querySelector('.sticky-note-decouple-btn');
  //widget

  //widget
  if (currentMode === 'canvas') {
    //widget - COUPLED → DECOUPLED: Convert canvas note to overlay
    //mv:widget //state:canvas->overlay //rel:parent=.canvas-sticky-note child=.sticky-note-window
    const noteRect = noteEl.getBoundingClientRect();
    const sourceCenterX = noteRect.left + (noteRect.width / 2);
    const sourceCenterY = noteRect.top + (noteRect.height / 2);
    const sourceWidth = noteRect.width || noteEl.offsetWidth || 240;
    const sourceHeight = noteRect.height || noteEl.offsetHeight || 240;
    const decoupleCanvasWidth = noteEl.offsetWidth || 240;
    const decoupleCanvasHeight = noteEl.offsetHeight || 240;
    const overlayWidth = decoupleCanvasWidth;
    const overlayHeight = decoupleCanvasHeight;
    const sourceTitle = noteEl.querySelector('.sticky-note-title')?.textContent || 'STICKY NOTE';
    const sourceBody = noteEl.querySelector('.sticky-note-body')?.value || '';
    const overlayLeft = sourceCenterX - (overlayWidth / 2);
    const overlayTop = sourceCenterY - (overlayHeight / 2);
    const { scale: activeScale } = getActiveCanvasTransform();
    const decoupleZoom = Math.max(0.001, activeScale || 1);

    //widget - Remove canvas note
    //widget
    noteEl.remove();
    //widget

    //widget - Create overlay note at converted screen position
    //widget
    const overlayNote = createStickyNote({
      //widget
      id: parseInt(noteId),
      //widget
      left: overlayLeft,
      //widget
      top: overlayTop,
      //widget
      width: overlayWidth,
      //widget
      height: overlayHeight,
      //widget
      title: sourceTitle,
      //widget
      body: sourceBody,
      //widget
      decoupleCanvasWidth,
      //widget
      decoupleCanvasHeight,
      //widget
      decoupleDisplayWidth: overlayWidth,
      //widget
      decoupleDisplayHeight: overlayHeight,
      //widget
      decoupleZoom
      //widget
    }, true);

    overlayNote.dataset.stickyDecoupleCanvasWidth = String(decoupleCanvasWidth);
    overlayNote.dataset.stickyDecoupleCanvasHeight = String(decoupleCanvasHeight);
    overlayNote.dataset.stickyDecoupleDisplayWidth = String(overlayWidth);
    overlayNote.dataset.stickyDecoupleDisplayHeight = String(overlayHeight);
    overlayNote.dataset.stickyDecoupleZoom = String(decoupleZoom);

    //widget - Copy collapsed state
    //widget
    if (noteEl.classList.contains('collapsed')) {
      //widget
      overlayNote.classList.add('collapsed');
      //widget
    }
    stickyDebug('Toggle mode complete (canvas->overlay)', {
      noteId,
      resultMode: overlayNote?.dataset?.stickyNoteMode,
      resultCanvas: overlayNote?.dataset?.stickyNoteCanvas
    });
    //widget
  } else {
    //widget - DECOUPLED → COUPLED: Convert overlay note to canvas mode
    //mv:widget //state:overlay->canvas //rel:parent=.sticky-note-window child=.canvas-sticky-note
    const noteRect = noteEl.getBoundingClientRect();
    const sourceCenterX = noteRect.left + (noteRect.width / 2);
    const sourceCenterY = noteRect.top + (noteRect.height / 2);
    const sourceWidth = noteRect.width || noteEl.offsetWidth || 240;
    const sourceHeight = noteRect.height || noteEl.offsetHeight || 240;
    const sourceTitle = noteEl.querySelector('.sticky-note-title')?.textContent || 'STICKY NOTE';
    const sourceBody = noteEl.querySelector('.sticky-note-body')?.value || '';

    const { scale: activeScale, panX: activePanX, panY: activePanY } = getActiveCanvasTransform();
    const currentZoom = Math.max(0.001, activeScale);
    const canvasCenterX = (sourceCenterX - activePanX) / currentZoom;
    const canvasCenterY = (sourceCenterY - activePanY) / currentZoom;
    const baselineCanvasWidth = Number.parseFloat(noteEl.dataset.stickyDecoupleCanvasWidth || '');
    const baselineCanvasHeight = Number.parseFloat(noteEl.dataset.stickyDecoupleCanvasHeight || '');
    const baselineDisplayWidth = Number.parseFloat(noteEl.dataset.stickyDecoupleDisplayWidth || '');
    const baselineDisplayHeight = Number.parseFloat(noteEl.dataset.stickyDecoupleDisplayHeight || '');
    const hasBaselineCanvasSize = Number.isFinite(baselineCanvasWidth)
      && Number.isFinite(baselineCanvasHeight)
      && baselineCanvasWidth > 0
      && baselineCanvasHeight > 0;
    const overlaySizeUnchanged = Number.isFinite(baselineDisplayWidth)
      && Number.isFinite(baselineDisplayHeight)
      && Math.abs(sourceWidth - baselineDisplayWidth) <= 1
      && Math.abs(sourceHeight - baselineDisplayHeight) <= 1;
    const useBaselineCanvasSize = overlaySizeUnchanged && hasBaselineCanvasSize;
    const defaultCanvasStickySize = 240;
    const appearsUnresizedOverlayWithoutBaseline = !hasBaselineCanvasSize
      && Math.abs(sourceWidth - defaultCanvasStickySize) <= 1
      && Math.abs(sourceHeight - defaultCanvasStickySize) <= 1;
    const canvasWidth = useBaselineCanvasSize
      ? baselineCanvasWidth
      : (appearsUnresizedOverlayWithoutBaseline ? defaultCanvasStickySize : (sourceWidth / currentZoom));
    const canvasHeight = useBaselineCanvasSize
      ? baselineCanvasHeight
      : (appearsUnresizedOverlayWithoutBaseline ? defaultCanvasStickySize : (sourceHeight / currentZoom));
    const activeCanvasType = getCurrentCanvasType();
    const firstIntersectingCanvasNote = findFirstIntersectingCanvasStickyNote(activeCanvasType, noteRect);
    const firstIntersectingRect = firstIntersectingCanvasNote?.getBoundingClientRect?.();
    const shouldCascadeFromUnderlyingNote = !!firstIntersectingCanvasNote
      && !!firstIntersectingRect
      && (sourceWidth > (firstIntersectingRect.width + 1) || sourceHeight > (firstIntersectingRect.height + 1));

    let targetCanvasCenterX = canvasCenterX;
    let targetCanvasCenterY = canvasCenterY;
    if (shouldCascadeFromUnderlyingNote) {
      const underlyingLeft = Number.parseFloat(firstIntersectingCanvasNote.style.left || '');
      const underlyingTop = Number.parseFloat(firstIntersectingCanvasNote.style.top || '');
      const underlyingWidth = Number.parseFloat(firstIntersectingCanvasNote.style.width || '');
      const underlyingHeight = Number.parseFloat(firstIntersectingCanvasNote.style.height || '');
      const hasUnderlyingGeometry = Number.isFinite(underlyingLeft)
        && Number.isFinite(underlyingTop)
        && Number.isFinite(underlyingWidth)
        && Number.isFinite(underlyingHeight)
        && underlyingWidth > 0
        && underlyingHeight > 0;

      if (hasUnderlyingGeometry) {
        const cascadePosition = findNextCascadePosition(
          activeCanvasType,
          underlyingLeft + (underlyingWidth / 2),
          underlyingTop + (underlyingHeight / 2)
        );
        targetCanvasCenterX = cascadePosition.x;
        targetCanvasCenterY = cascadePosition.y;
      }
    }

    const canvasLeft = targetCanvasCenterX - (canvasWidth / 2);
    const canvasTop = targetCanvasCenterY - (canvasHeight / 2);

    //widget - Remove overlay note
    //widget
    noteEl.remove();
    //widget

    //widget - Create canvas note at converted canvas position
    //widget
    const canvasNote = createStickyNote({
      //widget
      id: parseInt(noteId),
      //widget
      left: canvasLeft,
      //widget
      top: canvasTop,
      //widget
      width: canvasWidth,
      //widget
      height: canvasHeight,
      //widget
      title: sourceTitle,
      //widget
      body: sourceBody
      //widget
    }, false);

    //widget - Copy collapsed state
    //widget
    if (noteEl.classList.contains('collapsed')) {
      //widget
      canvasNote.classList.add('collapsed');
      //widget
    }
    stickyDebug('Toggle mode complete (overlay->canvas)', {
      noteId,
      resultMode: canvasNote?.dataset?.stickyNoteMode,
      resultCanvas: canvasNote?.dataset?.stickyNoteCanvas
    });
  }
}

/**
 * //widget - Register event listeners on sticky note element
 * @param {HTMLElement} noteEl - Note element
 */
function registerStickyNoteElement(noteEl) {
  //widget
  if (!noteEl) return;
  //widget

  //widget
  const stickyNoteId = getStickyNoteIdFromElement(noteEl);
  //widget
  if (!stickyNoteId) return;
  //widget

  //widget
  const headerEl = noteEl.querySelector('.sticky-note-header');
  //widget
  const closeEl = noteEl.querySelector('.sticky-note-close');
  //widget
  const bodyEl = noteEl.querySelector('.sticky-note-body');
  //widget
  const titleEl = noteEl.querySelector('.sticky-note-title');
  //widget
  if (!headerEl || !closeEl || !bodyEl || !titleEl) return;
  //widget

  //widget
  stickyNoteStateById.set(stickyNoteId, {
    //widget
    noteEl,
    //widget
    headerEl,
    //widget
    closeEl,
    //widget
    bodyEl,
    //widget
    titleEl
    //widget
  });
  //widget

  //widget
  bodyEl.setAttribute('maxlength', String(STICKY_NOTE_TEXT_MAX_CHARS));
  //widget

  //widget - Bring canvas sticky note to front on mousedown
  //widget
  if (noteEl.classList.contains('canvas-sticky-note')) {
    //widget
    noteEl.addEventListener('mousedown', (e) => {
      //mv:widget //state:canvas //rel:child=.canvas-sticky-note -> parent=active-canvas-container
      //widget
      if (e.target.closest('.sticky-note-decouple-btn, .sticky-note-close')) return;
      //widget
      bringCanvasHierarchyToFront(noteEl);
      //widget
    });
  } else {
    noteEl.addEventListener('mousedown', () => {
      if (typeof window.setFloatingWindowPrimary === 'function') {
        window.setFloatingWindowPrimary('sticky-note', noteEl);
      }
    });
    noteEl.addEventListener('touchstart', () => {
      if (typeof window.setFloatingWindowPrimary === 'function') {
        window.setFloatingWindowPrimary('sticky-note', noteEl);
      }
    }, { passive: true });
  }

  //widget
  let stickyTitleLongPressTimerId = null;
  //widget
  const cancelStickyTitleLongPress = () => {
    //widget
    if (!stickyTitleLongPressTimerId) return;
    //widget
    clearTimeout(stickyTitleLongPressTimerId);
    //widget
    stickyTitleLongPressTimerId = null;
    //widget
  };
  //widget

  //widget
  headerEl.addEventListener('mousedown', (event) => {
    tryStartStickyHeaderDrag(noteEl, titleEl, event);
  });
  //widget

  //widget - Touch support for header drag
  headerEl.addEventListener('touchstart', (event) => {
    tryStartStickyHeaderDrag(noteEl, titleEl, event);
  }, { passive: false });
  //widget

  //widget
  titleEl.addEventListener('mousedown', (event) => {
    //widget
    if (event.button !== 0) return;
    //widget
    event.stopPropagation();
    //widget
    cancelStickyTitleLongPress();
    //widget
    stickyTitleLongPressTimerId = setTimeout(() => {
      //widget
      stickyTitleLongPressTimerId = null;
      //widget
      enableStickyNoteTitleEditing(noteEl, titleEl);
      //widget
    }, STICKY_NOTE_TITLE_LONG_PRESS_MS);
    //widget
  });
  //widget

  //widget
  titleEl.addEventListener('mouseup', () => {
    //widget
    cancelStickyTitleLongPress();
    //widget
  });
  //widget

  //widget
  titleEl.addEventListener('mouseleave', () => {
    //widget
    cancelStickyTitleLongPress();
    //widget
  });
  //widget

  //widget
  titleEl.addEventListener('blur', () => {
    //widget
    finalizeStickyNoteTitleEditing(noteEl, titleEl, false);
    //widget
  });
  //widget

  //widget
  titleEl.addEventListener('keydown', (event) => {
    //widget
    if (titleEl.getAttribute('contenteditable') !== 'true') return;
    //widget
    if (event.key === 'Enter') {
      //widget
      event.preventDefault();
      //widget
      titleEl.blur();
      //widget
      return;
      //widget
    }
    //widget
    if (event.key === 'Escape') {
      //widget
      event.preventDefault();
      //widget
      finalizeStickyNoteTitleEditing(noteEl, titleEl, true);
      //widget
      return;
      //widget
    }
    //widget
    if (event.key.length === 1) {
      //widget
      const currentTitleText = titleEl.textContent || '';
      //widget
      if (currentTitleText.length >= STICKY_NOTE_TITLE_MAX_CHARS) {
        //widget
        event.preventDefault();
        //widget
      }
    }
  });
  //widget

  //widget
  closeEl.addEventListener('click', (event) => {
    //widget
    event.stopPropagation();
    //widget
    cancelStickyTitleLongPress();
    //widget
    const deletedNoteSnapshot = buildStickyNoteSnapshotFromElement(noteEl);
    //widget
    saveStickyNoteSnapshot(noteEl);
    //widget
    stickyNoteStateById.delete(stickyNoteId);
    //widget
    stickyNoteSnapshotById.delete(stickyNoteId);
    //widget
    if (activeDraggingStickyNoteEl === noteEl) {
      //widget
      endActiveStickyNoteDrag();
      //widget
    }
    //widget
    noteEl.remove();
    //widget
    updateStickyNoteBufferList();
    //widget
    stickyNotesVisible = stickyNoteStateById.size > 0 && stickyNotesVisible;
    //widget
    stickyNoteToggleBtn?.classList.toggle('active', !!stickyNotesVisible);
    //widget
    persistStickyNotesForContextKey();
    //widget

    //widget
    if (deletedNoteSnapshot) {
      //widget
      const undoToken = `sticky_undo_${stickyNoteDeleteUndoTokenCounter++}`;
      //widget
      stickyNoteDeleteUndoSnapshotsByToken.set(undoToken, {
        //widget
        contextKey: activeStickyNotesContextKey,
        //widget
        snapshot: deletedNoteSnapshot,
        //widget
        createdAt: Date.now()
        //widget
      });
      //widget

      //widget
      const safeDeletedTitle = escapeStickyNoteLogText(deletedNoteSnapshot.title || 'STICKY NOTE');
      //widget
      addLogEntry(
        //widget
        `<b>Sticky Note Deleted:</b> ${safeDeletedTitle} <span class="sticky-note-undo-link" data-sticky-note-undo-token="${undoToken}" style="display:inline-block; margin-left:6px; padding:1px 8px; border-radius:4px; background:#facc15; color:#1f2937; font-weight:800; cursor:pointer;">UNDO</span>`,
        //widget
        'normal'
        //widget
      );
    }
  });
  //widget

  //widget - Touch support for close button
  closeEl.addEventListener('touchstart', (event) => {
    //widget
    event.stopPropagation();
    //widget
    event.preventDefault();
    //widget
  }, { passive: false });
  //widget

  closeEl.addEventListener('touchend', (event) => {
    //widget
    event.stopPropagation();
    //widget
    event.preventDefault();
    //widget
    const deletedNoteSnapshot = buildStickyNoteSnapshotFromElement(noteEl);
    //widget
    saveStickyNoteSnapshot(noteEl);
    //widget
    stickyNoteStateById.delete(stickyNoteId);
    //widget
    stickyNoteSnapshotById.delete(stickyNoteId);
    //widget
    if (activeDraggingStickyNoteEl === noteEl) {
      //widget
      endActiveStickyNoteDrag();
      //widget
    }
    //widget
    noteEl.remove();
    //widget
    updateStickyNoteBufferList();
    //widget
    stickyNotesVisible = stickyNoteStateById.size > 0 && stickyNotesVisible;
    //widget
    stickyNoteToggleBtn?.classList.toggle('active', !!stickyNotesVisible);
    //widget
    persistStickyNotesForContextKey();
    //widget

    //widget
    if (deletedNoteSnapshot) {
      //widget
      const undoToken = `sticky_undo_${stickyNoteDeleteUndoTokenCounter++}`;
      //widget
      stickyNoteDeleteUndoSnapshotsByToken.set(undoToken, {
        //widget
        contextKey: activeStickyNotesContextKey,
        //widget
        snapshot: deletedNoteSnapshot,
        //widget
        createdAt: Date.now()
        //widget
      });
      //widget

      //widget
      const safeDeletedTitle = escapeStickyNoteLogText(deletedNoteSnapshot.title || 'STICKY NOTE');
      //widget
      addLogEntry(
        //widget
        `<b>Sticky Note Deleted:</b> ${safeDeletedTitle} <span class="sticky-note-undo-link" data-sticky-note-undo-token="${undoToken}" style="display:inline-block; margin-left:6px; padding:1px 8px; border-radius:4px; background:#facc15; color:#1f2937; font-weight:800; cursor:pointer;">UNDO</span>`,
        //widget
        'normal'
        //widget
      );
    }
  });

  //widget - Isolate note body interactions from canvas pan (including textarea resize handle drag)
  bodyEl.addEventListener('mousedown', (event) => {
    beginStickyBodyInteraction(event);
  });

  bodyEl.addEventListener('touchstart', (event) => {
    beginStickyBodyInteraction(event);
  }, { passive: true });

  bodyEl.addEventListener('pointerdown', (event) => {
    beginStickyBodyInteraction(event);
  });

  bodyEl.addEventListener('mouseup', () => {
    endStickyBodyInteraction();
  });

  bodyEl.addEventListener('pointerup', () => {
    endStickyBodyInteraction();
  });

  bodyEl.addEventListener('touchend', () => {
    endStickyBodyInteraction();
  }, { passive: true });

  bodyEl.addEventListener('blur', () => {
    endStickyBodyInteraction();
  });
  //widget

  //widget
  bodyEl.addEventListener('input', () => {
    //widget
    if ((bodyEl.value || '').length > STICKY_NOTE_TEXT_MAX_CHARS) {
      //widget
      bodyEl.value = bodyEl.value.slice(0, STICKY_NOTE_TEXT_MAX_CHARS);
      //widget
    }
    //widget
    saveStickyNoteSnapshot(noteEl);
    //widget
  });
}

/**
 * //widget - Set sticky notes visibility state
 * @param {boolean} shouldShowNotes - Visibility state
 */
function setStickyNotesVisible(shouldShowNotes) {
  //widget - DEPRECATED: No longer controls button appearance or visibility
  //widget - Function kept for backward compatibility but does nothing
  //widget
  return;
  //widget
}

/**
 * //widget - Start sticky toggle long press timer
 */
function startStickyToggleLongPress() {
  //widget
  if (!stickyNoteToggleBtn) return;
  //widget
  stickyTogglePressStartTimestamp = Date.now();
  //widget
}

/**
 * //widget - Cancel sticky toggle long press timer
 */
function cancelStickyToggleLongPress() {
  //widget
  stickyTogglePressStartTimestamp = 0;
  //widget
}

/**
 * //widget - Create new sticky note
 * @param {object} initialSnapshot - Initial snapshot data
 * @param {boolean} forceOverlayMode - Force overlay mode
 * @returns {HTMLElement|null} - Created note element
 */
function createStickyNote(initialSnapshot = null, forceOverlayMode = false) {
  //widget
  if (!stickyNoteSeedEl) {
    //widget
    console.warn('[Sticky Note] Seed element not found');
    //widget
    return null;
    //widget
  }
  //widget

  //widget
  const preferredStickyNoteId = Number(initialSnapshot?.id);
  //widget
  const snapshotModeRaw = String(initialSnapshot?.mode || initialSnapshot?.stickyNoteMode || '').toLowerCase();
  //widget
  const snapshotMode = (snapshotModeRaw === 'canvas' || snapshotModeRaw === 'overlay') ? snapshotModeRaw : null;
  //widget
  const snapshotCanvasRaw = String(initialSnapshot?.canvas || initialSnapshot?.stickyNoteCanvas || '').toLowerCase();
  //widget
  const snapshotCanvas = (snapshotCanvasRaw === 'dm' || snapshotCanvasRaw === 'player') ? snapshotCanvasRaw : null;
  //widget
  const isCanvasMode = forceOverlayMode ? false : (snapshotMode ? snapshotMode === 'canvas' : true);
  //widget
  const nextNoteId = getLowestAvailableStickyNoteId(preferredStickyNoteId, isCanvasMode);
  //widget
  if (!Number.isFinite(nextNoteId)) {
    //widget
    console.warn('[Sticky Note] No available note ID');
    //widget
    return null;
    //widget
  }
  //widget

  //widget - Determine if note should be on canvas or overlay
  //widget
  const currentCanvasType = window.dmModeManager?.isActive ? 'dm' : 'player';
  //widget
  const targetCanvasType = snapshotCanvas || currentCanvasType;
  stickyDebug('Create note', {
    initialId: initialSnapshot?.id,
    requestedMode: snapshotMode,
    requestedCanvas: snapshotCanvas,
    forceOverlayMode,
    resolvedIsCanvasMode: isCanvasMode,
    resolvedTargetCanvas: targetCanvasType,
    currentCanvasType
  });
  //widget

  //widget
  let nextNoteElement;
  //widget

  //widget
  if (isCanvasMode) {
    //widget - Check canvas note limit before creating
    //widget
    if (!canCreateCanvasNote(targetCanvasType)) {
      //widget
      addLogEntry(`<b>Sticky Note Blocked:</b> ${targetCanvasType.toUpperCase()} canvas already has ${STICKY_NOTE_MAX_COUNT} notes. Delete or decouple a note first.`, 'normal');
      //widget
      return null;
      //widget
    }

    //widget - Create canvas sticky note (COUPLED - moves with canvas)
    //mv:widget //state:canvas //rel:parent=#canvas-sticky-notes-player|#canvas-sticky-notes-dm child=.canvas-sticky-note
    //widget
    nextNoteElement = document.createElement('div');
    //widget
    nextNoteElement.className = 'canvas-sticky-note';
    //widget
    nextNoteElement.innerHTML = `
      <div class="sticky-note-header">
        <span class="sticky-note-title">STICKY NOTE</span>
        <div class="sticky-note-actions">
          <div class="sticky-note-decouple-btn" title="Decouple: Toggle Canvas/Overlay Mode">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span class="close-btn sticky-note-close">&times;</span>
        </div>
      </div>
      <textarea class="sticky-note-body" placeholder="Enter note text..."></textarea>
    `;
    //widget

    //widget - Append to active canvas sticky notes container
    //rel:parent=canvasStickyNotesContainer child=nextNoteElement
    //widget
    const canvasStickyNotesContainer = targetCanvasType === 'dm'
      //widget
      ? document.getElementById('canvas-sticky-notes-dm')
      //widget
      : document.getElementById('canvas-sticky-notes-player');
    //widget
    
    //widget - Debug log for container lookup
    //widget
    console.log('[Sticky Note] Canvas type:', targetCanvasType);
    //widget
    console.log('[Sticky Note] DM container:', document.getElementById('canvas-sticky-notes-dm'));
    //widget
    console.log('[Sticky Note] Player container:', document.getElementById('canvas-sticky-notes-player'));
    //widget
    console.log('[Sticky Note] Target container:', canvasStickyNotesContainer);
    //widget
    
    //widget
    if (canvasStickyNotesContainer) {
      //widget
      canvasStickyNotesContainer.appendChild(nextNoteElement);
      //widget
      console.log('[Sticky Note] Note appended to container');
      //widget
    } else {
      //widget
      console.error('[Sticky Note] Canvas sticky notes container not found!');
      //widget
      addLogEntry(`<b>Sticky Note Error:</b> Canvas container not found for ${currentCanvasType} mode.`, 'normal');
      //widget
      return null;
      //widget
    }

    //widget
    nextNoteElement.dataset.stickyNoteId = String(nextNoteId);
    //widget
    nextNoteElement.dataset.stickyNoteMode = 'canvas';
    //widget
    nextNoteElement.dataset.stickyNoteCanvas = targetCanvasType;
    //widget
    applyStickyDecoupleMetadataFromSnapshot(nextNoteElement, initialSnapshot);
    //widget

    const hasSnapshotPosition = Number.isFinite(Number(initialSnapshot?.left)) && Number.isFinite(Number(initialSnapshot?.top));
    const hasSnapshotSize = Number.isFinite(Number(initialSnapshot?.width)) && Number.isFinite(Number(initialSnapshot?.height));

    if (hasSnapshotPosition) {
      const noteLeft = Number(initialSnapshot.left);
      const noteTop = Number(initialSnapshot.top);
      const noteWidth = hasSnapshotSize ? Number(initialSnapshot.width) : 240;
      const noteHeight = hasSnapshotSize ? Number(initialSnapshot.height) : 240;
      nextNoteElement.style.left = `${noteLeft}px`;
      nextNoteElement.style.top = `${noteTop}px`;
      nextNoteElement.style.width = `${Math.max(1, noteWidth)}px`;
      nextNoteElement.style.height = `${Math.max(1, noteHeight)}px`;
    } else {
      //widget - Place sticky note at the center of the visible canvas area
      //widget
      const viewportWidth = window.innerWidth;
      //widget
      const viewportHeight = window.innerHeight;
      //widget
      //widget - Get current pan and zoom
      //widget - Get current pan and zoom from the appropriate canvas
      //widget
      let zoom = 1;
      //widget
      let currentPanX = 0;
      //widget
      let currentPanY = 0;
      //widget
      const canvasEl = targetCanvasType === 'dm'
        //widget
        ? document.getElementById('dm-canvas-container')
        //widget
        : document.getElementById('world');
      //widget
      const transform = canvasEl ? (canvasEl.style.transform || window.getComputedStyle(canvasEl).transform) : '';
      //widget
      if (transform && transform.includes('scale')) {
        //widget
        const match = transform.match(/scale\(([^)]+)\)/);
        //widget
        if (match) zoom = parseFloat(match[1]);
        //widget
      }
      //widget
      if (transform && transform.includes('translate')) {
        //widget
        const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
        //widget
        if (match) {
          //widget
          currentPanX = parseFloat(match[1]);
          //widget
          currentPanY = parseFloat(match[2]);
          //widget
        }
      }
      //widget - Calculate center of viewport in canvas coordinates
      //widget
      const centerScreenX = viewportWidth / 2;
      //widget
      const centerScreenY = viewportHeight / 2;
      //widget
      const centerCanvasX = (centerScreenX - currentPanX) / zoom;
      //widget
      const centerCanvasY = (centerScreenY - currentPanY) / zoom;
      //widget
      //widget - Find next cascade position to avoid overlapping center points
      //widget
      const cascadePosition = findNextCascadePosition(targetCanvasType, centerCanvasX, centerCanvasY);
      //widget
      //widget - Note size at zoom 1
      //widget
      const baseNoteWidth = 240;
      //widget
      const baseNoteHeight = 240;
      //widget
      const noteWidth = baseNoteWidth;
      //widget
      const noteHeight = baseNoteHeight;
      //widget - Position note at cascade position (centered on cascade point)
      //widget
      nextNoteElement.style.left = `${cascadePosition.x - noteWidth / 2}px`;
      //widget
      nextNoteElement.style.top = `${cascadePosition.y - noteHeight / 2}px`;
      //widget
      nextNoteElement.style.width = `${noteWidth}px`;
      //widget
      nextNoteElement.style.height = `${noteHeight}px`;
      //widget
    }
    //widget
  } else {
    //widget - Create overlay sticky note (DECOUPLED - fixed position)
    //mv:widget //state:overlay //rel:parent=stickyNoteSeedEl.parentElement child=.sticky-note-window
    //widget
    nextNoteElement = stickyNoteSeedEl.cloneNode(true);
    //widget
    nextNoteElement.removeAttribute('id');
    //widget
    stickyNoteSeedEl.parentElement?.appendChild(nextNoteElement);
    //widget
    //widget
    nextNoteElement.dataset.stickyNoteId = String(nextNoteId);
    //widget
    nextNoteElement.dataset.stickyNoteMode = 'overlay';
    //widget
    nextNoteElement.dataset.stickyNoteCanvas = targetCanvasType;
    //widget
    applyStickyDecoupleMetadataFromSnapshot(nextNoteElement, initialSnapshot);
    //widget
    //widget - Update decouple button state for overlay mode
    //widget
    const decoupleBtn = nextNoteElement.querySelector('.sticky-note-decouple-btn');
    //widget
    if (decoupleBtn) {
      //widget
      decoupleBtn.classList.add('active');
      //widget
    }
    //widget
    //widget - Use provided position/size if available
    //widget
    if (initialSnapshot && typeof initialSnapshot.left === 'number') {
      //widget
      nextNoteElement.style.left = `${initialSnapshot.left}px`;
      //widget
      nextNoteElement.style.top = `${initialSnapshot.top}px`;
      //widget
      if (initialSnapshot.width) nextNoteElement.style.width = `${initialSnapshot.width}px`;
      //widget
      if (initialSnapshot.height) nextNoteElement.style.height = `${initialSnapshot.height}px`;
      //widget
    } else {
      //widget - Default overlay placement uses info-window center with cascade.
      const noteWidth = 240;
      const noteHeight = 240;
      const preferredCenter = resolvePreferredInfoWindowCenter();
      const baseLeft = preferredCenter.x - (noteWidth / 2);
      const baseTop = preferredCenter.y - (noteHeight / 2);
      const cascaded = findNextOverlayCascadePosition(baseLeft, baseTop);
      const clamped = clampStickyNotePosition(cascaded.left, cascaded.top, noteWidth, noteHeight);
      nextNoteElement.style.left = `${clamped.left}px`;
      nextNoteElement.style.top = `${clamped.top}px`;
    }
  }

  //widget
  nextNoteElement.classList.remove('hidden');
  //widget
  nextNoteElement.classList.remove('collapsed');
  //widget
  //widget - Only set default size if not already set
  //widget
  if (!nextNoteElement.style.width || nextNoteElement.style.width === '240px') {
    //widget
    nextNoteElement.style.width = '240px';
    //widget
  }
  //widget
  if (!nextNoteElement.style.height || nextNoteElement.style.height === '240px') {
    //widget
    nextNoteElement.style.height = '240px';
    //widget
  }

  //widget
  const titleEl = nextNoteElement.querySelector('.sticky-note-title');
  //widget
  const bodyEl = nextNoteElement.querySelector('.sticky-note-body');
  //widget
  //widget
  if (titleEl) titleEl.textContent = 'STICKY NOTE';
  //widget
  if (bodyEl) bodyEl.value = '';
  //widget

  //widget - Setup decouple button click handler
  //widget
  const decoupleBtn = nextNoteElement.querySelector('.sticky-note-decouple-btn');
  //widget
  if (decoupleBtn) {
    //widget
    decoupleBtn.addEventListener('click', (e) => {
      //widget
      e.stopPropagation();
      //widget
      toggleStickyNoteMode(nextNoteElement);
      //widget
    });
    //widget

    //widget - Touch support for decouple button
    decoupleBtn.addEventListener('touchstart', (e) => {
      //widget
      e.stopPropagation();
      //widget
      e.preventDefault();
      //widget
    }, { passive: false });
    //widget

    decoupleBtn.addEventListener('touchend', (e) => {
      //widget
      e.stopPropagation();
      //widget
      e.preventDefault();
      //widget
      toggleStickyNoteMode(nextNoteElement);
      //widget
    });
  }

  //widget
  registerStickyNoteElement(nextNoteElement);
  if (!nextNoteElement.classList.contains('canvas-sticky-note') && typeof window.setFloatingWindowPrimary === 'function') {
    window.setFloatingWindowPrimary('sticky-note', nextNoteElement);
  }
  //widget

  //widget
  if (initialSnapshot && typeof initialSnapshot === 'object') {
    //widget
    if (titleEl) {
      //widget
      titleEl.textContent = normalizeStickyNoteTitle(initialSnapshot.title || '', 'STICKY NOTE');
      //widget
    }
    //widget
    if (bodyEl) {
      //widget
      bodyEl.value = String(initialSnapshot.body || '').slice(0, STICKY_NOTE_TEXT_MAX_CHARS);
      //widget
    }
    //widget
    //widget
    const requestedWidth = Number(initialSnapshot.width);
    //widget
    const requestedHeight = Number(initialSnapshot.height);
    //widget
    const isCanvasStickyNote = nextNoteElement.classList.contains('canvas-sticky-note');
    const preserveOverlayDisplaySize = !isCanvasStickyNote && !!initialSnapshot?.preserveOverlayDisplaySize;
    if (Number.isFinite(requestedWidth) && requestedWidth > 0) {
      //widget
      const widthPx = (isCanvasStickyNote || preserveOverlayDisplaySize)
        ? requestedWidth
        : Math.min(420, Math.max(170, requestedWidth));
      //widget
      nextNoteElement.style.width = `${Math.max(1, widthPx)}px`;
      if (preserveOverlayDisplaySize) {
        nextNoteElement.style.minWidth = `${Math.max(1, Math.min(170, widthPx))}px`;
        nextNoteElement.style.maxWidth = `${Math.max(420, widthPx)}px`;
      }
      //widget
    }
    //widget
    if (Number.isFinite(requestedHeight) && requestedHeight > 0) {
      //widget
      const heightPx = (isCanvasStickyNote || preserveOverlayDisplaySize)
        ? requestedHeight
        : Math.min(420, Math.max(170, requestedHeight));
      //widget
      nextNoteElement.style.height = `${Math.max(1, heightPx)}px`;
      if (preserveOverlayDisplaySize) {
        nextNoteElement.style.minHeight = `${Math.max(1, Math.min(170, heightPx))}px`;
        nextNoteElement.style.maxHeight = `${Math.max(420, heightPx)}px`;
      }
      //widget
    }
    //widget
    //widget
    const noteWidth = nextNoteElement.offsetWidth || 240;
    //widget
    const noteHeight = nextNoteElement.offsetHeight || 240;
    //widget
    const requestedLeft = Number(initialSnapshot.left);
    //widget
    const requestedTop = Number(initialSnapshot.top);
    //widget
    if (Number.isFinite(requestedLeft) && Number.isFinite(requestedTop)) {
      //widget
      //widget - Only clamp overlay sticky notes
      //widget
      if (!nextNoteElement.classList.contains('canvas-sticky-note')) {
        //widget
        const clamped = clampStickyNotePosition(requestedLeft, requestedTop, noteWidth, noteHeight);
        //widget
        nextNoteElement.style.left = `${clamped.left}px`;
        //widget
        nextNoteElement.style.top = `${clamped.top}px`;
        //widget
      } else {
        //widget
        nextNoteElement.style.left = `${requestedLeft}px`;
        //widget
        nextNoteElement.style.top = `${requestedTop}px`;
        //widget
      }
    } else {
      //widget
      positionStickyNoteAboveButton(nextNoteElement);
      //widget
    }
    //widget
    //widget - Update decouple button state based on mode
    //widget
    const noteDecoupleBtn = nextNoteElement.querySelector('.sticky-note-decouple-btn');
    //widget
    if (noteDecoupleBtn) {
      //widget
      const isDecoupled = nextNoteElement.dataset.stickyNoteMode === 'overlay';
      //widget
      noteDecoupleBtn.classList.toggle('active', isDecoupled);
      //widget
    }
    //widget
    //widget
    nextNoteElement.classList.toggle('collapsed', !!initialSnapshot.collapsed);
    //widget
  } else {
    //widget
    positionStickyNoteAboveButton(nextNoteElement);
    //widget
  }

  //widget
  saveStickyNoteSnapshot(nextNoteElement);
  //widget
  updateStickyNoteBufferList();
  stickyDebug('Create note complete', {
    noteId: nextNoteElement?.dataset?.stickyNoteId,
    mode: nextNoteElement?.dataset?.stickyNoteMode,
    canvas: nextNoteElement?.dataset?.stickyNoteCanvas,
    left: nextNoteElement?.style?.left,
    top: nextNoteElement?.style?.top,
    width: nextNoteElement?.style?.width,
    height: nextNoteElement?.style?.height
  });
  //widget
  
  //widget
  return nextNoteElement;
  //widget
}

function logStickyNoteCreationFromOfficialButton(noteEl) {
  if (!noteEl || isSyncingStickyNotesContext || window.__isStickyNotesSyncing) return;

  const rawIdValue = Number.parseInt(String(noteEl.dataset.stickyNoteId || ''), 10);
  const noteIdText = Number.isFinite(rawIdValue) ? `Note #${rawIdValue}` : 'Sticky Note';
  const canvasType = String(noteEl.dataset.stickyNoteCanvas || getCurrentCanvasType() || 'player').toUpperCase();
  addLogEntry(`<b>Sticky Note Created:</b> ${noteIdText} on <b>${canvasType}</b> canvas.`, 'normal');
}

/**
 * //widget - Position sticky note above button (placeholder)
 * @param {HTMLElement} noteEl - Note element
 */
function positionStickyNoteAboveButton(noteEl) {
  //widget - Do not reposition note after creation
  //widget
  return;
  //widget
}

/**
 * //widget - Setup sticky note toggle button listeners
 */
function setupStickyNoteToggleListeners() {
  //widget
  if (!stickyNoteToggleBtn) return;
  //widget

  //widget - Footer sticky-note button is intentionally inert.
  //widget - Sticky-note creation now lives in widget popup menu button.
  //widget
  stickyNoteToggleBtn.addEventListener('click', (event) => {
    //widget
    event.stopPropagation();
    //widget
    event.preventDefault();
    //widget
  });
  //widget
}

/**
 * //widget - Bring canvas sticky note to front
 * @param {HTMLElement} noteEl - Note element
 */
function bringCanvasHierarchyToFront(noteEl) {
  //widget
  if (!noteEl) return;
  //widget
  noteEl.style.zIndex = String(canvasLayerCounter++);
  //widget
}

/**
 * //widget - Placeholder for addLogEntry (provided by main app)
 */
function addLogEntry() {
  //widget - Implemented in main index.html
  //widget
  if (typeof window.addLogEntry === 'function') {
    //widget
    return window.addLogEntry.apply(window, arguments);
    //widget
  }
}

//widget - Export for external access
//widget
window.initStickyNotes = initStickyNotes;
//widget
window.saveAllStickyNoteSnapshots = saveAllStickyNoteSnapshots;
//widget
window.cancelStickyToggleLongPress = cancelStickyToggleLongPress;
//widget
window.bringCanvasHierarchyToFront = bringCanvasHierarchyToFront;
//widget
window.syncStickyNotesForActiveBuffer = syncStickyNotesForActiveBuffer;
//widget
window.createStickyNote = createStickyNote;
//widget
window.toggleStickyNoteMode = toggleStickyNoteMode;
//widget
window.persistStickyNotesForContextKey = persistStickyNotesForContextKey;
//widget
window.restoreDeletedStickyNoteFromUndoToken = restoreDeletedStickyNoteFromUndoToken;

//widget - Canvas namespace for organized API
//widget
window.Canvas = window.Canvas || {};
//widget
window.Canvas.StickyNotes = {
  //widget
  create: createStickyNote,
  //widget
  toggle: toggleStickyNoteMode,
  //widget
  sync: syncStickyNotesForActiveBuffer,
  //widget
  persist: persistStickyNotesForContextKey,
  //widget
  // Helper to convert screen clicks to canvas world position
  screenToWorld: toWorldCoords,
  //widget
  // Auto-save trigger (debounced)
  triggerAutoSave: autoSaveStickyNotes
  //widget
};

//widget - Alias for backwards compatibility
//widget
window.ChainWarden = window.Canvas;

//widget - Legacy transform sync (kept for backwards compatibility)
//widget
window.setCanvasTransform = function(newScale, newPanX, newPanY) {
  //widget - Called by index.html to update transform state
  //widget
  setScale(newScale);
  //widget
  setPanX(newPanX);
  //widget
  setPanY(newPanY);
  //widget
};
//widget

//widget - Alias for backwards compatibility
//widget
window.setChainWardenTransform = window.setCanvasTransform;

//widget - Save notes before page unload/refresh
//widget
window.addEventListener('beforeunload', () => {
  persistStickyNotesForContextKey();
  //widget
  console.log('[Sticky Notes] Saved before page unload');
  //widget
});
//widget

//widget - DO NOT auto-initialize - called from index.html after DOM is ready
//widget
// initStickyNotes() is called from the main script in index.html
//widget

//widget ========== STICKY NOTE BUFFER (Overlay Window) ==========
//widget - Sticky note buffer drag state
let isDraggingBuffer = false;
let bufferDragStartX = 0;
let bufferDragStartY = 0;
let bufferStartLeft = 0;
let bufferStartTop = 0;
let bufferStartRight = 0;
let bufferStartBottom = 0;
const BUFFER_MIN_HEADER_VISIBLE_X = 24;
const BUFFER_MIN_HEADER_VISIBLE_Y = 24;

function getStickyNoteBufferUndoEntriesForContext(contextKey, createIfMissing = false) {
  const normalizedContextKey = String(contextKey || '__no_combatant__');
  if (!stickyNoteBufferUndoEntriesByContext.has(normalizedContextKey)) {
    if (!createIfMissing) return [];
    stickyNoteBufferUndoEntriesByContext.set(normalizedContextKey, []);
  }
  return stickyNoteBufferUndoEntriesByContext.get(normalizedContextKey) || [];
}

function enqueueStickyNoteBufferUndoSnapshot(snapshot, contextKey) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const normalizedContextKey = String(contextKey || getActiveStickyNotesContextKey() || '__no_combatant__');
  const contextEntries = getStickyNoteBufferUndoEntriesForContext(normalizedContextKey, true);
  const undoEntry = {
    id: `sticky_buffer_undo_${stickyNoteBufferUndoEntryCounter++}`,
    contextKey: normalizedContextKey,
    snapshot: JSON.parse(JSON.stringify(snapshot)),
    createdAt: Date.now()
  };
  contextEntries.unshift(undoEntry);
  return undoEntry;
}

function removeStickyNoteBufferUndoEntry(contextKey, undoEntryId) {
  const contextEntries = getStickyNoteBufferUndoEntriesForContext(contextKey, false);
  if (!contextEntries.length) return;
  const nextEntries = contextEntries.filter((entry) => String(entry?.id || '') !== String(undoEntryId || ''));
  stickyNoteBufferUndoEntriesByContext.set(String(contextKey || '__no_combatant__'), nextEntries);
}

function clearAllStickyNoteBufferUndoEntries() {
  stickyNoteBufferUndoEntriesByContext.clear();
}

function removeStickyNoteElementFromState(noteEl) {
  if (!noteEl) return null;
  const snapshot = buildStickyNoteSnapshotFromElement(noteEl);
  const stickyNoteId = getStickyNoteIdFromElement(noteEl);
  saveStickyNoteSnapshot(noteEl);
  if (Number.isFinite(stickyNoteId)) {
    stickyNoteStateById.delete(stickyNoteId);
    stickyNoteSnapshotById.delete(stickyNoteId);
  }
  if (activeDraggingStickyNoteEl === noteEl) {
    endActiveStickyNoteDrag();
  }
  noteEl.remove();
  return snapshot;
}

function refreshStickyNoteFooterButtonState() {
  stickyNotesVisible = stickyNoteStateById.size > 0 && stickyNotesVisible;
  stickyNoteToggleBtn?.classList.toggle('active', !!stickyNotesVisible);
}

function canRestoreStickyNoteSnapshotWithinCaps(snapshot) {
  const snapshotMode = String(snapshot?.mode || snapshot?.stickyNoteMode || '').toLowerCase();
  const snapshotCanvas = String(snapshot?.canvas || snapshot?.stickyNoteCanvas || '').toLowerCase();
  if (snapshotMode === 'canvas') {
    const targetCanvasType = snapshotCanvas === 'dm' ? 'dm' : 'player';
    if (!canCreateCanvasNote(targetCanvasType)) {
      addLogEntry(`<b>Sticky Note Blocked:</b> ${targetCanvasType.toUpperCase()} canvas is at max note capacity.`, 'normal');
      return false;
    }
    return true;
  }

  if (getOverlayStickyNoteCount() >= STICKY_NOTE_MAX_COUNT) {
    addLogEntry('<b>Sticky Note Blocked:</b> Info Window overlay is at max note capacity.', 'normal');
    return false;
  }
  return true;
}

function restoreStickyNoteFromBufferUndoEntry(undoEntry) {
  if (!undoEntry || !undoEntry.snapshot) return false;
  if (!canRestoreStickyNoteSnapshotWithinCaps(undoEntry.snapshot)) return false;
  const restoredNote = createStickyNote(undoEntry.snapshot);
  if (!restoredNote) return false;
  setStickyNotesVisible(true);
  persistStickyNotesForContextKey();
  return true;
}

//widget - Toggle sticky note buffer visibility
function toggleStickyNoteBuffer() {
  //widget
  const bufferEl = document.getElementById('sticky-note-buffer');
  //widget
  if (!bufferEl) return;
  //widget
  
  //widget
  const isHidden = bufferEl.classList.contains('hidden');
  //widget
  bufferEl.classList.toggle('hidden', !isHidden);
  //widget
  
  //widget
  if (isHidden) {
    //widget
    updateStickyNoteBufferList();
    if (typeof window.setFloatingWindowPrimary === 'function') {
      window.setFloatingWindowPrimary('sticky-buffer', bufferEl);
    }
    //widget
    console.log('[Sticky Note Buffer] Opened');
    //widget
  } else {
    //widget
    console.log('[Sticky Note Buffer] Closed');
    //widget
  }
  //widget
}

//widget - Update sticky note list in buffer
function updateStickyNoteBufferList() {
  //widget
  const noteListEl = document.getElementById('sticky-note-list');
  //widget
  if (!noteListEl) return;
  //widget
  
  //widget
  noteListEl.innerHTML = '';
  //widget

  const currentCanvasType = getCurrentCanvasType();
  const currentContextKey = getActiveStickyNotesContextKey();
  const pendingUndoEntries = getStickyNoteBufferUndoEntriesForContext(currentContextKey, false)
    .map((undoEntry) => {
      const snapshot = undoEntry?.snapshot || {};
      const mode = String(snapshot.mode || snapshot.stickyNoteMode || 'overlay').toLowerCase();
      const canvas = String(snapshot.canvas || snapshot.stickyNoteCanvas || currentCanvasType).toLowerCase();
      return {
        isPendingUndo: true,
        undoEntryId: String(undoEntry.id || ''),
        noteMode: mode === 'canvas' ? 'canvas' : 'overlay',
        noteCanvas: canvas === 'dm' ? 'dm' : 'player',
        title: String(snapshot.title || 'STICKY NOTE').trim() || 'STICKY NOTE',
        preview: String(snapshot.body || '').trim()
      };
    })
    .filter((entry) => !!entry.undoEntryId);
  
  //widget
  const allNotes = Array.from(document.querySelectorAll('.sticky-note-window[data-sticky-note-id], .canvas-sticky-note[data-sticky-note-id]'));
  //widget
  
  //widget
  if (allNotes.length === 0 && pendingUndoEntries.length === 0) {
    //widget
    noteListEl.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 20px;">No sticky notes created yet</div>';
    //widget
    return;
    //widget
  }
  //widget

  const escapeBufferText = (rawText) => String(rawText || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const noteEntries = allNotes.map((noteEl, index) => {
    const noteId = String(noteEl.dataset.stickyNoteId || `note-${index}`);
    const noteMode = String(noteEl.dataset.stickyNoteMode || 'overlay');
    const noteCanvas = String(noteEl.dataset.stickyNoteCanvas || currentCanvasType);
    const titleEl = noteEl.querySelector('.sticky-note-title');
    const bodyEl = noteEl.querySelector('.sticky-note-body');
    return {
      noteEl,
      bodyEl,
      noteId,
      noteMode,
      noteCanvas,
      title: String(titleEl?.textContent || 'STICKY NOTE').trim() || 'STICKY NOTE',
      preview: String(bodyEl?.value || '').trim()
    };
  });

  const currentCanvasEntries = noteEntries.filter((entry) => entry.noteMode === 'canvas' && entry.noteCanvas === currentCanvasType);
  const overlayEntries = noteEntries.filter((entry) => entry.noteMode !== 'canvas');
  const otherCanvasEntries = noteEntries.filter((entry) => entry.noteMode === 'canvas' && entry.noteCanvas !== currentCanvasType);

  const renderNoteItem = (entry, locationLabel) => {
    const noteItem = document.createElement('div');
    noteItem.className = 'sticky-note-buffer-item';
    noteItem.style.cssText = `
      background: #1a1a1a;
      border: 1px solid #f4c95d;
      border-radius: 4px;
      padding: 10px;
      cursor: pointer;
      transition: background-color 0.2s;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    `;
    const contentWrap = document.createElement('div');
    contentWrap.style.cssText = 'min-width:0; flex:1;';
    contentWrap.innerHTML = `
      <div style="font-weight: 600; color: #f4c95d; margin-bottom: 4px; font-size: 12px;">
        ${escapeBufferText(entry.title)}
        <span style="color: #94a3b8; font-size: 10px;">(${entry.isPendingUndo ? 'deleted' : `#${escapeBufferText(entry.noteId)}`} • ${escapeBufferText(locationLabel)})</span>
      </div>
      <div style="color: ${entry.isPendingUndo ? '#fca5a5' : '#e2e8f0'}; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${escapeBufferText(entry.preview || '(empty)')}
      </div>
    `;
    noteItem.appendChild(contentWrap);

    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.style.cssText = `
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 10px;
      font-weight: 700;
      color: #0f172a;
      cursor: pointer;
      align-self: center;
      flex: 0 0 auto;
      background: ${entry.isPendingUndo ? '#facc15' : '#ef4444'};
    `;
    actionBtn.textContent = entry.isPendingUndo ? 'UNDO' : 'DEL';
    actionBtn.title = entry.isPendingUndo ? 'Restore this sticky note' : 'Delete this sticky note';
    actionBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (entry.isPendingUndo) {
        const contextEntries = getStickyNoteBufferUndoEntriesForContext(currentContextKey, false);
        const undoEntry = contextEntries.find((candidate) => String(candidate?.id || '') === String(entry.undoEntryId || ''));
        if (!undoEntry) {
          updateStickyNoteBufferList();
          return;
        }

        const restoreSucceeded = restoreStickyNoteFromBufferUndoEntry(undoEntry);
        if (!restoreSucceeded) return;

        removeStickyNoteBufferUndoEntry(currentContextKey, undoEntry.id);
        updateStickyNoteBufferList();
        return;
      }

      if (!entry.noteEl || !entry.noteEl.isConnected) {
        updateStickyNoteBufferList();
        return;
      }

      const deletedSnapshot = removeStickyNoteElementFromState(entry.noteEl);
      if (!deletedSnapshot) {
        updateStickyNoteBufferList();
        return;
      }

      enqueueStickyNoteBufferUndoSnapshot(deletedSnapshot, currentContextKey);
      refreshStickyNoteFooterButtonState();
      persistStickyNotesForContextKey();
      addLogEntry(`<b>Sticky Note Deleted:</b> ${escapeStickyNoteLogText(deletedSnapshot.title || 'STICKY NOTE')}`, 'normal');
      updateStickyNoteBufferList();
    });
    noteItem.appendChild(actionBtn);

    noteItem.addEventListener('click', () => {
      if (entry.isPendingUndo) return;
      if (entry.noteEl.classList.contains('canvas-sticky-note')) {
        bringCanvasHierarchyToFront(entry.noteEl);
      }
      entry.bodyEl?.focus();
      toggleStickyNoteBuffer();
    });

    return noteItem;
  };

  const renderSection = (titleText, entries, locationLabelBuilder) => {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'sticky-note-buffer-section';
    sectionEl.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin-bottom:10px;';

    const headerEl = document.createElement('div');
    headerEl.style.cssText = 'font-size:11px; font-weight:700; color:#f4c95d; text-transform:uppercase; letter-spacing:0.04em; opacity:0.95;';
    headerEl.textContent = `${titleText} (${entries.length})`;
    sectionEl.appendChild(headerEl);

    if (!entries.length) {
      const emptyEl = document.createElement('div');
      emptyEl.style.cssText = 'color:#94a3b8; font-size:11px; padding:6px 2px;';
      emptyEl.textContent = 'No notes';
      sectionEl.appendChild(emptyEl);
      noteListEl.appendChild(sectionEl);
      return;
    }

    entries.forEach((entry) => {
      const locationLabel = locationLabelBuilder(entry);
      sectionEl.appendChild(renderNoteItem(entry, locationLabel));
    });

    noteListEl.appendChild(sectionEl);
  };

  renderSection(
    `${currentCanvasType.toUpperCase()} Canvas`,
    currentCanvasEntries,
    () => `${currentCanvasType.toUpperCase()} Canvas`
  );
  renderSection(
    'Info Window Overlay',
    overlayEntries,
    (entry) => `Info Window / ${entry.noteCanvas.toUpperCase()}`
  );
  renderSection(
    'Other Canvas',
    otherCanvasEntries,
    (entry) => `${entry.noteCanvas.toUpperCase()} Canvas`
  );
  renderSection(
    'Pending Undo (Expires When Action Log Closes)',
    pendingUndoEntries,
    (entry) => `${entry.noteMode === 'canvas' ? `${entry.noteCanvas.toUpperCase()} Canvas` : 'Info Window'}`
  );
  //widget
}

//widget - Initialize sticky note buffer button handlers
function initStickyNoteBuffer() {
  //widget
  const bufferEl = document.getElementById('sticky-note-buffer');
  //widget
  const bufferHeader = document.querySelector('.sticky-note-buffer-header');
  //widget
  const yellowBtn = document.getElementById('log-yellow-btn');
  //widget
  const closeBtn = document.getElementById('close-sticky-buffer');
  //widget
  const deleteAllBtn = document.getElementById('delete-all-sticky-notes');
  //widget
  
  //widget ========== BUFFER DRAG FUNCTIONALITY (Matches Action Log pattern) ==========
  //widget - Mouse drag
  if (bufferHeader) {
    const clampBufferPosition = (left, top, element) => {
      const width = element.offsetWidth || 0;
      const height = element.offsetHeight || 0;
      const headerHeight = bufferHeader.offsetHeight || 0;
      return clampInfoWindowPositionRecoverable(left, top, width, height, headerHeight);
    };

    // Action Log style drag for Sticky Notes Buffer
    bufferHeader.onmousedown = (e) => {
      if (e.target.closest('.close-btn, .delete-all-btn')) return;
      const bufferEl = document.getElementById('sticky-note-buffer');
      if (!bufferEl) return;
      if (typeof window.setFloatingWindowPrimary === 'function') {
        window.setFloatingWindowPrimary('sticky-buffer', bufferEl);
      }

      // Normalize centered default position to pixel position to prevent initial jump
      const rect = bufferEl.getBoundingClientRect();
      bufferEl.style.transform = 'none';
      bufferEl.style.left = rect.left + 'px';
      bufferEl.style.top = rect.top + 'px';
      bufferEl.style.right = 'auto';
      bufferEl.style.bottom = 'auto';

      isDraggingBuffer = true;
      bufferDragStartX = e.clientX;
      bufferDragStartY = e.clientY;
      bufferStartLeft = rect.left;
      bufferStartTop = rect.top;
      syncStickyWindowDragClass();
      e.preventDefault();
      e.stopPropagation();
      // Mouse move/up listeners
      function onMouseMove(ev) {
        if (!isDraggingBuffer) return;
        const dx = ev.clientX - bufferDragStartX;
        const dy = ev.clientY - bufferDragStartY;
        const nextLeft = bufferStartLeft + dx;
        const nextTop = bufferStartTop + dy;
        const clamped = clampBufferPosition(nextLeft, nextTop, bufferEl);
        bufferEl.style.left = clamped.left + 'px';
        bufferEl.style.top = clamped.top + 'px';
      }
      function onMouseUp(ev) {
        isDraggingBuffer = false;
        syncStickyWindowDragClass();
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        if (ev) ev.stopPropagation();
      }
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
    // Touch drag (Action Log style)
    bufferHeader.addEventListener('touchstart', (e) => {
      if (e.target.closest('.close-btn, .delete-all-btn')) return;
      if (!e.touches || !e.touches.length) return;
      const bufferEl = document.getElementById('sticky-note-buffer');
      if (!bufferEl) return;
      if (typeof window.setFloatingWindowPrimary === 'function') {
        window.setFloatingWindowPrimary('sticky-buffer', bufferEl);
      }

      // Normalize centered default position to pixel position to prevent initial jump
      const rect = bufferEl.getBoundingClientRect();
      bufferEl.style.transform = 'none';
      bufferEl.style.left = rect.left + 'px';
      bufferEl.style.top = rect.top + 'px';
      bufferEl.style.right = 'auto';
      bufferEl.style.bottom = 'auto';

      const touch = e.touches[0];
      isDraggingBuffer = true;
      bufferDragStartX = touch.clientX;
      bufferDragStartY = touch.clientY;
      bufferStartLeft = rect.left;
      bufferStartTop = rect.top;
      syncStickyWindowDragClass();
      e.preventDefault();
      e.stopPropagation();
      function onTouchMove(ev) {
        if (!isDraggingBuffer || !ev.touches.length) return;
        const t = ev.touches[0];
        const dx = t.clientX - bufferDragStartX;
        const dy = t.clientY - bufferDragStartY;
        const nextLeft = bufferStartLeft + dx;
        const nextTop = bufferStartTop + dy;
        const clamped = clampBufferPosition(nextLeft, nextTop, bufferEl);
        bufferEl.style.left = clamped.left + 'px';
        bufferEl.style.top = clamped.top + 'px';
        ev.preventDefault();
        ev.stopPropagation();
      }
      function onTouchEnd(ev) {
        isDraggingBuffer = false;
        syncStickyWindowDragClass();
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
        if (ev) ev.stopPropagation();
      }
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd);
    }, { passive: false });
  }
  //widget ==========================================================================
  //widget
  
  //widget
  if (yellowBtn) {
    //widget
    yellowBtn.addEventListener('click', (e) => {
      //widget
      e.stopPropagation();
      //widget
      toggleStickyNoteBuffer();
      //widget
    });
    //widget
    yellowBtn.addEventListener('touchstart', (e) => {
      //widget
      e.preventDefault();
      //widget
      e.stopPropagation();
      //widget
      toggleStickyNoteBuffer();
      //widget
    }, { passive: false });
    //widget
  }
  //widget
  
  //widget
  if (closeBtn) {
    //widget
    closeBtn.addEventListener('click', () => {
      //widget
      toggleStickyNoteBuffer();
      //widget
    });
    //widget
  }
  //widget
  
  //widget
  if (deleteAllBtn) {
    //widget
    deleteAllBtn.addEventListener('click', () => {
      //widget
      if (confirm('Delete all sticky notes? This cannot be undone.')) {
        //widget
        const allNotes = Array.from(document.querySelectorAll('.sticky-note-window[data-sticky-note-id], .canvas-sticky-note[data-sticky-note-id]'));
        //widget
        allNotes.forEach((noteEl) => {
          removeStickyNoteElementFromState(noteEl);
        });
        //widget
        clearAllStickyNoteBufferUndoEntries();
        //widget
        stickyNoteDeleteUndoSnapshotsByToken.clear();
        //widget
        refreshStickyNoteFooterButtonState();
        //widget
        updateStickyNoteBufferList();
        //widget
        persistStickyNotesForContextKey();
        //widget
        addLogEntry('<b>Sticky Notes:</b> Deleted all notes across DM canvas, Player canvas, and Info Window.', 'normal');
        //widget
        console.log('[Sticky Note Buffer] All notes deleted');
        //widget
      }
      //widget
    });
    //widget
  }

  if (!hasActionLogVisibilityListener) {
    hasActionLogVisibilityListener = true;
    window.addEventListener('chainwarden:action-log-visibility-changed', (event) => {
      const isVisible = !!event?.detail?.visible;
      if (isVisible) return;
      clearAllStickyNoteBufferUndoEntries();
      updateStickyNoteBufferList();
    });
  }
  //widget
  
  //widget
  console.log('[Sticky Note Buffer] Initialized with drag support');
  //widget
}

//widget - Export for external access
//widget
window.toggleStickyNoteBuffer = toggleStickyNoteBuffer;
//widget
window.updateStickyNoteBufferList = updateStickyNoteBufferList;
//widget
window.initStickyNoteBuffer = initStickyNoteBuffer;

})(); // End of IIFE
