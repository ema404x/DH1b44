import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, MapPin, Calendar, Wrench, FileText } from 'lucide-react';

const empty = {
  numero_sap: '', numero_sap_desaprobado: '', descripcion: '', tipo: 'mantenimiento',
  estado: 'pendiente', prioridad: 'media', sitio: '', establecimiento: '', direccion: '',
  inspector: '', clase_orden: '', status_sap: '', comuna: '',
  jefe_sitio: '', jefe_sitio_email: '', fecha_emision_sap: '', fecha_limite: '',
  proyecto_nombre: '', activo_nombre: '', presupuesto_estimado: 0,
  materiales_necesarios: '', observaciones: '', notas_resolucion: '',
};

export default function PendienteDialog({ open, onOpenChange, pendiente, onSave, isSaving }) {
  const [form, setForm] = useState(empty);

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

  useEffect(() => {
    setForm(pendiente ? { ...empty, ...pendiente } : empty);
  }, [pendiente, open]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const jefes = employees.filter(e => ['supervisor', 'capataz', 'ingeniero', 'gerente'].includes(e.role));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {pendiente ? `Editar: ${pendiente.numero_sap || pendiente.descripcion?.slice(0, 40)}` : 'Nuevo Pendiente SAP'}
            {form.comuna && <Badge variant="outline" className="text-xs">Comuna {form.comuna}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
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
                <Input value={form.inspector || ''} onChange={e => set('inspector', e.target.value)} placeholder="Nombre del inspector" />
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
                <Input value={form.sitio} onChange={e => set('sitio', e.target.value)} placeholder="Ej: MARTINEZ CASTRO 3061" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Establecimiento</Label>
                <Input value={form.establecimiento || ''} onChange={e => set('establecimiento', e.target.value)} placeholder="Nombre del establecimiento" />
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

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={!form.descripcion || isSaving} className="flex-1">
            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando...</> : 'Guardar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}