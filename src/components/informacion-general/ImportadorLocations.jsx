import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle2, AlertCircle, Loader2, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const SHEET_NAMES = ['COMUNA 8A1', 'COMUNA 8B1', 'COMUNA 10A1'];
const COMUNA_MAP = { 'COMUNA 8A1': '8A', 'COMUNA 8B1': '8B', 'COMUNA 10A1': '10A' };

export default function ImportadorLocations({ onImportSuccess }) {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileSelect = async (file) => {
    if (!file) return;
    setResult(null);
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const wb = XLSX.read(e.target.result);
          let totalImported = 0;
          let totalErrors = 0;
          const errors = [];

          for (const sheetName of SHEET_NAMES) {
            if (!wb.SheetNames.includes(sheetName)) continue;
            const ws = wb.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(ws);
            const comuna = COMUNA_MAP[sheetName];

            for (const row of data) {
              try {
                const ubic = (row['Ubic. Técnica'] || row['Ubic.Tecnica'] || '').trim();
                const establecimiento = (row.Establecimiento || '').trim();
                if (!ubic || !establecimiento) continue;

                const payload = {
                  ubic_tecnica: ubic.toLowerCase(),
                  elem_pep: (row['Elem. PEP'] || '').trim(),
                  direccion: (row.Dirección || '').trim(),
                  establecimiento,
                  m2: row.M2 ? parseFloat(String(row.M2).replace(/,/g, '.')) : null,
                  inspector: (row.INSPECTOR || '').trim(),
                  jefe_sitio: (row['JEFE SITIO'] || row['JEFE '] || '').trim() || null,
                  comuna,
                  sup: row.SUP ? parseFloat(String(row.SUP).replace(/,/g, '.')) : null,
                  estado: 'activo',
                };

                try {
                  const existing = await base44.entities.LocationData.filter({
                    ubic_tecnica: payload.ubic_tecnica,
                  });
                  if (existing.length > 0) {
                    await base44.entities.LocationData.update(existing[0].id, payload);
                  } else {
                    await base44.entities.LocationData.create(payload);
                  }
                } catch (updateErr) {
                  // Si falla la búsqueda/actualización, intenta crear directo
                  await base44.entities.LocationData.create(payload);
                }
                totalImported++;
              } catch (err) {
                totalErrors++;
                const escuela = row.Establecimiento || 'Sin nombre';
                errors.push(`${escuela}: ${err.message}`);
              }
            }
          }

          setResult({
            imported: totalImported,
            errors: totalErrors,
            errorsList: errors.slice(0, 5),
            hasMore: errors.length > 5,
          });

          if (totalImported > 0) {
            toast.success(`✅ Importadas ${totalImported} escuelas`);
            onImportSuccess?.();
          } else {
            toast.error('❌ No se importaron registros. Revisa el formato del Excel');
          }
          if (totalErrors > 0) toast.warning(`⚠️ ${totalErrors} errores encontrados`);
        } catch (parseError) {
          toast.error('Error al leer el archivo: ' + parseError.message);
          setResult(null);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      toast.error('Error al importar: ' + error.message);
      setResult(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Instrucciones */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6 flex gap-3">
          <HelpCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Formato esperado:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Archivo Excel con hojas: COMUNA 8A1, COMUNA 8B1, COMUNA 10A1</li>
              <li>Columnas requeridas: Ubic. Técnica, Establecimiento</li>
              <li>Columnas opcionales: Elem. PEP, Dirección, M2, INSPECTOR, JEFE SITIO</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Upload area */}
      <Card className="border-dashed border-2">
        <CardContent className="pt-6">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={e => handleFileSelect(e.target.files?.[0])}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full py-12 flex flex-col items-center justify-center gap-4 hover:bg-slate-50 transition-colors disabled:opacity-50 rounded-lg"
          >
            {uploading ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <span className="text-base font-semibold">Importando escuelas...</span>
              </>
            ) : (
              <>
                <Upload className="h-12 w-12 text-primary" />
                <div className="text-center">
                  <p className="font-semibold text-slate-900 text-base">Arrastrá o hacé clic para cargar Excel</p>
                  <p className="text-sm text-muted-foreground mt-1">Soporta: .xlsx, .xls</p>
                </div>
              </>
            )}
          </button>
        </CardContent>
      </Card>

      {/* Resultado */}
      {result && (
        <Card className={result.errors === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-orange-200 bg-orange-50'}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {result.errors === 0 ? (
                <><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Importación completada con éxito</>
              ) : (
                <><AlertCircle className="h-5 w-5 text-orange-600" /> Importación parcial</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 border border-emerald-200">
                <p className="text-sm text-muted-foreground mb-1">Importadas</p>
                <p className="text-3xl font-bold text-emerald-700">{result.imported}</p>
              </div>
              <div className={`bg-white rounded-lg p-4 border ${result.errors > 0 ? 'border-orange-200' : 'border-emerald-200'}`}>
                <p className="text-sm text-muted-foreground mb-1">Errores</p>
                <p className={`text-3xl font-bold ${result.errors > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>{result.errors}</p>
              </div>
            </div>

            {result.errorsList.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-800">Detalles de errores:</p>
                <div className="bg-white rounded-lg p-3 border border-orange-200 space-y-1.5">
                  {result.errorsList.map((err, idx) => (
                    <p key={idx} className="text-xs text-slate-700 font-mono">
                      <span className="text-orange-600 font-bold">✕</span> {err}
                    </p>
                  ))}
                  {result.hasMore && <p className="text-xs text-slate-400 pt-1 border-t border-orange-100">y más errores...</p>}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => setResult(null)} variant="outline" className="flex-1">
                Cerrar
              </Button>
              {result.imported > 0 && (
                <Button onClick={() => { setResult(null); fileRef.current?.click(); }} className="flex-1 gap-2">
                  <Upload className="h-4 w-4" /> Importar otro
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}