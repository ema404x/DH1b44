import React from 'react';
import { UserX, CheckCircle2 } from 'lucide-react';

export default function NoVinieronLista({ data }) {
  if (!data.laboral) return <Mensaje texto="Hoy no es día laboral según el horario del sector." />;
  if (!data.umbralPasado) return <Mensaje texto={`Las ausencias se calculan pasadas las ${(data.horarioHoy || data.horario).hora_entrada} más ${data.horario.tolerancia_minutos} minutos de tolerancia.`} />;
  if (!data.noVinieron.length) return <Mensaje ok texto="Todos los operarios activos ficharon su entrada hoy." />;
  return (
    <div className="rounded-2xl border border-border/60 bg-card divide-y divide-border/40 overflow-hidden">
      {data.noVinieron.map((e) => (
        <div key={e.id} className="flex items-center gap-3 px-4 py-3">
          <div className="h-9 w-9 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
            <UserX className="h-4 w-4 text-red-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{e.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">{[e.role, e.assigned_location].filter(Boolean).join(' · ') || 'Sin ubicación asignada'}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Mensaje({ texto, ok }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border/70 px-4 py-8 justify-center text-sm text-muted-foreground text-center">
      {ok && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />} {texto}
    </div>
  );
}