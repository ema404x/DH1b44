import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, CheckCircle2, AlertCircle, Loader2, Users, MapPin, X, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

/**
 * Importa el Excel "Direcciones por Jefe de Sitio" y actualiza
 * el campo jefe_sitio en LocationData buscando por dirección.
 *
 * Formato esperado: hoja "Detalle" con columnas:
 *   Jefe de Sitio | Comuna | Dirección
 */
export default function ImportadorJefesSitio({ locations, onSuccess }) {
  const fileRef = useRef();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);   // datos del Excel antes de aplicar
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  // Normaliza texto para comparación: mayúsculas, sin tildes, sin espacios extra
  const norm = (s = '') =>
    s.toUpperCase()
     .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
     .replace(/\s+/g, ' ')
     .trim();

  const handleFile = async (file) => {
    if (!file) return;
    setResult(null);
    setLoading(true);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);

      // Buscar hoja "Detalle"
      const detailSheet = wb.SheetNames.find(n => n.toLowerCase().includes('detalle'));
      if (!detailSheet) {
        toast.error('No se encontró la hoja "Detalle" en el Excel');
        setLoading(false);
        return;
      }

      const ws = wb.Sheets[detailSheet];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Encontrar fila de encabezado (que tenga "Jefe de Sitio" o similar)
      let headerIdx = -1;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i].map(c => norm(String(c || '')));
        if (row.some(c => c.includes('JEFE')) && row.some(c => c.includes('DIRECCION') || c.includes('DIRECOON'))) {
          headerIdx = i;
          break;
        }
      }

      if (headerIdx === -1) {
        // Fallback: asumir que la fila 2 (idx=2) es el header (como vimos en el archivo)
        headerIdx = 2;
      }

      const headers = rows[headerIdx].map(c => norm(String(c || '')));
      const jefeCol = headers.findIndex(h => h.includes('JEFE'));
      const dirCol  = headers.findIndex(h => h.includes('DIRECCION') || h.includes('DIRECOON'));

      if (jefeCol === -1 || dirCol === -1) {
        toast.error('No se encontraron columnas de "Jefe de Sitio" o "Dirección" en el Excel');
        setLoading(false);
        return;
      }

      // Parsear filas de datos
      const items = [];
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const jefe = String(row[jefeCol] || '').trim();
        const dir  = String(row[dirCol]  || '').trim();
        if (!jefe || !dir) continue;
        items.push({ jefe, dir });
      }

      if (items.length === 0) {
        toast.error('No se encontraron datos válidos en el Excel');
        setLoading(false);
        return;
      }

      setPreview({ items, fileName: file.name });
    } catch (err) {
      toast.error('Error al leer el archivo: ' + err.message);
    }
    setLoading(false);
  };

  const applyImport = async () => {
    if (!preview) return;
    setLoading(true);

    let updated = 0;
    let notFound = [];
    const toUpdate = []; // { loc, newJefe }

    // Mapear locations por dirección normalizada
    const locByDir = {};
    for (const loc of locations) {
      const key = norm(loc.direccion || '');
      if (!locByDir[key]) locByDir[key] = [];
      locByDir[key].push(loc);
    }

    // Por cada entrada del Excel, buscar escuelas coincidentes
    for (const { jefe, dir } of preview.items) {
      const key = norm(dir);
      const matches = locByDir[key] || [];

      if (matches.length === 0) {
        // Búsqueda parcial
        const partial = Object.entries(locByDir).find(([k]) => k.includes(key) || key.includes(k));
        if (partial) {
          for (const loc of partial[1]) {
            if (loc.jefe_sitio !== jefe) toUpdate.push({ loc, newJefe: jefe });
          }
        } else {
          notFound.push(dir);
        }
      } else {
        for (const loc of matches) {
          if (loc.jefe_sitio !== jefe) toUpdate.push({ loc, newJefe: jefe });
        }
      }
    }

    // Deduplicar por loc.id (puede haber múltiples entradas para la misma escuela)
    const seen = new Set();
    const dedupedUpdates = toUpdate.filter(({ loc }) => {
      if (seen.has(loc.id)) return false;
      seen.add(loc.id);
      return true;
    });

    // Aplicar actualizaciones
    for (const { loc, newJefe } of dedupedUpdates) {
      await base44.entities.LocationData.update(loc.id, { ...loc, jefe_sitio: newJefe });
      updated++;
    }

    queryClient.invalidateQueries({ queryKey: ['locations'] });

    setResult({
      updated,
      notFound: [...new Set(notFound)],
      totalDirs: new Set(preview.items.map(i => i.dir)).size,
      totalJefes: new Set(preview.items.map(i => i.jefe)).size,
    });
    setPreview(null);
    setLoading(false);

    if (updated > 0) toast.success(`✅ ${updated} escuelas actualizadas con jefes de sitio`);
    onSuccess?.();
  };

  return (
    <div className="space-y-4">
      {/* Upload */}
      {!preview && !result && (
        <>
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4 pb-4 flex gap-3">
              <Users className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">Formato esperado:</p>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  <li>Archivo Excel con hoja <strong>"Detalle"</strong></li>
                  <li>Columnas: <strong>Jefe de Sitio</strong> · <strong>Dirección</strong></li>
                  <li>Asigna automáticamente el jefe a todas las escuelas de esa dirección</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed border-2 border-blue-200">
            <CardContent className="pt-6">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={e => handleFile(e.target.files?.[0])}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                className="w-full py-10 flex flex-col items-center justify-center gap-3 hover:bg-blue-50/50 transition-colors disabled:opacity-50 rounded-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                    <span className="text-sm font-semibold text-slate-600">Leyendo archivo...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-blue-500" />
                    <div className="text-center">
                      <p className="font-semibold text-slate-900">Cargar Excel de Jefes de Sitio</p>
                      <p className="text-xs text-muted-foreground mt-1">Clic para seleccionar .xlsx</p>
                    </div>
                  </>
                )}
              </button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Preview */}
      {preview && !result && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Vista previa — {preview.fileName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-700">
              Se encontraron <strong>{preview.items.length}</strong> entradas con{' '}
              <strong>{new Set(preview.items.map(i => i.jefe)).size}</strong> jefes de sitio.
            </p>

            {/* Resumen por jefe */}
            <div className="bg-white rounded-lg border divide-y max-h-56 overflow-y-auto text-xs">
              {Object.entries(
                preview.items.reduce((acc, { jefe, dir }) => {
                  if (!acc[jefe]) acc[jefe] = [];
                  acc[jefe].push(dir);
                  return acc;
                }, {})
              ).map(([jefe, dirs]) => (
                <div key={jefe} className="px-3 py-2">
                  <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Users className="h-3 w-3 text-blue-500" />
                    {jefe} <span className="text-slate-400 font-normal">({dirs.length} dir.)</span>
                  </p>
                  <p className="text-slate-500 mt-0.5 pl-4 truncate">{dirs.slice(0, 3).join(', ')}{dirs.length > 3 ? '...' : ''}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => setPreview(null)} disabled={loading}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancelar
              </Button>
              <Button size="sm" onClick={applyImport} disabled={loading} className="gap-1">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Aplicar cambios
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className={result.updated > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-orange-200 bg-orange-50'}>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              {result.updated > 0
                ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                : <AlertCircle className="h-5 w-5 text-orange-600" />
              }
              <p className="font-semibold text-slate-900">
                {result.updated > 0
                  ? `${result.updated} escuelas actualizadas correctamente`
                  : 'No se encontraron coincidencias'
                }
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white rounded-lg p-3 border border-emerald-200">
                <p className="text-xl font-bold text-emerald-700">{result.updated}</p>
                <p className="text-xs text-muted-foreground">Escuelas actualizadas</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <p className="text-xl font-bold text-slate-700">{result.totalDirs}</p>
                <p className="text-xs text-muted-foreground">Direcciones procesadas</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-200">
                <p className="text-xl font-bold text-blue-700">{result.totalJefes}</p>
                <p className="text-xs text-muted-foreground">Jefes de sitio</p>
              </div>
            </div>

            {result.notFound?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-orange-700 mb-1">
                  {result.notFound.length} dirección(es) no encontradas en la base de datos:
                </p>
                <div className="bg-white rounded-lg p-2 border border-orange-200 max-h-32 overflow-y-auto space-y-0.5">
                  {result.notFound.map((d, i) => (
                    <p key={i} className="text-xs text-slate-600 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-orange-400 flex-shrink-0" /> {d}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <Button size="sm" variant="outline" className="w-full" onClick={() => setResult(null)}>
              Listo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}