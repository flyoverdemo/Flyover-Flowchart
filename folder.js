/**
 * FOLDER.JS - Folder + Stack Runtime Module
 * //folder - Core behavior for folder settings panels, in-stack card visibility, and stack sizing.
 *
 * ARCHITECTURE OVERVIEW
 * - This module is intentionally runtime-focused and stateless by default except for references
 *   passed in through `createFolderRuntime(options)`.
 * - It does NOT own canvas transforms, node dragging, detached-card drag mechanics, or edit-mode input loops.
 *   Those are owned by `index.html` orchestration and related runtime systems.
 * - It DOES own:
 *   1) Folder settings persistence adapters (load/save contracts)
 *   2) Panel snap-position logic (left/right/bottom)
 *   3) In-stack visibility toggles and reordering side effects
 *   4) Stack height recalculation based on current visible/expanded cards
 *   5) Additional Actions panel row rendering and per-card toggle hooks
 *
 * MODULE RESPONSIBILITIES (HIGH LEVEL)
 * 1) Persistence scaffolding
 *    - `folderDefaults` defines localStorage key + baseline schema.
 *    - `createFolderSettingsStore` provides resilient load/save wrapper and fallback cloning.
 *
 * 2) Runtime wiring
 *    - `createFolderRuntime(options)` captures shared references from host app (DOM nodes, arrays, callbacks).
 *    - Host remains source-of-truth for many globals (order arrays, visible-state objects, panel position state).
 *
 * 3) Layout + sizing
 *    - Computes active stack card order using `visibleStates` and current DOM card order.
 *    - Re-applies classes (`at-pos-*`, `hidden`) and CSS variables (`--stack-y`) to match runtime state.
 *    - Dynamically updates folder height variables (`--folder-dynamic-height`, `--additional-folder-dynamic-height`).
 *
 * 4) Panel behaviors
 *    - Supports snapping panel to left/right/bottom relative to stack bounds.
 *    - Keeps side-panel heights synchronized when configured left/right.
 *
 * 5) Folder settings interactions
 *    - Main stack toggles call `handleCardToggle(cardIndex, toggleEl)`.
 *    - Additional Actions toggles are generated dynamically and managed via delegated handlers.
 *
 * RELATIONSHIPS WITH INDEX.HTML / OTHER RUNTIMES
 * - `index.html` hosts input orchestration, edit-layout state, detached card behavior, and persistence timing.
 * - This module is called from `index.html` wrappers (`updatePositions`, `handleCardToggle`, panel snap updaters).
 * - Detached card visuals, drop zones, parent-button glow, and card restacking decisions are handled outside this file.
 *   However, this module supports detached workflows by explicitly skipping detached cards in stack layout math.
 * - Recent interop updates in `index.html` now include:
 *   - detached card toggle-click restore back into stack order defaults,
 *   - mixed restack drop policy (stack center-based, parent-button pointer-release based),
 *   - top-card-only detach rule for unarmed stack,
 *   - touch parity for detached drag lifecycle.
 *   This module remains the geometry/state sink for those upstream decisions.
 *
 * LOOSE / DETACHED CARD INTEROP (IMPORTANT)
 * - Detached cards are identified by class `detached-from-stack`.
 * - In stack calculations, detached cards are excluded so they do not affect:
 *   - in-stack position class assignments,
 *   - hidden/visible card slot calculations,
 *   - dynamic folder panel sizing baseline.
 * - This prevents detached cards from corrupting stack geometry while preserving toggle-based state.
 * - Restacking and detached drop logic should mutate `visibleStates`/`order` upstream, then call `updatePositions()`.
 *
 * DATA CONTRACTS PASSED INTO createFolderRuntime(options)
 * - Required-ish references (practically required for full behavior):
 *   - `nodes`: keyed node map (expects `card-stack` and optionally others)
 *   - `sidePanel`, `cardStack`
 *   - `order`, `visibleStates`, `stackCards`
 * - Optional references / callbacks with defaults:
 *   - `additionalCardStack`, `additionalSidePanel`, `additionalVisibleStates`, `additionalPanelContent`
 *   - `saveFolderSettingsState`, `getCardDisplayLabel`
 *   - panel position getters/setters and long-press state callbacks for specific controls
 *
 * PERSISTENCE MODEL
 * - Default schema key: `chainWarden_folderSettingsState`.
 * - Shape:
 *   {
 *     unarmed: {
 *       show: boolean,
 *       position: 'left' | 'right' | 'bottom',
 *       collapsed: boolean,
 *       visibleStates: Record<number, boolean>
 *     },
 *     additionalActions: {
 *       show: boolean,
 *       position: 'left' | 'right' | 'bottom',
 *       collapsed: boolean,
 *       visibleStates: Record<string, boolean>
 *     }
 *   }
 * - Store wrapper is intentionally defensive:
 *   - malformed JSON -> defaults
 *   - missing key -> defaults
 *   - partial objects -> merged with defaults
 *
 * ORDER + VISIBILITY SEMANTICS
 * - `order`: rank preference for stack cards (lower index in `order` means nearer top when visible).
 * - `visibleStates[idx]`: card visibility toggle state for stack cards.
 * - `handleCardToggle` behavior:
 *   - toggles active state
 *   - if card is turned off, card index is moved to end of order (preserves user intent for return order)
 *   - triggers `updatePositions()` + persistence callback
 *
 * STACK HEIGHT SEMANTICS
 * - Height derives from visible, non-detached cards only.
 * - Expanded cards contribute additional vertical space (first/top card and nested cards have different extras).
 * - This keeps folder dimensions responsive to card expansion while preserving stack readability.
 * - Empty folder UX: when visible in-stack count is zero, runtime now renders a centered,
 *   non-interactive indicator (`no cards in folder (0/x)`) where `x` is max cards in that stack.
 *
 * PANEL SNAP SEMANTICS
 * - Snap calculation compares pointer position against stack bounds with configurable threshold.
 * - Horizontal overshoot -> left/right snap.
 * - Bottom overshoot within x-range -> bottom snap.
 * - Left/right snap forces expanded panel mode and explicit height sync to stack.
 *
 * ADDITIONAL ACTIONS PANEL ROWS
 * - Rows are rendered from DOM order of `.additional-stack-card` elements.
 * - Toggle state is source-truthed by `additionalVisibleStates[cardId] !== false`.
 * - Row clicks use delegated event binding via `data-additional-card-id`.
 *
 * TOUCH + MOUSE INTEROP
 * - Several controls support both mouse and touch start/end flows.
 * - Touch handlers prevent default where needed to avoid canvas gesture conflict.
 * - Long-press logic exists for stepped-scroll controls and invokes host callbacks.
 * - Detached-card touch-drag lifecycle (touchstart/move/end for loose cards) is owned by `index.html`.
 *   This module remains compatible by excluding detached cards from stack layout calculations.
 * - Card-handle long-press context-menu suppression (mobile Chrome share/download/print prompt prevention)
 *   is also owned by `index.html` alongside card detail panel long-press orchestration.
 *
 * EXTENSION GUIDELINES (FOR FUTURE IMPLEMENTATION)
 * 1) Keep this module runtime-pure:
 *    - pass references in, emit side effects to provided callbacks, avoid new global dependencies.
 *
 * 2) Detached card enhancements:
 *    - if detached semantics change, preserve the rule that detached cards are excluded from stack math.
 *
 * 3) New folder families:
 *    - mirror Additional Actions pattern: dedicated visible-state map + delegated row rendering.
 *
 * 4) Persistence migrations:
 *    - extend `folderDefaults.defaultFolderSettingsState`, maintain backward-safe merge in `load()`.
 *
 * 5) Performance discipline:
 *    - batch DOM writes where possible; avoid expensive measurement loops in pointer-move hot paths.
 *
 * 6) Debugging strategy:
 *    - validate three states separately: (a) visibility toggles, (b) stack order, (c) detached exclusion.
 *    - for detached-card issues, verify both ranking paths:
 *      (1) runtime `activeInStack` filters detached cards out,
 *      (2) handle-click reorder logic in `index.html` uses same detached exclusion rule.
 *
 * KNOWN BOUNDARIES / NON-GOALS
 * - No ownership of canvas pan/zoom.
 * - No ownership of Edit Layout drag lifecycle.
 * - No ownership of detached-card drop target policy (stack center vs pointer-over-button, etc.).
 * - No direct logging/UI telemetry beyond light warnings for storage failures.
 */

(function attachFolderModule(globalScope) {
  const folderDefaults = {
    folderSettingsStateKey: 'chainWarden_folderSettingsState',
    defaultFolderSettingsState: {
      unarmed: {
        show: false,
        position: 'bottom',
        collapsed: false,
        visibleStates: { 0: true, 1: true, 2: true }
      },
      additionalActions: {
        show: false,
        position: 'bottom',
        collapsed: false,
        visibleStates: {}
      }
    }
  };

  function cloneDefaultState() {
    return JSON.parse(JSON.stringify(folderDefaults.defaultFolderSettingsState));
  }

  function createFolderSettingsStore(options = {}) {
    const storage = options.storage || globalScope.localStorage;
    const stateKey = String(options.stateKey || folderDefaults.folderSettingsStateKey);
    const defaultState = options.defaultState || cloneDefaultState();

    function load() {
      try {
        const savedRaw = storage.getItem(stateKey);
        if (!savedRaw) return JSON.parse(JSON.stringify(defaultState));
        const parsed = JSON.parse(savedRaw);
        return {
          ...JSON.parse(JSON.stringify(defaultState)),
          ...(parsed && typeof parsed === 'object' ? parsed : {})
        };
      } catch (error) {
        console.warn('[Folder Settings] Failed to load from localStorage:', error);
        return JSON.parse(JSON.stringify(defaultState));
      }
    }

    function save(state) {
      try {
        storage.setItem(stateKey, JSON.stringify(state));
      } catch (error) {
        console.warn('[Folder Settings] Failed to save to localStorage:', error);
      }
    }

    return { load, save, stateKey };
  }

  function initializeAdditionalVisibleStates(additionalVisibleStates, additionalCardElements = []) {
    if (!additionalVisibleStates || !Array.isArray(additionalCardElements)) return;
    additionalCardElements.forEach((cardEl) => {
      if (!cardEl || !cardEl.id) return;
      if (typeof additionalVisibleStates[cardEl.id] === 'undefined') {
        additionalVisibleStates[cardEl.id] = true;
      }
    });
  }

  function createFolderRuntime(options = {}) {
    const panelSnapThreshold = Number.isFinite(Number(options.panelSnapThreshold))
      ? Number(options.panelSnapThreshold)
      : 50;

    const nodes = options.nodes || {};
    const sidePanel = options.sidePanel || null;
    const cardStack = options.cardStack || null;
    const additionalCardStack = options.additionalCardStack || null;
    const additionalSidePanel = options.additionalSidePanel || null;
    const order = Array.isArray(options.order) ? options.order : [];
    const visibleStates = options.visibleStates || {};
    const stackCards = Array.isArray(options.stackCards) ? options.stackCards : [];
    const additionalActionFolderCards = Array.isArray(options.additionalActionFolderCards)
      ? options.additionalActionFolderCards
      : [];
    const defaultTemplateCard = options.defaultTemplateCard || null;
    const additionalVisibleStates = options.additionalVisibleStates || {};
    const additionalPanelContent = options.additionalPanelContent || null;
    const steppedScrollControlStateByBoxId = options.steppedScrollControlStateByBoxId || {};
    const saveFolderSettingsState = typeof options.saveFolderSettingsState === 'function'
      ? options.saveFolderSettingsState
      : () => {};
    const getCardDisplayLabel = typeof options.getCardDisplayLabel === 'function'
      ? options.getCardDisplayLabel
      : (() => 'Unknown');
    const onHitBoxLongPressChange = typeof options.onHitBoxLongPressChange === 'function'
      ? options.onHitBoxLongPressChange
      : () => {};
    const onDmgBoxLongPressChange = typeof options.onDmgBoxLongPressChange === 'function'
      ? options.onDmgBoxLongPressChange
      : () => {};
    const getPanelCurrentPos = typeof options.getPanelCurrentPos === 'function'
      ? options.getPanelCurrentPos
      : (() => 'bottom');
    const setPanelCurrentPos = typeof options.setPanelCurrentPos === 'function'
      ? options.setPanelCurrentPos
      : () => {};
    const getAdditionalPanelCurrentPos = typeof options.getAdditionalPanelCurrentPos === 'function'
      ? options.getAdditionalPanelCurrentPos
      : (() => 'bottom');
    const setAdditionalPanelCurrentPos = typeof options.setAdditionalPanelCurrentPos === 'function'
      ? options.setAdditionalPanelCurrentPos
      : () => {};

    function resolvePanelSnapPosition(clientX, clientY, stackRect, currentPos) {
      let nextPos = currentPos;
      const leftThreshold = stackRect.left - panelSnapThreshold;
      const rightThreshold = stackRect.right + panelSnapThreshold;
      const bottomThreshold = stackRect.bottom + panelSnapThreshold;

      if (clientX < leftThreshold) {
        nextPos = 'left';
      } else if (clientX > rightThreshold) {
        nextPos = 'right';
      } else if (clientY > bottomThreshold && clientX > stackRect.left && clientX < stackRect.right) {
        nextPos = 'bottom';
      }

      return nextPos;
    }

    function getLowestCardBottomPx(stackCards, visibleStates, order) {
      // Find the lowest bottom edge of all visible cards in the stack
      let maxBottom = 0;
      stackCards.forEach((card, idx) => {
        if (!card || !visibleStates[idx]) return;
        if (card.classList.contains('detached-from-stack')) return;
        const rect = card.getBoundingClientRect();
        const parentRect = card.parentElement?.getBoundingClientRect();
        if (rect && parentRect) {
          const bottom = rect.bottom - parentRect.top;
          if (bottom > maxBottom) maxBottom = bottom;
        }
      });
      return maxBottom;
    }

    function applyPanelPositionClass(panelEl, nextPos, parentStackEl) {
      panelEl.classList.remove('pos-left', 'pos-right', 'pos-bottom');
      panelEl.classList.add('pos-' + nextPos);
      // Dynamic height for left/right configs
      if (nextPos === 'left' || nextPos === 'right') {
        if (parentStackEl) {
          // Calculate the lowest card bottom (relative to stack), fallback to 1 card height
          const stackCardsArr = Array.isArray(stackCards) ? stackCards : [];
          const minHeight = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-height'), 10) || 155;
          let maxBottom = getLowestCardBottomPx(stackCardsArr, visibleStates, order);
          if (!maxBottom || maxBottom < minHeight) maxBottom = minHeight;
          panelEl.style.height = maxBottom + 'px';
        }
      } else {
        panelEl.style.height = '';
      }
    }

    function updateMainPanelSnapPosition(clientX, clientY) {
      const cardStackEl = nodes['card-stack']?.el;
      if (!cardStackEl || !sidePanel || !cardStack) return false;

      const stackRect = cardStackEl.getBoundingClientRect();
      const panelCurrentPos = getPanelCurrentPos();
      const newPos = resolvePanelSnapPosition(clientX, clientY, stackRect, panelCurrentPos);
      if (newPos === panelCurrentPos) return false;

      applyPanelPositionClass(sidePanel, newPos, cardStackEl);
      if (newPos === 'left' || newPos === 'right') {
        sidePanel.classList.remove('collapsed');
        cardStack.classList.remove('panel-collapsed');
        sidePanel.style.height = cardStackEl.offsetHeight + 'px';
      } else {
        sidePanel.style.height = '';
      }

      setPanelCurrentPos(newPos);
      saveFolderSettingsState();
      return true;
    }

    function updateAdditionalPanelSnapPosition(clientX, clientY) {
      if (!additionalCardStack || !additionalSidePanel) return false;
      const stackRect = additionalCardStack.getBoundingClientRect();
      const additionalPanelCurrentPos = getAdditionalPanelCurrentPos();
      const newPos = resolvePanelSnapPosition(clientX, clientY, stackRect, additionalPanelCurrentPos);
      if (newPos === additionalPanelCurrentPos) return false;

      applyPanelPositionClass(additionalSidePanel, newPos, additionalCardStack);
      if (newPos === 'left' || newPos === 'right') {
        additionalSidePanel.classList.remove('collapsed');
        additionalCardStack.classList.remove('panel-collapsed');
        additionalSidePanel.style.height = additionalCardStack.offsetHeight + 'px';
      } else {
        additionalSidePanel.style.height = '';
      }

      setAdditionalPanelCurrentPos(newPos);
      saveFolderSettingsState();
      return true;
    }

    function setupSteppedScroll(boxId, scrollId, defaultIndex, maxIndex, valuesArray) {
      const box = document.getElementById(boxId);
      const scroll = document.getElementById(scrollId);
      if (!box || !scroll) return;

      const steppedScrollControlState = {
        boxId,
        scrollId,
        index: defaultIndex,
        defaultIndex,
        maxIndex,
        valuesArray: Array.isArray(valuesArray) ? valuesArray : [],
        update: null
      };

      steppedScrollControlStateByBoxId[boxId] = steppedScrollControlState;

      const itemHeight = 44;
      let longPressTimer;
      let isLongPress = false;

      const update = () => {
        const offset = steppedScrollControlState.index * itemHeight;
        scroll.style.transform = `translateY(-${offset}px)`;
        if (steppedScrollControlState.index !== steppedScrollControlState.defaultIndex) box.classList.add('modified');
        else box.classList.remove('modified');
      };

      steppedScrollControlState.update = update;

      update();

      const startHold = () => {
        isLongPress = false;
        if (boxId === 'hit-box') onHitBoxLongPressChange(false);
        if (boxId === 'dmg-box') onDmgBoxLongPressChange(false);
        box.classList.add('pressing');
        longPressTimer = setTimeout(() => {
          isLongPress = true;
          if (boxId === 'hit-box') onHitBoxLongPressChange(true);
          if (boxId === 'dmg-box') onDmgBoxLongPressChange(true);
          steppedScrollControlState.index = steppedScrollControlState.defaultIndex;
          update();
          box.classList.remove('pressing');
        }, 1500);
      };

      const endHold = () => {
        clearTimeout(longPressTimer);
        box.classList.remove('pressing');
        if (boxId === 'hit-box') {
          setTimeout(() => {
            onHitBoxLongPressChange(false);
          }, 50);
        }
        if (boxId === 'dmg-box') {
          setTimeout(() => {
            onDmgBoxLongPressChange(false);
          }, 50);
        }
      };

      box.addEventListener('mousedown', startHold);
      window.addEventListener('mouseup', endHold);

      box.addEventListener('touchstart', () => {
        startHold();
      }, { passive: true });
      box.addEventListener('touchend', endHold);

      box.addEventListener('click', (e) => {
        if (isLongPress) {
          isLongPress = false;
          return;
        }
        if (boxId === 'hit-box' || boxId === 'dmg-box') {
          e.stopPropagation();
        }
      });

      box.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.deltaY > 0 && steppedScrollControlState.index > 0) steppedScrollControlState.index--;
        else if (e.deltaY < 0 && steppedScrollControlState.index < steppedScrollControlState.maxIndex) steppedScrollControlState.index++;
        update();
      }, { passive: false });

      let touchStartY = 0;
      box.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; });
      box.addEventListener('touchmove', (e) => {
        const touchEndY = e.touches[0].clientY;
        const diff = touchStartY - touchEndY;
        if (Math.abs(diff) > 25) {
          e.preventDefault();
          clearTimeout(longPressTimer);
          box.classList.remove('pressing');
          if (diff < 0 && steppedScrollControlState.index > 0) { steppedScrollControlState.index--; touchStartY = touchEndY; }
          else if (diff > 0 && steppedScrollControlState.index < steppedScrollControlState.maxIndex) { steppedScrollControlState.index++; touchStartY = touchEndY; }
          update();
        }
      }, { passive: false });
    }

    function setSteppedScrollDefaultValue(boxId, selectedDisplayValue) {
      const steppedScrollControlState = steppedScrollControlStateByBoxId[boxId];
      if (!steppedScrollControlState || !Array.isArray(steppedScrollControlState.valuesArray)) return;

      const normalizeToken = (value) => String(value || '').replace(/\s+/g, '').toLowerCase();
      const normalizedSelectedToken = normalizeToken(selectedDisplayValue);

      let selectedOptionIndex = steppedScrollControlState.valuesArray.findIndex(
        optionDisplayValue => normalizeToken(optionDisplayValue) === normalizedSelectedToken
      );

      if (selectedOptionIndex < 0) {
        selectedOptionIndex = steppedScrollControlState.defaultIndex;
      }

      if (selectedOptionIndex < 0) {
        selectedOptionIndex = 0;
      }

      steppedScrollControlState.defaultIndex = selectedOptionIndex;
      steppedScrollControlState.index = selectedOptionIndex;

      if (typeof steppedScrollControlState.update === 'function') {
        steppedScrollControlState.update();
      }
    }

    function updateEmptyFolderIndicator(stackEl, visibleCardCount, maxCardCount) {
      if (!stackEl) return;

      const clampedVisibleCount = Number.isFinite(Number(visibleCardCount))
        ? Math.max(0, Number(visibleCardCount))
        : 0;
      const clampedMaxCount = Number.isFinite(Number(maxCardCount))
        ? Math.max(0, Number(maxCardCount))
        : 0;

      let indicatorEl = stackEl.querySelector('.empty-folder-indicator');
      if (!indicatorEl) {
        indicatorEl = document.createElement('div');
        indicatorEl.className = 'empty-folder-indicator';
        stackEl.appendChild(indicatorEl);
      }

      indicatorEl.textContent = `no cards in folder (0/${clampedMaxCount})`;
      indicatorEl.classList.toggle('show', clampedVisibleCount === 0);
    }

    function updateAdditionalActionsFolderSizing() {
      if (!additionalCardStack) return;

      const additionalActionCards = Array.from(additionalCardStack.querySelectorAll('.additional-stack-card'));
      additionalActionCards.forEach((cardEl) => {
        const cardIsVisible = additionalVisibleStates[cardEl.id] !== false;
        cardEl.classList.toggle('hidden', !cardIsVisible);
        cardEl.classList.remove('additional-top-card');
      });

      const visibleAdditionalActionCards = additionalActionCards.filter(cardEl => !cardEl.classList.contains('hidden'));
      if (visibleAdditionalActionCards[0]) {
        visibleAdditionalActionCards[0].classList.add('additional-top-card');
      }
      const baseOffset = 35;
      const baseCardHeightPx = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-height'), 10) || 155;
      const expandedCardExtraHeightPx = 170;
      const nestedExpandedCardExtraHeightPx = 102;

      let currentStackYPx = 0;
      let stackBottomEdgePx = 0;

      visibleAdditionalActionCards.forEach((cardEl, idx) => {
        const expandedExtraHeightPx = idx > 0
          ? nestedExpandedCardExtraHeightPx
          : expandedCardExtraHeightPx;

        const cardHeightPx = cardEl.classList.contains('details-expanded')
          ? (baseCardHeightPx + expandedExtraHeightPx)
          : baseCardHeightPx;

        cardEl.style.transform = `translateY(${currentStackYPx}px)`;
        cardEl.style.zIndex = String(30 - idx);

        stackBottomEdgePx = Math.max(stackBottomEdgePx, currentStackYPx + cardHeightPx);
        currentStackYPx += baseOffset + (cardHeightPx - baseCardHeightPx);
      });

      const additionalStackHeightPx = Math.max(baseCardHeightPx, stackBottomEdgePx);

      document.documentElement.style.setProperty(
        '--additional-folder-dynamic-height',
        `calc(${additionalStackHeightPx}px + (var(--folder-offset) * 2))`
      );

      additionalCardStack.style.height = `${additionalStackHeightPx}px`;

      const additionalFolderBack = additionalCardStack.querySelector('.folder-back');
      if (additionalFolderBack) {
        additionalFolderBack.style.height = `calc(${additionalStackHeightPx}px + (var(--folder-offset) * 2))`;
      }

      additionalActionCards
        .filter(cardEl => cardEl.classList.contains('hidden'))
        .forEach((cardEl) => {
          cardEl.style.transform = '';
          cardEl.style.zIndex = '';
        });

      updateEmptyFolderIndicator(additionalCardStack, visibleAdditionalActionCards.length, additionalActionCards.length);
    }

    function updatePositions() {
      const activeInStack = order.filter((idx) => {
        if (!visibleStates[idx]) return false;
        const cardEl = stackCards[idx];
        if (!cardEl) return false;
        return !cardEl.classList.contains('detached-from-stack');
      });
      const baseOffset = 35;
      const baseCardHeightPx = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-height'), 10) || 155;
      const expandedCardExtraHeightPx = 170;
      const nestedExpandedCardExtraHeightPx = 102;

      let currentStackYPx = 0;
      let stackBottomEdgePx = 0;
      activeInStack.forEach((stackCardIndex, stackPositionIndex) => {
        const cardEl = stackCards[stackCardIndex];
        if (!cardEl) return;

        const expandedExtraHeightPx = stackPositionIndex > 0
          ? nestedExpandedCardExtraHeightPx
          : expandedCardExtraHeightPx;

        const cardHeightPx = cardEl.classList.contains('details-expanded')
          ? (baseCardHeightPx + expandedExtraHeightPx)
          : baseCardHeightPx;

        cardEl.style.setProperty('--stack-y', `${currentStackYPx}px`);
        cardEl.style.zIndex = String(30 - stackPositionIndex);

        stackBottomEdgePx = Math.max(stackBottomEdgePx, currentStackYPx + cardHeightPx);
        currentStackYPx += baseOffset + (cardHeightPx - baseCardHeightPx);
      });

      const stackHeightPx = Math.max(baseCardHeightPx, stackBottomEdgePx);

      document.documentElement.style.setProperty(
        '--folder-dynamic-height',
        `calc(${stackHeightPx}px + (var(--folder-offset) * 2))`
      );

      if (cardStack) {
        cardStack.style.height = `${stackHeightPx}px`;
        // If side panel is in left/right config, update its height to match
        if (sidePanel && (sidePanel.classList.contains('pos-left') || sidePanel.classList.contains('pos-right'))) {
          // Set height to max(bottom of lowest card, 1 card height)
          const minHeight = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-height'), 10) || 155;
          let maxBottom = getLowestCardBottomPx(stackCards, visibleStates, order);
          if (!maxBottom || maxBottom < minHeight) maxBottom = minHeight;
          sidePanel.style.height = maxBottom + 'px';
        }
      }

      stackCards.forEach((card, idx) => {
        card.classList.remove('at-pos-1', 'at-pos-2', 'at-pos-3', 'hidden');
        if (card.classList.contains('detached-from-stack')) {
          card.style.removeProperty('--stack-y');
          return;
        }
        const stackPos = activeInStack.indexOf(idx);
        if (!visibleStates[idx]) {
          card.classList.add('hidden');
          card.style.removeProperty('--stack-y');
          card.style.removeProperty('z-index');
        } else if (stackPos !== -1) {
          card.classList.add(`at-pos-${Math.min(3, stackPos + 1)}`);
        }
      });

      if (defaultTemplateCard) {
        defaultTemplateCard.classList.remove('at-pos-1', 'at-pos-2', 'at-pos-3', 'hidden');
      }

      updateEmptyFolderIndicator(cardStack, activeInStack.length, stackCards.length);

      updateAdditionalActionsFolderSizing();
      // If additional panel is in left/right config, update its height to match
      if (additionalSidePanel && (additionalSidePanel.classList.contains('pos-left') || additionalSidePanel.classList.contains('pos-right'))) {
        // Set height to max(bottom of lowest card, 1 card height)
        const minHeight = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-height'), 10) || 155;
        let maxBottom = getLowestCardBottomPx(
          Array.from(additionalCardStack.querySelectorAll('.additional-stack-card')),
          additionalVisibleStates,
          []
        );
        if (!maxBottom || maxBottom < minHeight) maxBottom = minHeight;
        additionalSidePanel.style.height = maxBottom + 'px';
      }
    }

    function bringAdditionalCardToFront(cardEl) {
      if (!additionalCardStack || !cardEl) return;
      if (cardEl.classList.contains('hidden')) return;
      if (cardEl.classList.contains('swapping')) return;

      const firstCard = additionalCardStack.querySelector('.additional-stack-card');
      if (firstCard === cardEl) return;

      const transformMatch = String(cardEl.style.transform || '').match(/translateY\((-?\d+(?:\.\d+)?)px\)/);
      const currentTranslateY = transformMatch ? Number(transformMatch[1]) : 0;
      cardEl.style.setProperty('--additional-swap-start-y', `${currentTranslateY}px`);

      cardEl.classList.add('swapping');

      setTimeout(() => {
        const firstVisibleCard = Array.from(additionalCardStack.querySelectorAll('.additional-stack-card'))
          .find((candidateCardEl) => !candidateCardEl.classList.contains('hidden'));
        additionalCardStack.insertBefore(cardEl, firstVisibleCard || firstCard);
        cardEl.classList.remove('swapping');
        updateAdditionalActionsFolderSizing();
        renderAdditionalPanelRows();
      }, 300);
    }

    function handleCardToggle(cardIndex, toggleEl) {
      // Unarmed folder stack mapping: 0=Basic Attack, 1=Divine Strike, 2=Blight Smite.
      toggleEl.classList.toggle('active');
      visibleStates[cardIndex] = toggleEl.classList.contains('active');
      if (!visibleStates[cardIndex]) {
        const pos = order.indexOf(cardIndex);
        order.splice(pos, 1);
        order.push(cardIndex);
      }
      updatePositions();
      saveFolderSettingsState();
    }

    function renderAdditionalPanelRows() {
      if (!additionalPanelContent) return;

      const additionalCards = additionalActionFolderCards.length
        ? additionalActionFolderCards
        : Array.from(document.querySelectorAll('.additional-stack-card'));
      const rowsHtml = additionalCards.map((cardEl) => {
        const cardId = cardEl.id;
        const isActive = additionalVisibleStates[cardId] !== false;
        const label = getCardDisplayLabel(cardEl);
        const isDetachedAndHiddenAdditionalCard = !!(cardEl?.classList?.contains('detached-from-stack') && !isActive);
        const labelClassName = isDetachedAndHiddenAdditionalCard
          ? 'toggle-label detached-unavailable'
          : 'toggle-label';
        return `<div class="toggle-row"><div class="panel-toggle-square toggle-grey ${isActive ? 'active' : ''}" data-additional-card-id="${cardId}"></div><div class="${labelClassName}">${label}</div></div>`;
      }).join('');

      additionalPanelContent.innerHTML = `${rowsHtml}<div class="panel-info-text">Toggle visibility of cards within this folder stack.</div>`;
    }

    function handleAdditionalCardToggle(cardId, toggleEl) {
      if (!cardId) return;
      const isCurrentlyActive = additionalVisibleStates[cardId] !== false;
      if (!isCurrentlyActive && typeof globalScope.restoreDetachedAdditionalCardFromToggle === 'function') {
        const wasRestoredFromDetached = !!globalScope.restoreDetachedAdditionalCardFromToggle(cardId);
        if (wasRestoredFromDetached) {
          toggleEl.classList.add('active');
          return;
        }
      }

      const nextActiveState = !(additionalVisibleStates[cardId] !== false);
      additionalVisibleStates[cardId] = nextActiveState;
      toggleEl.classList.toggle('active', nextActiveState);
      updateAdditionalActionsFolderSizing();
      renderAdditionalPanelRows();
      saveFolderSettingsState();
    }

    function bindFolderToggleButtons(globalToggle, additionalGlobalToggle) {
      if (globalToggle && !globalToggle.dataset.folderToggleBound) {
        globalToggle.dataset.folderToggleBound = '1';

        globalToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          globalToggle.classList.toggle('active');
          if (sidePanel) {
            const isFirstOpen = !sidePanel.classList.contains('show');
            sidePanel.classList.toggle('show');
            if (isFirstOpen) {
              // Always open in expanded mode below the folder
              sidePanel.classList.remove('collapsed');
              sidePanel.classList.remove('pos-left', 'pos-right');
              sidePanel.classList.add('pos-bottom');
              cardStack?.classList.remove('panel-collapsed');
            } else if (sidePanel.classList.contains('pos-bottom')) {
              sidePanel.classList.toggle('collapsed');
              cardStack?.classList.toggle('panel-collapsed', sidePanel.classList.contains('collapsed'));
            }
          }
          saveFolderSettingsState();
        });

        globalToggle.addEventListener('touchstart', (e) => {
          e.stopPropagation();
          e.preventDefault();
          globalToggle.classList.toggle('active');
          if (sidePanel) {
            const isFirstOpen = !sidePanel.classList.contains('show');
            sidePanel.classList.toggle('show');
            if (isFirstOpen) {
              // Always open in expanded mode below the folder
              sidePanel.classList.remove('collapsed');
              sidePanel.classList.remove('pos-left', 'pos-right');
              sidePanel.classList.add('pos-bottom');
              cardStack?.classList.remove('panel-collapsed');
            } else if (sidePanel.classList.contains('pos-bottom')) {
              sidePanel.classList.toggle('collapsed');
              cardStack?.classList.toggle('panel-collapsed', sidePanel.classList.contains('collapsed'));
            }
          }
          saveFolderSettingsState();
        }, { passive: false });
      }

      if (additionalGlobalToggle && additionalSidePanel && !additionalGlobalToggle.dataset.folderToggleBound) {
        additionalGlobalToggle.dataset.folderToggleBound = '1';

        const handleAdditionalToggle = (e, isTouch = false) => {
          e.stopPropagation();
          if (isTouch) e.preventDefault();
          additionalGlobalToggle.classList.toggle('active');
          if (additionalSidePanel) {
            const isFirstOpen = !additionalSidePanel.classList.contains('show');
            additionalSidePanel.classList.toggle('show');
            if (isFirstOpen) {
              // Always open in expanded mode below the folder
              additionalSidePanel.classList.remove('collapsed');
              additionalSidePanel.classList.remove('pos-left', 'pos-right');
              additionalSidePanel.classList.add('pos-bottom');
              additionalCardStack?.classList.remove('panel-collapsed');
            } else if (additionalSidePanel.classList.contains('pos-bottom')) {
              additionalSidePanel.classList.toggle('collapsed');
              additionalCardStack?.classList.toggle('panel-collapsed', additionalSidePanel.classList.contains('collapsed'));
            } else {
              additionalSidePanel.classList.remove('collapsed');
              additionalCardStack?.classList.remove('panel-collapsed');
              if (additionalCardStack) {
                additionalSidePanel.style.height = `${additionalCardStack.offsetHeight}px`;
              }
            }
          }
          saveFolderSettingsState();
        };

        additionalGlobalToggle.addEventListener('click', (e) => handleAdditionalToggle(e, false));
        additionalGlobalToggle.addEventListener('touchstart', (e) => handleAdditionalToggle(e, true), { passive: false });
      }
    }

    function bindAdditionalPanelContentHandlers() {
      if (!additionalPanelContent || additionalPanelContent.dataset.folderPanelBound) return;
      additionalPanelContent.dataset.folderPanelBound = '1';

      additionalPanelContent.addEventListener('click', (e) => {
        const toggleEl = e.target.closest('.panel-toggle-square[data-additional-card-id]');
        if (!toggleEl) return;
        e.stopPropagation();
        const cardId = toggleEl.getAttribute('data-additional-card-id');
        handleAdditionalCardToggle(cardId, toggleEl);
      });

      additionalPanelContent.addEventListener('wheel', (e) => {
        e.stopPropagation();
      }, { passive: false });
    }

    function bindAdditionalPanelWheelGuard() {
      if (!additionalSidePanel || additionalSidePanel.dataset.folderWheelGuardBound) return;
      additionalSidePanel.dataset.folderWheelGuardBound = '1';

      additionalSidePanel.addEventListener('wheel', (e) => {
        if (!additionalSidePanel.classList.contains('show')) return;
        e.stopPropagation();
      }, { passive: false });
    }

    return {
      resolvePanelSnapPosition,
      applyPanelPositionClass,
      updateMainPanelSnapPosition,
      updateAdditionalPanelSnapPosition,
      setupSteppedScroll,
      setSteppedScrollDefaultValue,
      updatePositions,
      updateAdditionalActionsFolderSizing,
      bringAdditionalCardToFront,
      handleCardToggle,
      renderAdditionalPanelRows,
      handleAdditionalCardToggle,
      bindFolderToggleButtons,
      bindAdditionalPanelContentHandlers,
      bindAdditionalPanelWheelGuard
    };
  }

  globalScope.Folder = {
    defaults: folderDefaults,
    createFolderSettingsStore,
    initializeAdditionalVisibleStates,
    createFolderRuntime
  };
})(window);
