import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Loader2, User } from 'lucide-react';
import { exportarQRsUbicacionesPDF } from '@/utils/exportLocationsQR';
import { toast } from 'sonner';

/**
 * Diálogo para exportar QRs de ubicaciones a PDF, filtrando por jefe de sitio.
 * @param locations    — LocationQR[] (lista completa, service role)
 * @param jefeByLocId  — Map<locationId, jefe_sitio> (de LocationData join)
 */
export default function ExportarQRsDialog({ open, onOpenChange, locations, jefeByLocId }) {
  const [selected, setSelected] = useState('TODOS');
  const [exporting, setExporting] = useState(false);

  // Construir lista de jefes con conteo de QRs
  const jefes = useMemo(() => {
    const counts = new Map();
    for (const loc of locations) {
      const jefe = jefeByLocId?.get(loc.id) || 'Sin jefe asignado';
      counts.set(jefe, (counts.get(jefe) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([nombre, count]) => ({ nombre, count }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [locations, jefeByLocId]);

  const filtered = useMemo(() => {
    if (selected === 'TODOS') return locations;
    return locations.filter((l) => (jefeByLocId?.get(l.id) || 'Sin jefe asignado') === selected);
  }, [selected, locations, jefeByLocId]);

  const handleExport = async () => {
    if (!filtered.length) {
      toast.error('No hay QRs para el jefe seleccionado');
      return;
    }
    setExporting(true);
    try {
      await exportarQRsUbicacionesPDF(filtered);
      toast.success(`PDF generado · ${filtered.length} QR${filtered.length !== 1 ? 's' : ''}`);
      onOpenChange(false);
    } catch (e) {
      toast.error('Error al generar el PDF de QRs');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            Exportar QRs a PDF
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Filtrar por jefe de sitio
            </label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">
                  Todos los jefes ({locations.length})
                </SelectItem>
                {jefes.map((j) => (
                  <SelectItem key={j.nombre} value={j.nombre}>
                    {j.nombre} ({j.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            {selected === 'TODOS'
              ? `Se exportarán los ${locations.length} QRs de todas las ubicaciones`
              : `Se exportarán ${filtered.length} QR${filtered.length !== 1 ? 's' : ''} del jefe "${selected}"`}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={exporting || !filtered.length} className="gap-2">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? 'Generando...' : 'Descargar PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}