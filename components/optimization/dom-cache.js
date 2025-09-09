/**
 * DOM Cache - caching for frequently accessed elements
 */

const cache = new Map();

// Cache frequently used static elements
const cacheStatic = () => {
  const elements = {
    trashBin: '.trash-bin',
    statusBar: '.status-bar',
    noteInput: '.note-input',
    selectionBox: '.selection-box'
  };
  
  Object.entries(elements).forEach(([key, selector]) => {
    const el = document.querySelector(selector);
    if (el) cache.set(key, el);
  });
};

// Simple cache-aware query functions
window.$ = (selector) => {
  if (cache.has(selector)) {
    const el = cache.get(selector);
    return el.isConnected ? el : (cache.delete(selector), document.querySelector(selector));
  }
  return document.querySelector(selector);
};

window.$$ = (selector, useCache = false) => {
  if (useCache && cache.has(selector)) {
    const els = cache.get(selector);
    return els.every(el => el.isConnected) ? els : (cache.delete(selector), Array.from(document.querySelectorAll(selector)));
  }
  return Array.from(document.querySelectorAll(selector));
};

window.$within = (parent, selector) => parent ? parent.querySelector(selector) : null;

// Initialize cache when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', cacheStatic);
} else {
  cacheStatic();
}
