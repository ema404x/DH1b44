import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Loader2, CheckCircle2, ClipboardList, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import ReporteForm from '@/components/operario/ReporteForm';

export default function PortalOperarioApp() {
  const { currentUser, displayName, employeeName } = useCurrentUser();
  const [reporteOT, setReporteOT] = useState(null);
  const [completing, setCompleting] = useState(null);
  const queryClient = useQueryClient();

  const { data: allOTs = [], isLoading } = useQuery({
    queryKey: ['workorders-operario'],
    queryFn: () => base44.entities.WorkOrder.list('-created_date', 500),
    staleTime: 1000 * 60 * 5,
  });

  const misOTs = useMemo(() => {
    if (!currentUser) return [];
    const myName  = (employeeName || '').toLowerCase();
    const myEmail = (currentUser.email || '').toLowerCase();
    const myId    = currentUser.id || '';
    return allOTs.filter(ot => {
      if (ot.status === 'cancelada') return false;
      if (myId && ot.created_by_id === myId) return true;
      const assigned = (ot.assigned_to || '').toLowerCase();
      const assignedName = (ot.assigned_name || '').toLowerCase();
      if (myEmail && (assigned === myEmail || assignedName === myEmail)) return true;
      if (myName  && (assigned.includes(myName) || assignedName.includes(myName))) return true;
      return false;
    });
  }, [allOTs, currentUser, employeeName]);

  // Quick complete — marca como completada directamente
  const quickComplete = async (ot) => {
    setCompleting(ot.id);
    try {
      await base44.entities.WorkOrder.update(ot.id, {
        status: 'completada',
        completed_date: new Date().toISOString().split('T')[0],
      });
      toast.success('OT marcada como completada');
      queryClient.invalidateQueries({ queryKey: ['workorders-operario'] });
    } catch (err) {
      toast.error('Error: ' + (err.message || 'intente nuevamente'));
    } finally {
      setCompleting(null);
    }
  };

  const handleReporteSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['workorders-operario'] });
    setReporteOT(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Mis Órdenes de Trabajo</h1>
          <p className="text-xs text-slate-400">{displayName} · {misOTs.length} asignada{misOTs.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Lista de OTs */}
      {misOTs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
          <CheckCircle2 className="h-12 w-12 text-slate-700" />
          <p className="text-sm font-medium">No tenés órdenes asignadas</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {misOTs.map(ot => (
            <OTCard
              key={ot.id}
              ot={ot}
              onReporte={() => setReporteOT(ot)}
              onComplete={() => quickComplete(ot)}
              completing={completing === ot.id}
            />
          ))}
        </div>
      )}

      {/* Formulario de reporte simplificado */}
      {reporteOT && (
        <ReporteForm ot={reporteOT} onClose={() => setReporteOT(null)} onSaved={handleReporteSaved} />
      )}
    </div>
  );
}

const STATUS_BADGE = {
  pendiente:   { label: 'Pendiente',   cls: 'bg-amber-400/10 text-amber-400 border-amber-400/20' },
  asignada:    { label: 'Asignada',    cls: 'bg-blue-400/10 text-blue-400 border-blue-400/20' },
  en_progreso: { label: 'En Progreso', cls: 'bg-sky-400/10 text-sky-400 border-sky-400/20' },
  completada:  { label: 'Completada',  cls: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' },
};

function OTCard({ ot, onReporte, onComplete, completing }) {
  const badge = STATUS_BADGE[ot.status] || STATUS_BADGE.pendiente;
  const isDone = ot.status === 'completada';

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      {/* Badge + título */}
      <div>
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.cls} mb-2`}>
          {badge.label}
        </span>
        <h3 className="text-sm font-semibold text-white leading-snug">{ot.title}</h3>
        {ot.location && (
          <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{ot.location}</span>
          </div>
        )}
      </div>

      {/* Botones rápidos */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={onReporte}
          className="flex-1 h-9 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium hover:bg-slate-700 transition-colors"
        >
          Reportar
        </button>
        {!isDone && (
          <button
            onClick={onComplete}
            disabled={completing}
            className="flex-1 h-9 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {completing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Finalizar
          </button>
        )}
      </div>
    </div>
  );
}