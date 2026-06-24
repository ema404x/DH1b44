// ═══════════════════════════════════════════════════════════════
// Performance Optimizations - Configuración global
// ═══════════════════════════════════════════════════════════════

/**
 * Request debounce para evitar múltiples calls iguales
 * Uso: const fetchUsers = debounce(() => api.users.list(), 500);
 */
export function debounce(fn, ms = 300) {
  let timer;
  return function debounced(...args) {
    clearTimeout(timer);
    return new Promise(resolve => {
      timer = setTimeout(() => resolve(fn(...args)), ms);
    });
  };
}

/**
 * Lazy load images con IntersectionObserver
 */
export function setupLazyImages() {
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.classList.add('loaded');
        imageObserver.unobserve(img);
      }
    });
  }, { rootMargin: '50px' });

  document.querySelectorAll('img[data-src]').forEach(img => imageObserver.observe(img));
}

/**
 * Memoización simple para funciones costosas
 */
export function memoize(fn, maxAge = 60000) {
  let cached = null;
  let timestamp = null;
  
  return function memoized(...args) {
    const now = Date.now();
    if (cached && timestamp && now - timestamp < maxAge) {
      return cached;
    }
    cached = fn(...args);
    timestamp = now;
    return cached;
  };
}

/**
 * Limitar renders innecesarios con comparación de props
 */
export const shallowEqual = (obj1, obj2) => {
  if (obj1 === obj2) return true;
  if (!obj1 || !obj2) return false;
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  return keys1.every(key => obj1[key] === obj2[key]);
};

/**
 * Monitoreo de performance (DevTools)
 */
export function logPerformance(label) {
  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    performance.mark(label);
    return () => {
      performance.measure(label, label);
      const measure = performance.getEntriesByName(label)[0];
      if (measure?.duration > 100) {
        console.warn(`⚠️ ${label}: ${measure.duration.toFixed(2)}ms`);
      }
    };
  }
  return () => {};
}