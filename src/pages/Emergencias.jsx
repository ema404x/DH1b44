import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle, Plus, X, Zap, CheckCircle2, Clock, Shield, BarChart2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EmergenciaForm from '@/components/emergencias/EmergenciaForm';
import EmergenciaCard from '@/components/emergencias/EmergenciaCard';
import EmergenciasDashboard from '@/components/emergencias/EmergenciasDashboard';
import { useAuth } from '@/lib/AuthContext';

const FILTROS = [
  { id: 'all', label: 'Todas' },
  { id: 'activa', label: '🔴 Activas' },
  { id: 'en_atencion', label: '🟡 En Atención' },
  { id: 'resuelta', label: '🟢 Resueltas' },
];

export default function Emergencias() {
  const [showForm, setShowForm] = useState(false);
  const [filtro, setFiltro] = useState('all');
  const [tab, setTab] = useState('lista'); // 'lista' | 'dashboard'
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: emergencias = [], isLoading, refetch } = useQuery({
    queryKey: ['emergencias'],
    queryFn: () => base44.entities.Emergencia.list('-created_date', 200),
    refetchInterval: 30000, // auto-refresh cada 30s
  });

  const stats = {
    activas: emergencias.filter(e => e.estado === 'activa').length,
    enAtencion: emergencias.filter(e => e.estado === 'en_atencion').length,
    resueltas: emergencias.filter(e => e.estado === 'resuelta').length,
    total: emergencias.length,
  };

  const filtradas = filtro === 'all' ? emergencias : emergencias.filter(e => e.estado === filtro);

  const handleSuccess = () => {
    setShowForm(false);
    refetch();
    queryClient.invalidateQueries({ queryKey: ['workorders'] });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated bg */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-red-600/20 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-xl shadow-red-500/30 animate-pulse">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Emergencias</h1>
                <p className="text-sm text-slate-400">Centro de respuesta rápida</p>
              </div>
            </div>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-500/30 gap-2"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva</span> Emergencia
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, icon: Shield, color: 'from-slate-500' },
            { label: 'Activas', value: stats.activas, icon: AlertTriangle, color: 'from-red-500', pulse: stats.activas > 0 },
            { label: 'En Atención', value: stats.enAtencion, icon: Clock, color: 'from-yellow-500' },
            { label: 'Resueltas', value: stats.resueltas, icon: CheckCircle2, color: 'from-emerald-500' },
          ].map((s, i) => (
            <div key={i} className={`rounded-lg border backdrop-blur p-4 ${s.pulse ? 'border-red-500/50 bg-red-500/10' : 'border-slate-700/50 bg-slate-800/50'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{s.label}</p>
                <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${s.color} to-transparent flex items-center justify-center`}>
                  <s.icon className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
              <p className={`text-2xl font-bold ${s.pulse && s.value > 0 ? 'text-red-400' : 'text-white'}`}>{s.value}</p>
            </div>
          ))}
        </motion.div>

        {/* Modal Nueva Emergencia */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
              onClick={(e) => e.target === e.currentTarget && setShowForm(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl shadow-red-500/20 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="sticky top-0 bg-slate-900 border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    <h2 className="text-lg font-bold text-white">Registrar Emergencia</h2>
                  </div>
                  <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-6">
                  <EmergenciaForm onSuccess={handleSuccess} onCancel={() => setShowForm(false)} />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex gap-2 mb-5 border-b border-slate-700/50 pb-4">
          {[
            { id: 'lista', label: 'Lista', icon: Shield },
            { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                tab === t.id
                  ? 'bg-red-600/20 border-red-500/50 text-red-300'
                  : 'border-slate-700/50 text-slate-400 hover:border-slate-600 bg-slate-800/30'
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </motion.div>

        {/* Dashboard */}
        {tab === 'dashboard' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <EmergenciasDashboard emergencias={emergencias} />
          </motion.div>
        )}

        {/* Vista Lista */}
        {tab === 'lista' && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex gap-2 flex-wrap mb-5">
              {FILTROS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFiltro(f.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                    filtro === f.id
                      ? 'bg-red-600/20 border-red-500/50 text-red-300'
                      : 'border-slate-700/50 text-slate-400 hover:border-slate-600 bg-slate-800/30'
                  }`}
                >
                  {f.label}
                  {f.id !== 'all' && (
                    <span className="ml-1.5 text-xs opacity-70">
                      ({f.id === 'activa' ? stats.activas : f.id === 'en_atencion' ? stats.enAtencion : stats.resueltas})
                    </span>
                  )}
                </button>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-red-500 animate-spin" />
                </div>
              ) : filtradas.length === 0 ? (
                <div className="text-center py-16">
                  {stats.activas === 0 && filtro !== 'all' ? (
                    <div>
                      <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium">No hay emergencias en este estado</p>
                    </div>
                  ) : (
                    <div>
                      <Zap className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium">No hay emergencias registradas</p>
                      <p className="text-slate-500 text-sm mt-1">Presioná "Nueva Emergencia" para registrar una</p>
                    </div>
                  )}
                </div>
              ) : (
                <AnimatePresence>
                  {filtradas.map(e => (
                    <EmergenciaCard key={e.id} emergencia={e} onUpdate={refetch} isAdmin={isAdmin} />
                  ))}
                </AnimatePresence>
              )}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}