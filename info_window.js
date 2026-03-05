/**
 * info_window.js
 *
 * //info window
 * Pre-segregation reference notes for extracting and standardizing info-window behavior.
 * This file is intentionally comment-first right now.
 *
 * //info window - SCOPE
 * - Standard movable info windows follow shared logic from index.html:
 *   z-order promotion, recoverable drag clamp, footer-aware lower bounds, and resize limits.
 * - Pinned elements are EXCLUDED from the standard creation flow:
 *   1) character quick title bar (#character-quick-popdown)
 *   2) action indicator group (#action-indicator-window)
 *
 * //info window - NEW WINDOW CREATION (STANDARD ITEM)
 * 1) Markup
 *    - Create a root window element with fixed positioning.
 *    - Add a dedicated header drag handle region.
 *    - Keep close/action controls inside the header, but exclude those controls from drag-start.
 *
 * 2) Stacking
 *    - Include the new root selector in the shared promotion selector (INFO_WINDOW_PROMOTE_SELECTOR).
 *    - Use setFloatingWindowPrimary(...) on pointer/mousedown/touchstart to bring to front.
 *    - New standard windows should remain below pinned top-layer items (footer + action indicators).
 *
 * 3) Drag bounds
 *    - Clamp movement through shared recoverable clamp helpers.
 *    - Lower drag limit is defined by: footer top - this window's header height.
 *    - Result: full header remains visible at the lowest draggable position.
 *
 * 4) Resize bounds
 *    - If resizable, cap max height via getMaxInfoWindowHeightFromTop(...).
 *    - Preserve minimum dimensions and keep the window recoverable.
 *
 * 5) Canvas input isolation
 *    - Add/select root in canvas-blocked selector lists so canvas pan/zoom is not stolen while interacting with the window.
 *
 * //info window - WIDGET DOC SOURCE
 * - Canonical widget creation instructions are maintained in widgets.js.
 * - Do not duplicate "how to make a widget" guidance here.
 * - This file should only describe shared info-window infrastructure APIs.
 */

(function() {
	'use strict';

	//info window - shared clamp visibility constants
	const INFO_WINDOW_MIN_HEADER_VISIBLE_X = 24;
	const INFO_WINDOW_MIN_HEADER_VISIBLE_Y = 24;
	const INFO_WINDOW_DEFAULTS = {
		baseZ: 1000,
		initialLayerCounter: 10010,
		footerTopLayerZ: 2147483000,
		actionIndicatorTopLayerZ: 2147482999,
		promoteSelector: '#log-window, #log-calculator-window, #character-info-window, #load-character-window, #sticky-note-buffer, .sticky-note-window:not(.canvas-sticky-note)',
		excludedElementIds: ['character-quick-popdown'],
		pointerBlockedMovableSelectors: '#log-window, #log-calculator-window, #sticky-note-buffer, .sticky-note-window, .canvas-sticky-note, #character-info-window, #load-character-window',
		wheelBlockedMovableSelectors: '#log-window, #log-calculator-window, #sticky-note-buffer, .sticky-note-window, #character-info-window, #load-character-window',
		pointerBlockedUiSelectors: '.card-detail-panel, .panel-content, .stat-box, .scroll-container, .floating-window-header'
	};

	//info window - compat bridge factory for helper lookup + fallback handling
	function createCompat(core = window.InfoWindow || {}) {
		const compatCore = core || {};
		return {
			getHelper(name, fallbackFactory) {
				const helperFn = compatCore[name];
				if (typeof helperFn === 'function') return helperFn;
				return typeof fallbackFactory === 'function' ? fallbackFactory() : null;
			},
			invoke(name, args = [], fallbackValue = null) {
				const helperFn = this.getHelper(name);
				if (typeof helperFn === 'function') {
					return helperFn(...(Array.isArray(args) ? args : []));
				}
				return fallbackValue;
			},
			createPinnedTopLayerManager(options) {
				const helperFn = this.getHelper('createPinnedTopLayerManager');
				return typeof helperFn === 'function' ? helperFn(options) : null;
			},
			createWindowTypeResolver(windowTypeMap, options, fallbackResolver) {
				const helperFn = this.getHelper('createWindowTypeResolver');
				if (typeof helperFn === 'function') return helperFn(windowTypeMap, options);
				return fallbackResolver;
			},
			createLayerManager(options) {
				const helperFn = this.getHelper('createLayerManager');
				return typeof helperFn === 'function' ? helperFn(options) : null;
			},
			createPromotionHelpers(options) {
				const helperFn = this.getHelper('createPromotionHelpers');
				return typeof helperFn === 'function' ? helperFn(options) : null;
			},
			bindWindowPrimaryPromotion(options) {
				const helperFn = this.getHelper('bindWindowPrimaryPromotion');
				return typeof helperFn === 'function' ? helperFn(options) : null;
			},
			createCanvasInputBlockPolicy(options) {
				const helperFn = this.getHelper('createCanvasInputBlockPolicy');
				return typeof helperFn === 'function' ? helperFn(options) : null;
			}
		};
	}

	//info window - shared footer boundary utility for bottom clamps
	function getFooterTopBoundary() {
		const footerEl = document.querySelector('footer');
		if (!footerEl) return window.innerHeight;
		const footerRect = footerEl.getBoundingClientRect();
		if (!footerRect || footerRect.height <= 0) return window.innerHeight;
		return footerRect.top;
	}

	//info window - header-height probe used for per-window lower drag limit
	function getInfoWindowHeaderHeight(windowEl) {
		if (!windowEl) return 36;
		const headerEl = windowEl.querySelector('.floating-window-header, .sticky-note-buffer-header, .sticky-note-header');
		return headerEl?.offsetHeight || 36;
	}

	//info window - recoverable clamp: keep header visible and stop at footer top
	function clampInfoWindowRecoverableTopLeft(windowEl, leftPx, topPx, headerHeightOverride = null) {
		const width = windowEl?.offsetWidth || 280;
		const headerHeight = Math.max(1, headerHeightOverride ?? getInfoWindowHeaderHeight(windowEl));
		const footerTop = getFooterTopBoundary();

		const minLeft = INFO_WINDOW_MIN_HEADER_VISIBLE_X - width;
		const maxLeft = window.innerWidth - INFO_WINDOW_MIN_HEADER_VISIBLE_X;
		const minTop = INFO_WINDOW_MIN_HEADER_VISIBLE_Y - headerHeight;
		const maxTopFromViewport = window.innerHeight - headerHeight;
		const maxTopFromFooter = footerTop - headerHeight;
		const maxTop = Math.max(minTop, Math.min(maxTopFromViewport, maxTopFromFooter));

		return {
			left: Math.min(maxLeft, Math.max(minLeft, leftPx)),
			top: Math.min(maxTop, Math.max(minTop, topPx))
		};
	}

	//info window - fixed-position variant (top/right anchored windows)
	function clampRecoverableFixedWindowTopRight(windowEl, topPx, rightPx) {
		const width = windowEl?.offsetWidth || 280;
		const left = window.innerWidth - rightPx - width;
		const clampedLeftTop = clampInfoWindowRecoverableTopLeft(windowEl, left, topPx);
		return {
			top: clampedLeftTop.top,
			right: window.innerWidth - clampedLeftTop.left - width
		};
	}

	//info window - fixed-position variant (bottom/right anchored windows)
	function clampRecoverableFixedWindowBottomRight(windowEl, rightPx, bottomPx) {
		const width = windowEl?.offsetWidth || 280;
		const height = windowEl?.offsetHeight || 280;
		const left = window.innerWidth - rightPx - width;
		const top = window.innerHeight - bottomPx - height;
		const clampedLeftTop = clampInfoWindowRecoverableTopLeft(windowEl, left, top);
		return {
			right: window.innerWidth - clampedLeftTop.left - width,
			bottom: window.innerHeight - clampedLeftTop.top - height
		};
	}

	//info window - max-height helper respecting footer top + viewport
	function getMaxInfoWindowHeightFromTop(topPx, minHeightPx = 250, bottomPaddingPx = 12) {
		const footerTop = getFooterTopBoundary();
		const viewportLimit = window.innerHeight - topPx - bottomPaddingPx;
		const footerLimit = footerTop - topPx - bottomPaddingPx;
		const maxAllowed = Math.min(viewportLimit, footerLimit);
		return Math.max(minHeightPx, maxAllowed);
	}

	//info window - shared layer manager for movable info-window fronting/stacking
	function createLayerManager(options = {}) {
		const selector = String(options.selector || '').trim();
		if (!selector) {
			throw new Error('InfoWindow.createLayerManager requires a non-empty selector');
		}

		const baseZ = Number.isFinite(Number(options.baseZ)) ? Number(options.baseZ) : 1000;
		const topLimitZ = Number.isFinite(Number(options.topLimitZ)) ? Number(options.topLimitZ) : (baseZ + 10000);
		let layerCounter = Number.isFinite(Number(options.initialLayerCounter))
			? Number(options.initialLayerCounter)
			: (baseZ + 10);
		const resolveInfoWindowElement = typeof options.resolveInfoWindowElement === 'function'
			? options.resolveInfoWindowElement
			: (() => null);
		const excludedElementIds = Array.isArray(options.excludedElementIds)
			? options.excludedElementIds.map((id) => String(id || '').trim()).filter(Boolean)
			: [];
		let delegatedHandler = null;

		const isExcludedElement = (windowEl) => {
			if (!windowEl || !(windowEl instanceof Element)) return true;
			if (!windowEl.id) return false;
			return excludedElementIds.includes(windowEl.id);
		};

		const bringInfoWindowToFront = (windowEl) => {
			if (!windowEl || isExcludedElement(windowEl)) return;
			const infoWindows = Array.from(document.querySelectorAll(selector));
			let currentMaxZ = baseZ + 9;
			infoWindows.forEach((infoWindowEl) => {
				const computedZ = Number.parseInt(window.getComputedStyle(infoWindowEl).zIndex, 10);
				if (Number.isFinite(computedZ)) {
					currentMaxZ = Math.max(currentMaxZ, Math.min(topLimitZ, computedZ));
				}
			});
			layerCounter = Math.max(layerCounter + 1, currentMaxZ + 1, baseZ + 10);
			if (layerCounter > topLimitZ) {
				layerCounter = topLimitZ;
			}
			windowEl.style.setProperty('z-index', String(layerCounter), 'important');
		};

		const setFloatingWindowPrimary = (windowType, windowElOverride = null) => {
			const targetWindow = windowElOverride || resolveInfoWindowElement(windowType);
			bringInfoWindowToFront(targetWindow);
		};

		const bindDelegatedPromotion = ({ root = document, capture = true, windowType = 'sticky-note' } = {}) => {
			if (delegatedHandler) {
				root.removeEventListener('pointerdown', delegatedHandler, capture);
			}
			delegatedHandler = (event) => {
				const targetEl = event.target instanceof Element ? event.target.closest(selector) : null;
				if (!targetEl) return;
				setFloatingWindowPrimary(windowType, targetEl);
			};
			root.addEventListener('pointerdown', delegatedHandler, capture);
			return () => {
				if (!delegatedHandler) return;
				root.removeEventListener('pointerdown', delegatedHandler, capture);
				delegatedHandler = null;
			};
		};

		return {
			bringInfoWindowToFront,
			setFloatingWindowPrimary,
			bindDelegatedPromotion
		};
	}

	//info window - shared canvas input-block policy for pointer/wheel isolation
	function createCanvasInputBlockPolicy(options = {}) {
		const pointerBlockedMovableSelectors = String(
			options.pointerBlockedMovableSelectors
				|| INFO_WINDOW_DEFAULTS.pointerBlockedMovableSelectors
		);
		const wheelBlockedMovableSelectors = String(
			options.wheelBlockedMovableSelectors
				|| INFO_WINDOW_DEFAULTS.wheelBlockedMovableSelectors
		);
		const pointerBlockedUiSelectors = String(
			options.pointerBlockedUiSelectors
				|| INFO_WINDOW_DEFAULTS.pointerBlockedUiSelectors
		);

		const isCanvasPointerBlockedTarget = (rawTarget) => {
			const target = rawTarget instanceof Element ? rawTarget : null;
			if (!target) return false;
			if (target.closest(pointerBlockedMovableSelectors)) return true;
			if (target.closest(pointerBlockedUiSelectors)) return true;
			return false;
		};

		const isCanvasWheelBlockedTarget = (rawTarget) => {
			const target = rawTarget instanceof Element ? rawTarget : null;
			if (!target) return false;
			if (target.closest(wheelBlockedMovableSelectors)) return true;
			if (target.closest(pointerBlockedUiSelectors)) return true;
			return false;
		};

		return {
			pointerBlockedMovableSelectors,
			wheelBlockedMovableSelectors,
			pointerBlockedUiSelectors,
			isCanvasPointerBlockedTarget,
			isCanvasWheelBlockedTarget
		};
	}

	//info window - shared pinned top-layer manager for footer + action-indicator group
	function createPinnedTopLayerManager(options = {}) {
		const footerTopLayerZ = Number.isFinite(Number(options.footerTopLayerZ))
			? Number(options.footerTopLayerZ)
			: INFO_WINDOW_DEFAULTS.footerTopLayerZ;
		const actionIndicatorTopLayerZ = Number.isFinite(Number(options.actionIndicatorTopLayerZ))
			? Number(options.actionIndicatorTopLayerZ)
			: INFO_WINDOW_DEFAULTS.actionIndicatorTopLayerZ;
		const floatingWindowTopLimitZ = Number.isFinite(Number(options.floatingWindowTopLimitZ))
			? Number(options.floatingWindowTopLimitZ)
			: (actionIndicatorTopLayerZ - 1);
		const footerSelector = String(options.footerSelector || 'footer');
		const actionIndicatorSelector = String(options.actionIndicatorSelector || '#action-indicator-window');

		const enforce = () => {
			const footerEl = document.querySelector(footerSelector);
			if (footerEl) {
				footerEl.style.setProperty('z-index', String(footerTopLayerZ), 'important');
			}
			const actionIndicatorEl = document.querySelector(actionIndicatorSelector);
			if (actionIndicatorEl) {
				actionIndicatorEl.style.setProperty('z-index', String(actionIndicatorTopLayerZ), 'important');
			}
		};

		return {
			footerTopLayerZ,
			actionIndicatorTopLayerZ,
			floatingWindowTopLimitZ,
			enforce
		};
	}

	//info window - pinned top-layer bootstrap (phase 12): manager + fallback enforce + resolved z values
	function bootstrapPinnedTopLayers(options = {}) {
		const manager = createPinnedTopLayerManager(options);
		const footerTopLayerZ = manager?.footerTopLayerZ ?? INFO_WINDOW_DEFAULTS.footerTopLayerZ;
		const actionIndicatorTopLayerZ = manager?.actionIndicatorTopLayerZ ?? INFO_WINDOW_DEFAULTS.actionIndicatorTopLayerZ;
		const floatingWindowTopLimitZ = manager?.floatingWindowTopLimitZ ?? (actionIndicatorTopLayerZ - 1);

		if (manager && typeof manager.enforce === 'function') {
			manager.enforce();
		} else {
			const footerSelector = String(options.footerSelector || 'footer');
			const actionIndicatorSelector = String(options.actionIndicatorSelector || '#action-indicator-window');
			const footerEl = document.querySelector(footerSelector);
			if (footerEl) {
				footerEl.style.setProperty('z-index', String(footerTopLayerZ), 'important');
			}
			const actionIndicatorEl = document.querySelector(actionIndicatorSelector);
			if (actionIndicatorEl) {
				actionIndicatorEl.style.setProperty('z-index', String(actionIndicatorTopLayerZ), 'important');
			}
		}

		return {
			manager,
			footerTopLayerZ,
			actionIndicatorTopLayerZ,
			floatingWindowTopLimitZ
		};
	}

	//info window - shared resolver factory for windowType -> root element mapping
	function createWindowTypeResolver(windowTypeMap = {}, options = {}) {
		const fallbackResolver = typeof options.fallbackResolver === 'function'
			? options.fallbackResolver
			: (() => null);

		return (windowType) => {
			const resolvedType = String(windowType || '').trim();
			if (!resolvedType) return null;
			const entry = windowTypeMap[resolvedType];
			if (typeof entry === 'function') {
				const resolvedElement = entry();
				return resolvedElement instanceof Element ? resolvedElement : null;
			}
			if (entry instanceof Element) return entry;
			if (typeof entry === 'string' && entry.trim()) {
				const resolvedElement = document.querySelector(entry);
				return resolvedElement instanceof Element ? resolvedElement : null;
			}
			const fallbackElement = fallbackResolver(resolvedType);
			return fallbackElement instanceof Element ? fallbackElement : null;
		};
	}

	//info window - shared binder for mousedown/touchstart fronting listeners
	function bindWindowPrimaryPromotion(options = {}) {
		const bindings = Array.isArray(options.bindings) ? options.bindings : [];
		const setFloatingWindowPrimary = typeof options.setFloatingWindowPrimary === 'function'
			? options.setFloatingWindowPrimary
			: null;
		if (!setFloatingWindowPrimary) return [];

		const cleanupHandlers = [];
		bindings.forEach((binding) => {
			if (!binding || !binding.windowType) return;
			const resolvedElement = typeof binding.element === 'function'
				? binding.element()
				: binding.element;
			if (!(resolvedElement instanceof Element)) return;

			const eventTypes = Array.isArray(binding.events) && binding.events.length > 0
				? binding.events
				: ['mousedown', 'touchstart'];
			eventTypes.forEach((eventType) => {
				const isTouch = eventType === 'touchstart';
				const listener = () => setFloatingWindowPrimary(binding.windowType);
				const listenerOptions = isTouch ? { passive: true } : undefined;
				resolvedElement.addEventListener(eventType, listener, listenerOptions);
				cleanupHandlers.push(() => resolvedElement.removeEventListener(eventType, listener, listenerOptions));
			});
		});

		return cleanupHandlers;
	}

	//info window - phase 13 bootstrap for primary-promotion bindings with legacy fallback listeners
	function bootstrapWindowPrimaryPromotion(options = {}) {
		const setFloatingWindowPrimary = typeof options.setFloatingWindowPrimary === 'function'
			? options.setFloatingWindowPrimary
			: null;
		const bindings = Array.isArray(options.bindings) ? options.bindings : [];
		const fallbackBindings = Array.isArray(options.fallbackBindings) ? options.fallbackBindings : [];
		const bindWindowPrimaryPromotionFn = typeof options.bindWindowPrimaryPromotion === 'function'
			? options.bindWindowPrimaryPromotion
			: null;

		if (bindWindowPrimaryPromotionFn && setFloatingWindowPrimary) {
			const sharedCleanup = bindWindowPrimaryPromotionFn({
				setFloatingWindowPrimary,
				bindings
			});
			if (sharedCleanup !== null && sharedCleanup !== undefined) {
				return {
					usedSharedBinder: true,
					cleanupHandlers: Array.isArray(sharedCleanup) ? sharedCleanup : []
				};
			}
		}

		const cleanupHandlers = [];
		fallbackBindings.forEach((binding) => {
			if (!binding) return;
			const resolvedElement = typeof binding.element === 'function'
				? binding.element()
				: binding.element;
			const promote = typeof binding.promote === 'function' ? binding.promote : null;
			if (!(resolvedElement instanceof Element) || !promote) return;

			const mouseListener = () => promote();
			resolvedElement.addEventListener('mousedown', mouseListener);
			cleanupHandlers.push(() => resolvedElement.removeEventListener('mousedown', mouseListener));

			const touchListener = () => promote();
			const touchOptions = { passive: true };
			resolvedElement.addEventListener('touchstart', touchListener, touchOptions);
			cleanupHandlers.push(() => resolvedElement.removeEventListener('touchstart', touchListener, touchOptions));
		});

		return {
			usedSharedBinder: false,
			cleanupHandlers
		};
	}

	//info window - phase 14 bootstrap for delegated sticky-note/dynamic overlay promotion
	function bootstrapDelegatedPromotion(options = {}) {
		const layerManager = options.layerManager || null;
		const root = options.root instanceof EventTarget ? options.root : document;
		const capture = options.capture === undefined ? true : !!options.capture;
		const windowType = String(options.windowType || 'sticky-note');
		const selector = String(options.selector || '').trim();
		const promote = typeof options.promote === 'function' ? options.promote : null;

		if (layerManager && typeof layerManager.bindDelegatedPromotion === 'function') {
			return {
				usedLayerManagerBinder: true,
				cleanup: layerManager.bindDelegatedPromotion({ root, capture, windowType })
			};
		}

		if (!selector || !promote) {
			return {
				usedLayerManagerBinder: false,
				cleanup: null
			};
		}

		const listener = (event) => {
			const targetEl = event.target instanceof Element ? event.target.closest(selector) : null;
			if (!targetEl) return;
			promote(windowType, targetEl);
		};
		root.addEventListener('pointerdown', listener, capture);

		return {
			usedLayerManagerBinder: false,
			cleanup: () => root.removeEventListener('pointerdown', listener, capture)
		};
	}

	//info window - phase 15 bootstrap for core helper bridge + canvas input block helpers
	function bootstrapCanvasInteractionHelpers(options = {}) {
		const compat = options.compat && typeof options.compat.getHelper === 'function'
			? options.compat
			: null;
		const defaults = options.defaults && typeof options.defaults === 'object'
			? options.defaults
			: INFO_WINDOW_DEFAULTS;

		const getHelperFn = (name, localFallbackFactory) => {
			if (compat) {
				return compat.getHelper(name, localFallbackFactory);
			}
			const localFallback = typeof localFallbackFactory === 'function' ? localFallbackFactory() : null;
			return typeof localFallback === 'function' ? localFallback : localFallback;
		};

		const getFooterTopBoundaryHelper = getHelperFn('getFooterTopBoundary', () => getFooterTopBoundary);
		const getInfoWindowHeaderHeightHelper = getHelperFn('getInfoWindowHeaderHeight', () => getInfoWindowHeaderHeight);
		const clampInfoWindowRecoverableTopLeftHelper = getHelperFn('clampInfoWindowRecoverableTopLeft', () => clampInfoWindowRecoverableTopLeft);
		const clampRecoverableFixedWindowTopRightHelper = getHelperFn('clampRecoverableFixedWindowTopRight', () => clampRecoverableFixedWindowTopRight);
		const clampRecoverableFixedWindowBottomRightHelper = getHelperFn('clampRecoverableFixedWindowBottomRight', () => clampRecoverableFixedWindowBottomRight);
		const getMaxInfoWindowHeightFromTopHelper = getHelperFn('getMaxInfoWindowHeightFromTop', () => getMaxInfoWindowHeightFromTop);

		const pointerBlockedMovableSelectors = String(
			defaults.pointerBlockedMovableSelectors
				|| INFO_WINDOW_DEFAULTS.pointerBlockedMovableSelectors
		);
		const wheelBlockedMovableSelectors = String(
			defaults.wheelBlockedMovableSelectors
				|| INFO_WINDOW_DEFAULTS.wheelBlockedMovableSelectors
		);
		const pointerBlockedUiSelectors = String(
			defaults.pointerBlockedUiSelectors
				|| INFO_WINDOW_DEFAULTS.pointerBlockedUiSelectors
		);

		const canvasInputBlockPolicy = createCanvasInputBlockPolicy({
			pointerBlockedMovableSelectors,
			wheelBlockedMovableSelectors,
			pointerBlockedUiSelectors
		});

		const isCanvasPointerBlockedTarget = (rawTarget) => {
			if (canvasInputBlockPolicy && typeof canvasInputBlockPolicy.isCanvasPointerBlockedTarget === 'function') {
				return canvasInputBlockPolicy.isCanvasPointerBlockedTarget(rawTarget);
			}
			const target = rawTarget instanceof Element ? rawTarget : null;
			if (!target) return false;
			if (target.closest(pointerBlockedMovableSelectors)) return true;
			if (target.closest(pointerBlockedUiSelectors)) return true;
			return false;
		};

		const isCanvasWheelBlockedTarget = (rawTarget) => {
			if (canvasInputBlockPolicy && typeof canvasInputBlockPolicy.isCanvasWheelBlockedTarget === 'function') {
				return canvasInputBlockPolicy.isCanvasWheelBlockedTarget(rawTarget);
			}
			const target = rawTarget instanceof Element ? rawTarget : null;
			if (!target) return false;
			if (target.closest(wheelBlockedMovableSelectors)) return true;
			if (target.closest(pointerBlockedUiSelectors)) return true;
			return false;
		};

		return {
			getFooterTopBoundary: getFooterTopBoundaryHelper,
			getInfoWindowHeaderHeight: getInfoWindowHeaderHeightHelper,
			clampInfoWindowRecoverableTopLeft: clampInfoWindowRecoverableTopLeftHelper,
			clampRecoverableFixedWindowTopRight: clampRecoverableFixedWindowTopRightHelper,
			clampRecoverableFixedWindowBottomRight: clampRecoverableFixedWindowBottomRightHelper,
			getMaxInfoWindowHeightFromTop: getMaxInfoWindowHeightFromTopHelper,
			pointerBlockedMovableSelectors,
			wheelBlockedMovableSelectors,
			pointerBlockedUiSelectors,
			canvasInputBlockPolicy,
			isCanvasPointerBlockedTarget,
			isCanvasWheelBlockedTarget
		};
	}

	//info window - phase 17 bootstrap for core resolver/layer/primary/promotion controllers
	function bootstrapInfoWindowControllers(options = {}) {
		const compat = options.compat && typeof options.compat.getHelper === 'function' && typeof options.compat.invoke === 'function'
			? options.compat
			: createCompat(window.InfoWindow || {});
		const defaults = options.defaults && typeof options.defaults === 'object'
			? options.defaults
			: INFO_WINDOW_DEFAULTS;
		const windowTypeMap = options.windowTypeMap && typeof options.windowTypeMap === 'object'
			? options.windowTypeMap
			: {};
		const resolveFallback = typeof options.resolveFallback === 'function'
			? options.resolveFallback
			: (() => null);
		const pinnedOptions = options.pinnedOptions && typeof options.pinnedOptions === 'object'
			? options.pinnedOptions
			: {
				footerTopLayerZ: Number.isFinite(Number(defaults.footerTopLayerZ)) ? Number(defaults.footerTopLayerZ) : INFO_WINDOW_DEFAULTS.footerTopLayerZ,
				actionIndicatorTopLayerZ: Number.isFinite(Number(defaults.actionIndicatorTopLayerZ)) ? Number(defaults.actionIndicatorTopLayerZ) : INFO_WINDOW_DEFAULTS.actionIndicatorTopLayerZ,
				footerSelector: 'footer',
				actionIndicatorSelector: '#action-indicator-window'
			};

		const baseZ = Number.isFinite(Number(options.baseZ))
			? Number(options.baseZ)
			: (Number.isFinite(Number(defaults.baseZ)) ? Number(defaults.baseZ) : INFO_WINDOW_DEFAULTS.baseZ);
		const promoteSelector = String(options.promoteSelector || defaults.promoteSelector || INFO_WINDOW_DEFAULTS.promoteSelector);
		const excludedElementIds = Array.isArray(options.excludedElementIds)
			? options.excludedElementIds.map((id) => String(id || '').trim()).filter(Boolean)
			: (Array.isArray(defaults.excludedElementIds)
				? defaults.excludedElementIds.map((id) => String(id || '').trim()).filter(Boolean)
				: INFO_WINDOW_DEFAULTS.excludedElementIds);
		const initialLayerCounter = Number.isFinite(Number(options.initialLayerCounter))
			? Number(options.initialLayerCounter)
			: (Number.isFinite(Number(defaults.initialLayerCounter))
				? Number(defaults.initialLayerCounter)
				: INFO_WINDOW_DEFAULTS.initialLayerCounter);

		const bootstrapPinnedTopLayersFn = compat.getHelper('bootstrapPinnedTopLayers', () => bootstrapPinnedTopLayers);
		const pinnedBootstrap = typeof bootstrapPinnedTopLayersFn === 'function'
			? bootstrapPinnedTopLayersFn(pinnedOptions)
			: null;
		const pinnedLayerManager = pinnedBootstrap?.manager
			|| compat.invoke('createPinnedTopLayerManager', [pinnedOptions], null);
		const footerTopLayerZ = Number.isFinite(Number(pinnedBootstrap?.footerTopLayerZ))
			? Number(pinnedBootstrap.footerTopLayerZ)
			: (Number.isFinite(Number(pinnedLayerManager?.footerTopLayerZ))
				? Number(pinnedLayerManager.footerTopLayerZ)
				: (Number.isFinite(Number(pinnedOptions.footerTopLayerZ))
					? Number(pinnedOptions.footerTopLayerZ)
					: INFO_WINDOW_DEFAULTS.footerTopLayerZ));
		const actionIndicatorTopLayerZ = Number.isFinite(Number(pinnedBootstrap?.actionIndicatorTopLayerZ))
			? Number(pinnedBootstrap.actionIndicatorTopLayerZ)
			: (Number.isFinite(Number(pinnedLayerManager?.actionIndicatorTopLayerZ))
				? Number(pinnedLayerManager.actionIndicatorTopLayerZ)
				: (Number.isFinite(Number(pinnedOptions.actionIndicatorTopLayerZ))
					? Number(pinnedOptions.actionIndicatorTopLayerZ)
					: INFO_WINDOW_DEFAULTS.actionIndicatorTopLayerZ));
		const derivedTopLimitZ = Number.isFinite(Number(pinnedBootstrap?.floatingWindowTopLimitZ))
			? Number(pinnedBootstrap.floatingWindowTopLimitZ)
			: (Number.isFinite(Number(pinnedLayerManager?.floatingWindowTopLimitZ))
				? Number(pinnedLayerManager.floatingWindowTopLimitZ)
				: (actionIndicatorTopLayerZ - 1));
		const topLimitZ = Number.isFinite(Number(options.topLimitZ))
			? Number(options.topLimitZ)
			: derivedTopLimitZ;

		const resolveInfoWindowElement = compat.invoke('createWindowTypeResolver', [windowTypeMap, undefined], resolveFallback);
		const infoWindowLayerManager = compat.invoke('createLayerManager', [{
			selector: promoteSelector,
			baseZ,
			topLimitZ,
			initialLayerCounter,
			excludedElementIds,
			resolveInfoWindowElement
		}], null);

		const createFloatingWindowPrimaryFn = compat.getHelper('createFloatingWindowPrimary', () => createFloatingWindowPrimary);
		const infoWindowPrimaryApi = typeof createFloatingWindowPrimaryFn === 'function'
			? createFloatingWindowPrimaryFn({
				layerManager: infoWindowLayerManager,
				resolveInfoWindowElement,
				fallbackBaseZ: baseZ,
				excludedElementIds
			})
			: null;

		const setFloatingWindowPrimary = infoWindowPrimaryApi?.setFloatingWindowPrimary
			|| ((windowType, windowElOverride = null) => {
				if (infoWindowLayerManager && typeof infoWindowLayerManager.setFloatingWindowPrimary === 'function') {
					infoWindowLayerManager.setFloatingWindowPrimary(windowType, windowElOverride);
					return;
				}
				const targetWindow = windowElOverride || resolveInfoWindowElement(windowType);
				if (!targetWindow) return;
				if (targetWindow.id && excludedElementIds.includes(String(targetWindow.id).trim())) return;
				targetWindow.style.setProperty('z-index', String(baseZ + 10), 'important');
			});

		const infoWindowPromotionHelpers = compat.invoke('createPromotionHelpers', [{ setFloatingWindowPrimary }], null);

		return {
			baseZ,
			topLimitZ,
			initialLayerCounter,
			pinnedOptions,
			pinnedBootstrap,
			pinnedLayerManager,
			footerTopLayerZ,
			actionIndicatorTopLayerZ,
			floatingWindowTopLimitZ: topLimitZ,
			usedPinnedBootstrap: !!pinnedBootstrap,
			promoteSelector,
			excludedElementIds,
			resolveInfoWindowElement,
			infoWindowLayerManager,
			infoWindowPrimaryApi,
			setFloatingWindowPrimary,
			infoWindowPromotionHelpers
		};
	}

	//info window - shared promotion wrappers for common window types
	function createPromotionHelpers(options = {}) {
		const promote = typeof options.setFloatingWindowPrimary === 'function'
			? options.setFloatingWindowPrimary
			: null;
		if (!promote) {
			return {
				promoteInfoWindow: () => {},
				promoteCharacterInfoWindow: () => {},
				promoteLoadCharacterWindow: () => {},
				promoteLogWindow: () => {},
				promoteCalculatorWindow: () => {}
			};
		}

		const typeMap = {
			character: options.characterType || 'character',
			load: options.loadType || 'load',
			log: options.logType || 'log',
			calculator: options.calculatorType || 'calculator'
		};

		const promoteInfoWindow = (windowType, windowElOverride = null) => {
			promote(windowType, windowElOverride);
		};

		return {
			promoteInfoWindow,
			promoteCharacterInfoWindow: () => promoteInfoWindow(typeMap.character),
			promoteLoadCharacterWindow: () => promoteInfoWindow(typeMap.load),
			promoteLogWindow: () => promoteInfoWindow(typeMap.log),
			promoteCalculatorWindow: () => promoteInfoWindow(typeMap.calculator)
		};
	}

	//info window - phase 10 bootstrap for shared primary fronting API + global export wiring
	function createFloatingWindowPrimary(options = {}) {
		const layerManager = options.layerManager || null;
		const resolveInfoWindowElement = typeof options.resolveInfoWindowElement === 'function'
			? options.resolveInfoWindowElement
			: (() => null);
		const fallbackBaseZ = Number.isFinite(Number(options.fallbackBaseZ))
			? Number(options.fallbackBaseZ)
			: INFO_WINDOW_DEFAULTS.baseZ;
		const excludedElementIds = Array.isArray(options.excludedElementIds)
			? options.excludedElementIds.map((id) => String(id || '').trim()).filter(Boolean)
			: INFO_WINDOW_DEFAULTS.excludedElementIds;

		const setFloatingWindowPrimary = (windowType, windowElOverride = null) => {
			if (layerManager && typeof layerManager.setFloatingWindowPrimary === 'function') {
				layerManager.setFloatingWindowPrimary(windowType, windowElOverride);
				return;
			}
			const targetWindow = windowElOverride || resolveInfoWindowElement(windowType);
			if (!targetWindow) return;
			if (targetWindow.id && excludedElementIds.includes(String(targetWindow.id).trim())) return;
			targetWindow.style.setProperty('z-index', String(fallbackBaseZ + 10), 'important');
		};

		const attachGlobal = (target = window, key = 'setFloatingWindowPrimary') => {
			if (!target || !key) return setFloatingWindowPrimary;
			target[key] = setFloatingWindowPrimary;
			return setFloatingWindowPrimary;
		};

		return {
			setFloatingWindowPrimary,
			attachGlobal
		};
	}

	//info window - namespace export for future segregation
	window.InfoWindow = {
		defaults: INFO_WINDOW_DEFAULTS,
		createCompat,
		INFO_WINDOW_MIN_HEADER_VISIBLE_X,
		INFO_WINDOW_MIN_HEADER_VISIBLE_Y,
		getFooterTopBoundary,
		getInfoWindowHeaderHeight,
		clampInfoWindowRecoverableTopLeft,
		clampRecoverableFixedWindowTopRight,
		clampRecoverableFixedWindowBottomRight,
		getMaxInfoWindowHeightFromTop,
		createLayerManager,
		createCanvasInputBlockPolicy,
		createPinnedTopLayerManager,
		bootstrapPinnedTopLayers,
		createWindowTypeResolver,
		bindWindowPrimaryPromotion,
		bootstrapWindowPrimaryPromotion,
		bootstrapDelegatedPromotion,
		bootstrapCanvasInteractionHelpers,
		bootstrapInfoWindowControllers,
		createPromotionHelpers,
		createFloatingWindowPrimary
	};

	//info window - legacy-compatible globals used by current index/widgets runtime
	window.clampRecoverableFixedWindowTopRight = clampRecoverableFixedWindowTopRight;
	window.clampRecoverableFixedWindowBottomRight = clampRecoverableFixedWindowBottomRight;
	window.getMaxInfoWindowHeightFromTop = getMaxInfoWindowHeightFromTop;
})();
