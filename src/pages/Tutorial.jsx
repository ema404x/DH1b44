import React, { useState, useMemo, useEffect } from 'react';
import { BookOpen, Search, Grid, List, CheckCircle2, Trophy, Play, FileText, Zap, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import TutorialGuide from '@/components/tutorial/TutorialGuide';
import CompletionCertificate from '@/components/tutorial/CompletionCertificate';
import { TUTORIAL_MODULES } from '@/components/tutorial/tutorialContent';
import { base44 } from '@/api/base44Client';

const CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'operaciones', label: 'Operaciones' },
  { id: 'administracion', label: 'Administración' },
  { id: 'campo', label: 'Campo' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'seguridad', label: 'Seguridad' },
];

export default function Tutorial() {
  const [selectedModule, setSelectedModule] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [category, setCategory] = useState('all');
  const [completedModules, setCompletedModules] = useState(new Set());
  const [user, setUser] = useState(null);
  const [showCertificate, setShowCertificate] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      const saved = localStorage.getItem('completedTutorialModules') || '[]';
      setCompletedModules(new Set(JSON.parse(saved)));
    };
    loadData();
  }, []);

  const handleModuleComplete = (moduleId) => {
    const updated = new Set(completedModules);
    updated.add(moduleId);
    setCompletedModules(updated);
    localStorage.setItem('completedTutorialModules', JSON.stringify(Array.from(updated)));
    const module = TUTORIAL_MODULES.find(m => m.id === moduleId);
    if (module) setShowCertificate(module);
  };

  const filteredModules = useMemo(() => {
    return TUTORIAL_MODULES.filter(mod => {
      const matchSearch = !searchTerm ||
        mod.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mod.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mod.keywords?.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCat = category === 'all' || mod.category === category;
      return matchSearch && matchCat;
    });
  }, [searchTerm, category]);

  const progressPct = TUTORIAL_MODULES.length > 0
    ? Math.round((completedModules.size / TUTORIAL_MODULES.length) * 100)
    : 0;

  if (selectedModule) {
    return (
      <TutorialGuide
        module={selectedModule}
        isCompleted={completedModules.has(selectedModule.id)}
        onComplete={() => handleModuleComplete(selectedModule.id)}
        onBack={() => setSelectedModule(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Ambient bg */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/30">
              <BookOpen className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Centro de Aprendizaje</h1>
              <p className="text-slate-400 mt-0.5">Domina DH1 Software paso a paso</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className={`gap-2 ${viewMode === 'grid' ? 'bg-slate-700/50 text-white' : 'text-slate-400 hover:text-white'}`} onClick={() => setViewMode('grid')}>
              <Grid className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className={`gap-2 ${viewMode === 'list' ? 'bg-slate-700/50 text-white' : 'text-slate-400 hover:text-white'}`} onClick={() => setViewMode('list')}>
              <List className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>

        {/* Progress Card */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 to-purple-950/40 backdrop-blur p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-yellow-400" />
              <div>
                <p className="font-semibold text-white">Tu Progreso General</p>
                <p className="text-sm text-slate-400">{completedModules.size} de {TUTORIAL_MODULES.length} módulos completados</p>
              </div>
            </div>
            <span className="text-4xl font-bold text-indigo-400">{progressPct}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </motion.div>

        {/* Search + Categories */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            <Input
              placeholder="Buscar módulo o tema..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-indigo-500/50"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  category === cat.id
                    ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-300'
                    : 'border-slate-700/50 text-slate-400 hover:border-slate-600 bg-slate-800/30'
                }`}
              >
                {cat.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-500 self-center">{filteredModules.length} módulos</span>
          </div>
        </motion.div>

        {/* Module Grid/List */}
        {filteredModules.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">Sin resultados para "{searchTerm}"</p>
            <Button variant="ghost" className="mt-4 text-slate-400" onClick={() => { setSearchTerm(''); setCategory('all'); }}>
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-3'}
          >
            <AnimatePresence>
              {filteredModules.map((module, i) => {
                const isCompleted = completedModules.has(module.id);
                return (
                  <motion.div
                    key={module.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <button
                      onClick={() => setSelectedModule(module)}
                      className={`group w-full text-left rounded-xl border backdrop-blur transition-all duration-200 hover:scale-[1.02] hover:shadow-xl ${
                        isCompleted
                          ? 'border-emerald-500/40 bg-emerald-950/30 hover:border-emerald-400/60 hover:shadow-emerald-500/10'
                          : 'border-slate-700/50 bg-slate-800/40 hover:border-indigo-500/40 hover:shadow-indigo-500/10'
                      } ${viewMode === 'list' ? 'flex items-center gap-4 px-5 py-4' : 'p-5'}`}
                    >
                      {viewMode === 'grid' ? (
                        <>
                          <div className="flex items-start justify-between mb-4">
                            <div className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl"
                              style={{ backgroundColor: module.color + '25' }}>
                              {module.icon}
                            </div>
                            <div className="flex gap-2">
                              {isCompleted && (
                                <Badge className="text-xs bg-emerald-600/30 text-emerald-300 border-emerald-500/40 border gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Completado
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                                {module.steps.length} pasos
                              </Badge>
                            </div>
                          </div>
                          <p className="font-semibold text-white group-hover:text-indigo-300 transition-colors mb-1">{module.title}</p>
                          <p className="text-sm text-slate-400 leading-snug mb-4">{module.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex gap-1.5 flex-wrap">
                              {module.keywords?.slice(0, 2).map(kw => (
                                <span key={kw} className="text-[10px] px-2 py-0.5 rounded-full border border-slate-600/50 text-slate-500">{kw}</span>
                              ))}
                            </div>
                            <Play className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                            style={{ backgroundColor: module.color + '25' }}>
                            {module.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-white group-hover:text-indigo-300 transition-colors">{module.title}</p>
                              {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />}
                            </div>
                            <p className="text-sm text-slate-400 truncate">{module.description}</p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">{module.steps.length} pasos</Badge>
                            <Play className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                          </div>
                        </>
                      )}
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Footer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="mt-8 pt-8 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          {[
            { icon: Play, title: 'Guías paso a paso', desc: 'Instrucciones detalladas y claras' },
            { icon: FileText, title: 'Explicaciones prácticas', desc: 'Ejemplos reales y contextuales' },
            { icon: Zap, title: 'Contenido actualizado', desc: 'Todos los módulos del sistema' },
          ].map((item, i) => (
            <div key={i} className="space-y-2">
              <item.icon className="h-7 w-7 text-indigo-400 mx-auto" />
              <p className="font-semibold text-white text-sm">{item.title}</p>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Certificado */}
      {showCertificate && (
        <CompletionCertificate
          module={showCertificate}
          userName={user?.full_name || 'Usuario'}
          onClose={() => setShowCertificate(null)}
        />
      )}
    </div>
  );
}