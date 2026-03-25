import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

export default function PresupuestoResumen({ form, onPctChange }) {
  const subtotal = (form.rubros || []).reduce((acc, r) =>
    acc + r.items.reduce((a, i) => a + (i.total || 0), 0), 0
  );
  const gg = subtotal * (form.gastos_generales_pct / 100);
  const ben = (subtotal + gg) * (form.beneficio_pct / 100);
  const baseImponible = subtotal + gg + ben;
  const iva = baseImponible * (form.iva_pct / 100);
  const total = baseImponible + iva;

  const Row = ({ label, value, className = '' }) => (
    <div className={`flex justify-between items-center py-1.5 ${className}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold text-sm">{fmt(value)}</span>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Resumen Financiero</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Porcentajes configurables */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Parámetros de cálculo</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Gastos Gral. %</Label>
                <Input
                  type="number"
                  value={form.gastos_generales_pct}
                  onChange={e => onPctChange('gastos_generales_pct', parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Beneficio %</Label>
                <Input
                  type="number"
                  value={form.beneficio_pct}
                  onChange={e => onPctChange('beneficio_pct', parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">IVA %</Label>
                <Input
                  type="number"
                  value={form.iva_pct}
                  onChange={e => onPctChange('iva_pct', parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Desglose por rubros */}
            {(form.rubros || []).length > 0 && (
              <div className="mt-3 space-y-1 border rounded-lg p-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Subtotal por Rubro</p>
                {form.rubros.map((r, i) => {
                  const sub = r.items.reduce((a, it) => a + (it.total || 0), 0);
                  return (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[200px]">{r.nombre}</span>
                      <span className="font-medium">{fmt(sub)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Totales */}
          <div className="border rounded-lg p-4 space-y-1 bg-card">
            <Row label="Subtotal de obra" value={subtotal} />
            <Row label={`Gastos generales (${form.gastos_generales_pct}%)`} value={gg} />
            <Row label={`Beneficio (${form.beneficio_pct}%)`} value={ben} />
            <div className="border-t my-2" />
            <Row label="Base imponible" value={baseImponible} />
            <Row label={`IVA (${form.iva_pct}%)`} value={iva} />
            <div className="border-t my-2" />
            <div className="flex justify-between items-center py-2 bg-primary/5 rounded-lg px-2">
              <span className="font-bold text-base">TOTAL</span>
              <span className="font-bold text-lg text-primary">{fmt(total)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}