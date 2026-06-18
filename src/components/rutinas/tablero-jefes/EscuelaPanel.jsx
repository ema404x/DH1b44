import React, { useState } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import {
  ChevronDown, ChevronRight, Building2, AlertTriangle,
  CheckCircle2, Clock, Zap
} from 'lucide-react';
import RutinaRow from './RutinaRow';

function urgenciaEscuela(ordenes) {
  if (ordenes.some(o => o.estado === 'vencida')) return 'critico';
  const hoy = new Date();
  if (ordenes.some(o => o.estado === 'pendiente' && o.fecha_limite && differenceInDays(parseISO(o.fecha_limite), hoy) <= 3)) return 'alerta';
  return 'normal';
}

export default function EscuelaPanel({ escuela, onOrdenUpdated }) {
  const [expanded, setExpanded] = useState(false);
  const urgencia = urgenciaEscuela(escuela.ordenes);

  const vencidas = escuela.ordenes.filter(o => o.estado === 'vencida').length;
  const pendientes = escuela.ordenes.filter(o => o.estado === 'pendiente').length;
  const en_proceso = escuela.ordenes.filter(o => o.estado === 'en_proceso').length;

  const borderColor = urgencia === 'critico' ? 'border-l-red-500' :
                      urgencia === 'alerta' ? 'border-l-yellow-500' : 'border-l-emerald-500/40';

  return (
    <div className={`border-l-2 ml-4 mr-0 ${borderColor}`}>
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/5 transition-colors"
      >
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
        }
        <Building2 className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />

        <p className="flex-1 text-sm font-semibold text-white/85 truncate min-w-0">{escuela.nombre}</p>

        <div className="flex items-center gap-2 flex-shrink-0">
          {vencidas > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
              <AlertTriangle className="h-3 w-3" />{vencidas}
            </span>
          )}
          {en_proceso > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-blue-400">
              <Zap className="h-3 w-3" />{en_proceso}
            </span>
          )}
          {pendientes > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-yellow-400/70">
              <Clock className="h-3 w-3" />{pendientes}
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="pb-2 px-4">
          {escuela.ordenes
            .sort((a, b) => {
              const order = { vencida: 0, en_proceso: 1, pendiente: 2 };
              return (order[a.estado] ?? 3) - (order[b.estado] ?? 3);
            })
            .map(orden => (
              <RutinaRow key={orden.id} orden={orden} onUpdated={onOrdenUpdated} />
            ))
          }
        </div>
      )}
    </div>
  );
}