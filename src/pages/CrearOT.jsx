/**
 * Página para que el Jefe de Sitio cree OTs rápidamente
 * Flujo: Seleccionar establecimiento → Título + Prioridad → Instrucciones (texto/voz) → Fotos → Crear
 */
import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Mic, MicOff, Camera, CheckCircle2, Loader2, ArrowLeft,
  MapPin, ClipboardList, Zap, X, QrCode
} from 'lucide-react';
import QRCodeModal from '@/components/shared/QRCodeModal';

const PRIORITIES = [
  { value: 'baja', label: 'Baja', color: 'bg-slate-100 text-slate-700' },
  { value: 'media', label: 'Media', color: 'bg-blue-100 text-blue-700' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgente', label: '🚨 Urgente', color: 'bg-red-100 text-red-700' },
];

export default function CrearOT() {
  const queryClient = useQueryClient();

  // Form state
  const [step, setStep] = useState(1); // 1: establecimiento, 2: detalle, 3: creada
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('media');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [createdOT, setCreatedOT] = useState(null);
  const [showQR, setShowQR] = useState(false);

  // Audio recording
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Photo upload
  const fileRef = useRef();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { data: locations = [], isLoading: loadingLocations } = useQuery({
    queryKey: ['locations-crear-ot'],
    queryFn: () => base44.entities.LocationQR.list('name', 200),
    staleTime: 60000,
  });

  const activeLocations = locations.filter(l => l.is_active !== false);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WorkOrder.create(data),
    onSuccess: (ot) => {
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      setCreatedOT(ot);
      setStep(3);
    },
    onError: () => toast.error('Error al crear la OT'),
  });

  // ── Grabación de audio ──────────────────────────────────────────────────────
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = e => chunksRef.current.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      await transcribeAudio(blob);
    };
    mr.start();
    mediaRecorderRef.current = mr;
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const transcribeAudio = async (blob) => {
    setTranscribing(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });
      const text = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
      setDescription(prev => prev ? prev + ' ' + text : text);
      toast.success('Audio transcripto correctamente');
    } catch {
      toast.error('No se pudo transcribir el audio');
    }
    setTranscribing(false);
  };

  // ── Fotos ──────────────────────────────────────────────────────────────────
  const handlePhotos = async (files) => {
    if (!files?.length) return;
    setUploadingPhoto(true);
    for (const file of Array.from(files)) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotos(prev => [...prev, file_url]);
    }
    setUploadingPhoto(false);
  };

  // ── Crear OT ───────────────────────────────────────────────────────────────
  const handleCreate = () => {
    if (!title.trim()) { toast.error('El título es obligatorio'); return; }
    createMutation.mutate({
      title: title.trim(),
      priority,
      description,
      photos,
      status: 'pendiente',
      type: 'mantenimiento_correctivo',
      location_qr_id: selectedLocation?.id || '',
      location_qr_name: selectedLocation?.name || '',
      location: selectedLocation?.address || selectedLocation?.name || '',
      project_name: selectedLocation?.project_name || '',
    });
  };

  const resetForm = () => {
    setStep(1);
    setSelectedLocation(null);
    setTitle('');
    setPriority('media');
    setDescription('');
    setPhotos([]);
    setCreatedOT(null);
    setShowQR(false);
  };

  // ── PASO 3: OT Creada ──────────────────────────────────────────────────────
  if (step === 3 && createdOT) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl space-y-5">
          <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">¡OT Creada!</h2>
            <p className="text-muted-foreground text-sm mt-1">{createdOT.title}</p>
            {selectedLocation && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <MapPin className="h-3 w-3" /> {selectedLocation.name}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Button
              className="w-full gap-2 bg-primary hover:bg-primary/90"
              onClick={() => setShowQR(true)}
            >
              <QrCode className="h-4 w-4" /> Ver QR de la OT
            </Button>
            <Button variant="outline" className="w-full" onClick={resetForm}>
              Crear otra OT
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4 border-b border-border">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
          <ClipboardList className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Crear Orden de Trabajo</h1>
          <p className="text-xs text-muted-foreground">Rápido y sencillo</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* ── PASO 1: Establecimiento ───────────────────────────────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary" /> Establecimiento
          </label>
          {loadingLocations ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
            </div>
          ) : (
            <Select
              value={selectedLocation?.id || ''}
              onValueChange={(id) => {
                const loc = activeLocations.find(l => l.id === id);
                setSelectedLocation(loc || null);
              }}
            >
              <SelectTrigger className="bg-card border-border text-foreground h-12">
                <SelectValue placeholder="Seleccionar establecimiento..." />
              </SelectTrigger>
              <SelectContent>
                {activeLocations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                    {loc.address ? ` — ${loc.address}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* ── Título ─────────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Título de la tarea *
          </label>
          <Input
            placeholder="Ej: Revisar filtraciones en techo"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="bg-card border-border text-foreground h-12 text-base"
          />
        </div>

        {/* ── Prioridad ──────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Prioridad
          </label>
          <div className="grid grid-cols-4 gap-2">
            {PRIORITIES.map(p => (
              <button
                key={p.value}
                onClick={() => setPriority(p.value)}
                className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                  priority === p.value
                    ? 'border-primary ring-1 ring-primary ' + p.color
                    : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Instrucciones (texto + voz) ────────────────────────────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Instrucciones para el operario
          </label>
          <textarea
            placeholder="Escribí las instrucciones o usá el micrófono para dictarlas..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm px-3 py-3 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {/* Botón de grabación */}
          <div className="flex items-center gap-2">
            {recording ? (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 font-semibold text-sm animate-pulse"
              >
                <MicOff className="h-4 w-4" /> Detener grabación
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={transcribing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary font-semibold text-sm hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                {transcribing ? 'Transcribiendo...' : 'Dictar instrucciones'}
              </button>
            )}
            {recording && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> Grabando...
              </span>
            )}
          </div>
        </div>

        {/* ── Fotos ─────────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" /> Fotos de referencia
          </label>

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((url, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-border">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={e => handlePhotos(e.target.files)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingPhoto}
            className="w-full h-12 rounded-xl border-2 border-dashed border-border bg-card hover:border-primary/50 flex items-center justify-center gap-2 text-muted-foreground text-sm font-medium transition-colors disabled:opacity-50"
          >
            {uploadingPhoto
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo...</>
              : <><Camera className="h-4 w-4" /> Sacar / Subir Foto</>
            }
          </button>
        </div>

        {/* ── Botón Crear ────────────────────────────────────────────────────── */}
        <Button
          className="w-full h-14 text-base font-bold gap-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:shadow-lg shadow-purple-500/30 transition-all"
          onClick={handleCreate}
          disabled={!title.trim() || createMutation.isPending}
        >
          {createMutation.isPending
            ? <><Loader2 className="h-5 w-5 animate-spin" /> Creando OT...</>
            : <><Zap className="h-5 w-5" /> Crear Orden de Trabajo</>
          }
        </Button>

      </div>
    </div>
  );
}