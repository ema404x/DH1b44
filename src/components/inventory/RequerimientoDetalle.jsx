import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, CheckCircle2, Clock, ShoppingCart, Package, Send, MessageSquare, Loader2 } from 'lucide-react';

const ESTADOS = [
  { value: 'borrador', label: 'Borrador', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  { value: 'enviado', label: 'Enviado', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { value: 'en_revision', label: 'En Revisión', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { value: 'aprobado', label: 'Aprobado', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { value: 'en_compra', label: 'En Compra', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { value: 'recibido', label: 'Recibido ✓', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  { value: 'rechazado', label: 'Rechazado', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
];

const PRIORIDAD_COLORS = {
  baja: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  normal: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  alta: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  urgente: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const unitLabels = {
  unidad: 'un', metro: 'm', metro2: 'm²', metro3: 'm³',
  kg: 'kg', litro: 'L', bolsa: 'bolsa', caja: 'caja',
};

export default function RequerimientoDetalle({ req, onClose, user }) {
  const [nuevoEstado, setNuevoEstado] = useState(req?.estado || '');
  const [observacion, setObservacion] = useState('');
  const [esAlerta, setEsAlerta] = useState(false);
  const [ocNum, setOcNum] = useState(req?.numero_orden_compra || '');
  const [proveedor, setProveedor] = useState(req?.proveedor_seleccionado || '');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const estadoInfo = ESTADOS.find(e => e.value === req?.estado);

  const handleGuardar = async () => {
    if (!observacion.trim() && nuevoEstado === req.estado) return;
    setSaving(true);
    const entrada = {
      fecha: new Date().toISOString(),
      estado: nuevoEstado,
      usuario: user?.full_name || user?.email || 'Sistema',
      observacion: observacion.trim(),
      tiene_alerta: esAlerta,
    };
    const historial = [...(req.historial || []), entrada];
    const updates = {
      estado: nuevoEstado,
      historial,
      ...(ocNum && { numero_orden_compra: ocNum }),
      ...(proveedor && { proveedor_seleccionado: proveedor }),
    };
    await base44.entities.RequerimientoCompra.update(req.id, updates);
    queryClient.invalidateQueries({ queryKey: ['requerimientos'] });
    setObservacion('');
    setEsAlerta(false);
    setSaving(false);
    onClose();
  };

  if (!req) return null;

  return (
    <Sheet open={!!req} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-2xl bg-slate-900 border-slate-700 text-white overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-white text-xl">{req.titulo}</SheetTitle>
              <p className="text-slate-400 text-sm mt-1">{req.numero} · {req.jefe_sitio}</p>
            </div>
            <Badge className={`border text-xs ${estadoInfo?.color}`}>{estadoInfo?.label}</Badge>
          </div>
        </SheetHeader>

        <div className="space-y-6 py-5">
          {/* Info general */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {req.establecimiento && (
              <div><p className="text-slate-500 text-xs mb-0.5">Establecimiento</p><p className="text-white">{req.establecimiento}</p></div>
            )}
            {req.fecha_necesidad && (
              <div><p className="text-slate-500 text-xs mb-0.5">Fecha necesidad</p><p className="text-white">{req.fecha_necesidad}</p></div>
            )}
            <div>
              <p className="text-slate-500 text-xs mb-0.5">Prioridad</p>
              <Badge className={`border text-xs ${PRIORIDAD_COLORS[req.prioridad]}`}>{req.prioridad}</Badge>
            </div>
            <div><p className="text-slate-500 text-xs mb-0.5">Total estimado</p><p className="text-white font-semibold">${req.total_estimado?.toLocaleString() || 0}</p></div>
          </div>

          {/* Items */}
          <div>
            <p className="text-sm font-semibold text-white mb-3">Materiales solicitados</p>
            <div className="space-y-2">
              {(req.items || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-white font-medium">{item.material_nombre}</p>
                      {item.notas_item && <p className="text-xs text-slate-400">{item.notas_item}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{item.cantidad_solicitada} {unitLabels[item.unidad] || item.unidad}</p>
                    {item.cantidad_aprobada != null && item.cantidad_aprobada !== item.cantidad_solicitada && (
                      <p className="text-xs text-yellow-400">Aprobado: {item.cantidad_aprobada}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Historial */}
          {(req.historial || []).length > 0 && (
            <div>
              <p className="text-sm font-semibold text-white mb-3">Historial</p>
              <div className="space-y-3">
                {[...req.historial].reverse().map((h, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${h.tiene_alerta ? 'bg-amber-950/40 border-amber-500/40' : 'bg-slate-800/40 border-slate-700/50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {h.tiene_alerta && <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                        <span className="text-xs font-semibold text-slate-300">{h.usuario}</span>
                        <Badge className={`text-[10px] border ${ESTADOS.find(e => e.value === h.estado)?.color || 'border-slate-600 text-slate-400'}`}>
                          {ESTADOS.find(e => e.value === h.estado)?.label || h.estado}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {h.fecha ? format(new Date(h.fecha), 'dd/MM/yy HH:mm', { locale: es }) : ''}
                      </span>
                    </div>
                    {h.observacion && <p className="text-sm text-slate-300">{h.observacion}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Datos de compra (solo visible cuando está en proceso) */}
          {['aprobado', 'en_compra', 'recibido'].includes(req.estado) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">N° Orden de Compra</Label>
                <Input value={ocNum} onChange={e => setOcNum(e.target.value)}
                  placeholder="OC-001..." className="bg-slate-800 border-slate-600 text-white h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Proveedor</Label>
                <Input value={proveedor} onChange={e => setProveedor(e.target.value)}
                  placeholder="Nombre del proveedor..." className="bg-slate-800 border-slate-600 text-white h-8 text-sm" />
              </div>
            </div>
          )}

          {/* Acción: cambiar estado + observación */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 space-y-3">
            <p className="text-sm font-semibold text-white">Actualizar estado</p>
            <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea value={observacion} onChange={e => setObservacion(e.target.value)}
              placeholder="Escribí una observación sobre este cambio..."
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500" rows={3} />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={esAlerta} onChange={e => setEsAlerta(e.target.checked)}
                  className="rounded border-slate-600" />
                <span className="text-sm text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Marcar como alerta
                </span>
              </label>
              <Button onClick={handleGuardar} disabled={saving || !observacion.trim()}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Guardar
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}