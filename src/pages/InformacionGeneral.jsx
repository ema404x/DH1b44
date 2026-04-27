import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Search, Filter, MapPin, Users, Brain, Upload, Settings,
  Zap, TrendingUp, CheckCircle2, AlertTriangle, BarChart3, Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import DirectorioJerarquico from '@/components/informacion-general/DirectorioJerarquico';
import ImportadorSimple from '@/components/informacion-general/ImportadorSimple';
import ImportadorDireccionesJefes from '@/components/informacion-general/ImportadorDireccionesJefes';

const COMUNAS = [
  { id: '8A', label: 'Comuna 8A', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { id: '8B', label: 'Comuna 8B', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { id: '10A', label: 'Comuna 10A', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
];

export default function InformacionGeneral() {
  const [activeTab, setActiveTab] = useState('directorio');
  const [search, setSearch] = useState('');
  const [selectedComuna, setSelectedComuna] = useState('all');
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading, refetch } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.LocationData.list('-created_date', 500),
  });

  const { data: direcciones = [] } = useQuery({
    queryKey: ['direcciones'],
    queryFn: () => base44.entities.Direccion.list('-updated_date', 500),
  });

  const stats = useMemo(() => ({
    total: locations.length,
    activos: locations.filter(l => l.estado === 'activo').length,
    inactivos: locations.filter(l => l.estado === 'inactivo').length,
    jefesSitio: new Set(locations.map(l => l.jefe_sitio).filter(Boolean)).size,
    m2Total: locations.reduce((s, l) => s + (l.m2 || 0), 0),
    direccionesTotal: direcciones.length,
  }), [locations, direcciones]);

  const sinAsignar = useMemo(() => locations.filter(l => !l.jefe_sitio), [locations]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/30 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10">
        {/* Header Premium */}
        <div className="border-b border-slate-700/50 backdrop-blur-xl bg-slate-900/50 sticky top-0 z-20 shadow-2xl">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <motion.div
                  className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-2xl shadow-primary/40"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  <Building2 className="h-8 w-8 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                    Información General
                    <Badge className="bg-primary/20 text-primary border-primary/30 ml-2">Hub Central</Badge>
                  </h1>
                  <p className="text-sm text-slate-400 mt-2">Gestión integral de escuelas, direcciones y asignaciones</p>
                </div>
              </div>
              <motion.button
                onClick={() => setActiveTab('importar')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-primary to-purple-600 text-white font-semibold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all"
              >
                <Upload className="h-5 w-5" />
                <span className="hidden sm:inline">Importar Datos</span>
              </motion.button>
            </motion.div>

            {/* Stats Grid Premium */}
            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Escuelas', value: stats.total, icon: Building2, color: 'from-blue-500', highlight: stats.total > 0 },
                { label: 'Activas', value: stats.activos, icon: Zap, color: 'from-emerald-500', highlight: stats.activos === stats.total },
                { label: 'Direcciones', value: stats.direccionesTotal, icon: MapPin, color: 'from-orange-500' },
                { label: 'Jefes Sitio', value: stats.jefesSitio, icon: Users, color: 'from-purple-500' },
                { label: 'Superficie (m²)', value: `${(stats.m2Total / 1000).toFixed(1)}K`, icon: TrendingUp, color: 'from-cyan-500' },
              ].map((stat, i) => (
                <motion.div key={i} variants={item}>
                  <div className={`relative overflow-hidden rounded-lg backdrop-blur border transition-all duration-300 ${
                    stat.highlight
                      ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-emerald-500/50 shadow-lg shadow-emerald-500/20'
                      : 'bg-gradient-to-br from-slate-700/50 to-slate-800/50 border-slate-600/50 hover:border-slate-500/50'
                  }`}>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{stat.label}</p>
                        <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${stat.color} to-transparent flex items-center justify-center`}>
                          <stat.icon className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-white">{stat.value}</p>
                    </div>
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 pointer-events-none"
                      animate={{ opacity: [0, 0.1, 0] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
                    />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Tabs Modernas */}
        <div className="max-w-7xl mx-auto px-6 pt-8">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex gap-3 mb-8 border-b border-slate-700/50 pb-4">
            {[
              { id: 'directorio', label: 'Directorio Jerárquico', icon: MapPin },
              { id: 'importar', label: 'Importar Datos', icon: Brain },
            ].map(tab => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileHover={{ x: 5 }}
                className={`flex items-center gap-2 px-5 py-3 rounded-lg font-semibold transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-primary/20 to-purple-600/20 text-primary border border-primary/50 shadow-lg shadow-primary/20'
                    : 'text-slate-400 hover:text-slate-300 border border-transparent hover:border-slate-700/50'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </motion.button>
            ))}
          </motion.div>

          {/* Content Directorio */}
          {activeTab === 'directorio' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              {/* Alerts */}
              <motion.div className="mb-6 space-y-3">
                {sinAsignar.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-4 p-4 rounded-lg bg-gradient-to-r from-orange-500/20 to-orange-600/10 border border-orange-500/50 backdrop-blur"
                  >
                    <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-orange-200">⚠️ {sinAsignar.length} escuela(s) sin jefe de sitio</p>
                      <p className="text-sm text-orange-300/80 mt-1">Completa las asignaciones para optimizar la operación</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 border border-emerald-500/50 backdrop-blur"
                  >
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                    <p className="font-semibold text-emerald-200">✅ Todas las escuelas tienen jefe de sitio asignado</p>
                  </motion.div>
                )}
              </motion.div>

              {/* Search & Filters */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    placeholder="Buscar escuela, dirección, jefe, ubicación técnica..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-12 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-primary/50 focus:ring-primary/20"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setSelectedComuna('all')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all border ${
                      selectedComuna === 'all'
                        ? 'bg-slate-700/50 border-slate-600/50 text-white'
                        : 'bg-transparent border-slate-700/50 text-slate-400 hover:border-slate-600/50'
                    }`}
                  >
                    Todas
                  </button>
                  {COMUNAS.map(c => (
                    <motion.button
                      key={c.id}
                      onClick={() => setSelectedComuna(selectedComuna === c.id ? 'all' : c.id)}
                      whileHover={{ scale: 1.05 }}
                      className={`px-4 py-2 rounded-lg font-medium transition-all border ${
                        selectedComuna === c.id
                          ? `${c.color} shadow-lg`
                          : 'bg-transparent border-slate-700/50 text-slate-400 hover:border-slate-600/50'
                      }`}
                    >
                      {c.label}
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              {/* Directorio */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                {isLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="h-12 w-12 rounded-full border-2 border-slate-700 border-t-primary"
                    />
                  </div>
                ) : (
                  <DirectorioJerarquico />
                )}
              </motion.div>
            </motion.div>
          )}

          {/* Content Importar */}
          {activeTab === 'importar' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6">
              {/* Importador de Direcciones y Jefes */}
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Importador de Direcciones y Jefes</h3>
                    <p className="text-sm text-slate-400">Excel con estructura: Jefe → Dirección → Escuelas</p>
                  </div>
                </div>
                <ImportadorDireccionesJefes onSuccess={() => { refetch(); setActiveTab('directorio'); }} />
              </div>

              {/* Importador Simple */}
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                    <Brain className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Importador Simple</h3>
                    <p className="text-sm text-slate-400">Carga Excel directamente sin pasos manuales</p>
                  </div>
                </div>
                <ImportadorSimple onSuccess={() => { refetch(); setActiveTab('directorio'); }} />
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="max-w-7xl mx-auto px-6 py-12 mt-12 border-t border-slate-700/50 text-center"
        >
          <p className="text-sm text-slate-400">
            Gestión inteligente de información • Última actualización: {new Date().toLocaleDateString('es-AR')}
          </p>
        </motion.div>
      </div>
    </div>
  );
}