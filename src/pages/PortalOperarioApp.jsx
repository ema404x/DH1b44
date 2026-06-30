import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Play, Package, Loader2 } from 'lucide-react';
import OTEjecucionModal from '@/components/operario/OTEjecucionModal';

export default function PortalOperarioApp() {
  const { currentUser, displayName, employeeName } = useCurrentUser();
  const [selected, setSelected] = useState(null);
  const queryClient = useQueryClient();

  const { data: allOTs = [], isLoading } = useQuery({
    queryKey: ['workorders-operario'],
    queryFn: () => base44.entities.WorkOrder.list('-created_date', 500),
    staleTime: 1000 * 60 * 5,
  });

  const misOTsActivas = useMemo(() => {
    if (!currentUser) return [];
    const myName  = (employeeName || '').toLowerCase();
    const myEmail = (currentUser.email || '').toLowerCase();
    const myId    = currentUser.id || '';
    return allOTs.filter(ot => {
      if (ot.status === 'completada' || ot.status === 'cancelada') return false;
      if (myId && ot.created_by_id === myId) return true;
      const assigned = (ot.assigned_to || '').toLowerCase();
      const assignedName = (ot.assigned_name || '').toLowerCase();
      if (myEmail && (assigned === myEmail || assignedName === myEmail)) return true;
      if (myName  && (assigned.includes(myName) || assignedName.includes(myName))) return true;
      return false;
    });
  }, [allOTs, currentUser, employeeName]);

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['workorders-operario'] });
    setSelected(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">

      {/* Header minimalista */}
      <div className="px-6 pt-8 pb-4">
        <p className="text-sm text-slate-500">Hola,</p>
        <h1 className="text-3xl font-bold text-white tracking-tight">{displayName}</h1>
      </div>

      {/* Lista de OTs como tarjetas grandes y simples */}
      {misOTsActivas.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
          <Package className="h-12 w-12 text-slate-700" />
          <p className="text-lg text-slate-500 font-medium">No tenés órdenes activas</p>
        </div>
      ) : (
        <div className="flex-1 px-4 space-y-4">
          {misOTsActivas.map(ot => (
            <OTCardMinimal key={ot.id} ot={ot} onOpen={() => setSelected(ot)} />
          ))}
        </div>
      )}

      {selected && (
        <OTEjecucionModal ot={selected} onClose={() => setSelected(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}

function OTCardMinimal({ ot, onOpen }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
      {/* Título grande */}
      <h2 className="text-xl font-bold text-white leading-snug mb-1">{ot.title}</h2>
      {ot.location && (
        <p className="text-base text-slate-400 mb-4">{ot.location}</p>
      )}

      {/* Dos botones grandes y claros */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onOpen}
          className="flex items-center justify-center gap-2 h-14 rounded-xl bg-primary text-white text-lg font-semibold hover:bg-primary/90 transition-colors"
        >
          <Play className="h-5 w-5" />
          Ejecutar
        </button>
        <button
          onClick={onOpen}
          className="flex items-center justify-center gap-2 h-14 rounded-xl bg-slate-800 text-slate-200 text-lg font-semibold hover:bg-slate-700 transition-colors border border-slate-700"
        >
          <Package className="h-5 w-5" />
          Materiales
        </button>
      </div>
    </div>
  );
}