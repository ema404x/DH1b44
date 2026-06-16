/**
 * ReglasOroElectricidad — Componente reutilizable
 * Muestra las 5 Reglas de Oro de Seguridad Eléctrica.
 * Prop `compact`: versión resumida para el modal de creación de OT.
 * Prop `onClose`: función para cerrar (si se usa como banner/modal).
 */
import React from 'react';
import { Zap, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const REGLAS = [
  {
    numero: 1,
    titulo: 'Corte visible o efectivo',
    descripcion: 'Aislá la instalación desconectando todas las fuentes de alimentación. El corte debe ser físico y visible (interruptores abiertos, fusibles retirados).',
    icon: '⚡',
  },
  {
    numero: 2,
    titulo: 'Bloqueo y etiquetado',
    descripcion: 'Bloqueá mecánicamente los dispositivos de corte (candado) y etiquetálos para evitar reconexiones accidentales mientras trabajás.',
    icon: '🔒',
  },
  {
    numero: 3,
    titulo: 'Verificación de ausencia de tensión',
    descripcion: 'Nunca confíes solo en que una llave está abierta. Verificá con instrumental que no hay electricidad en los cables.',
    icon: '🔍',
  },
  {
    numero: 4,
    titulo: 'Puesta a tierra y en cortocircuito',
    descripcion: 'Conectá a tierra todos los conductores activos para evitar diferencias de potencial peligrosas durante el trabajo.',
    icon: '🌍',
  },
  {
    numero: 5,
    titulo: 'Señalización y delimitación de la zona',
    descripcion: 'Delimitá y señalizá la zona de trabajo para que el personal no autorizado no pueda acceder ni energizar accidentalmente.',
    icon: '🚧',
  },
];

export default function ReglasOroElectricidad({ compact = false, onClose }) {
  if (compact) {
    return (
      <div className="rounded-xl border-2 border-yellow-500/40 bg-yellow-500/8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-yellow-500/15 border-b border-yellow-500/30">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Zap className="h-4 w-4 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-yellow-300">⚠️ 5 Reglas de Oro — Seguridad Eléctrica</p>
              <p className="text-[11px] text-yellow-400/70">Obligatorias antes de iniciar cualquier trabajo eléctrico</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-yellow-400/60 hover:text-yellow-400 transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {/* Reglas compactas */}
        <div className="px-4 py-3 grid grid-cols-1 gap-2">
          {REGLAS.map(r => (
            <div key={r.numero} className="flex items-start gap-3">
              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                {r.numero}
              </span>
              <div>
                <span className="text-xs font-semibold text-yellow-300">{r.icon} {r.titulo}: </span>
                <span className="text-xs text-yellow-200/70">{r.descripcion}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-2.5 bg-yellow-500/10 border-t border-yellow-500/20">
          <p className="text-[11px] text-yellow-400/80 font-medium text-center">
            El incumplimiento de estas reglas puede causar accidentes graves o fatales.
          </p>
        </div>
      </div>
    );
  }

  // Versión completa para Control de Riesgos
  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-yellow-500/10 border-b border-yellow-500/20">
        <div className="h-10 w-10 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center flex-shrink-0">
          <Zap className="h-5 w-5 text-yellow-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-yellow-300">5 Reglas de Oro — Seguridad Eléctrica</h3>
          <p className="text-xs text-yellow-400/70 mt-0.5">
            Protocolos fundamentales y universales para trabajo en instalaciones eléctricas · DAEM Infraestructura Escolar
          </p>
        </div>
      </div>

      {/* Reglas */}
      <div className="divide-y divide-yellow-500/10">
        {REGLAS.map(r => (
          <div key={r.numero} className="flex items-start gap-4 px-5 py-4 hover:bg-yellow-500/5 transition-colors">
            <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-yellow-500/15 border border-yellow-500/25 flex items-center justify-center">
              <span className="text-sm font-black text-yellow-400">{r.numero}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-yellow-300 flex items-center gap-1.5">
                <span>{r.icon}</span> {r.titulo}
              </p>
              <p className="text-xs text-foreground/70 mt-1 leading-relaxed">{r.descripcion}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-yellow-500/10 border-t border-yellow-500/20">
        <p className="text-xs text-yellow-400/80 font-semibold text-center">
          ⚠️ El incumplimiento de las 5 Reglas de Oro puede causar accidentes graves o fatales. Aplicación obligatoria.
        </p>
      </div>
    </div>
  );
}