/**
 * DOM CACHE MODULE
 * Centralized DOM element caching and query optimization
 * Reduces redundant querySelector calls and improves performance
 */

// DOM element cache with lazy loading
const domCache = new Map();

// Ensure this loads before other modules that depend on it
if (typeof window !== 'undefined') {
    window.domCache = domCache;
}

/**
 * Smart cached DOM query with selective caching strategy
 * @param {string} selector - CSS selector string
 * @param {boolean} forceRefresh - Force cache refresh
 * @returns {Element|null} Cached or newly queried element
 */
const $ = (selector, forceRefresh = false) => {
    // Dynamic selectors that change frequently - always query fresh
    const dynamicSelectors = [
        '.board.active', '.board[data-board-id=', '.sticky-note', '.board-title-circle',
        '.emoji-sticker', '.color-palette', '.deleted-note', '.board-button'
    ];
    
    // Board-specific selectors that change when switching boards
    const boardSpecificSelectors = [
        `.board[data-board-id="${currentBoardId || 1}"]`,
        '.board.active'
    ];
    
    // Check if this is a dynamic or board-specific selector
    const isDynamic = dynamicSelectors.some(ds => selector.includes(ds));
    const isBoardSpecific = boardSpecificSelectors.some(bs => selector === bs);
    
    if (isDynamic || isBoardSpecific || forceRefresh) {
        const element = document.querySelector(selector);
        // Cache board-specific selectors for current session
        if (isBoardSpecific && !isDynamic) {
            domCache.set(selector, element);
        }
        return element;
    }
    
    // Static selectors - use persistent caching
    if (!domCache.has(selector)) {
        const element = document.querySelector(selector);
        domCache.set(selector, element);
        return element;
    }
    return domCache.get(selector);
};

/**
 * Smart cached querySelectorAll with selective caching
 * @param {string} selector - CSS selector string
 * @param {boolean} forceRefresh - Force cache refresh
 * @returns {Array} Array of elements with all Array methods
 */
const $$ = (selector, forceRefresh = false) => {
    // Dynamic selectors that change frequently - always query fresh
    const dynamicSelectors = [
        '.board', '.board-button', '.sticky-note', '.board-title-circle',
        '.emoji-sticker', '.color-palette', '.deleted-note', '.emoji-item',
        '.sticky-note.selected', '.board.active', '.board-pattern-option',
        '.board-color-option', '.color-option'
    ];
    
    // Check if this is a dynamic selector
    const isDynamic = dynamicSelectors.some(ds => selector.includes(ds));
    
    if (isDynamic || forceRefresh) {
        return Array.from(document.querySelectorAll(selector));
    }
    
    // Static selectors - use caching
    const cacheKey = `all:${selector}`;
    if (!domCache.has(cacheKey)) {
        const elements = Array.from(document.querySelectorAll(selector));
        domCache.set(cacheKey, elements);
        return elements;
    }
    
    // Return fresh copy to preserve Array methods
    const cached = domCache.get(cacheKey);
    return Array.isArray(cached) ? [...cached] : Array.from(document.querySelectorAll(selector));
};

/**
 * Scoped query within a specific element with caching
 * @param {Element} parent - Parent element to query within
 * @param {string} selector - CSS selector string
 * @returns {Element|null} Found element or null
 */
const $within = (parent, selector) => {
    if (!parent) return null;
    const cacheKey = `${parent.className || 'element'}:${selector}`;
    if (!domCache.has(cacheKey)) {
        const element = parent.querySelector(selector);
        domCache.set(cacheKey, element);
        return element;
    }
    return domCache.get(cacheKey);
};

/**
 * Frequently accessed elements - pre-cached for maximum performance
 * Uses safe fallbacks to prevent errors during initialization
 */
const DOM = {
    // Core UI elements - static, cached persistently
    get boardsContainer() { return $('.boards-container'); },
    get activeBoard() { return $('.board.active'); },
    get currentBoard() { 
        // Safe fallback for currentBoardId which may not be defined yet
        const boardId = (typeof window !== 'undefined' && window.currentBoardId) || 1;
        return $(`.board[data-board-id="${boardId}"]`); 
    },
    get boardsNavigation() { return $('.boards-navigation'); },
    get addBoardButton() { return $('.add-board-button'); },
    
    // Input and controls - static, cached persistently
    get noteInput() { return $('.note-input textarea'); },
    get textareaContainer() { return $('.textarea-container'); },
    get boardStyleMenu() { return $('.board-style-menu'); },
    get boardStyleButton() { return $('.board-style-button'); },
    get shortcutHint() { return $('.shortcut-hint'); },
    get shortcutIcon() { return $('#shortcutIcon'); },
    
    // Trash and modals - static, cached persistently
    get trashBin() { return $('.trash-bin'); },
    get trashModal() { return $('#trashModal'); },
    get trashCount() { return $('.trash-count'); },
    get deletedNotesContainer() { return $('.deleted-notes-container'); },
    get clearTrashBtn() { return $('.clear-trash-btn'); },
    
    // Transfer and selection - static, cached persistently
    get dragTransferMessage() { return $('#dragTransferMessage'); },
    get noteLimitMessage() { return $('#noteLimitMessage'); },
    get statusBar() { return $('.status-bar'); },
    
    // Emoji system - static, cached persistently
    get emojiPicker() { return $('.emoji-picker'); },
    
    // Dynamic collections (always fresh)
    get allBoards() { return $$('.board', true); },
    get allBoardButtons() { return $$('.board-button', true); },
    get activeBoardNotes() { 
        const board = this.currentBoard;
        return board ? Array.from(board.querySelectorAll('.sticky-note')) : []; 
    },
    get selectedNotes() { return $$('.sticky-note.selected', true); },
    get colorPalettes() { return $$('.color-palette', true); }
};

/**
 * Clears specific cache entries when DOM structure changes
 * @param {string|Array} selectors - Selector(s) to clear from cache
 */
const clearCache = (selectors = null) => {
    if (!selectors) {
        domCache.clear();
        return;
    }
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
    selectorArray.forEach(selector => {
        domCache.delete(selector);
        domCache.delete(`all:${selector}`);
    });
};

/**
 * Refreshes cache for dynamic content areas and board switches
 */
const refreshDynamicCache = () => {
    const dynamicSelectors = [
        '.board', '.board-button', '.sticky-note', 
        '.color-palette', '.board-title-input', '.board.active'
    ];
    dynamicSelectors.forEach(selector => {
        domCache.delete(selector);
        domCache.delete(`all:${selector}`);
    });
    
    // Clear board-specific cached selectors when boards change
    for (let i = 1; i <= 9; i++) {
        domCache.delete(`.board[data-board-id="${i}"]`);
    }
};

// Make DOM cache globally available
if (typeof window !== 'undefined') {
    window.$ = $;
    window.$$ = $$;
    window.$within = $within;
    window.DOM = DOM;
    window.clearCache = clearCache;
    window.refreshDynamicCache = refreshDynamicCache;
}

// Auto-refresh cache when DOM mutations occur in key areas
let observer = null;

const initializeCacheObserver = () => {
    if (observer) return; // Already initialized
    
    observer = new MutationObserver((mutations) => {
        let shouldRefresh = false;
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' && 
                (mutation.target.classList?.contains('boards-container') ||
                 mutation.target.classList?.contains('board') ||
                 mutation.target.classList?.contains('boards-navigation'))) {
                shouldRefresh = true;
            }
        });
        if (shouldRefresh) refreshDynamicCache();
    });

    // Start observing
    const container = $('.boards-container');
    if (container) {
        observer.observe(container, { childList: true, subtree: true });
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCacheObserver);
} else {
    // DOM already loaded, initialize immediately
    setTimeout(initializeCacheObserver, 0);
}
