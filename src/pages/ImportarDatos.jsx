import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Brain, Upload, CheckCircle2, Sparkles, Clock, Shield, TrendingUp, Loader2, Zap, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import ImportStepUpload from '@/components/importar/ImportStepUpload';
import ImportStepMapping from '@/components/importar/ImportStepMapping';
import ImportStepResult from '@/components/importar/ImportStepResult';
import ImportadorJefesSitio from '@/components/informacion-general/ImportadorJefesSitio';
import AsignadorJefesEscuelas from '@/components/informacion-general/AsignadorJefesEscuelas';
import AliceImportAssistant from '@/components/importar/AliceImportAssistant';

const MODULES = [
  { key: 'InformePlaneacion', label: 'Informes de Planificación', icon: 'ScrollText', color: 'from-cyan-500', hint: 'Mes, descripción, proveedor, estado...' },
  { key: 'Client', label: 'Proveedores / Clientes', icon: 'Users', color: 'from-blue-500', hint: 'CUIT, razón social, contacto...' },
  { key: 'Employee', label: 'Empleados', icon: 'HardHat', color: 'from-emerald-500', hint: 'DNI, nombre, cargo, especialidad...' },
  { key: 'Material', label: 'Materiales / Inventario', icon: 'Package', color: 'from-amber-500', hint: 'Código, descripción, stock, precio...' },
  { key: 'Project', label: 'Proyectos / Obras', icon: 'Briefcase', color: 'from-violet-500', hint: 'Nombre, código, cliente, fechas...' },
  { key: 'WorkOrder', label: 'Órdenes de Trabajo', icon: 'ClipboardList', color: 'from-orange-500', hint: 'N° OT, tareas, ubicación, estado...' },
  { key: 'Asset', label: 'Activos / Equipos', icon: 'TrendingUp', color: 'from-cyan-500', hint: 'Nombre, serie, marca, modelo...' },
  { key: 'LocationData', label: 'Ubicaciones Técnicas', icon: 'MapPin', color: 'from-pink-500', hint: 'Ubic. técnica, establecimiento, m2...' },
  { key: 'PrecarioMinisterio', label: 'Preciario Ministerial', icon: 'DollarSign', color: 'from-lime-500', hint: 'Código, descripción, PU mat, PU mo...' },
  { key: 'Quote', label: 'Presupuestos', icon: 'FileText', color: 'from-teal-500', hint: 'Título, cliente, subtotal, total...' },
  { key: 'Invoice', label: 'Facturas', icon: 'DollarSign', color: 'from-red-500', hint: 'Cliente, importe, fecha, estado...' },
  { key: 'Informe', label: 'Informes', icon: 'ScrollText', color: 'from-indigo-500', hint: 'Título, establecimiento, jefe de sitio...' },
  { key: 'Emergencia', label: 'Emergencias', icon: 'AlertTriangle', color: 'from-rose-500', hint: 'Tipo, establecimiento, estado, descripción...' },
  { key: 'RiesgoControl', label: 'Control de Riesgos', icon: 'ShieldAlert', color: 'from-yellow-500', hint: 'Evento, probabilidad, consecuencia, sector...' },
  { key: 'ObraCertificacion', label: 'Certificación de Obras', icon: 'Star', color: 'from-orange-400', hint: 'Título SAP, MTOM, MEIN, monto, avance...' },
  { key: 'Direccion', label: 'Direcciones', icon: 'Building2', color: 'from-slate-500', hint: 'Dirección, comuna, jefe de sitio, m2...' },
  { key: null, label: 'Detección Automática', icon: 'Brain', color: 'from-primary', hint: 'La IA detecta automáticamente el módulo' },
];

const STEPS = [
  { id: 0, name: 'Módulo', icon: Sparkles },
  { id: 1, name: 'Subir', icon: Upload },
  { id: 2, name: 'Análisis', icon: Brain },
  { id: 3, name: 'Mapeo', icon: Sparkles },
  { id: 4, name: 'Resultado', icon: CheckCircle2 },
];

function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isActive = step.id === currentStep;
        const isCompleted = step.id < currentStep;
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center font-semibold transition-all ${
              isCompleted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' :
              isActive ? 'bg-primary/20 text-primary border border-primary/50 ring-2 ring-primary/30' :
              'bg-slate-700/50 text-slate-400 border border-slate-600/50'
            }`}>
              <Icon className="h-4 w-4" />
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-0.5 w-6 ${isCompleted ? 'bg-emerald-500/50' : 'bg-slate-700/30'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ImportFlow({ onReset }) {
  const [step, setStep] = useState(0);
  const [selectedModule, setSelectedModule] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [mappingResult, setMappingResult] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const mappingRef = useRef(null);

  const handleModuleSelect = (moduleKey) => {
    setSelectedModule(MODULES.find(m => m.key === moduleKey) || null);
    setStep(1);
  };

  const handleFileUploaded = async (file, fileUrl, rawData) => {
    setUploadedFile({ file, fileUrl, rawData });
    setIsProcessing(true);
    setStep(2);

    try {
      const res = await base44.functions.invoke('smartImportAnalyze', {
        file_url: fileUrl,
        raw_data: rawData,
        hint_entity: selectedModule?.key || null,
      });

      const result = res.data?.sheets ? res.data : res.data?.response;
      if (!result?.sheets?.length) {
        toast.error('No se detectaron datos en el archivo');
        setStep(1);
        return;
      }

      // Forzar entidad si se seleccionó módulo
      const finalResult = selectedModule?.key
        ? { ...result, sheets: result.sheets.map(s => ({ ...s, target_entity: selectedModule.key })) }
        : result;

      mappingRef.current = finalResult;
      setMappingResult(finalResult);
      setStep(3);
    } catch (err) {
      toast.error('Error: ' + err.message);
      setStep(1);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    const mapping = mappingRef.current || mappingResult;
    if (!mapping?.sheets?.some(s => s.target_entity && s.target_entity !== 'skip')) {
      toast.error('Configura al menos una hoja para importar');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await base44.functions.invoke('smartImportExecute', {
        mapping,
        raw_data: uploadedFile.rawData,
      });

      const result = res.data?.results ? res.data : res.data?.response;
      if (!result?.results?.length) {
        toast.error('La importación no devolvió resultados válidos');
        return;
      }

      setImportResult(result);
      setStep(4);
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setStep(0);
    setSelectedModule(null);
    setUploadedFile(null);
    setMappingResult(null);
    setImportResult(null);
    mappingRef.current = null;
    onReset?.();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <StepIndicator currentStep={step} />
      <AliceImportAssistant step={step} mappingResult={mappingResult} importResult={importResult} />

      {/* Step 0: Module Selection */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-slate-700/30 border border-slate-600/50 rounded-lg">
            <Brain className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm text-slate-300">Elige el módulo o usa <strong>Detección Automática</strong></span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {MODULES.map((mod) => (
              <motion.button
                key={mod.key ?? 'auto'}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleModuleSelect(mod.key)}
                className="group flex flex-col items-start gap-2 p-4 rounded-xl border border-slate-600/50 bg-slate-800/50 hover:border-primary/50 hover:bg-slate-700/50 transition-all text-left"
              >
                <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${mod.color} to-transparent flex items-center justify-center`}>
                  {mod.icon && <span className="text-white text-xs">{mod.icon.charAt(0)}</span>}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white leading-tight">{mod.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{mod.hint}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-primary mt-auto" />
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 1 && <ImportStepUpload onFileUploaded={handleFileUploaded} />}

      {/* Step 2: Processing */}
      {step === 2 && (
        <Card className="border-0 bg-gradient-to-br from-slate-700/50 to-slate-800/50 backdrop-blur-xl">
          <CardContent className="flex flex-col items-center justify-center py-24 gap-6">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
              <Brain className="h-12 w-12 text-primary" />
            </motion.div>
            <div className="text-center">
              <p className="text-xl font-semibold text-white mb-2">Analizando con IA...</p>
              <p className="text-sm text-slate-400">
                {selectedModule ? `Mapeando ${selectedModule.label}` : 'Detectando estructura automáticamente'}
              </p>
            </div>
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <motion.div key={i} className="h-2 w-2 rounded-full bg-primary"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ delay: i * 0.2, duration: 1.5, repeat: Infinity }} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Mapping */}
      {step === 3 && mappingResult && (
        <>
          <ImportStepMapping
            mappingResult={mappingResult}
            onConfirm={(m) => { mappingRef.current = m; setMappingResult(m); }}
            onBack={() => setStep(1)}
          />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleReset}>Cancelar</Button>
            <Button onClick={handleImport} disabled={isProcessing} className="gap-2">
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Importar
            </Button>
          </div>
        </>
      )}

      {/* Step 4: Result */}
      {step === 4 && importResult && (
        <ImportStepResult result={importResult} onReset={handleReset} />
      )}
    </motion.div>
  );
}

export default function ImportarDatos() {
  const [activeTab, setActiveTab] = useState('general');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="border-b border-slate-700/50 backdrop-blur-xl bg-slate-900/50 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Importación Inteligente</h1>
                  <p className="text-xs text-slate-400 mt-0.5">Importá datos desde Excel con mapeo automático</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-6">
            <TabsList className="bg-slate-800/50 border border-slate-700/50 backdrop-blur-xl grid w-full grid-cols-3">
              <TabsTrigger value="general" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                <Brain className="h-4 w-4 mr-2" /> Importación
              </TabsTrigger>
              <TabsTrigger value="jefes" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                <Upload className="h-4 w-4 mr-2" /> Jefes de Sitio
              </TabsTrigger>
              <TabsTrigger value="escuelas" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                <Upload className="h-4 w-4 mr-2" /> Escuelas
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Content */}
          {activeTab === 'general' && <ImportFlow onReset={() => setRefreshKey(k => k + 1)} key={refreshKey} />}
          {activeTab === 'jefes' && <motion.div key={`jefes-${refreshKey}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <ImportadorJefesSitio onSuccess={() => setRefreshKey(k => k + 1)} />
          </motion.div>}
          {activeTab === 'escuelas' && <motion.div key={`escuelas-${refreshKey}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <AsignadorJefesEscuelas onSuccess={() => setRefreshKey(k => k + 1)} />
          </motion.div>}

          {/* Footer */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 py-8 border-t border-slate-700/50">
            {[
              { icon: Sparkles, title: 'IA Inteligente', desc: 'Detección automática' },
              { icon: Clock, title: 'Ultra Rápido', desc: 'Miles de registros' },
              { icon: Shield, title: 'Seguro', desc: 'Validación integrada' },
              { icon: TrendingUp, title: '16 Módulos', desc: 'Cualquier entidad' },
            ].map((f, i) => (
              <div key={i} className="text-center">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/30 to-purple-600/30 flex items-center justify-center mx-auto mb-2">
                  <f.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="font-semibold text-white text-xs">{f.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}