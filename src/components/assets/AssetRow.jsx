import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Pencil, Trash2, QrCode, Cpu, Zap, Wind, Droplets, Car, Hammer, Building, Shield, Monitor, Sofa, Clock, CheckCircle2 } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { fmtCurrency } from '@/lib/format';

// Fila de activo extraída a su propio archivo y memoizada a nivel atómico.
// React.memo evita re-renderizar todas las filas cuando el padre re-renderiza
// por cambios NO relacionados con el asset (ej: escribir en el buscador, cambiar
// filtros de sede/tipo/estado) — siempre que las props sean estables.
// Las callbacks onEdit/onQr/onDelete deben venir estabilizadas (useCallback /
// setters estables / mutate de react-query) desde el padre.
// NO se envuelve a nivel página (dead-end: rompe el build) — sólo a nivel fila.

const typeLabels = {
  equipo_electrico: 'Eléctrico', equipo_mecanico: 'Mecánico', instalacion_hvac: 'HVAC',
  instalacion_sanitaria: 'Sanitario', estructura: 'Estructura', vehiculo: 'Vehículo',
  herramienta: 'Herramienta', sistemas_informaticos: 'Informático', mobiliario: 'Mobiliario',
  seguridad: 'Seguridad', otro: 'Otro',
};
const typeIcons = {
  equipo_electrico: Zap, equipo_mecanico: Hammer, instalacion_hvac: Wind, instalacion_sanitaria: Droplets,
  estructura: Building, vehiculo: Car, herramienta: Hammer, sistemas_informaticos: Monitor,
  mobiliario: Sofa, seguridad: Shield, otro: Cpu,
};
const statusColors = {
  operativo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  en_mantenimiento: 'bg-amber-100 text-amber-700 border-amber-200',
  fuera_de_servicio: 'bg-red-100 text-red-700 border-red-200',
  baja: 'bg-gray-100 text-gray-500 border-gray-200',
};
const critColors = {
  baja: 'bg-slate-100 text-slate-600', media: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700', critica: 'bg-red-100 text-red-700',
};

function getMaintenanceStatus(asset) {
  if (!asset.next_maintenance) return null;
  const days = differenceInDays(new Date(asset.next_maintenance), new Date());
  if (days < 0) return { label: `Vencido ${Math.abs(days)}d`, color: 'text-red-600' };
  if (days <= 14) return { label: `En ${days}d`, color: 'text-amber-600' };
  return { label: `En ${days}d`, color: 'text-emerald-600' };
}

function AssetRow({ asset, sedes, onEdit, onQr, onDelete }) {
  const Icon = typeIcons[asset.type] || Cpu;
  const maint = getMaintenanceStatus(asset);
  const sedeName = (id) => sedes.find(s => s.id === id)?.nombre || '';

  return (
    <tr className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => onEdit(asset)}>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-sm leading-tight truncate max-w-[200px]">{asset.name}</div>
            <div className="text-[11px] text-muted-foreground font-mono">{asset.code || '—'}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 hidden md:table-cell text-xs text-muted-foreground truncate max-w-[160px]">{sedeName(asset.location_id) || asset.sede || '—'}</td>
      <td className="px-3 py-2.5 hidden lg:table-cell text-xs">{typeLabels[asset.type] || 'Otro'}</td>
      <td className="px-3 py-2.5">
        <Badge variant="outline" className={`text-[10px] ${statusColors[asset.status]}`}>{(asset.status || '').replace('_', ' ')}</Badge>
      </td>
      <td className="px-3 py-2.5 hidden lg:table-cell">
        <Badge className={`text-[10px] ${critColors[asset.criticality]}`}>{asset.criticality}</Badge>
      </td>
      <td className="px-3 py-2.5 hidden xl:table-cell text-[11px]">
        {maint ? (
          <span className={`flex items-center gap-1 ${maint.color}`}><Clock className="h-3 w-3" />{maint.label}</span>
        ) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2.5">
        {asset.visto_bapro ? (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> Visto
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Pendiente</span>
        )}
      </td>
      <td className="px-3 py-2.5 hidden lg:table-cell text-right text-xs tabular-nums">{asset.purchase_cost ? fmtCurrency(asset.purchase_cost) : '—'}</td>
      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={() => onQr(asset)} title="Ver QR del activo"><QrCode className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(asset)}><Pencil className="h-3.5 w-3.5" /></Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>¿Eliminar activo?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(asset.id)}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </td>
    </tr>
  );
}

// React.memo shallow-compara props; con callbacks estables del padre, las filas
// no se re-renderizan al escribir en el buscador o cambiar filtros de sede/tipo.
export default React.memo(AssetRow);