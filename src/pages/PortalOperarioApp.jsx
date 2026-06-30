import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Clock, CheckCircle, Wrench, Loader2, ClipboardList, AlertCircle, Calendar } from 'lucide-react';
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

  const urgentes = useMemo(() => misOTs.filter(o => o.priority === 'urgente' && o.status !== 'completada' && o.status !== 'cancelada').length, [misOTs]);

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['workorders-operario'] });
    setSelected(null);
  };

  return (
    <div className="min-h-screen flex flex-col gap-5">

      {/* HERO HEADER */}
      <div className="relative overflow-hidden rounded-2xl border border-white/8"
        style={{ background: 'linear-gradient(135deg, rgba(30,58,95,0.5) 0%, rgba(15,30,50,0.6) 100%)' }}>
        <div className="absolute inset-0 opacity-30"
          style={{ background: 'radial-gradient(circle at 20% 50%, rgba(59,130,246,0.25), transparent 50%), radial-gradient(circle at 80% 20%, rgba(16,185,129,0.15), transparent 40%)' }} />
        <div className="relative p-5 sm:p-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center backdrop-blur-sm">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Mis Órdenes de Trabajo</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                Bienvenido, <span className="text-white font-medium">{displayName}</span>
              </p>
            </div>
          </div>
          {urgentes > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 backdrop-blur-sm">
              <AlertCircle className="h-4 w-4 text-red-400 animate-pulse" />
              <span className="text-sm font-semibold text-red-300">{urgentes} OT{urgentes > 1 ? 's' : ''} urgente{urgentes > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard icon={Clock} label="Pendientes" value={counts.pendiente} color="amber" />
        <KpiCard icon={Wrench} label="En Progreso" value={counts.en_progreso} color="sky" />
        <KpiCard icon={CheckCircle} label="Completadas" value={counts.completada} color="emerald" />
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-slate-900/60 backdrop-blur-sm p-1 rounded-xl border border-white/5 w-fit self-start">
        {TABS.map(({ key, label, icon: TabIcon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === key
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <TabIcon className="h-4 w-4" />
            {label}
            {counts[key] > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                tab === key ? 'bg-white/20 text-white' : 'bg-slate-700/80 text-slate-300'
              }`}>{counts[key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-slate-500">Cargando órdenes...</p>
        </div>
      ) : byTab.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
          <div className="h-16 w-16 rounded-full bg-slate-800/60 flex items-center justify-center">
            <Calendar className="h-8 w-8 text-slate-600" />
          </div>
          <p className="text-sm font-medium text-slate-400">No hay órdenes en esta categoría</p>
          <p className="text-xs text-slate-600">Las nuevas asignaciones aparecerán aquí automáticamente</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {byTab.map(ot => (
            <OTOperarioCard key={ot.id} ot={ot} onOpen={() => setSelected(ot)} />
          ))}
        </div>
      )}

      {selected && (
        <OTEjecucionModal ot={selected} onClose={() => setSelected(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}

const KPI_STYLES = {
  amber:   { bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  text: 'text-amber-400',   glow: 'shadow-amber-500/10' },
  sky:     { bg: 'bg-sky-500/10',    border: 'border-sky-500/20',    text: 'text-sky-400',     glow: 'shadow-sky-500/10' },
  emerald: { bg: 'bg-emerald-500/10',border: 'border-emerald-500/20',text: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
};

const KpiCard = React.memo(function KpiCard({ icon: Icon, label, value, color }) {
  const s = KPI_STYLES[color];
  return (
    <div className={`relative ${s.bg} border ${s.border} rounded-xl p-4 backdrop-blur-sm overflow-hidden`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className={`text-2xl font-bold ${s.text} tabular-nums mt-1`}>{value}</p>
        </div>
        <div className={`h-9 w-9 rounded-lg ${s.bg} border ${s.border} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${s.text}`} />
        </div>
      </div>
    </div>
  );
});