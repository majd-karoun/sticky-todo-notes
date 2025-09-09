/**
 * CONSOLIDATED EVENT MANAGER
 * Centralizes all document-level event listeners to improve performance
 * Replaces multiple individual listeners with single consolidated handlers
 */

// Global event state tracking
const eventState = {
    // Mouse tracking
    mouseX: 0,
    mouseY: 0,
    
    // Drag states
    isDragging: false,
    isResizing: false,
    isSelecting: false,
    isMovingSelection: false,
    isDragInProgress: false,
    
    // Active elements
    activeNote: null,
    hoveredBoardButton: null,
    
    // Selection state
    selectionStartX: 0,
    selectionStartY: 0,
    selectionMoveStartX: 0,
    selectionMoveStartY: 0,
    
    // Timers and cleanup
    hoverTimeout: null,
    holdTimer: null
};

// Registry for handlers from different modules
const handlerRegistry = {
    mousemove: new Set(),
    mouseup: new Set(),
    mousedown: new Set(),
    keydown: new Set(),
    click: new Set()
};

/**
 * Register a handler for a specific event type
 * @param {string} eventType - The event type (mousemove, mouseup, etc.)
 * @param {Function} handler - The handler function
 * @param {string} moduleId - Identifier for the module (for cleanup)
 */
const registerHandler = (eventType, handler, moduleId = 'default') => {
    if (!handlerRegistry[eventType]) {
        handlerRegistry[eventType] = new Set();
    }
    
    // Add module identifier to handler for cleanup
    handler._moduleId = moduleId;
    handlerRegistry[eventType].add(handler);
};

/**
 * Unregister handlers for a specific module
 * @param {string} moduleId - The module identifier
 */
const unregisterModule = (moduleId) => {
    Object.values(handlerRegistry).forEach(handlerSet => {
        handlerSet.forEach(handler => {
            if (handler._moduleId === moduleId) {
                handlerSet.delete(handler);
            }
        });
    });
};

/**
 * CONSOLIDATED MOUSEMOVE HANDLER
 * Handles all mousemove events from different modules
 */
const consolidatedMouseMoveHandler = (e) => {
    // Update global mouse position
    eventState.mouseX = e.clientX;
    eventState.mouseY = e.clientY;
    
    // Call all registered mousemove handlers
    if (handlerRegistry.mousemove) {
        handlerRegistry.mousemove.forEach(handler => {
            try {
                handler(e, eventState);
            } catch (error) {
                console.error('Error in mousemove handler:', error);
            }
        });
    }
};

/**
 * CONSOLIDATED MOUSEUP HANDLER
 * Handles all mouseup events from different modules
 */
const consolidatedMouseUpHandler = (e) => {
    // Call all registered mouseup handlers
    if (handlerRegistry.mouseup) {
        handlerRegistry.mouseup.forEach(handler => {
            try {
                handler(e, eventState);
            } catch (error) {
                console.error('Error in mouseup handler:', error);
            }
        });
    }
    // Reset global states after all handlers
    eventState.isDragging = false;
    eventState.isResizing = false;
    eventState.activeNote = null;
};

/**
 * CONSOLIDATED MOUSEDOWN HANDLER
 * Handles all mousedown events from different modules
 */
const consolidatedMouseDownHandler = (e) => {
    // Call all registered mousedown handlers
    if (handlerRegistry.mousedown) {
        handlerRegistry.mousedown.forEach(handler => {
            try {
                handler(e, eventState);
            } catch (error) {
                console.error('Error in mousedown handler:', error);
            }
        });
    }
};

/**
 * CONSOLIDATED KEYDOWN HANDLER
 * Handles all keydown events from different modules
 */
const consolidatedKeyDownHandler = (e) => {
    // Call all registered keydown handlers
    if (handlerRegistry.keydown) {
        handlerRegistry.keydown.forEach(handler => {
            try {
                handler(e, eventState);
            } catch (error) {
                console.error('Error in keydown handler:', error);
            }
        });
    }
};

/**
 * CONSOLIDATED CLICK HANDLER
 * Handles specific click events that need global coordination
 */
const consolidatedClickHandler = (e) => {
    // Call all registered click handlers
    if (handlerRegistry.click) {
        handlerRegistry.click.forEach(handler => {
            try {
                handler(e, eventState);
            } catch (error) {
                console.error('Error in click handler:', error);
            }
        });
    }
};

/**
 * Initialize the consolidated event system
 */
const initializeEventManager = () => {
    // Remove any existing listeners first (in case of re-initialization)
    document.removeEventListener('mousemove', consolidatedMouseMoveHandler);
    document.removeEventListener('mouseup', consolidatedMouseUpHandler);
    document.removeEventListener('mousedown', consolidatedMouseDownHandler);
    document.removeEventListener('keydown', consolidatedKeyDownHandler);
    document.removeEventListener('click', consolidatedClickHandler);
    
    // Add consolidated listeners
    document.addEventListener('mousemove', consolidatedMouseMoveHandler, { passive: true });
    document.addEventListener('mouseup', consolidatedMouseUpHandler);
    document.addEventListener('mousedown', consolidatedMouseDownHandler);
    document.addEventListener('keydown', consolidatedKeyDownHandler);
    document.addEventListener('click', consolidatedClickHandler);
};

/**
 * Cleanup function for when the app is destroyed
 */
const cleanupEventManager = () => {
    document.removeEventListener('mousemove', consolidatedMouseMoveHandler);
    document.removeEventListener('mouseup', consolidatedMouseUpHandler);
    document.removeEventListener('mousedown', consolidatedMouseDownHandler);
    document.removeEventListener('keydown', consolidatedKeyDownHandler);
    document.removeEventListener('click', consolidatedClickHandler);
    
    // Clear all handler registries
    Object.keys(handlerRegistry).forEach(key => {
        handlerRegistry[key].clear();
    });
};

// Make functions globally available
if (typeof window !== 'undefined') {
    window.eventManager = {
        registerHandler,
        unregisterModule,
        initializeEventManager,
        cleanupEventManager,
        eventState,
        handlerRegistry
    };
}

// Initialize immediately and expose globally
initializeEventManager();

// Auto-initialize when DOM is ready (backup)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEventManager);
} else {
    // DOM already loaded, initialize immediately
    setTimeout(initializeEventManager, 0);
}
