/**
 * Mapa de transiciones válidas para el flujo de Órdenes de Trabajo.
 * Fuente única de verdad — usada por Kanban, Panel de Detalle, y Portal del Operario.
 */

// Transiciones drag-and-drop: "desde→hacia" = acción
const DRAG_TRANSITIONS = {
  'pendiente→asignada': 'asignar',
  'asignada→en_progreso': 'iniciar',
  'en_progreso→pendiente_validacion': 'finalizar',
  'pendiente_validacion→completada': 'aprobar',
  'pendiente_validacion→en_progreso': 'rechazar',
};

// Estados destino que aceptan desde cualquier estado no-terminal
const FLEXIBLE_TARGETS = {
  'cancelada': 'cancelar',
  'obra': 'convertir_obra',
  'completada': 'completar',
};

const TERMINAL_STATES = ['completada', 'cancelada', 'obra'];

/**
 * Dada una transición drag-and-drop (fromStatus → toStatus),
 * devuelve el nombre de la acción para transicionEstadoOT, o null si no es válida.
 */
export function getTransitionAction(fromStatus, toStatus) {
  if (TERMINAL_STATES.includes(fromStatus)) return null;
  if (FLEXIBLE_TARGETS[toStatus]) return FLEXIBLE_TARGETS[toStatus];
  return DRAG_TRANSITIONS[`${fromStatus}→${toStatus}`] || null;
}

/**
 * Devuelve las acciones disponibles según el estado actual de la OT.
 * Usado por el panel de detalle para mostrar botones contextuales.
 */
export function getAvailableActions(status) {
  const actions = {
    pendiente: [
      { accion: 'asignar', label: 'Asignar', variant: 'blue' },
    ],
    asignada: [
      { accion: 'iniciar', label: 'Iniciar', variant: 'sky' },
    ],
    en_progreso: [
      { accion: 'finalizar', label: 'Finalizar', variant: 'emerald' },
    ],
    pendiente_validacion: [
      { accion: 'aprobar', label: 'Aprobar', variant: 'emerald' },
      { accion: 'rechazar', label: 'Rechazar', variant: 'red' },
    ],
    completada: [],
    cancelada: [],
    obra: [],
  };
  return actions[status] || [];
}

export const ACTION_VARIANTS = {
  blue:    'bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30',
  sky:     'bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30',
  emerald: 'bg-emerald-600 text-white hover:bg-emerald-500',
  amber:   'bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600/30',
  red:     'bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600/30',
};