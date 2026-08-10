import React from 'react';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n || 0);

// Fila editable de un ítem con todos los tramos de medición:
// contratado (cant/pu/total) · acum. anterior (U/$) · presente (U/$) ·
// acum. presente (U/$) · saldo $. Editar unidad o importe recalcula el otro
// coherente (lo resuelve setItem en el editor vía acumulacionUtils).
export default function ItemAcumulacionRow({ item, index, onChange, onRemove }) {
  const num = (field, value, opts = {}) => (
    <Input
      type="number"
      step={opts.step ?? 'any'}
      min={opts.min ?? 0}
      className={`h-8 text-xs text-right tabular-nums ${opts.className || ''}`}
      value={value ?? ''}
      onChange={e => onChange(index, field, +e.target.value)}
    />
  );
  return (
    <tr className={item._sobrecertificado ? 'bg-red-50/70' : (index % 2 === 0 ? 'bg-background' : 'bg-muted/30')}>
      <td className="px-1 py-1">
        <Input className="h-8 text-xs" value={item.numero ?? index + 1} onChange={e => onChange(index, 'numero', +e.target.value)} />
      </td>
      <td className="px-1 py-1">
        <Input className="h-8 text-xs" value={item.descripcion || ''} onChange={e => onChange(index, 'descripcion', e.target.value)} />
      </td>
      <td className="px-1 py-1">
        <Input className="h-8 text-xs w-14" value={item.um || ''} onChange={e => onChange(index, 'um', e.target.value)} />
      </td>
      <td className="px-1 py-1">{num('cantidad', item.cantidad)}</td>
      <td className="px-1 py-1">{num('importe_unitario', item.importe_unitario)}</td>
      <td className="px-1 py-1 text-right text-xs font-medium tabular-nums align-middle">{fmt(item.importe_total)}</td>
      <td className="px-1 py-1">{num('med_acum_anterior_unidad', item.med_acum_anterior_unidad, { step: '0.01' })}</td>
      <td className="px-1 py-1">{num('med_acum_anterior_importe', item.med_acum_anterior_importe)}</td>
      <td className="px-1 py-1 bg-blue-50/40">{num('med_presente_unidad', item.med_presente_unidad, { step: '0.01', className: 'border-blue-300 focus:ring-blue-400' })}</td>
      <td className="px-1 py-1 bg-blue-50/40">{num('med_presente_importe', item.med_presente_importe, { className: 'border-blue-300 focus:ring-blue-400' })}</td>
      <td className="px-1 py-1 text-right text-xs tabular-nums align-middle">{fmt(item.med_acum_presente_unidad)}</td>
      <td className="px-1 py-1 text-right text-xs font-medium tabular-nums align-middle">{fmt(item.med_acum_presente_importe)}</td>
      <td className={`px-1 py-1 text-right text-xs tabular-nums align-middle ${item._sobrecertificado ? 'text-red-600 font-semibold' : 'text-orange-600 font-medium'}`}>{fmt(item.saldo_pendiente_importe)}</td>
      <td className="px-1 py-1 text-center align-middle">
        <button onClick={() => onRemove(index)} className="text-destructive hover:bg-destructive/10 rounded p-1" title="Eliminar ítem">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}