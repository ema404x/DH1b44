/**
 * CrearOT — Formulario profesional de alta de Órdenes de Trabajo
 * Flujo guiado por pasos: Ubicación → Detalle → Tareas & Materiales → Asignación → Confirmación
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Mic, MicOff, Camera, CheckCircle2, Loader2, MapPin,
  ClipboardList, Zap, X, QrCode, Plus, Trash2, ChevronRight,
  ChevronLeft, Clock, Package, Wrench, AlertTriangle,
  Layers, ArrowLeft, Search
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import QRCodeModal from '@/components/shared/QRCodeModal';
import OTTemplateSelector from '@/components/workorders/OTTemplateSelector';

// ── Constantes ─────────────────────────────────────────────────────────────────

const PRIORITIES = [
  { value: 'baja',    label: 'Baja',      color: 'bg-slate-500/20 text-slate-300 border-slate-500/40' },
  { value: 'media',   label: 'Media',     color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  { value: 'alta',    label: 'Alta',      color: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  { value: 'urgente', label: '🚨 Urgente', color: 'bg-red-500/20 text-red-300 border-red-500/40' },
];

const TYPES = [
  { value: 'mantenimiento_correctivo',  label: 'Correctivo',  icon: Wrench },
  { value: 'mantenimiento_preventivo',  label: 'Preventivo',  icon: Clock },
  { value: 'instalacion',               label: 'Instalación', icon: Zap },
  { value: 'inspeccion',                label: 'Inspección',  icon: ClipboardList },
  { value: 'reparacion',                label: 'Reparación',  icon: AlertTriangle },
  { value: 'emergencia',                label: 'Emergencia',  icon: AlertTriangle },
];

const STEPS = [
  { id: 1, label: 'Ubicación' },
  { id: 2, label: 'Detalle' },
  { id: 3, label: 'Materiales' },
];

// ── Componente auxiliar: item de checklist ─────────────────────────────────────

function ChecklistItem({ item, onUpdate, onRemove }) {
  return (
    <div className="flex items-center gap-2 group">
      <Input
        value={item.task}
        onChange={e => onUpdate({ ...item, task: e.target.value })}
        placeholder="Descripción de la tarea..."
        className="flex-1 bg-slate-800 border-slate-700 text-white text-sm h-9"
      />
      <button
        onClick={onRemove}
        className="h-9 w-9 rounded-lg border border-slate-700 bg-slate-800 text-slate-500 hover:text-red-400 hover:border-red-500/50 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Componente auxiliar: item de material ─────────────────────────────────────

function MaterialItem({ item, onUpdate, onRemove }) {
  return (
    <div className="flex items-center gap-2 group">
      <Input
        value={item.material_name}
        onChange={e => onUpdate({ ...item, material_name: e.target.value })}
        placeholder="Material / insumo..."
        className="flex-1 bg-slate-800 border-slate-700 text-white text-sm h-9"
      />
      <Input
        type="number"
        value={item.quantity || ''}
        onChange={e => onUpdate({ ...item, quantity: parseFloat(e.target.value) || 0 })}
        placeholder="Cant."
        className="w-20 bg-slate-800 border-slate-700 text-white text-sm h-9"
      />
      <button
        onClick={onRemove}
        className="h-9 w-9 rounded-lg border border-slate-700 bg-slate-800 text-slate-500 hover:text-red-400 hover:border-red-500/50 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function CrearOT() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Wizard state
  const [step, setStep] = useState(1);
  const [createdOT, setCreatedOT] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  // Form fields
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('mantenimiento_correctivo');
  const [priority, setPriority] = useState('media');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [materials, setMaterials] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [requirePhotos, setRequirePhotos] = useState(false);

  // Audio (Web Speech API — transcripción en tiempo real)
  const [recording, setRecording] = useState(false);
  const [noSpeechSupport, setNoSpeechSupport] = useState(false);
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const descAcumuladaRef = useRef('');

  // Cleanup al desmontar
  useEffect(() => () => {
    isRecordingRef.current = false;
    recognitionRef.current?.stop();
  }, []);

  // Photo upload
  const fileRef = useRef();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ── Location search state ────────────────────────────────────────────────
  const [locationSearch, setLocationSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const locationSearchRef = useRef(null);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: locations = [], isLoading: loadingLocations } = useQuery({
    queryKey: ['locations-crear-ot'],
    queryFn: () => base44.entities.LocationQR.list('name', 2000),
    staleTime: 60000,
  });
  const activeLocations = locations;

  // ── Mutation ─────────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WorkOrder.create(data),
    onSuccess: (ot) => {
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      queryClient.invalidateQueries({ queryKey: ['workorders-campo'] });
      setCreatedOT(ot);
      setStep(5); // pantalla de éxito
      toast.success('¡Orden de trabajo creada exitosamente!');
    },
    onError: () => toast.error('Error al crear la OT. Intente nuevamente.'),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSelectLocation = useCallback((loc) => {
    setSelectedLocation(loc);
    setLocationSearch(loc.name);
    setShowSuggestions(false);
  }, []);

  const handleClearLocation = useCallback(() => {
    setSelectedLocation(null);
    setLocationSearch('');
    setShowSuggestions(false);
    setTimeout(() => locationSearchRef.current?.focus(), 50);
  }, []);

  const filteredSuggestions = useMemo(() =>
    activeLocations.filter(l =>
      !locationSearch ||
      l.name?.toLowerCase().includes(locationSearch.toLowerCase()) ||
      l.address?.toLowerCase().includes(locationSearch.toLowerCase())
    ).slice(0, 8)
  , [activeLocations, locationSearch]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('#location-search-container')) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Plantilla → pre-llena campos
  const handleApplyTemplate = useCallback((template) => {
    setTitle(template.title || '');
    setType(template.type || 'mantenimiento_correctivo');
    setPriority(template.priority || 'media');
    setDescription(template.description || '');
    setRequirePhotos(!!template.require_photos);
    setTemplateOpen(false);
    toast.success(`Plantilla "${template.nombre}" aplicada`);
  }, []);

  // Materiales
  const addMaterial = () =>
    setMaterials(prev => [...prev, { material_name: '', quantity: 1, unit_cost: 0 }]);
  const updateMaterial = (idx, updated) =>
    setMaterials(prev => prev.map((m, i) => i === idx ? updated : m));
  const removeMaterial = (idx) =>
    setMaterials(prev => prev.filter((_, i) => i !== idx));

  // Audio
  const createRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.lang = 'es-AR';
    r.continuous = false; // una sesión por vez — evita duplicados
    r.interimResults = false; // solo resultados finales
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(res => res[0].transcript)
        .join(' ')
        .trim();
      if (transcript) {
        const base = descAcumuladaRef.current.trimEnd();
        const updated = base ? base + ' ' + transcript : transcript;
        descAcumuladaRef.current = updated;
        setDescription(updated);
      }
    };

    r.onerror = (e) => {
      if (isRecordingRef.current && (e.error === 'no-speech' || e.error === 'audio-capture')) {
        setTimeout(() => { if (isRecordingRef.current) { try { r.start(); } catch (_) {} } }, 300);
      } else if (e.error !== 'aborted') {
        isRecordingRef.current = false;
        setRecording(false);
      }
    };

    r.onend = () => {
      if (isRecordingRef.current) {
        setTimeout(() => {
          if (isRecordingRef.current) {
            const newR = createRecognition();
            if (newR) { recognitionRef.current = newR; newR.start(); }
          }
        }, 200);
      } else {
        setRecording(false);
      }
    };

    return r;
  };

  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setNoSpeechSupport(true); return; }
    descAcumuladaRef.current = description; // sincronizar con el texto actual
    isRecordingRef.current = true;
    setRecording(true);
    const r = createRecognition();
    if (r) { recognitionRef.current = r; r.start(); }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    setRecording(false);
    recognitionRef.current?.stop();
  };

  // Fotos
  const handlePhotos = async (files) => {
    if (!files?.length) return;
    setUploadingPhoto(true);
    for (const file of Array.from(files)) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setPhotos(prev => [...prev, file_url]);
      } catch {
        toast.error(`Error subiendo ${file.name}`);
      }
    }
    setUploadingPhoto(false);
  };

  // Crear
  const handleCreate = () => {
    createMutation.mutate({
      title: title.trim(),
      type,
      priority,
      description,
      status: 'pendiente',
      scheduled_date: scheduledDate || undefined,
      materials_used: materials.filter(m => m.material_name.trim()),
      require_photos: requirePhotos,
      photos,
      location_qr_id: selectedLocation?.id || '',
      location_qr_name: selectedLocation?.name || '',
      location: selectedLocation?.address || selectedLocation?.name || '',
      project_name: selectedLocation?.project_name || '',
    });
  };

  // Reset
  const resetForm = () => {
    setStep(1);
    setCreatedOT(null);
    setShowQR(false);
    setSelectedLocation(null);
    setTitle('');
    setType('mantenimiento_correctivo');
    setPriority('media');
    setDescription('');
    setScheduledDate('');
    setMaterials([]);
    setPhotos([]);
    setRequirePhotos(false);
  };

  // ── Validaciones por paso ────────────────────────────────────────────────────

  const canProceed = () => {
    if (step === 1) return true; // ubicación es opcional
    if (step === 2) return title.trim().length > 0;
    if (step === 3) return true; // materiales opcionales
    return false;
  };

  // ── PASO 5: Éxito ──────────────────────────────────────────────────────────

  if (step === 5 && createdOT) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl space-y-6">
          <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">¡OT Creada!</h2>
            <p className="text-muted-foreground text-sm mt-1 font-medium">{createdOT.title}</p>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {selectedLocation && (
                <p className="flex items-center justify-center gap-1">
                  <MapPin className="h-3 w-3" /> {selectedLocation.name}
                </p>
              )}

            </div>
          </div>
          <div className="space-y-2">
            <Button className="w-full gap-2" onClick={() => setShowQR(true)}>
              <QrCode className="h-4 w-4" /> Ver QR de la OT
            </Button>
            <Button variant="outline" className="w-full" onClick={resetForm}>
              Crear otra OT
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => navigate('/ordenes')}>
              Ir a Órdenes de Trabajo
            </Button>
          </div>
        </div>

        {showQR && (
          <QRCodeModal
            open
            onClose={() => setShowQR(false)}
            title={createdOT.title}
            subtitle={selectedLocation?.name || ''}
            value={`${window.location.origin}/ejecutar-ot?ot=${createdOT.id}`}
          />
        )}
      </div>
    );
  }

  // ── Layout principal ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur border-b border-border px-4 pt-4 pb-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <Link to="/ordenes">
                <button className="h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </Link>
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <ClipboardList className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-foreground">Crear Orden de Trabajo</h1>
                <p className="text-xs text-muted-foreground">Paso {step} de 3</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTemplateOpen(true)}
              className="gap-1.5 border-border text-muted-foreground hover:text-foreground text-xs"
            >
              <Layers className="h-3.5 w-3.5" /> Plantilla
            </Button>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1">
            {STEPS.map(s => (
              <div key={s.id} className="flex-1">
                <div className={`h-1 rounded-full transition-colors ${step >= s.id ? 'bg-primary' : 'bg-border'}`} />
                <p className={`text-[10px] mt-1 text-center font-medium transition-colors ${step === s.id ? 'text-primary' : step > s.id ? 'text-muted-foreground' : 'text-border'}`}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* ── PASO 1: Ubicación ──────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <SectionTitle icon={MapPin} label="¿En qué establecimiento?" sub="Seleccioná la ubicación donde se realizará el trabajo" />

            {loadingLocations ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando establecimientos...
              </div>
            ) : (
              <div className="space-y-2">
                {/* Input con búsqueda */}
                <div id="location-search-container" className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    ref={locationSearchRef}
                    value={locationSearch}
                    onChange={e => {
                      setLocationSearch(e.target.value);
                      setSelectedLocation(null);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Escribí para buscar establecimiento..."
                    className="bg-card border-border text-foreground h-12 pl-9 pr-9"
                  />
                  {locationSearch && (
                    <button
                      onClick={handleClearLocation}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}

                  {/* Dropdown de sugerencias */}
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                      {filteredSuggestions.map(loc => (
                        <button
                          key={loc.id}
                          onMouseDown={() => handleSelectLocation(loc)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border/50 last:border-0"
                        >
                          <MapPin className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{loc.name}</p>
                            {loc.address && <p className="text-xs text-muted-foreground truncate">{loc.address}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Sin resultados */}
                  {showSuggestions && locationSearch && filteredSuggestions.length === 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl px-4 py-3 text-sm text-muted-foreground">
                      Sin resultados para "{locationSearch}"
                    </div>
                  )}
                </div>

                {selectedLocation && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm space-y-1">
                    <p className="font-semibold text-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" /> {selectedLocation.name}
                    </p>
                    {selectedLocation.address && <p className="text-muted-foreground text-xs flex items-center gap-1"><MapPin className="h-3 w-3" />{selectedLocation.address}</p>}
                    {selectedLocation.project_name && <p className="text-muted-foreground text-xs">Proyecto: {selectedLocation.project_name}</p>}
                  </div>
                )}

                {!selectedLocation && !locationSearch && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    La ubicación es opcional — podés continuar sin seleccionarla
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PASO 2: Detalle ────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <SectionTitle icon={ClipboardList} label="Detalle de la orden" sub="Completá los datos principales de la tarea" />

            {/* Título */}
            <FieldGroup label="Título *">
              <Input
                placeholder="Ej: Revisar filtraciones en techo del aula 3"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="bg-card border-border text-foreground h-12 text-base"
                autoFocus
              />
            </FieldGroup>

            {/* Tipo */}
            <FieldGroup label="Tipo de trabajo">
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-xs font-medium transition-all ${
                        type === t.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </FieldGroup>

            {/* Prioridad */}
            <FieldGroup label="Prioridad">
              <div className="grid grid-cols-4 gap-2">
                {PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                      priority === p.value
                        ? `${p.color} border-current ring-1 ring-current`
                        : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </FieldGroup>

            {/* Instrucciones */}
            <FieldGroup label="Instrucciones para el operario">
              <textarea
                placeholder="Describí detalladamente el trabajo a realizar, o usá el micrófono para dictarlo..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm px-3 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {recording ? (
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 font-semibold text-xs"
                  >
                    <MicOff className="h-3.5 w-3.5" /> Detener
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  </button>
                ) : (
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary font-semibold text-xs hover:bg-primary/20 transition-colors"
                  >
                    <Mic className="h-3.5 w-3.5" /> Dictar instrucciones
                  </button>
                )}
                {recording && (
                  <span className="text-xs text-red-400 font-medium flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Escuchando — hablá con normalidad
                  </span>
                )}
                {noSpeechSupport && (
                  <span className="text-xs text-destructive">Usá Chrome para grabación de voz</span>
                )}
              </div>
            </FieldGroup>

            {/* Fotos de referencia */}
            <FieldGroup label="Fotos de referencia">
              {photos.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {photos.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-border">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={e => handlePhotos(e.target.files)} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingPhoto}
                className="w-full h-11 rounded-xl border-2 border-dashed border-border bg-card hover:border-primary/50 flex items-center justify-center gap-2 text-muted-foreground text-sm font-medium transition-colors disabled:opacity-50"
              >
                {uploadingPhoto
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo...</>
                  : <><Camera className="h-4 w-4" /> Agregar foto(s) de referencia</>
                }
              </button>
            </FieldGroup>
          </div>
        )}

        {/* ── PASO 3: Materiales + Resumen ───────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <SectionTitle icon={Package} label="Materiales y confirmación" sub="Agregá los insumos necesarios y revisá el resumen antes de crear la OT" />

            {/* Fecha programada */}
            <FieldGroup label="Fecha programada">
              <Input
                type="date"
                value={scheduledDate}
                onChange={e => setScheduledDate(e.target.value)}
                className="bg-card border-border text-foreground h-11"
              />
            </FieldGroup>

            {/* Materiales */}
            <FieldGroup
              label="Materiales necesarios"
              action={
                <button onClick={addMaterial} className="text-xs text-primary flex items-center gap-1 hover:underline">
                  <Plus className="h-3 w-3" /> Agregar material
                </button>
              }
            >
              {materials.length === 0 ? (
                <div
                  onClick={addMaterial}
                  className="w-full h-16 rounded-xl border-2 border-dashed border-border bg-card hover:border-primary/50 flex items-center justify-center gap-2 text-muted-foreground text-sm cursor-pointer transition-colors"
                >
                  <Package className="h-4 w-4" /> Agregar materiales / insumos
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_80px_36px] gap-2 px-1">
                    <span className="text-xs text-muted-foreground uppercase font-medium">Material</span>
                    <span className="text-xs text-muted-foreground uppercase font-medium">Cant.</span>
                    <span />
                  </div>
                  {materials.map((m, idx) => (
                    <MaterialItem
                      key={idx}
                      item={m}
                      onUpdate={updated => updateMaterial(idx, updated)}
                      onRemove={() => removeMaterial(idx)}
                    />
                  ))}
                  <button onClick={addMaterial} className="w-full h-9 rounded-lg border border-dashed border-border bg-card hover:border-primary/50 text-xs text-muted-foreground flex items-center justify-center gap-1.5 transition-colors">
                    <Plus className="h-3 w-3" /> Agregar material
                  </button>
                </div>
              )}
            </FieldGroup>

            {/* Requiere fotos */}
            <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card cursor-pointer hover:border-primary/50 transition-colors">
              <input
                type="checkbox"
                checked={requirePhotos}
                onChange={e => setRequirePhotos(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              <div>
                <p className="text-sm font-medium text-foreground">Requiere fotos para completar</p>
                <p className="text-xs text-muted-foreground">El operario deberá adjuntar fotos antes de marcar la OT como completada</p>
              </div>
            </label>

            {/* Resumen */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumen de la OT</p>
              <SummaryRow label="Título" value={title} />
              <SummaryRow label="Tipo" value={TYPES.find(t => t.value === type)?.label} />
              <SummaryRow label="Prioridad" value={priority.charAt(0).toUpperCase() + priority.slice(1)} />
              {selectedLocation && <SummaryRow label="Establecimiento" value={selectedLocation.name} />}
              {scheduledDate && <SummaryRow label="Fecha programada" value={scheduledDate} />}
              {materials.filter(m => m.material_name.trim()).length > 0 && (
                <SummaryRow label="Materiales" value={`${materials.filter(m => m.material_name.trim()).length} ítem(s)`} />
              )}
              {photos.length > 0 && <SummaryRow label="Fotos adjuntas" value={`${photos.length} foto(s)`} />}
              {requirePhotos && <SummaryRow label="Requiere fotos" value="Sí" />}
            </div>
          </div>
        )}

        {/* ── Navegación de pasos ────────────────────────────────────────────── */}
        <div className="flex gap-3 pt-2 pb-8">
          {step > 1 && (
            <Button variant="outline" className="flex-1 h-12 gap-2 border-border" onClick={() => setStep(s => s - 1)}>
              <ChevronLeft className="h-4 w-4" /> Atrás
            </Button>
          )}
          {step < 3 ? (
            <Button
              className="flex-1 h-12 gap-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:shadow-lg shadow-purple-500/30"
              onClick={() => {
                if (!canProceed()) {
                  toast.error('Completá el título para continuar');
                  return;
                }
                setStep(s => s + 1);
              }}
            >
              Continuar <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              className="flex-1 h-12 gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:shadow-lg shadow-emerald-500/30 font-bold text-base"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending
                ? <><Loader2 className="h-5 w-5 animate-spin" /> Creando OT...</>
                : <><CheckCircle2 className="h-5 w-5" /> Crear Orden de Trabajo</>
              }
            </Button>
          )}
        </div>
      </div>

      {/* Selector de plantillas */}
      <OTTemplateSelector
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        onSelect={handleApplyTemplate}
      />
    </div>
  );
}

// ── Helpers de UI ──────────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, label, sub }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-foreground">{label}</h2>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function FieldGroup({ label, children, action }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
        {action}
      </div>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}