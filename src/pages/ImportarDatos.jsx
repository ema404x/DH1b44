import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { 
  Sparkles, Upload, Brain, CheckCircle2, Building2, Users, TrendingUp,
  ArrowRight, Zap, Globe, Clock, Shield, BarChart3, Loader2, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import ImportStepUpload from '@/components/importar/ImportStepUpload';
import ImportStepMapping from '@/components/importar/ImportStepMapping';
import ImportStepConfirm from '@/components/importar/ImportStepConfirm';
import ImportStepResult from '@/components/importar/ImportStepResult';
import AsignadorJefesEscuelas from '@/components/informacion-general/AsignadorJefesEscuelas';
import ImportadorJefesSitio from '@/components/informacion-general/ImportadorJefesSitio';

const STEPS = [
  { id: 0, name: 'Subir Archivo', icon: Upload, description: 'Selecciona tu archivo Excel' },
  { id: 1, name: 'Análisis IA', icon: Brain, description: 'Detección automática de datos' },
  { id: 2, name: 'Mapeo', icon: Sparkles, description: 'Confirma la estructura' },
  { id: 3, name: 'Resultado', icon: CheckCircle2, description: 'Importación completada' },
];

export default function ImportarDatos() {
  const [activeTab, setActiveTab] = useState('general');
  const [step, setStep] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [mappingResult, setMappingResult] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.LocationData.list('-created_date', 500),
  });

  const stats = useMemo(() => ({
    totalEscuelas: locations.length,
    activas: locations.filter(l => l.estado === 'activo').length,
    m2: locations.reduce((s, l) => s + (l.m2 || 0), 0),
  }), [locations]);

  const handleFileUploaded = async (file, fileUrl, rawData) => {
    setUploadedFile({ file, fileUrl, rawData });
    setIsProcessing(true);
    setStep(1);

    try {
      const response = await base44.functions.invoke('smartImportAnalyze', {
        file_url: fileUrl,
        raw_data: rawData,
      });
      const result = response.data?.sheets ? response.data : response.data?.response;
      setMappingResult(result);
      setStep(2);
    } catch (error) {
      toast.error('Error al analizar: ' + error.message);
      setStep(0);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMappingConfirmed = (confirmedMapping) => {
    setMappingResult(confirmedMapping);
  };

  const handleImportConfirmed = async (finalMapping) => {
    setIsProcessing(true);
    try {
      const response = await base44.functions.invoke('smartImportExecute', {
        mapping: finalMapping,
        raw_data: uploadedFile.rawData,
      });
      const result = response.data?.results ? response.data : response.data?.response;
      setImportResult(result);
      setStep(3);
    } catch (error) {
      toast.error('Error al importar: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setStep(0);
    setUploadedFile(null);
    setMappingResult(null);
    setImportResult(null);
    setIsProcessing(false);
  };

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10">
        {/* Header Premium */}
        <div className="border-b border-slate-700/50 backdrop-blur-xl bg-slate-900/50 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30">
                  <Brain className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                    Importación Inteligente de Datos
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 ml-2">AI-Powered</Badge>
                  </h1>
                  <p className="text-sm text-slate-400 mt-1">Carga tus datos con detección automática y mapeo inteligente</p>
                </div>
              </div>
              {step > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-right">
                  <p className="text-sm font-semibold text-primary mb-2">{STEPS[step].name}</p>
                  <p className="text-xs text-slate-400">{STEPS[step].description}</p>
                </motion.div>
              )}
            </motion.div>

            {/* Stats Row */}
            {step === 0 && (
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Escuelas Cargadas', value: stats.totalEscuelas, icon: Building2, color: 'from-blue-500' },
                  { label: 'Activas', value: stats.activas, icon: Zap, color: 'from-emerald-500' },
                  { label: 'Superficie (m²)', value: `${(stats.m2 / 1000).toFixed(1)}K`, icon: Globe, color: 'from-purple-500' },
                ].map((stat, i) => (
                  <motion.div key={i} variants={item}>
                    <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-3 backdrop-blur">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${stat.color} to-transparent flex items-center justify-center`}>
                          <stat.icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">{stat.label}</p>
                          <p className="text-lg font-bold text-white">{stat.value}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </div>

        {/* Tabs Premium */}
        <div className="max-w-7xl mx-auto px-6 pt-8">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-slate-800/50 border border-slate-700/50 backdrop-blur-xl grid w-full grid-cols-3 mb-8">
                <TabsTrigger value="general" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  <Brain className="h-4 w-4 mr-2" /> Importación IA
                </TabsTrigger>
                <TabsTrigger value="jefes" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  <Users className="h-4 w-4 mr-2" /> Jefes de Sitio
                </TabsTrigger>
                <TabsTrigger value="escuelas" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  <Building2 className="h-4 w-4 mr-2" /> Escuelas
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </motion.div>

          {/* Content */}
          {activeTab === 'general' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Steps Indicator */}
              {step > 0 && (
                <div className="flex gap-2 mb-8">
                  {STEPS.map((s, idx) => {
                    const StepIcon = s.icon;
                    const isActive = idx === step;
                    const isComplete = idx < step;
                    return (
                      <motion.div
                        key={idx}
                        className="flex-1"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                      >
                        <div
                          className={`relative p-4 rounded-lg backdrop-blur transition-all ${
                            isActive
                              ? 'bg-primary/30 border border-primary/50 shadow-lg shadow-primary/20'
                              : isComplete
                              ? 'bg-emerald-500/20 border border-emerald-500/50'
                              : 'bg-slate-700/30 border border-slate-600/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isComplete ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                            ) : (
                              <div className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                isActive ? 'bg-primary text-white' : 'bg-slate-600 text-slate-300'
                              }`}>
                                {idx + 1}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-semibold text-white">{s.name}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>
                            </div>
                          </div>
                          {isActive && (
                            <motion.div
                              className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/50"
                              animate={{ opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Main Content */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                {step === 0 && <ImportStepUpload onFileUploaded={handleFileUploaded} />}
                {step === 1 && isProcessing && (
                  <Card className="border-0 bg-gradient-to-br from-slate-700/50 to-slate-800/50 backdrop-blur-xl">
                    <CardContent className="flex flex-col items-center justify-center py-24 gap-6">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                        className="relative"
                      >
                        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-purple-600 opacity-20" />
                        <Brain className="h-12 w-12 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </motion.div>
                      <div className="text-center">
                        <p className="text-xl font-semibold text-white mb-2">Analizando con IA...</p>
                        <p className="text-sm text-slate-400">Detectando entidades, patrones y mapeando columnas automáticamente</p>
                      </div>
                      <motion.div className="flex gap-1">
                        {[...Array(3)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="h-2 w-2 rounded-full bg-primary"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ delay: i * 0.2, duration: 1.5, repeat: Infinity }}
                          />
                        ))}
                      </motion.div>
                    </CardContent>
                  </Card>
                )}
                {step === 2 && mappingResult && (
                  <ImportStepMapping
                    mappingResult={mappingResult}
                    onConfirm={handleMappingConfirmed}
                    onBack={() => setStep(0)}
                  />
                )}
                {step === 2 && !isProcessing && mappingResult && (
                  <div className="flex gap-3 justify-end mt-6">
                    <Button
                      variant="outline"
                      onClick={() => { handleReset(); }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => {
                        setIsProcessing(true);
                        handleImportConfirmed(mappingResult);
                      }}
                      disabled={isProcessing}
                      className="gap-2"
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      Importar Ahora
                    </Button>
                  </div>
                )}
                {step === 3 && importResult && (
                  <ImportStepResult
                    result={importResult}
                    onReset={handleReset}
                  />
                )}
              </motion.div>
            </motion.div>
          )}

          {activeTab === 'jefes' && (
            <motion.div key={`jefes-${refreshKey}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <ImportadorJefesSitio 
                locations={locations}
                onSuccess={() => setRefreshKey(prev => prev + 1)}
              />
            </motion.div>
          )}

          {activeTab === 'escuelas' && (
            <motion.div key={`escuelas-${refreshKey}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <AsignadorJefesEscuelas 
                onSuccess={() => setRefreshKey(prev => prev + 1)}
              />
            </motion.div>
          )}
        </div>

        {/* Footer Info */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="max-w-7xl mx-auto px-6 py-8 mt-12 border-t border-slate-700/50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { icon: Sparkles, title: 'IA Inteligente', desc: 'Detección automática de datos' },
              { icon: Clock, title: 'Ultra Rápido', desc: 'Procesa miles de registros' },
              { icon: Shield, title: 'Seguro', desc: 'Validación integrada' },
              { icon: TrendingUp, title: 'Reportes', desc: 'Estadísticas en tiempo real' },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + idx * 0.1 }}
                className="text-center"
              >
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/30 to-purple-600/30 flex items-center justify-center mx-auto mb-3">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="font-semibold text-white text-sm">{feature.title}</p>
                <p className="text-xs text-slate-400 mt-1">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}