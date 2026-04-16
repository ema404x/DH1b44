import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
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
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
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
              const ubic = row['Ubic. Técnica'] || row['Ubic.Tecnica'];
              if (!ubic || !row.Establecimiento) continue;

              const ubicLower = ubic.toLowerCase();
              const existing = await base44.asServiceRole.entities.LocationData.filter({
                ubic_tecnica: ubicLower,
              });

              const payload = {
                ubic_tecnica: ubicLower,
                elem_pep: row['Elem. PEP'] || '',
                direccion: row.Dirección || '',
                establecimiento: row.Establecimiento || '',
                m2: row.M2 ? parseFloat(row.M2) : null,
                inspector: row.INSPECTOR || '',
                jefe_sitio: (row['JEFE SITIO'] || row['JEFE '] || '').trim() || null,
                comuna,
                sup: row.SUP ? parseFloat(row.SUP) : null,
                estado: 'activo',
              };

              if (existing.length > 0) {
                await base44.entities.LocationData.update(existing[0].id, payload);
              } else {
                await base44.entities.LocationData.create(payload);
              }
              totalImported++;
            } catch (err) {
              totalErrors++;
              errors.push(`Fila ${row['N°'] || '?'}: ${err.message}`);
            }
          }
        }

        setResult({
          imported: totalImported,
          errors: totalErrors,
          errorsList: errors.slice(0, 5),
          hasMore: errors.length > 5,
        });

        toast.success(`Importadas ${totalImported} escuelas`);
        if (totalErrors > 0) toast.warning(`${totalErrors} errores encontrados`);
        onImportSuccess?.();
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
            className="w-full py-8 flex flex-col items-center justify-center gap-3 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <span className="text-sm font-medium">Importando...</span>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-primary" />
                <div className="text-center">
                  <p className="font-semibold text-slate-900">Subí el archivo Excel</p>
                  <p className="text-sm text-muted-foreground mt-1">Soporta: LISTADO ESCUELAS POR COMUNA</p>
                </div>
              </>
            )}
          </button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {result.errors === 0 ? (
                <><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Importación completada</>
              ) : (
                <><AlertCircle className="h-5 w-5 text-orange-600" /> Importación parcial</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Importadas</p>
                <p className="text-2xl font-bold text-emerald-700">{result.imported}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Errores</p>
                <p className="text-2xl font-bold text-orange-700">{result.errors}</p>
              </div>
            </div>

            {result.errorsList.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Primeros errores:</p>
                <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                  {result.errorsList.map((err, idx) => (
                    <p key={idx} className="text-xs text-slate-600">{err}</p>
                  ))}
                  {result.hasMore && <p className="text-xs text-slate-400">y más...</p>}
                </div>
              </div>
            )}

            <Button onClick={() => setResult(null)} variant="outline" className="w-full">
              Cerrar
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}