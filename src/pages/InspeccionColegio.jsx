import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList, Plus, ArrowLeft, Loader2, Sparkles, Calendar, User,
  RefreshCw, Building2, MapPin, CheckCircle2, Clock, FileText,
  AlertTriangle, BarChart3, Search, Filter, Trash2, ChevronRight,
  Activity, TrendingUp, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import SeccionInspeccion from '@/components/inspeccion/SeccionInspeccion';
import InformeViewer from '@/components/inspeccion/InformeViewer';
import { format } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const SECCIONES_DEFAULT = [
  'Fachada y accesos', 'Aulas', 'Baños', 'Cocina / Comedor',
  'Patio / Espacios exteriores', 'Instalaciones eléctricas',
  'Instalaciones de agua / Plomería', 'Instalaciones de gas',
  'Techo / Cubierta', 'Sala de dirección / Administración',
  'Observaciones generales', 'Otro',
];

const STATUS_CFG = {
  borrador:    { label: 'Borrador',     dot: 'bg-slate-400',   badge: 'bg-slate-800 text-slate-300 border-slate-600' },
  en_progreso: { label: 'En progreso',  dot: 'bg-blue-400',    badge: 'bg-blue-900/60 text-blue-300 border-blue-700' },
  generando:   { label: 'Generando',   dot: 'bg-amber-400 animate-pulse', badge: 'bg-amber-900/60 text-amber-300 border-amber-700' },
  completado:  { label: 'Completado',  dot: 'bg-emerald-400',  badge: 'bg-emerald-900/60 text-emerald-300 border-emerald-700' },
};

function buildSecciones() {
  return SECCIONES_DEFAULT.map((nombre, i) => ({
    id: `sec_${i}`, nombre, transcripcion: '', notas_libres: '', fotos: [], completada: false,
  }));
}

function StatPill({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex items-center gap-2.5 bg-card border border-border rounded-lg px-4 py-2.5 min-w-[130px]">
      <div className={`h-8 w-8 rounded-md flex items-center justify-center ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-base font-bold leading-none">{value}</p>
      </div>
    </div>
  );
}

export default function InspeccionColegioPage() {
  const { user } = useAuth();
  const { filterByUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const [vista, setVista] = useState('lista');
  const [inspeccionActiva, setInspeccionActiva] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [creando, setCreando] = useState(false);
  const [formNueva, setFormNueva] = useState({
    establecimiento: '', direccion: '', titulo: '',
    fecha_inspeccion: format(new Date(), 'yyyy-MM-dd'),
  });

  const saveTimerRef = useRef(null);
  const pendingSaveRef = useRef(null);

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
      return { ...p, establecimiento: val, direccion: calle || p.direccion };
    });
  };

  // KPIs
  const kpis = useMemo(() => ({
    total: inspecciones.length,
    completadas: inspecciones.filter(i => i.estado === 'completado').length,
    en_progreso: inspecciones.filter(i => i.estado === 'en_progreso').length,
    con_informe: inspecciones.filter(i => i.informe_generado).length,
  }), [inspecciones]);

  // Filtros
  const inspeccionesFiltradas = useMemo(() => {
    return inspecciones.filter(i => {
      const q = busqueda.toLowerCase();
      const matchQ = !q || (i.establecimiento || '').toLowerCase().includes(q) || (i.titulo || '').toLowerCase().includes(q) || (i.jefe_sitio || '').toLowerCase().includes(q);
      const matchE = filtroEstado === 'todos' || i.estado === filtroEstado;
      return matchQ && matchE;
    });
  }, [inspecciones, busqueda, filtroEstado]);

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
        if (pendingSaveRef.current) { flushSave(pendingSaveRef.current.id, pendingSaveRef.current.secciones); pendingSaveRef.current = null; }
      }, 400);
      return updated;
    });
  }, [flushSave]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (pendingSaveRef.current) base44.entities.InspeccionColegio.update(pendingSaveRef.current.id, { secciones: pendingSaveRef.current.secciones });
  }, []);

  const handleCrearNueva = async () => {
    if (!formNueva.establecimiento) return toast.error('Ingresá el establecimiento');
    setCreando(true);
    try {
      const nueva = await base44.entities.InspeccionColegio.create({
        ...formNueva,
        titulo: formNueva.titulo || `Inspección ${formNueva.establecimiento} — ${format(new Date(), 'dd/MM/yyyy')}`,
        jefe_sitio: user?.full_name || user?.email || 'Inspector',
        estado: 'en_progreso',
        secciones: buildSecciones(),
      });
      queryClient.invalidateQueries({ queryKey: ['inspecciones'] });
      setInspeccionActiva(nueva);
      setVista('editar');
    } catch { toast.error('Error al crear la inspección'); }
    finally { setCreando(false); }
  };

  const handleEliminar = async (e, id) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar esta inspección?')) return;
    await base44.entities.InspeccionColegio.delete(id);
    queryClient.invalidateQueries({ queryKey: ['inspecciones'] });
  };

  const pollingRef = useRef(null);

  const stopPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  };

  // Limpiar polling al desmontar
  useEffect(() => () => stopPolling(), []);

  const handleGenerarInforme = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const seccionesActuales = inspeccionActiva.secciones;
    const inspeccionId = inspeccionActiva.id;

    setGenerando(true);
    setInspeccionActiva(prev => ({ ...prev, informe_generado: null, estado: 'generando' }));

    // 1. Persistir secciones y limpiar informe viejo
    await base44.entities.InspeccionColegio.update(inspeccionId, {
      estado: 'generando', secciones: seccionesActuales, informe_generado: '',
    });

    // 2. Disparar generación (fire-and-forget en el backend)
    await base44.functions.invoke('generarInformeInspeccion', { inspeccion_id: inspeccionId });

    // 3. Polling cada 5s hasta que el informe aparezca en la DB
    stopPolling();
    let intentos = 0;
    const MAX_INTENTOS = 36; // 3 minutos máximo

    pollingRef.current = setInterval(async () => {
      intentos++;
      try {
        const fresca = await base44.entities.InspeccionColegio.get(inspeccionId);
        if (fresca?.informe_generado && fresca.informe_generado.length > 50) {
          stopPolling();
          setGenerando(false);
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
      } catch {
        // seguir intentando
      }
    }, 5000);
  };

  const seccionesCompletadas = inspeccionActiva?.secciones?.filter(s => s.completada).length || 0;
  const totalSecciones = inspeccionActiva?.secciones?.length || 0;
  const pctProgreso = totalSecciones > 0 ? Math.round((seccionesCompletadas / totalSecciones) * 100) : 0;

  // ── LISTA ──────────────────────────────────────────────────────────────────
  if (vista === 'lista') return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 font-medium tracking-wide uppercase">
            <Shield className="h-3.5 w-3.5" />
            Módulo de Inspección Edilicia
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Inspecciones de Colegios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Recorridos guiados · Registro fotográfico · Generación de informes con IA</p>
        </div>
        <Button onClick={() => setVista('nueva')} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Nueva inspección
        </Button>
      </div>

      {/* KPI strip */}
      {!isLoading && inspecciones.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <StatPill icon={ClipboardList} label="Total" value={kpis.total} accent="bg-primary/10 text-primary" />
          <StatPill icon={Activity} label="En progreso" value={kpis.en_progreso} accent="bg-blue-500/10 text-blue-400" />
          <StatPill icon={CheckCircle2} label="Completadas" value={kpis.completadas} accent="bg-emerald-500/10 text-emerald-400" />
          <StatPill icon={FileText} label="Con informe" value={kpis.con_informe} accent="bg-violet-500/10 text-violet-400" />
        </div>
      )}

      {/* Filtros */}
      {!isLoading && inspecciones.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar por establecimiento, inspector..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {['todos', 'en_progreso', 'completado', 'borrador'].map(e => (
              <button key={e} onClick={() => setFiltroEstado(e)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${filtroEstado === e ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {e === 'todos' ? 'Todos' : STATUS_CFG[e]?.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="border border-border rounded-xl bg-card">
          {[1,2,3].map(i => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0 animate-pulse">
              <div className="h-9 w-9 rounded-lg bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted rounded w-48" />
                <div className="h-2.5 bg-muted rounded w-32" />
              </div>
              <div className="h-5 w-20 bg-muted rounded-full" />
            </div>
          ))}
        </div>
      ) : inspeccionesFiltradas.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-20 flex flex-col items-center gap-3 text-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
            <ClipboardList className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">Sin inspecciones{busqueda ? ' para esa búsqueda' : ''}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {busqueda ? 'Probá con otro término' : 'Iniciá el primer recorrido de inspección'}
            </p>
          </div>
          {!busqueda && <Button onClick={() => setVista('nueva')} className="gap-2 mt-1"><Plus className="h-4 w-4" />Nueva inspección</Button>}
        </div>
      ) : (
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_120px_100px_40px] gap-4 px-5 py-2.5 border-b border-border bg-muted/40">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Establecimiento</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Inspector</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Fecha</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Progreso</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Estado</span>
            <span />
          </div>
          {inspeccionesFiltradas.map((insp, idx) => {
            const st = STATUS_CFG[insp.estado] || STATUS_CFG.borrador;
            const completadas = insp.secciones?.filter(s => s.completada).length || 0;
            const total = insp.secciones?.length || 0;
            const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;
            return (
              <div key={insp.id}
                onClick={() => { setInspeccionActiva(insp); setVista('editar'); }}
                className={`grid grid-cols-[2fr_1fr_1fr_120px_100px_40px] gap-4 px-5 py-3.5 cursor-pointer hover:bg-accent/40 transition-colors group items-center ${idx !== inspeccionesFiltradas.length - 1 ? 'border-b border-border/60' : ''}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate leading-tight">{insp.titulo || insp.establecimiento}</p>
                      {insp.titulo && <p className="text-xs text-muted-foreground truncate">{insp.establecimiento}</p>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">{insp.jefe_sitio || '—'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>{insp.fecha_inspeccion || '—'}</span>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground">{completadas}/{total}</span>
                    <span className="text-[11px] font-medium">{pct}%</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${st.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                    {st.label}
                  </span>
                </div>
                <div className="flex items-center justify-end">
                  <button onClick={e => handleEliminar(e, insp.id)}
                    className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── NUEVA ──────────────────────────────────────────────────────────────────
  if (vista === 'nueva') return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setVista('lista')}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h2 className="text-xl font-bold">Nueva inspección edilicia</h2>
          <p className="text-xs text-muted-foreground">Se creará un recorrido con {SECCIONES_DEFAULT.length} secciones predefinidas</p>
        </div>
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="bg-muted/40 border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">Datos del establecimiento</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Establecimiento *</label>
            <Input list="establecimientos-list" placeholder="Nombre del colegio o institución" value={formNueva.establecimiento} onChange={e => handleEstablecimientoChange(e.target.value)} className="h-9" />
            <datalist id="establecimientos-list">{establecimientos.map(e => <option key={e} value={e} />)}</datalist>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Dirección</label>
            <Input list="direcciones-list" placeholder="Dirección del establecimiento" value={formNueva.direccion}
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
              }} className="h-9" />
            <datalist id="direcciones-list">{direccionesList.map(d => <option key={d} value={d} />)}</datalist>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Título del informe</label>
            <Input placeholder="Opcional — se genera automáticamente" value={formNueva.titulo} onChange={e => setFormNueva(p => ({ ...p, titulo: e.target.value }))} className="h-9" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Fecha de inspección</label>
            <Input type="date" value={formNueva.fecha_inspeccion} onChange={e => setFormNueva(p => ({ ...p, fecha_inspeccion: e.target.value }))} className="h-9" />
          </div>
        </div>
        <div className="border-t border-border px-5 py-4 bg-muted/20 flex items-center justify-between gap-4">
          <div className="flex flex-wrap gap-1.5">
            {SECCIONES_DEFAULT.slice(0, 6).map(s => (
              <span key={s} className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{s}</span>
            ))}
            <span className="text-[10px] text-muted-foreground px-1">+{SECCIONES_DEFAULT.length - 6} más</span>
          </div>
          <Button onClick={handleCrearNueva} disabled={creando} className="gap-2 shrink-0">
            {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Iniciar recorrido
          </Button>
        </div>
      </div>
    </div>
  );

  // ── EDITAR ─────────────────────────────────────────────────────────────────
  if (vista === 'editar' && inspeccionActiva) {
    const tieneInforme = Boolean(inspeccionActiva.informe_generado);
    const st = STATUS_CFG[inspeccionActiva.estado] || STATUS_CFG.borrador;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setVista('lista')} className="shrink-0 h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-base leading-tight truncate">{inspeccionActiva.titulo || inspeccionActiva.establecimiento}</h2>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} /> {st.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{inspeccionActiva.establecimiento}</span>
                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{inspeccionActiva.jefe_sitio}</span>
                    {inspeccionActiva.fecha_inspeccion && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{inspeccionActiva.fecha_inspeccion}</span>}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {guardando && <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" />Guardando</span>}
              <Button onClick={handleGenerarInforme} disabled={generando || seccionesCompletadas === 0} className="gap-2 h-9">
                {generando ? <><Loader2 className="h-4 w-4 animate-spin" />Generando...</>
                  : tieneInforme ? <><RefreshCw className="h-4 w-4" />Regenerar informe</>
                  : <><Sparkles className="h-4 w-4" />Generar informe IA</>}
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="border-t border-border bg-muted/30 px-5 py-3 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-muted-foreground">Progreso del recorrido</span>
                <span className="text-xs font-bold">{seccionesCompletadas} / {totalSecciones} secciones · {pctProgreso}%</span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${pctProgreso}%` }} />
              </div>
            </div>
            {pctProgreso === 100 && !tieneInforme && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5" /> Listo para generar
              </div>
            )}
          </div>
        </div>

        {/* Pantalla de generación IA */}
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
              <p className="text-sm text-muted-foreground mt-1">El modelo de IA está procesando las observaciones, transcripciones y fotografías del recorrido.</p>
              <p className="text-xs text-muted-foreground mt-1">Este proceso toma entre 30 y 60 segundos · No cierres esta pantalla</p>
            </div>
            <div className="w-full max-w-xs bg-border/40 rounded-full h-1 overflow-hidden mt-2">
              <div className="h-full bg-violet-400 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* Layout dos columnas cuando hay informe */}
        {!generando && (
          <div className={tieneInforme ? 'grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 items-start' : ''}>
            {/* Informe */}
            {tieneInforme && (
              <div>
                <InformeViewer
                  key={inspeccionActiva.informe_generado.slice(0, 40)}
                  informe={inspeccionActiva.informe_generado}
                  establecimiento={inspeccionActiva.establecimiento}
                  fecha={inspeccionActiva.fecha_inspeccion}
                  secciones={inspeccionActiva.secciones || []}
                />
              </div>
            )}

            {/* Panel de secciones */}
            <div className="space-y-3">
              {tieneInforme && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">Secciones del recorrido</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Editá y regenerá el informe</p>
                    </div>
                    <span className="text-xs font-bold text-primary">{seccionesCompletadas}/{totalSecciones}</span>
                  </div>
                  <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
                    {(inspeccionActiva.secciones || []).map(seccion => (
                      <SeccionInspeccion key={seccion.id} seccion={seccion}
                        onChange={cambios => handleSeccionChange(seccion.id, cambios)} />
                    ))}
                  </div>
                </div>
              )}

              {!tieneInforme && (
                <div className="space-y-2">
                  {(inspeccionActiva.secciones || []).map(seccion => (
                    <SeccionInspeccion key={seccion.id} seccion={seccion}
                      onChange={cambios => handleSeccionChange(seccion.id, cambios)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}