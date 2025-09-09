/**
 * Storage Debouncer - Prevents excessive localStorage writes
 */

const pending = new Map();
const timers = new Map();

const flush = (key) => {
  if (!pending.has(key)) return;
  
  try {
    const data = pending.get(key);
    localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
    pending.delete(key);
    timers.delete(key);
  } catch (error) {
    console.warn('Storage save failed:', error);
  }
};

window.DebouncedStorage = {
  save(key, data, priority = 'normal') {
    if (timers.has(key)) clearTimeout(timers.get(key));
    
    pending.set(key, data);
    const delay = priority === 'high' ? 50 : priority === 'low' ? 1000 : 300;
    timers.set(key, setTimeout(() => flush(key), delay));
  },

  saveHigh(key, data) { this.save(key, data, 'high'); },
  saveLow(key, data) { this.save(key, data, 'low'); },
  
  flush(key) { flush(key); },
  flushAll() { pending.forEach((_, key) => flush(key)); }
};

// Auto-save on page unload
window.addEventListener('beforeunload', () => window.DebouncedStorage.flushAll());
