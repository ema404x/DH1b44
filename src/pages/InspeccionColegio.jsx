import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList, Plus, ArrowLeft, Loader2, Sparkles, Calendar, User,
  RefreshCw, Building2, MapPin, CheckCircle2, FileText, AlertTriangle,
  Search, Trash2, Activity, Shield, ChevronRight, X, GripVertical, PlusCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import SeccionInspeccion from '@/components/inspeccion/SeccionInspeccion';
import InformeViewer from '@/components/inspeccion/InformeViewer';
import { format } from 'date-fns';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const SECCIONES_DEFAULT = [
  'Fachada y accesos', 'Aulas', 'Baños', 'Cocina / Comedor',
  'Patio / Espacios exteriores', 'Instalaciones eléctricas',
  'Instalaciones de agua / Plomería', 'Instalaciones de gas',
  'Techo / Cubierta', 'Sala de dirección / Administración',
  'Observaciones generales', 'Otro',
];

const STATUS_CFG = {
  borrador:    { label: 'Borrador',    dot: 'bg-slate-400',  badge: 'bg-slate-800 text-slate-300 border-slate-600' },
  en_progreso: { label: 'En progreso', dot: 'bg-blue-400',   badge: 'bg-blue-900/60 text-blue-300 border-blue-700' },
  generando:   { label: 'Generando',  dot: 'bg-amber-400 animate-pulse', badge: 'bg-amber-900/60 text-amber-300 border-amber-700' },
  completado:  { label: 'Completado', dot: 'bg-emerald-400', badge: 'bg-emerald-900/60 text-emerald-300 border-emerald-700' },
};

function buildSecciones() {
  return SECCIONES_DEFAULT.map((nombre, i) => ({
    id: `sec_${i}`, nombre, transcripcion: '', notas_libres: '', fotos: [], completada: false,
  }));
}

// ── Mini card para lista móvil ─────────────────────────────────────────────
function InspeccionCard({ insp, onOpen, onDelete }) {
  const st = STATUS_CFG[insp.estado] || STATUS_CFG.borrador;
  const completadas = insp.secciones?.filter(s => s.completada).length || 0;
  const total = insp.secciones?.length || 0;
  const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;

  return (
    <div
      onClick={() => onOpen(insp)}
      className="bg-card border border-border rounded-xl p-4 active:scale-[0.98] transition-transform cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight line-clamp-2">{insp.titulo || insp.establecimiento}</p>
            {insp.titulo && <p className="text-xs text-muted-foreground mt-0.5 truncate">{insp.establecimiento}</p>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              {insp.fecha_inspeccion && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />{insp.fecha_inspeccion}
                </span>
              )}
              {insp.jefe_sitio && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <User className="h-3 w-3" />{insp.jefe_sitio}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${st.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onDelete(insp.id); }}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground">{completadas}/{total} secciones</span>
            <span className="text-[11px] font-bold">{pct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export default function InspeccionColegioPage() {
  const { filterByUser, displayName } = useCurrentUser();
  const queryClient = useQueryClient();

  const [vista, setVista] = useState('lista');
  const [inspeccionActiva, setInspeccionActiva] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [creando, setCreando] = useState(false);
  const [mostrarInforme, setMostrarInforme] = useState(false);
  const [formNueva, setFormNueva] = useState({
    establecimiento: '', direccion: '', titulo: '', comuna: '',
    fecha_inspeccion: format(new Date(), 'yyyy-MM-dd'),
  });
  const [nuevaSeccionNombre, setNuevaSeccionNombre] = useState('');
  const [dragSeccion, setDragSeccion] = useState(null);

  const saveTimerRef = useRef(null);
  const pendingSaveRef = useRef(null);
  const pollingRef = useRef(null);

  const { data: rawInspecciones = [], isLoading } = useQuery({
    queryKey: ['inspecciones'],
    queryFn: () => base44.entities.InspeccionColegio.list('-created_date', 50),
    staleTime: 0,
  });
  const inspecciones = filterByUser(rawInspecciones, ['jefe_sitio', 'created_by']);

  const { data: locations = [] } = useQuery({
    queryKey: ['locationData'],
    queryFn: () => base44.entities.LocationData.list('-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });
  const { data: direccionesData = [] } = useQuery({
    queryKey: ['direcciones'],
    queryFn: () => base44.entities.Direccion.list('-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  const direccionMap = useMemo(() => {
    const m = {}; direccionesData.forEach(d => { m[d.id] = d.direccion; }); return m;
  }, [direccionesData]);

  const establecimientos = useMemo(() =>
    [...new Set(locations.map(l => l.establecimiento).filter(Boolean))].sort(), [locations]);
  const direccionesList = useMemo(() =>
    [...new Set(direccionesData.map(d => d.direccion).filter(Boolean))].sort(), [direccionesData]);

  const getDireccionCalle = (loc) =>
    loc?.direccion_id && direccionMap[loc.direccion_id] ? direccionMap[loc.direccion_id] : '';

  const handleEstablecimientoChange = (val) => {
    setFormNueva(p => {
      const match = locations.find(l => l.establecimiento === val);
      const calle = match ? getDireccionCalle(match) : p.direccion;
      return { ...p, establecimiento: val, direccion: calle || p.direccion, comuna: match?.comuna || p.comuna };
    });
  };

  // Reordenamiento de secciones drag & drop (nativo HTML5)
  const handleDragStart = (e, idx) => { setDragSeccion(idx); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (dragSeccion === null || dragSeccion === idx) return;
    setInspeccionActiva(prev => {
      const secs = [...prev.secciones];
      const [moved] = secs.splice(dragSeccion, 1);
      secs.splice(idx, 0, moved);
      setDragSeccion(idx);
      return { ...prev, secciones: secs };
    });
  };
  const handleDragEnd = () => {
    setDragSeccion(null);
    if (inspeccionActiva) {
      base44.entities.InspeccionColegio.update(inspeccionActiva.id, { secciones: inspeccionActiva.secciones });
    }
  };

  // Agregar sección personalizada
  const handleAgregarSeccion = () => {
    const nombre = nuevaSeccionNombre.trim();
    if (!nombre) return;
    const nueva = { id: `sec_custom_${Date.now()}`, nombre, transcripcion: '', notas_libres: '', fotos: [], completada: false };
    setInspeccionActiva(prev => {
      const secciones = [...prev.secciones, nueva];
      base44.entities.InspeccionColegio.update(prev.id, { secciones });
      return { ...prev, secciones };
    });
    setNuevaSeccionNombre('');
  };

  // KPIs
  const kpis = useMemo(() => ({
    total: inspecciones.length,
    completadas: inspecciones.filter(i => i.estado === 'completado').length,
    en_progreso: inspecciones.filter(i => i.estado === 'en_progreso').length,
    con_informe: inspecciones.filter(i => i.informe_generado).length,
  }), [inspecciones]);

  // Filtros
  const inspeccionesFiltradas = useMemo(() =>
    inspecciones.filter(i => {
      const q = busqueda.toLowerCase();
      const matchQ = !q || (i.establecimiento || '').toLowerCase().includes(q) || (i.titulo || '').toLowerCase().includes(q);
      const matchE = filtroEstado === 'todos' || i.estado === filtroEstado;
      return matchQ && matchE;
    }), [inspecciones, busqueda, filtroEstado]);

  // Guardar con debounce
  const flushSave = useCallback(async (id, secciones) => {
    setGuardando(true);
    try { await base44.entities.InspeccionColegio.update(id, { secciones }); }
    catch { toast.error('Error al guardar'); }
    finally { setGuardando(false); }
  }, []);

  const handleSeccionChange = useCallback((seccionId, cambios) => {
    setInspeccionActiva(prev => {
      if (!prev) return prev;
      const secciones = prev.secciones.map(s => s.id === seccionId ? { ...s, ...cambios } : s);
      const updated = { ...prev, secciones };
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      pendingSaveRef.current = { id: updated.id, secciones };
      saveTimerRef.current = setTimeout(() => {
        if (pendingSaveRef.current) {
          flushSave(pendingSaveRef.current.id, pendingSaveRef.current.secciones);
          pendingSaveRef.current = null;
        }
      }, 400);
      return updated;
    });
  }, [flushSave]);

  // Flush al desmontar
  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (pendingSaveRef.current)
      base44.entities.InspeccionColegio.update(pendingSaveRef.current.id, { secciones: pendingSaveRef.current.secciones });
  }, []);

  const stopPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  };
  useEffect(() => () => stopPolling(), []);

  const handleCrearNueva = async () => {
    if (!formNueva.establecimiento) return toast.error('Ingresá el establecimiento');
    setCreando(true);
    try {
      const nueva = await base44.entities.InspeccionColegio.create({
        ...formNueva,
        titulo: formNueva.titulo || `Inspección ${formNueva.establecimiento} — ${format(new Date(), 'dd/MM/yyyy')}`,
        jefe_sitio: displayName || 'Inspector',
        estado: 'en_progreso',
        secciones: buildSecciones(),
      });
      queryClient.invalidateQueries({ queryKey: ['inspecciones'] });
      setInspeccionActiva(nueva);
      setMostrarInforme(false);
      setVista('editar');
    } catch { toast.error('Error al crear la inspección'); }
    finally { setCreando(false); }
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar esta inspección?')) return;
    await base44.entities.InspeccionColegio.delete(id);
    queryClient.invalidateQueries({ queryKey: ['inspecciones'] });
  };

  const handleGenerarInforme = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const seccionesActuales = inspeccionActiva.secciones;
    const inspeccionId = inspeccionActiva.id;

    setGenerando(true);
    setMostrarInforme(false);
    setInspeccionActiva(prev => ({ ...prev, informe_generado: null, estado: 'generando' }));

    await base44.entities.InspeccionColegio.update(inspeccionId, {
      estado: 'generando', secciones: seccionesActuales, informe_generado: '',
    });

    stopPolling();
    let intentos = 0;
    const MAX_INTENTOS = 24;

    pollingRef.current = setInterval(async () => {
      intentos++;
      try {
        const fresca = await base44.entities.InspeccionColegio.get(inspeccionId);
        if (fresca?.informe_generado && fresca.informe_generado.length > 50) {
          stopPolling();
          setGenerando(false);
          setMostrarInforme(true);
          setInspeccionActiva(prev => ({
            ...prev,
            secciones: seccionesActuales,
            informe_generado: fresca.informe_generado,
            estado: 'completado',
          }));
          queryClient.invalidateQueries({ queryKey: ['inspecciones'] });
          toast.success('Informe generado correctamente');
        } else if (intentos >= MAX_INTENTOS) {
          stopPolling();
          setGenerando(false);
          toast.error('Tiempo de espera agotado. Intentá regenerar el informe.');
          setInspeccionActiva(prev => ({ ...prev, secciones: seccionesActuales, informe_generado: null, estado: 'en_progreso' }));
        }
      } catch { /* seguir intentando */ }
    }, 5000);

    base44.functions.invoke('generarInformeInspeccion', { inspeccion_id: inspeccionId })
      .then(res => {
        const informe = res?.data?.informe;
        if (informe && informe.length > 50) {
          stopPolling();
          setGenerando(false);
          setMostrarInforme(true);
          setInspeccionActiva(prev => ({
            ...prev, secciones: seccionesActuales, informe_generado: informe, estado: 'completado',
          }));
          queryClient.invalidateQueries({ queryKey: ['inspecciones'] });
          toast.success('Informe generado correctamente');
        }
      })
      .catch(() => { /* el polling maneja el resultado */ });
  };

  const seccionesCompletadas = inspeccionActiva?.secciones?.filter(s => s.completada).length || 0;
  const totalSecciones = inspeccionActiva?.secciones?.length || 0;
  const pctProgreso = totalSecciones > 0 ? Math.round((seccionesCompletadas / totalSecciones) * 100) : 0;
  const tieneInforme = Boolean(inspeccionActiva?.informe_generado);

  // ── VISTA: LISTA ────────────────────────────────────────────────────────────
  if (vista === 'lista') return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1 font-medium tracking-wide uppercase">
            <Shield className="h-3 w-3" /> Inspección Edilicia
          </div>
          <h1 className="text-xl font-bold tracking-tight leading-tight">Inspecciones</h1>
          <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">Recorridos · Fotos · Informes IA</p>
        </div>
        <Button onClick={() => setVista('nueva')} className="gap-2 h-9 shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nueva inspección</span>
          <span className="sm:hidden">Nueva</span>
        </Button>
      </div>

      {/* KPI strip — horizontal scroll en móvil */}
      {!isLoading && inspecciones.length > 0 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap no-scrollbar">
          {[
            { icon: ClipboardList, label: 'Total', value: kpis.total, cls: 'text-primary bg-primary/10' },
            { icon: Activity, label: 'En progreso', value: kpis.en_progreso, cls: 'text-blue-400 bg-blue-500/10' },
            { icon: CheckCircle2, label: 'Completadas', value: kpis.completadas, cls: 'text-emerald-400 bg-emerald-500/10' },
            { icon: FileText, label: 'Con informe', value: kpis.con_informe, cls: 'text-violet-400 bg-violet-500/10' },
          ].map(({ icon: Icon, label, value, cls }) => (
            <div key={label} className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-3.5 py-2.5 shrink-0">
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${cls}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
                <p className="text-base font-bold leading-tight mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      {!isLoading && inspecciones.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar establecimiento..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="pl-9 h-10 text-sm"
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 bg-muted rounded-xl p-1 overflow-x-auto">
            {[
              { key: 'todos', label: 'Todos' },
              { key: 'en_progreso', label: 'En progreso' },
              { key: 'completado', label: 'Completado' },
              { key: 'borrador', label: 'Borrador' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setFiltroEstado(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  filtroEstado === key ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="h-9 w-9 bg-muted rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-muted rounded w-3/4" />
                  <div className="h-2.5 bg-muted rounded w-1/2" />
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full mt-4" />
            </div>
          ))}
        </div>
      ) : inspeccionesFiltradas.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-16 flex flex-col items-center gap-3 text-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
            <ClipboardList className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">{busqueda ? 'Sin resultados' : 'Sin inspecciones'}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {busqueda ? 'Probá con otro término' : 'Iniciá el primer recorrido'}
            </p>
          </div>
          {!busqueda && (
            <Button onClick={() => setVista('nueva')} className="gap-2 mt-1">
              <Plus className="h-4 w-4" /> Nueva inspección
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {inspeccionesFiltradas.map(insp => (
            <InspeccionCard
              key={insp.id}
              insp={insp}
              onOpen={i => { setInspeccionActiva(i); setMostrarInforme(Boolean(i.informe_generado)); setVista('editar'); }}
              onDelete={handleEliminar}
            />
          ))}
        </div>
      )}
    </div>
  );

  // ── VISTA: NUEVA ────────────────────────────────────────────────────────────
  if (vista === 'nueva') return (
    <div className="max-w-xl mx-auto space-y-4 pb-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setVista('lista')}
          className="h-9 w-9 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-lg font-bold">Nueva inspección</h2>
          <p className="text-xs text-muted-foreground">{SECCIONES_DEFAULT.length} secciones predefinidas</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="bg-muted/40 border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Datos del establecimiento</p>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Establecimiento *</label>
            <Input
              list="establecimientos-list"
              placeholder="Nombre del colegio"
              value={formNueva.establecimiento}
              onChange={e => handleEstablecimientoChange(e.target.value)}
              className="h-11 text-base"
            />
            <datalist id="establecimientos-list">{establecimientos.map(e => <option key={e} value={e} />)}</datalist>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Dirección</label>
            <Input
              list="direcciones-list"
              placeholder="Dirección del establecimiento"
              value={formNueva.direccion}
              onChange={e => {
                const val = e.target.value;
                setFormNueva(p => {
                  const dirObj = direccionesData.find(d => d.direccion === val);
                  if (dirObj) {
                    const locMatch = locations.find(l => l.direccion_id === dirObj.id);
                    return { ...p, direccion: val, establecimiento: locMatch?.establecimiento || p.establecimiento };
                  }
                  return { ...p, direccion: val };
                });
              }}
              className="h-11 text-base"
            />
            <datalist id="direcciones-list">{direccionesList.map(d => <option key={d} value={d} />)}</datalist>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Título del informe</label>
              <Input
                placeholder="Opcional — se genera auto"
                value={formNueva.titulo}
                onChange={e => setFormNueva(p => ({ ...p, titulo: e.target.value }))}
                className="h-11 text-base"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Fecha</label>
              <Input
                type="date"
                value={formNueva.fecha_inspeccion}
                onChange={e => setFormNueva(p => ({ ...p, fecha_inspeccion: e.target.value }))}
                className="h-11 text-base"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Comuna</label>
            <select
              value={formNueva.comuna}
              onChange={e => setFormNueva(p => ({ ...p, comuna: e.target.value }))}
              className="w-full h-11 text-base rounded-md border border-input bg-transparent px-3 text-foreground"
            >
              <option value="">Seleccionar...</option>
              <option value="8A">8A</option>
              <option value="8B">8B</option>
              <option value="10A">10A</option>
            </select>
          </div>
        </div>
        <div className="border-t border-border px-4 py-4 bg-muted/20">
          <p className="text-xs text-muted-foreground mb-3">Secciones incluidas:</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {SECCIONES_DEFAULT.map(s => (
              <span key={s} className="text-[11px] bg-secondary text-secondary-foreground px-2 py-1 rounded-full">{s}</span>
            ))}
          </div>
          <Button
            onClick={handleCrearNueva}
            disabled={creando || !formNueva.establecimiento}
            className="w-full h-12 text-base gap-2"
          >
            {creando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            Iniciar recorrido
          </Button>
        </div>
      </div>
    </div>
  );

  // ── VISTA: EDITAR ───────────────────────────────────────────────────────────
  if (vista === 'editar' && inspeccionActiva) {
    const st = STATUS_CFG[inspeccionActiva.estado] || STATUS_CFG.borrador;

    return (
      <div className="space-y-3 pb-8">
        {/* Header compacto */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border -mx-4 px-4 py-3 sm:static sm:bg-transparent sm:border-0 sm:mx-0 sm:px-0 sm:py-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setVista('lista')}
              className="h-9 w-9 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-sm leading-tight truncate">
                  {inspeccionActiva.titulo || inspeccionActiva.establecimiento}
                </p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${st.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {inspeccionActiva.establecimiento && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{inspeccionActiva.establecimiento}
                  </span>
                )}
                {guardando && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />Guardando
                  </span>
                )}
              </div>
            </div>

            {/* Botón generar — siempre visible */}
            <Button
              onClick={() => {
                const incompletas = totalSecciones - seccionesCompletadas;
                if (incompletas > 0 && !confirm(`Hay ${incompletas} sección${incompletas !== 1 ? 'es' : ''} sin revisar. ¿Generar informe de todas formas?`)) return;
                handleGenerarInforme();
              }}
              disabled={generando || seccionesCompletadas === 0}
              size="sm"
              className={`gap-1.5 h-9 shrink-0 text-xs ${pctProgreso < 100 && seccionesCompletadas > 0 ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
            >
              {generando
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : tieneInforme ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{tieneInforme ? 'Regenerar' : 'Generar informe'}</span>
              {pctProgreso < 100 && seccionesCompletadas > 0 && !generando && (
                <AlertTriangle className="h-3 w-3 ml-0.5" />
              )}
            </Button>
          </div>

          {/* Barra de progreso */}
          <div className="mt-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">Recorrido</span>
              <span className="text-[11px] font-bold">
                {seccionesCompletadas}/{totalSecciones} · {pctProgreso}%
                {pctProgreso === 100 && !tieneInforme && (
                  <span className="text-emerald-400 ml-1.5">✓ Listo para generar</span>
                )}
              </span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${pctProgreso === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                style={{ width: `${pctProgreso}%` }}
              />
            </div>
          </div>
        </div>

        {/* Pantalla de generación */}
        {generando && (
          <div className="rounded-xl border border-violet-700/50 bg-violet-900/20 px-6 py-10 flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-violet-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-card border-2 border-border flex items-center justify-center">
                <Loader2 className="h-3.5 w-3.5 text-violet-400 animate-spin" />
              </div>
            </div>
            <div>
              <p className="font-bold text-lg text-white">Generando informe técnico</p>
              <p className="text-sm text-muted-foreground mt-1">El modelo de IA está procesando las observaciones y fotografías.</p>
              <p className="text-xs text-muted-foreground mt-1">30–60 segundos · No cierres esta pantalla</p>
            </div>
            <div className="w-full max-w-xs bg-border/40 rounded-full h-1.5 overflow-hidden mt-2">
              <div className="h-full bg-violet-400 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* Informe: botón toggle en móvil cuando ya existe */}
        {!generando && tieneInforme && (
          <div className="xl:hidden">
            <button
              onClick={() => setMostrarInforme(v => !v)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                mostrarInforme
                  ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300'
                  : 'bg-card border-border text-foreground hover:border-primary/40'
              }`}
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {mostrarInforme ? 'Ocultar informe' : 'Ver informe generado'}
              </span>
              <ChevronRight className={`h-4 w-4 transition-transform ${mostrarInforme ? 'rotate-90' : ''}`} />
            </button>
          </div>
        )}

        {/* Layout: informe + secciones */}
        {!generando && (
          <div className="xl:grid xl:grid-cols-[1fr_380px] xl:gap-4 xl:items-start space-y-3 xl:space-y-0">
            {/* Informe (visible siempre en desktop, toggle en móvil) */}
            {tieneInforme && (mostrarInforme || false) && (
              <div className="xl:hidden">
                <InformeViewer
                  key={inspeccionActiva.informe_generado?.slice(0, 40)}
                  informe={inspeccionActiva.informe_generado}
                  establecimiento={inspeccionActiva.establecimiento}
                  fecha={inspeccionActiva.fecha_inspeccion}
                  secciones={inspeccionActiva.secciones || []}
                />
              </div>
            )}
            {tieneInforme && (
              <div className="hidden xl:block">
                <InformeViewer
                  key={inspeccionActiva.informe_generado?.slice(0, 40)}
                  informe={inspeccionActiva.informe_generado}
                  establecimiento={inspeccionActiva.establecimiento}
                  fecha={inspeccionActiva.fecha_inspeccion}
                  secciones={inspeccionActiva.secciones || []}
                />
              </div>
            )}

            {/* Secciones */}
            <div className="space-y-2.5">
              {tieneInforme && (
                <div className="hidden xl:flex items-center justify-between px-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Secciones del recorrido</p>
                  <span className="text-xs font-bold text-primary">{seccionesCompletadas}/{totalSecciones}</span>
                </div>
              )}
              {(inspeccionActiva.secciones || []).map((seccion, idx) => (
                <div
                  key={seccion.id}
                  draggable
                  onDragStart={e => handleDragStart(e, idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`relative group/drag ${dragSeccion === idx ? 'opacity-50' : ''}`}
                >
                  {/* Handle de arrastre */}
                  <div className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center opacity-0 group-hover/drag:opacity-40 cursor-grab z-10">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="pl-0">
                    <SeccionInspeccion
                      seccion={seccion}
                      onChange={cambios => handleSeccionChange(seccion.id, cambios)}
                    />
                  </div>
                </div>
              ))}

              {/* Agregar sección personalizada */}
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="Agregar sección personalizada..."
                  value={nuevaSeccionNombre}
                  onChange={e => setNuevaSeccionNombre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAgregarSeccion()}
                  className="h-9 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAgregarSeccion}
                  disabled={!nuevaSeccionNombre.trim()}
                  className="gap-1 shrink-0"
                >
                  <PlusCircle className="h-3.5 w-3.5" /> Agregar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}