import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Plus, ArrowLeft, Loader2, Sparkles, School, Calendar, User, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import SeccionInspeccion from '@/components/inspeccion/SeccionInspeccion';
import InformeViewer from '@/components/inspeccion/InformeViewer';
import { format } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';

const SECCIONES_DEFAULT = [
  'Fachada y accesos',
  'Aulas',
  'Baños',
  'Cocina / Comedor',
  'Patio / Espacios exteriores',
  'Instalaciones eléctricas',
  'Instalaciones de agua / Plomería',
  'Instalaciones de gas',
  'Techo / Cubierta',
  'Sala de dirección / Administración',
  'Observaciones generales',
  'Otro',
];

const STATUS_LABELS = {
  borrador: { label: 'Borrador', color: 'bg-slate-100 text-slate-600' },
  en_progreso: { label: 'En progreso', color: 'bg-blue-100 text-blue-700' },
  generando: { label: 'Generando...', color: 'bg-amber-100 text-amber-700' },
  completado: { label: 'Completado', color: 'bg-emerald-100 text-emerald-700' },
};

function buildSecciones() {
  return SECCIONES_DEFAULT.map((nombre, i) => ({
    id: `sec_${i}`,
    nombre,
    transcripcion: '',
    notas_libres: '',
    fotos: [],
    completada: false,
  }));
}

export default function InspeccionColegioPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [vista, setVista] = useState('lista'); // 'lista' | 'nueva' | 'editar'
  const [inspeccionActiva, setInspeccionActiva] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Form nueva inspección
  const [formNueva, setFormNueva] = useState({
    establecimiento: '',
    direccion: '',
    titulo: '',
    fecha_inspeccion: format(new Date(), 'yyyy-MM-dd'),
  });

  const { data: inspecciones = [], isLoading } = useQuery({
    queryKey: ['inspecciones'],
    queryFn: () => base44.entities.InspeccionColegio.list('-created_date', 50),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locationData'],
    queryFn: () => base44.entities.LocationData.list('-created_date', 500),
  });

  const establecimientos = useMemo(() =>
    [...new Set(locations.map(l => l.establecimiento).filter(Boolean))].sort(),
    [locations]
  );

  const direcciones = useMemo(() =>
    [...new Set(locations.map(l => l.ubic_tecnica).filter(Boolean))].sort(),
    [locations]
  );

  // Auto-completar dirección al seleccionar establecimiento
  const handleEstablecimientoChange = (val) => {
    setFormNueva(p => {
      const match = locations.find(l => l.establecimiento === val);
      return { ...p, establecimiento: val, direccion: match?.ubic_tecnica || p.direccion };
    });
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.InspeccionColegio.create(data),
    onSuccess: (nueva) => {
      queryClient.invalidateQueries({ queryKey: ['inspecciones'] });
      setInspeccionActiva(nueva);
      setVista('editar');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.InspeccionColegio.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inspecciones'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.InspeccionColegio.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inspecciones'] }),
  });

  const handleCrearNueva = () => {
    if (!formNueva.establecimiento) return toast.error('Ingresá el establecimiento');
    createMutation.mutate({
      ...formNueva,
      titulo: formNueva.titulo || `Inspección ${formNueva.establecimiento} - ${format(new Date(), 'dd/MM/yyyy')}`,
      jefe_sitio: user?.full_name || user?.email || 'Jefe de sitio',
      estado: 'en_progreso',
      secciones: buildSecciones(),
    });
  };

  const handleSeccionChange = async (seccionId, cambios) => {
    const secciones = inspeccionActiva.secciones.map(s =>
      s.id === seccionId ? { ...s, ...cambios } : s
    );
    const updated = { ...inspeccionActiva, secciones };
    setInspeccionActiva(updated);
    setGuardando(true);
    try {
      await updateMutation.mutateAsync({ id: updated.id, data: { secciones } });
    } finally {
      setGuardando(false);
    }
  };

  const handleGenerarInforme = async () => {
    setGenerando(true);
    try {
      await updateMutation.mutateAsync({ id: inspeccionActiva.id, data: { estado: 'generando' } });
      const res = await base44.functions.invoke('generarInformeInspeccion', { inspeccion_id: inspeccionActiva.id });
      const informe = res.data.informe;
      const updated = { ...inspeccionActiva, informe_generado: informe, estado: 'completado' };
      setInspeccionActiva(updated);
      queryClient.invalidateQueries({ queryKey: ['inspecciones'] });
      toast.success('Informe generado correctamente');
    } catch {
      toast.error('Error al generar el informe');
    } finally {
      setGenerando(false);
    }
  };

  const seccionesCompletadas = inspeccionActiva?.secciones?.filter(s => s.completada).length || 0;
  const totalSecciones = inspeccionActiva?.secciones?.length || 0;

  // ── LISTA ────────────────────────────────────────────────────────────
  if (vista === 'lista') return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Inspecciones de Colegios
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Recorridos con audio y generación de informes con IA</p>
        </div>
        <Button onClick={() => setVista('nueva')} className="gap-2">
          <Plus className="h-4 w-4" /> Nueva inspección
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : inspecciones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <ClipboardCheck className="h-16 w-16 text-muted-foreground/30" />
          <div>
            <p className="font-semibold text-lg">Sin inspecciones aún</p>
            <p className="text-sm text-muted-foreground mt-1">Creá una nueva inspección para comenzar el recorrido</p>
          </div>
          <Button onClick={() => setVista('nueva')} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva inspección
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {inspecciones.map(insp => {
            const st = STATUS_LABELS[insp.estado] || STATUS_LABELS.borrador;
            const completadas = insp.secciones?.filter(s => s.completada).length || 0;
            const total = insp.secciones?.length || 0;
            return (
              <div key={insp.id} className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => { setInspeccionActiva(insp); setVista('editar'); }}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{insp.titulo || insp.establecimiento}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{insp.establecimiento}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${st.color}`}>{st.label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><User className="h-3 w-3" />{insp.jefe_sitio}</span>
                  {insp.fecha_inspeccion && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{insp.fecha_inspeccion}</span>}
                </div>
                {total > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Secciones revisadas</span>
                      <span className="font-medium">{completadas}/{total}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${total > 0 ? (completadas / total) * 100 : 0}%` }} />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                  <span className="text-xs text-primary font-medium group-hover:underline flex items-center gap-1">
                    {insp.informe_generado ? 'Ver informe' : 'Continuar recorrido'} <ChevronRight className="h-3 w-3" />
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); if (confirm('¿Eliminar esta inspección?')) deleteMutation.mutate(insp.id); }}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
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

  // ── NUEVA ────────────────────────────────────────────────────────────
  if (vista === 'nueva') return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setVista('lista')}><ArrowLeft className="h-4 w-4" /></Button>
        <h2 className="text-xl font-bold">Nueva inspección</h2>
      </div>
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Establecimiento *</label>
          <Input
            list="establecimientos-list"
            placeholder="Nombre del colegio"
            value={formNueva.establecimiento}
            onChange={e => handleEstablecimientoChange(e.target.value)}
          />
          <datalist id="establecimientos-list">
            {establecimientos.map(e => <option key={e} value={e} />)}
          </datalist>
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Dirección</label>
          <Input
            list="direcciones-list"
            placeholder="Dirección del establecimiento"
            value={formNueva.direccion}
            onChange={e => {
              const val = e.target.value;
              setFormNueva(p => {
                const match = locations.find(l => l.ubic_tecnica === val);
                return { ...p, direccion: val, establecimiento: match?.establecimiento || p.establecimiento };
              });
            }}
          />
          <datalist id="direcciones-list">
            {direcciones.map(d => <option key={d} value={d} />)}
          </datalist>
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Título del informe</label>
          <Input
            placeholder="Se genera automáticamente si lo dejás vacío"
            value={formNueva.titulo}
            onChange={e => setFormNueva(p => ({ ...p, titulo: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Fecha</label>
          <Input
            type="date"
            value={formNueva.fecha_inspeccion}
            onChange={e => setFormNueva(p => ({ ...p, fecha_inspeccion: e.target.value }))}
          />
        </div>
        <Button className="w-full gap-2" onClick={handleCrearNueva} disabled={createMutation.isPending}>
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <School className="h-4 w-4" />}
          Iniciar recorrido
        </Button>
      </div>
    </div>
  );

  // ── EDITAR ────────────────────────────────────────────────────────────
  if (vista === 'editar' && inspeccionActiva) return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setVista('lista')}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h2 className="font-bold text-lg leading-tight">{inspeccionActiva.titulo || inspeccionActiva.establecimiento}</h2>
            <p className="text-xs text-muted-foreground">{inspeccionActiva.establecimiento} · {inspeccionActiva.jefe_sitio}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {guardando && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Guardando...</span>}
          <Button
            onClick={handleGenerarInforme}
            disabled={generando || seccionesCompletadas === 0}
            className="gap-2"
          >
            {generando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generando ? 'Generando informe...' : 'Generar informe con IA'}
          </Button>
        </div>
      </div>

      {/* Progreso */}
      <div className="rounded-xl border bg-card px-5 py-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Progreso del recorrido</span>
          <span className="text-muted-foreground">{seccionesCompletadas} de {totalSecciones} secciones</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${totalSecciones > 0 ? (seccionesCompletadas / totalSecciones) * 100 : 0}%` }}
          />
        </div>
        {seccionesCompletadas === totalSecciones && totalSecciones > 0 && (
          <p className="text-xs text-emerald-600 font-medium mt-2">✓ Todas las secciones revisadas. Podés generar el informe.</p>
        )}
      </div>

      {/* Secciones */}
      {!inspeccionActiva.informe_generado && (
        <div className="space-y-2">
          {(inspeccionActiva.secciones || []).map(seccion => (
            <SeccionInspeccion
              key={seccion.id}
              seccion={seccion}
              onChange={(cambios) => handleSeccionChange(seccion.id, cambios)}
            />
          ))}
        </div>
      )}

      {/* Informe generado */}
      {inspeccionActiva.informe_generado && (
        <div className="space-y-4">
          <InformeViewer
            informe={inspeccionActiva.informe_generado}
            establecimiento={inspeccionActiva.establecimiento}
            fecha={inspeccionActiva.fecha_inspeccion}
          />
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800 font-medium mb-2">¿Querés revisar o actualizar secciones?</p>
            <div className="space-y-2">
              {(inspeccionActiva.secciones || []).map(seccion => (
                <SeccionInspeccion
                  key={seccion.id}
                  seccion={seccion}
                  onChange={(cambios) => handleSeccionChange(seccion.id, cambios)}
                />
              ))}
            </div>
            <Button className="mt-3 gap-2" onClick={handleGenerarInforme} disabled={generando}>
              {generando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Regenerar informe
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return null;
}