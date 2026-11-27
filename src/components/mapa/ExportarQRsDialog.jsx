import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Loader2, User, Share2 } from 'lucide-react';
import { exportarQRsUbicacionesPDF } from '@/utils/exportLocationsQR';
import exportQrGroups, { getQrJefe } from '@/components/mapa/exportQrGroups';
import guardarArchivo, { esDispositivoMovil } from '@/utils/guardarArchivo';
import { toast } from 'sonner';

/**
 * Diálogo para exportar QRs de ubicaciones a PDF, filtrando por jefe de sitio.
 * @param locations    — LocationQR[] (lista completa, service role)
 * @param jefeByLocId  — Map<locationId, jefe_sitio> (de LocationData join)
 */
export default function ExportarQRsDialog({ open, onOpenChange, locations, jefeByLocId, mode = 'ot' }) {
  const [selected, setSelected] = useState('TODOS');
  const [exporting, setExporting] = useState(false);
  // Celular: el archivo se genera primero y se guarda con un segundo toque.
  const [listo, setListo] = useState(null); // { blob, name, count }
  const movil = esDispositivoMovil();

  const cambiarOpen = (o) => { if (!o) setListo(null); onOpenChange(o); };

  // Construir lista de jefes con conteo de QRs
  const jefes = useMemo(() => {
    const counts = new Map();
    for (const loc of locations) {
      const jefe = getQrJefe(loc, jefeByLocId);
      counts.set(jefe, (counts.get(jefe) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([nombre, count]) => ({ nombre, count }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [locations, jefeByLocId]);

  const filtered = useMemo(() => {
    if (selected === 'TODOS') return locations;
    return locations.filter((l) => getQrJefe(l, jefeByLocId) === selected);
  }, [selected, locations, jefeByLocId]);

  const handleExport = async () => {
    if (!filtered.length) {
      toast.error('No hay QRs para el jefe seleccionado');
      return;
    }
    setExporting(true);
    try {
      if (movil) {
        // Un solo PDF (los ZIP son incómodos en el teléfono), ordenado por jefe.
        const ordenados = [...filtered].sort((a, b) =>
          getQrJefe(a, jefeByLocId).localeCompare(getQrJefe(b, jefeByLocId), 'es') ||
          String(a.name || '').localeCompare(String(b.name || ''), 'es', { numeric: true }));
        const file = await exportarQRsUbicacionesPDF(ordenados, mode, {
          jefe: selected === 'TODOS' ? '' : selected, download: false,
        });
        setListo({ ...file, count: filtered.length });
      } else if (selected === 'TODOS') {
        const count = await exportQrGroups(filtered, jefeByLocId, mode);
        toast.success(`Descarga lista · ${count} PDFs separados por jefe · ${filtered.length} QRs`);
        onOpenChange(false);
      } else {
        await exportarQRsUbicacionesPDF(filtered, mode, { jefe: selected });
        toast.success(`PDF generado · ${filtered.length} QR${filtered.length !== 1 ? 's' : ''}`);
        onOpenChange(false);
      }
    } catch (e) {
      console.error('[ExportarQRs]', e);
      toast.error('Error al generar la descarga de QRs');
    } finally {
      setExporting(false);
    }
  };

  const handleGuardar = async () => {
    if (!listo) return;
    try {
      const r = await guardarArchivo(listo.blob, listo.name);
      if (r === 'cancelado') return;
      toast.success(`PDF listo · ${listo.count} QR${listo.count !== 1 ? 's' : ''}`);
      cambiarOpen(false);
    } catch (e) {
      console.error('[ExportarQRs] guardar', e);
      toast.error('No se pudo guardar el PDF');
    }
  };

  return (
    <Dialog open={open} onOpenChange={cambiarOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            {mode === 'fichaje' ? 'Descargar QRs de fichaje' : 'Exportar QRs a PDF'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Filtrar por jefe de sitio
            </label>
            <Select value={selected} onValueChange={(v) => { setSelected(v); setListo(null); }}>
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
            {listo
              ? `PDF generado con ${listo.count} QR${listo.count !== 1 ? 's' : ''}. Tocá "Guardar PDF" para descargarlo o compartirlo.`
              : movil
              ? `Se generará un PDF con ${filtered.length} QR${filtered.length !== 1 ? 's' : ''}${selected === 'TODOS' ? ', ordenados por jefe de sitio' : ` del jefe "${selected}"`}`
              : selected === 'TODOS'
              ? `Se descargarán los ${locations.length} QRs en un ZIP con ${jefes.length} PDFs separados, uno por jefe de sitio`
              : `Se exportarán ${filtered.length} QR${filtered.length !== 1 ? 's' : ''} del jefe "${selected}"`}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => cambiarOpen(false)} disabled={exporting}>
            Cancelar
          </Button>
          {listo ? (
            <Button onClick={handleGuardar} className="gap-2">
              <Share2 className="h-4 w-4" />
              Guardar PDF
            </Button>
          ) : (
            <Button onClick={handleExport} disabled={exporting || !filtered.length} className="gap-2">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? 'Generando...' : movil ? 'Generar PDF' : selected === 'TODOS' ? 'Descargar todos (ZIP)' : 'Descargar PDF'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}