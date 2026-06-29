import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { ClipboardList, CheckCircle, Clock, AlertCircle, Wrench, Loader2 } from 'lucide-react';
import OTOperarioCard from '@/components/operario/OTOperarioCard';
import OTEjecucionModal from '@/components/operario/OTEjecucionModal';

const TABS = [
  { key: 'pendiente',   label: 'Pendientes',  icon: Clock },
  { key: 'en_progreso', label: 'En Progreso', icon: Wrench },
  { key: 'completada',  label: 'Completadas', icon: CheckCircle },
];

export default function PortalOperarioApp() {
  const { currentUser, displayName, employeeName } = useCurrentUser();
  const [tab, setTab] = useState('pendiente');
  const [selected, setSelected] = useState(null);
  const queryClient = useQueryClient();

  const { data: allOTs = [], isLoading } = useQuery({
    queryKey: ['workorders-operario'],
    queryFn: () => base44.entities.WorkOrder.list('-created_date', 500),
    staleTime: 1000 * 60 * 5,
  });

  // Filtrar solo las asignadas al operario actual (por nombre o email)
  const misOTs = useMemo(() => {
    if (!currentUser) return [];
    const myName  = (employeeName || '').toLowerCase();
    const myEmail = (currentUser.email || '').toLowerCase();
    const myId    = currentUser.id || '';

    return allOTs.filter(ot => {
      if (myId && ot.created_by_id === myId) return true;
      const assigned = (ot.assigned_to || '').toLowerCase();
      const assignedName = (ot.assigned_name || '').toLowerCase();
      if (myEmail && (assigned === myEmail || assignedName === myEmail)) return true;
      if (myName  && (assigned.includes(myName) || assignedName.includes(myName))) return true;
      return false;
    });
  }, [allOTs, currentUser, employeeName]);

  const byTab = useMemo(() => {
    if (tab === 'completada') return misOTs.filter(o => o.status === 'completada' || o.status === 'cancelada');
    return misOTs.filter(o => o.status === tab || (tab === 'pendiente' && o.status === 'asignada'));
  }, [misOTs, tab]);

  const counts = useMemo(() => ({
    pendiente:   misOTs.filter(o => o.status === 'pendiente' || o.status === 'asignada').length,
    en_progreso: misOTs.filter(o => o.status === 'en_progreso').length,
    completada:  misOTs.filter(o => o.status === 'completada' || o.status === 'cancelada').length,
  }), [misOTs]);

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['workorders-operario'] });
    setSelected(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Mis Órdenes de Trabajo
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">Operario: <span className="text-white font-medium">{displayName}</span></p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="bg-slate-800 px-2.5 py-1 rounded-full">{misOTs.length} OTs asignadas</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 p-1 rounded-xl w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === key
                ? 'bg-primary text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {counts[key] > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                tab === key ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'
              }`}>{counts[key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : byTab.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
          <AlertCircle className="h-10 w-10" />
          <p className="text-sm">No hay órdenes en esta categoría</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {byTab.map(ot => (
            <OTOperarioCard key={ot.id} ot={ot} onOpen={() => setSelected(ot)} />
          ))}
        </div>
      )}

      {/* Modal de ejecución */}
      {selected && (
        <OTEjecucionModal
          ot={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}