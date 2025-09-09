/**
 * ANIMATION BATCHING MODULE
 * Optimizes DOM style updates by batching them into single animation frames
 * Prevents layout thrashing and improves animation performance
 */

class AnimationBatcher {
  constructor() {
    this.pendingUpdates = new Map();
    this.rafId = null;
    this.isProcessing = false;
  }

  /**
   * Batches a style update for an element
   * @param {HTMLElement} element - Target element
   * @param {Object} styles - Style properties to update
   * @param {string} priority - Update priority ('high', 'normal', 'low')
   */
  batchUpdate(element, styles, priority = 'normal') {
    if (!element || !styles) return;

    const elementId = this.getElementId(element);
    
    if (!this.pendingUpdates.has(elementId)) {
      this.pendingUpdates.set(elementId, {
        element,
        styles: {},
        priority,
        transforms: {}
      });
    }

    const update = this.pendingUpdates.get(elementId);
    
    // Separate transforms from regular styles for optimization
    Object.entries(styles).forEach(([prop, value]) => {
      if (prop === 'transform' || prop.startsWith('transform')) {
        update.transforms[prop] = value;
      } else {
        update.styles[prop] = value;
      }
    });

    // Update priority if higher
    if (this.getPriorityLevel(priority) > this.getPriorityLevel(update.priority)) {
      update.priority = priority;
    }

    this.scheduleFlush();
  }

  /**
   * Batches transform updates specifically (most common for drag operations)
   * @param {HTMLElement} element - Target element
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} additionalTransforms - Additional transform properties
   */
  batchTransform(element, x, y, additionalTransforms = {}) {
    const transforms = {
      transform: `translate(${x}px, ${y}px)`,
      ...additionalTransforms
    };
    this.batchUpdate(element, transforms, 'high');
  }

  /**
   * Batches multiple element updates
   * @param {Array} updates - Array of {element, styles, priority} objects
   */
  batchMultiple(updates) {
    updates.forEach(({ element, styles, priority }) => {
      this.batchUpdate(element, styles, priority);
    });
  }

  /**
   * Schedules the batch flush using requestAnimationFrame
   */
  scheduleFlush() {
    if (this.rafId || this.isProcessing) return;

    this.rafId = requestAnimationFrame(() => {
      this.flush();
    });
  }

  /**
   * Flushes all pending updates in priority order
   */
  flush() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.rafId = null;

    try {
      // Sort updates by priority
      const sortedUpdates = Array.from(this.pendingUpdates.values())
        .sort((a, b) => this.getPriorityLevel(b.priority) - this.getPriorityLevel(a.priority));

      // Apply all updates in a single batch
      sortedUpdates.forEach(({ element, styles, transforms }) => {
        if (!element.isConnected) return; // Skip disconnected elements

        // Apply regular styles
        Object.entries(styles).forEach(([prop, value]) => {
          element.style[prop] = value;
        });

        // Apply transforms
        Object.entries(transforms).forEach(([prop, value]) => {
          element.style[prop] = value;
        });
      });

      // Clear pending updates
      this.pendingUpdates.clear();
    } catch (error) {
      console.warn('Animation batch flush error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Forces immediate flush of all pending updates
   */
  forceFlush() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.flush();
  }

  /**
   * Clears all pending updates for an element
   * @param {HTMLElement} element - Target element
   */
  clearElement(element) {
    const elementId = this.getElementId(element);
    this.pendingUpdates.delete(elementId);
  }

  /**
   * Clears all pending updates
   */
  clearAll() {
    this.pendingUpdates.clear();
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Gets a unique identifier for an element
   * @param {HTMLElement} element - Target element
   * @returns {string} Unique identifier
   */
  getElementId(element) {
    if (!element._batcherId) {
      element._batcherId = `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return element._batcherId;
  }

  /**
   * Converts priority string to numeric level
   * @param {string} priority - Priority string
   * @returns {number} Priority level
   */
  getPriorityLevel(priority) {
    switch (priority) {
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  /**
   * Gets current batch statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      pendingUpdates: this.pendingUpdates.size,
      isProcessing: this.isProcessing,
      hasScheduledFlush: !!this.rafId
    };
  }
}

// Create global animation batcher instance
window.animationBatcher = new AnimationBatcher();

/**
 * Utility functions for common animation patterns
 */
const AnimationUtils = {
  /**
   * Smoothly updates element position using batched styles (left/top for compatibility)
   * @param {HTMLElement} element - Target element
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  updatePosition(element, x, y) {
    window.animationBatcher.batchUpdate(element, {
      left: `${x}px`,
      top: `${y}px`
    }, 'high');
  },

  /**
   * Updates element size with batched styles
   * @param {HTMLElement} element - Target element
   * @param {number} width - New width
   * @param {number} height - New height
   */
  updateSize(element, width, height) {
    window.animationBatcher.batchUpdate(element, {
      width: `${width}px`,
      height: `${height}px`
    }, 'high');
  },

  /**
   * Updates element opacity with batched styles
   * @param {HTMLElement} element - Target element
   * @param {number} opacity - New opacity (0-1)
   */
  updateOpacity(element, opacity) {
    window.animationBatcher.batchUpdate(element, {
      opacity: opacity.toString()
    }, 'normal');
  },

  /**
   * Updates z-index with batched styles
   * @param {HTMLElement} element - Target element
   * @param {number} zIndex - New z-index
   */
  updateZIndex(element, zIndex) {
    window.animationBatcher.batchUpdate(element, {
      zIndex: zIndex.toString()
    }, 'low');
  },

  /**
   * Applies multiple style changes efficiently
   * @param {HTMLElement} element - Target element
   * @param {Object} styles - Style object
   * @param {string} priority - Update priority
   */
  updateStyles(element, styles, priority = 'normal') {
    window.animationBatcher.batchUpdate(element, styles, priority);
  }
};

// Export animation utilities globally
window.AnimationUtils = AnimationUtils;
