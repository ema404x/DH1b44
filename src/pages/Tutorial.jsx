import React, { useState, useMemo, useEffect } from 'react';
import { BookOpen, ChevronRight, Search, Grid, List, Play, FileText, CheckCircle2, Trophy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TutorialGuide from '@/components/tutorial/TutorialGuide';
import CompletionCertificate from '@/components/tutorial/CompletionCertificate';
import { TUTORIAL_MODULES } from '@/components/tutorial/tutorialContent';
import { base44 } from '@/api/base44Client';

export default function Tutorial() {
  const [selectedModule, setSelectedModule] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [completedModules, setCompletedModules] = useState(new Set());
  const [user, setUser] = useState(null);
  const [showCertificate, setShowCertificate] = useState(null);

  // Cargar usuario y módulos completados
  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        // Recuperar módulos completados del localStorage
        const saved = localStorage.getItem('completedTutorialModules') || '[]';
        setCompletedModules(new Set(JSON.parse(saved)));
      } catch (err) {
        console.log('Error loading user:', err);
      }
    };
    loadData();
  }, []);

  const handleModuleComplete = (moduleId) => {
    const updated = new Set(completedModules);
    updated.add(moduleId);
    setCompletedModules(updated);
    localStorage.setItem('completedTutorialModules', JSON.stringify(Array.from(updated)));

    const module = TUTORIAL_MODULES.find(m => m.id === moduleId);
    if (module) {
      setShowCertificate(module);
    }
  };

  const filteredModules = useMemo(() => {
    if (!searchTerm) return TUTORIAL_MODULES;
    
    return TUTORIAL_MODULES.filter(mod =>
      mod.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mod.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mod.keywords?.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm]);

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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Centro de Aprendizaje</h1>
              <p className="text-muted-foreground mt-1">Domina DH1 Software paso a paso</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Busca un módulo o tema..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-11 text-base"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {filteredModules.length} módulos disponibles
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex justify-end gap-2 mb-6">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="gap-2"
          >
            <Grid className="h-4 w-4" /> Cuadrícula
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="gap-2"
          >
            <List className="h-4 w-4" /> Lista
          </Button>
        </div>

        {/* Progreso General */}
         <div className="mb-8 p-6 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
           <div className="flex items-center justify-between">
             <div>
               <h3 className="font-semibold text-lg flex items-center gap-2">
                 <Trophy className="h-5 w-5 text-primary" />
                 Tu Progreso
               </h3>
               <p className="text-sm text-muted-foreground mt-1">
                 {completedModules.size} de {TUTORIAL_MODULES.length} módulos completados
               </p>
             </div>
             <div className="text-3xl font-bold text-primary">
               {Math.round((completedModules.size / TUTORIAL_MODULES.length) * 100)}%
             </div>
           </div>
           <div className="mt-4 w-full bg-slate-200 rounded-full h-2">
             <div
               className="bg-gradient-to-r from-primary to-primary/70 h-2 rounded-full transition-all"
               style={{ width: `${(completedModules.size / TUTORIAL_MODULES.length) * 100}%` }}
             />
           </div>
         </div>

         {/* Modules Grid/List */}
         {filteredModules.length > 0 ? (
           <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
             {filteredModules.map((module) => {
               const isCompleted = completedModules.has(module.id);
               return (
                 <button
                   key={module.id}
                   onClick={() => setSelectedModule(module)}
                   className="group text-left"
                 >
                   <Card className={`h-full hover:shadow-lg transition-all duration-300 ${isCompleted ? 'border-emerald-300 bg-emerald-50/30 hover:border-primary/50 hover:scale-105' : 'hover:border-primary/50 hover:scale-105'}`}>
                     <CardHeader>
                       <div className="flex items-start justify-between gap-4 mb-2">
                         <div className={`h-12 w-12 rounded-lg flex items-center justify-center text-2xl`}
                           style={{ backgroundColor: module.color + '20' }}>
                           {module.icon}
                         </div>
                         <div className="flex gap-2 items-start">
                           {isCompleted && (
                             <Badge variant="default" className="text-xs bg-emerald-600 hover:bg-emerald-700 gap-1">
                               <CheckCircle2 className="h-3 w-3" /> Completado
                             </Badge>
                           )}
                           <Badge variant="secondary" className="text-xs">
                             {module.steps.length} pasos
                           </Badge>
                         </div>
                       </div>
                       <CardTitle className="group-hover:text-primary transition-colors">
                         {module.title}
                       </CardTitle>
                     </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {module.description}
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="flex gap-1">
                        {module.keywords?.slice(0, 2).map(kw => (
                          <Badge key={kw} variant="outline" className="text-xs">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-foreground">Sin resultados</p>
              <p className="text-sm text-muted-foreground">
                No encontramos módulos que coincidan con "{searchTerm}"
              </p>
              <Button
                variant="outline"
                onClick={() => setSearchTerm('')}
                className="mt-4"
              >
                Limpiar búsqueda
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
         <div className="mt-16 pt-8 border-t border-border">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="text-center space-y-2">
               <Play className="h-8 w-8 text-primary mx-auto" />
               <p className="font-semibold text-foreground">Guías paso a paso</p>
               <p className="text-sm text-muted-foreground">Instrucciones detalladas y claras</p>
             </div>
             <div className="text-center space-y-2">
               <FileText className="h-8 w-8 text-primary mx-auto" />
               <p className="font-semibold text-foreground">Explicaciones prácticas</p>
               <p className="text-sm text-muted-foreground">Ejemplos reales y contextuales</p>
             </div>
             <div className="text-center space-y-2">
               <BookOpen className="h-8 w-8 text-primary mx-auto" />
               <p className="font-semibold text-foreground">Contenido completo</p>
               <p className="text-sm text-muted-foreground">Todo lo que necesitas saber</p>
             </div>
           </div>
         </div>
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