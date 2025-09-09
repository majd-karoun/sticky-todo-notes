/**
 * Animation Batcher - Batches style updates for better performance
 */

const updates = new Map();
let rafId = null;

const flushAnimations = () => {
  updates.forEach(({ element, styles }) => {
    if (!element.isConnected) return;
    
    Object.entries(styles).forEach(([prop, value]) => {
      if (prop.startsWith('--')) {
        element.style.setProperty(prop, value);
      } else {
        element.style[prop] = value;
      }
    });
  });
  
  updates.clear();
  rafId = null;
};

const scheduleFlush = () => {
  if (!rafId) {
    rafId = requestAnimationFrame(flushAnimations);
  }
};

window.AnimationUtils = {
  updateStyles(element, styles, priority = 'normal') {
    if (!element || !styles) return;
    
    const id = element._batchId || (element._batchId = Math.random().toString(36));
    updates.set(id, { element, styles: { ...updates.get(id)?.styles, ...styles } });
    scheduleFlush();
  },

  updatePosition(element, x, y) {
    this.updateStyles(element, { left: `${x}px`, top: `${y}px` });
  },

  updateSize(element, width, height) {
    this.updateStyles(element, { width: `${width}px`, height: `${height}px` });
  },

  flush() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      flushAnimations();
    }
  }
};
