import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, MapPin, Calendar, Wrench, FileText, History } from 'lucide-react';
import PendienteHistorial from '@/components/assets/PendienteHistorial';

const empty = {
  numero_sap: '', numero_sap_desaprobado: '', descripcion: '', tipo: 'mantenimiento',
  estado: 'pendiente', prioridad: 'media', sitio: '', establecimiento: '', direccion: '',
  inspector: '', clase_orden: '', status_sap: '', comuna: '',
  jefe_sitio: '', jefe_sitio_email: '', fecha_emision_sap: '', fecha_limite: '',
  proyecto_nombre: '', activo_nombre: '', presupuesto_estimado: 0,
  materiales_necesarios: '', observaciones: '', notas_resolucion: '',
};

// Track meaningful fields for historial
const TRACKED_FIELDS = ['estado', 'jefe_sitio', 'prioridad', 'inspector', 'descripcion', 'sitio', 'fecha_limite'];

async function registrarCambio(pendienteId, numero_sap, original, updated) {
  try {
    const user = await base44.auth.me();
    const camposModificados = TRACKED_FIELDS.filter(f => original[f] !== updated[f]);
    if (camposModificados.length === 0) return;

    const entrada = {
      pendiente_id: pendienteId,
      pendiente_numero_sap: numero_sap || '',
      usuario_email: user.email,
      usuario_nombre: user.full_name || user.email,
      campos_modificados: camposModificados,
    };

    if (original.estado !== updated.estado) {
      entrada.estado_anterior = original.estado;
      entrada.estado_nuevo = updated.estado;
    }
    if (original.jefe_sitio !== updated.jefe_sitio) {
      entrada.jefe_sitio_anterior = original.jefe_sitio || '';
      entrada.jefe_sitio_nuevo = updated.jefe_sitio || '';
    }

    await base44.entities.PendienteHistorial.create(entrada);
  } catch (e) {
    // silent — historial is non-critical
  }
}

export default function PendienteDialog({ open, onOpenChange, pendiente, onSave, isSaving }) {
  const [form, setForm] = useState(empty);
  const [tab, setTab] = useState('editar');
  const qc = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => base44.entities.Employee.list(),
    enabled: open,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => base44.entities.Project.list(),
    enabled: open,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations-list'],
    queryFn: () => base44.entities.LocationData.list(),
    enabled: open,
  });

  const { data: direcciones = [] } = useQuery({
    queryKey: ['direcciones-list'],
    queryFn: () => base44.entities.Direccion.list(),
    enabled: open,
  });

  // Auto-completar inspector y jefe al cambiar sitio/establecimiento
  const autoFillFromLocation = (field, value) => {
    const norm = (s) => s ? String(s).trim().toUpperCase() : '';
    const normVal = norm(value);
    if (!normVal) return {};

    const loc = locations.find(l =>
      (field === 'establecimiento' && norm(l.establecimiento) === normVal) ||
      (field === 'sitio' && norm(l.ubic_tecnica) === normVal)
    );

    if (!loc) return {};
    const patch = {};
    if (loc.jefe_sitio) {
      patch.jefe_sitio = loc.jefe_sitio;
      const emp = employees.find(e => norm(e.full_name) === norm(loc.jefe_sitio));
      if (emp?.email) patch.jefe_sitio_email = emp.email;
    }
    if (loc.inspector) patch.inspector = loc.inspector;
    return patch;
  };

  // Fallback: si solo hay inspector, buscar jefe en Direccion
  const autoFillFromInspector = (inspectorName) => {
    const norm = (s) => s ? String(s).trim().toUpperCase() : '';
    const dir = direcciones.find(d => norm(d.inspector) === norm(inspectorName));
    if (!dir?.jefe_sitio) return {};
    const emp = employees.find(e => norm(e.full_name) === norm(dir.jefe_sitio));
    return {
      jefe_sitio: dir.jefe_sitio,
      ...(emp?.email ? { jefe_sitio_email: emp.email } : {}),
    };
  };

  useEffect(() => {
    setForm(pendiente ? { ...empty, ...pendiente } : empty);
    setTab('editar');
  }, [pendiente, open]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const jefes = employees.filter(e => ['supervisor', 'capataz', 'ingeniero', 'gerente'].includes(e.role));

  const handleSave = async () => {
    // Register historial if editing existing
    if (pendiente?.id) {
      await registrarCambio(pendiente.id, form.numero_sap, pendiente, form);
      qc.invalidateQueries({ queryKey: ['pendiente-historial', pendiente.id] });
    }
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {pendiente ? `Editar: ${pendiente.numero_sap || pendiente.descripcion?.slice(0, 40)}` : 'Nuevo Pendiente SAP'}
            {form.comuna && <Badge variant="outline" className="text-xs">Comuna {form.comuna}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs — only show Historial when editing existing */}
        {pendiente?.id && (
          <div className="flex border-b -mx-6 px-6 gap-1">
            {[
              { key: 'editar', label: 'Editar', icon: <FileText className="h-3.5 w-3.5" /> },
              { key: 'historial', label: 'Historial', icon: <History className="h-3.5 w-3.5" /> },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        )}

        {/* TAB: EDITAR */}
        {tab === 'editar' && (
          <div className="overflow-y-auto flex-1 space-y-5 py-2 pr-1">
            {/* SAP info row */}
            <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Datos SAP
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">N° Orden SAP</Label>
                  <Input value={form.numero_sap} onChange={e => set('numero_sap', e.target.value)} placeholder="Ej: 421499633" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">N° Orden 1° Desaprobado</Label>
                  <Input value={form.numero_sap_desaprobado || ''} onChange={e => set('numero_sap_desaprobado', e.target.value)} placeholder="Si aplica" />
                </div>
                <div className="space-y-1.5">
                   <Label className="text-xs">Inspector (creó la orden)</Label>
                   <Input value={form.inspector || ''} onChange={e => {
                     const patch = autoFillFromInspector(e.target.value);
                     setForm(prev => ({ ...prev, inspector: e.target.value, ...patch }));
                   }} placeholder="Nombre del inspector" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Comuna</Label>
                  <Input value={form.comuna || ''} onChange={e => set('comuna', e.target.value)} placeholder="Ej: 8A" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Clase de Orden</Label>
                  <Input value={form.clase_orden || ''} onChange={e => set('clase_orden', e.target.value)} placeholder="Ej: MEES" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status SAP</Label>
                  <Input value={form.status_sap || ''} onChange={e => set('status_sap', e.target.value)} placeholder="Ej: AEJE" />
                </div>
              </div>
            </div>

            {/* Tipo + Prioridad */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo *</Label>
                <Select value={form.tipo} onValueChange={v => set('tipo', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                    <SelectItem value="obra">Obra</SelectItem>
                    <SelectItem value="inspeccion">Inspección</SelectItem>
                    <SelectItem value="emergencia">Emergencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prioridad</Label>
                <Select value={form.prioridad} onValueChange={v => set('prioridad', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Descripcion */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tareas a Realizar *</Label>
              <Textarea rows={3} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción de las tareas..." />
            </div>

            {/* Sitio */}
            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Ubicación
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                   <Label className="text-xs">Ubicación / Dirección</Label>
                   <Input value={form.sitio} onChange={e => {
                     const patch = autoFillFromLocation('sitio', e.target.value);
                     setForm(prev => ({ ...prev, sitio: e.target.value, ...patch }));
                   }} placeholder="Ej: MARTINEZ CASTRO 3061" />
                </div>
                <div className="space-y-1.5">
                   <Label className="text-xs">Establecimiento</Label>
                   <Input value={form.establecimiento || ''} onChange={e => {
                     const patch = autoFillFromLocation('establecimiento', e.target.value);
                     setForm(prev => ({ ...prev, establecimiento: e.target.value, ...patch }));
                   }} placeholder="Nombre del establecimiento" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Proyecto</Label>
                  <Select value={form.proyecto_nombre || ''} onValueChange={v => set('proyecto_nombre', v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {projects.map(pr => <SelectItem key={pr.id} value={pr.name}>{pr.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Asignacion */}
            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Asignación
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Jefe de Sitio</Label>
                  <Select value={form.jefe_sitio || ''} onValueChange={v => {
                    const emp = employees.find(e => e.full_name === v);
                    set('jefe_sitio', v);
                    if (emp?.email) set('jefe_sitio_email', emp.email);
                    if (form.estado === 'pendiente') set('estado', 'asignado');
                  }}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar jefe..." /></SelectTrigger>
                    <SelectContent>
                      {(jefes.length > 0 ? jefes : employees).map(e => (
                        <SelectItem key={e.id} value={e.full_name}>{e.full_name} — {e.role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Estado</Label>
                  <Select value={form.estado} onValueChange={v => set('estado', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="asignado">Asignado</SelectItem>
                      <SelectItem value="en_progreso">En progreso</SelectItem>
                      <SelectItem value="resuelto">Resuelto</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Fechas */}
            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Fechas
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fecha Inicio SAP</Label>
                  <Input type="date" value={form.fecha_emision_sap || ''} onChange={e => set('fecha_emision_sap', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fecha Límite SAP</Label>
                  <Input type="date" value={form.fecha_limite || ''} onChange={e => set('fecha_limite', e.target.value)} />
                </div>
                {form.estado === 'resuelto' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fecha Resolución</Label>
                    <Input type="date" value={form.fecha_resolucion || ''} onChange={e => set('fecha_resolucion', e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            {/* Trabajo */}
            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" /> Detalles del trabajo
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Activo / Equipo relacionado</Label>
                  <Input value={form.activo_nombre || ''} onChange={e => set('activo_nombre', e.target.value)} placeholder="Nombre del activo" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Presupuesto estimado ($)</Label>
                  <Input type="number" value={form.presupuesto_estimado} onChange={e => set('presupuesto_estimado', parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Observaciones</Label>
                <Textarea rows={2} value={form.observaciones || ''} onChange={e => set('observaciones', e.target.value)} placeholder="Observaciones adicionales..." />
              </div>
              {form.estado === 'resuelto' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Notas de resolución</Label>
                  <Textarea rows={2} value={form.notas_resolucion || ''} onChange={e => set('notas_resolucion', e.target.value)} placeholder="Cómo se resolvió..." />
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: HISTORIAL */}
        {tab === 'historial' && pendiente?.id && (
          <div className="overflow-y-auto flex-1 py-2 pr-1">
            <PendienteHistorial pendienteId={pendiente.id} />
          </div>
        )}

        {/* Footer */}
        {tab === 'editar' && (
          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.descripcion || isSaving} className="flex-1">
              {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando...</> : 'Guardar'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}