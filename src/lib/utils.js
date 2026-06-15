import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 

export const isIframe = window.self !== window.top;

/**
 * Detecta si un string parece un email.
 */
export function isEmail(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
}

/**
 * Dado un string que puede ser un email o un nombre, intenta resolverlo
 * al nombre real del empleado usando la lista de empleados provista.
 *
 * @param {string} nameOrEmail  - El valor a resolver (puede ser email, nombre, o vacío)
 * @param {Array}  employees    - Array de objetos Employee con { email, full_name }
 * @param {string} [fallback]   - Texto a retornar si no se puede resolver (default: nameOrEmail)
 * @returns {string}
 */
export function resolveDisplayName(nameOrEmail, employees = [], fallback) {
  if (!nameOrEmail) return fallback || 'Usuario';
  const str = String(nameOrEmail).trim();

  // Si NO parece un email, retornar directamente (ya es un nombre)
  if (!isEmail(str)) return str || fallback || 'Usuario';

  // Es un email → buscar la ficha de empleado que coincida
  const email = str.toLowerCase();
  const emp = employees.find(e => e.email?.toLowerCase().trim() === email);
  if (emp?.full_name) return emp.full_name;

  // No encontrado → retornar fallback o el email original (como último recurso)
  return fallback || str;
}