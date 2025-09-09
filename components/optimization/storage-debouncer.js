/**
 * STORAGE DEBOUNCER MODULE
 * Optimizes localStorage operations by debouncing frequent writes
 * Prevents performance issues during drag operations and rapid changes
 */

class StorageDebouncer {
  constructor() {
    this.pendingSaves = new Map();
    this.debounceTimers = new Map();
    this.defaultDelay = 300; // 300ms default debounce delay
    this.isProcessing = false;
  }

  /**
   * Debounces a localStorage save operation
   * @param {string} key - Storage key
   * @param {*} data - Data to save
   * @param {number} delay - Debounce delay in milliseconds
   * @param {string} priority - Save priority ('immediate', 'high', 'normal', 'low')
   */
  debounceSave(key, data, delay = this.defaultDelay, priority = 'normal') {
    // Handle immediate saves (bypass debouncing)
    if (priority === 'immediate') {
      this.saveImmediately(key, data);
      return;
    }

    // Store the pending save data
    this.pendingSaves.set(key, { data, priority, timestamp: Date.now() });

    // Clear existing timer for this key
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }

    // Set new debounced timer
    const timer = setTimeout(() => {
      this.executeSave(key);
    }, delay);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Saves data immediately without debouncing
   * @param {string} key - Storage key
   * @param {*} data - Data to save
   */
  saveImmediately(key, data) {
    try {
      const serializedData = typeof data === 'string' ? data : JSON.stringify(data);
      localStorage.setItem(key, serializedData);
      
      // Clean up any pending saves for this key
      this.pendingSaves.delete(key);
      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key));
        this.debounceTimers.delete(key);
      }
    } catch (error) {
      console.warn(`Failed to save to localStorage (key: ${key}):`, error);
    }
  }

  /**
   * Executes a pending save operation
   * @param {string} key - Storage key
   */
  executeSave(key) {
    if (!this.pendingSaves.has(key)) return;

    const { data } = this.pendingSaves.get(key);
    this.saveImmediately(key, data);
  }

  /**
   * Flushes all pending saves immediately
   * Useful for critical moments like page unload
   */
  flushAll() {
    // Clear all timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();

    // Save all pending data
    this.pendingSaves.forEach(({ data }, key) => {
      try {
        const serializedData = typeof data === 'string' ? data : JSON.stringify(data);
        localStorage.setItem(key, serializedData);
      } catch (error) {
        console.warn(`Failed to flush localStorage (key: ${key}):`, error);
      }
    });

    this.pendingSaves.clear();
  }

  /**
   * Cancels a pending save operation
   * @param {string} key - Storage key to cancel
   */
  cancelSave(key) {
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
      this.debounceTimers.delete(key);
    }
    this.pendingSaves.delete(key);
  }

  /**
   * Gets the status of pending saves
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      pendingSaves: Array.from(this.pendingSaves.keys()),
      activeTimers: this.debounceTimers.size,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Clears all pending operations
   */
  clear() {
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    this.pendingSaves.clear();
  }
}

// Create global storage debouncer instance
window.storageDebouncer = new StorageDebouncer();

/**
 * Enhanced localStorage utilities with debouncing
 */
const DebouncedStorage = {
  /**
   * Saves data with debouncing (default behavior for frequent updates)
   * @param {string} key - Storage key
   * @param {*} data - Data to save
   * @param {number} delay - Debounce delay
   */
  save(key, data, delay = 300) {
    window.storageDebouncer.debounceSave(key, data, delay, 'normal');
  },

  /**
   * Saves data immediately (for critical operations)
   * @param {string} key - Storage key
   * @param {*} data - Data to save
   */
  saveImmediate(key, data) {
    window.storageDebouncer.saveImmediately(key, data);
  },

  /**
   * Saves data with high priority (shorter debounce)
   * @param {string} key - Storage key
   * @param {*} data - Data to save
   */
  saveHigh(key, data) {
    window.storageDebouncer.debounceSave(key, data, 100, 'high');
  },

  /**
   * Saves data with low priority (longer debounce)
   * @param {string} key - Storage key
   * @param {*} data - Data to save
   */
  saveLow(key, data) {
    window.storageDebouncer.debounceSave(key, data, 1000, 'low');
  },

  /**
   * Loads data from localStorage
   * @param {string} key - Storage key
   * @param {*} defaultValue - Default value if key doesn't exist
   * @returns {*} Parsed data or default value
   */
  load(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      
      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(item);
      } catch {
        return item;
      }
    } catch (error) {
      console.warn(`Failed to load from localStorage (key: ${key}):`, error);
      return defaultValue;
    }
  },

  /**
   * Removes an item from localStorage and cancels any pending saves
   * @param {string} key - Storage key
   */
  remove(key) {
    window.storageDebouncer.cancelSave(key);
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove from localStorage (key: ${key}):`, error);
    }
  },

  /**
   * Flushes all pending saves
   */
  flush() {
    window.storageDebouncer.flushAll();
  }
};

// Export debounced storage utilities globally
window.DebouncedStorage = DebouncedStorage;

// Ensure all pending saves are flushed before page unload
window.addEventListener('beforeunload', () => {
  window.storageDebouncer.flushAll();
});

// Also flush on visibility change (when tab becomes hidden)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    window.storageDebouncer.flushAll();
  }
});
