import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet, X } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function ImportadorSimple({ onSuccess }) {
  const fileRef = useRef();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const handleFile = async (file) => {
    if (!file) return;
    setResult(null);
    setLoading(true);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);

      // Buscar hoja con datos de escuelas
      const sheet = wb.SheetNames[0];
      const ws = wb.Sheets[sheet];
      const rows = XLSX.utils.sheet_to_json(ws);

      if (!rows || rows.length === 0) {
        toast.error('No se encontraron datos en el archivo');
        setLoading(false);
        return;
      }

      // Normalizar headers
      const firstRow = rows[0];
      const headers = Object.keys(firstRow);

      // Detectar si tiene columnas de dirección y jefe
      const hasDireccion = headers.some(h => h.toLowerCase().includes('dirección') || h.toLowerCase().includes('direccion'));
      const hasJefe = headers.some(h => h.toLowerCase().includes('jefe'));
      const hasEscuela = headers.some(h => h.toLowerCase().includes('establecimiento') || h.toLowerCase().includes('escuela'));

      if (!hasEscuela) {
        toast.error('El archivo debe contener una columna "establecimiento" o "escuela"');
        setLoading(false);
        return;
      }

      // Procesar datos
      const direccionesMap = {};
      const escuelasACrear = [];

      for (const row of rows) {
        const direccion = hasDireccion ? (row['Dirección'] || row['direccion'] || row['DIRECCIÓN'] || 'Sin dirección') : 'Sin dirección';
        const jefe = hasJefe ? (row['Jefe de Sitio'] || row['jefe_sitio'] || row['JEFE'] || null) : null;
        const escuela = row['Establecimiento'] || row['establecimiento'] || row['ESTABLECIMIENTO'] || '';
        const comuna = row['Comuna'] || row['comuna'] || row['COMUNA'] || '8A';
        const ubic = row['Ubicación Técnica'] || row['ubic_tecnica'] || row['UBICACION'] || '';
        const m2 = parseFloat(row['M2'] || row['m2'] || row['Superficie'] || 0);

        if (!escuela.trim()) continue;

        // Crear o actualizar dirección
        if (!direccionesMap[direccion]) {
          const dirId = await base44.entities.Direccion.create({
            direccion,
            comuna,
            jefe_sitio: jefe,
            estado: 'activo'
          });

          direccionesMap[direccion] = dirId.id;
        }

        // Guardar escuela para crear
        escuelasACrear.push({
          establecimiento: escuela,
          ubic_tecnica: ubic,
          comuna,
          m2,
          direccion_id: direccionesMap[direccion],
          jefe_sitio: jefe,
          estado: 'activo'
        });
      }

      // Crear escuelas en lotes
      let created = 0;
      let errors = [];

      for (const esc of escuelasACrear) {
        try {
          await base44.entities.LocationData.create(esc);
          created++;
        } catch (err) {
          errors.push(`${esc.establecimiento}: ${err.message}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['direcciones', 'escuelas', 'locations'] });

      setResult({
        success: created > 0,
        direccionesCreadas: Object.keys(direccionesMap).length,
        escuelasCreadas: created,
        errores: errors,
      });

      if (created > 0) {
        toast.success(`✅ ${created} escuelas y ${Object.keys(direccionesMap).length} direcciones importadas`);
        setTimeout(() => {
          onSuccess?.();
          setResult(null);
        }, 2000);
      } else {
        toast.error('No se pudieron importar escuelas');
      }
    } catch (err) {
      toast.error('Error al procesar: ' + err.message);
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <FileSpreadsheet className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Formato esperado del Excel:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                <li><strong>Establecimiento</strong> - Nombre de la escuela</li>
                <li><strong>Dirección</strong> - Dirección principal</li>
                <li><strong>Comuna</strong> - 8A, 8B o 10A</li>
                <li><strong>Jefe de Sitio</strong> - Nombre (opcional)</li>
                <li><strong>Ubicación Técnica</strong> - Código único (opcional)</li>
                <li><strong>M2</strong> - Superficie en metros (opcional)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {!result && (
        <Card className="border-dashed border-2 border-blue-300">
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
              className="w-full py-12 flex flex-col items-center justify-center gap-3 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                  <span className="font-semibold text-slate-600">Importando datos...</span>
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-blue-500" />
                  <div className="text-center">
                    <p className="font-semibold text-slate-900">Cargar Excel</p>
                    <p className="text-xs text-muted-foreground mt-1">Arrastra o haz clic para seleccionar archivo</p>
                  </div>
                </>
              )}
            </button>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className={result.success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              {result.success ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
              )}
              <div>
                <p className="font-semibold text-slate-900">
                  {result.success ? '✅ Importación completada' : '❌ Error en la importación'}
                </p>
              </div>
            </div>

            {result.success && (
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-white rounded-lg p-3 border border-emerald-200">
                  <p className="text-2xl font-bold text-emerald-700">{result.escuelasCreadas}</p>
                  <p className="text-xs text-muted-foreground">Escuelas</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-emerald-200">
                  <p className="text-2xl font-bold text-emerald-700">{result.direccionesCreadas}</p>
                  <p className="text-xs text-muted-foreground">Direcciones</p>
                </div>
              </div>
            )}

            {result.errores?.length > 0 && (
              <div className="bg-white rounded-lg p-3 border border-red-200 max-h-24 overflow-y-auto">
                <p className="text-xs font-semibold text-red-700 mb-2">Errores:</p>
                <ul className="text-xs text-red-600 space-y-1">
                  {result.errores.slice(0, 5).map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                  {result.errores.length > 5 && <li>... y {result.errores.length - 5} más</li>}
                </ul>
              </div>
            )}

            <Button 
              size="sm" 
              variant="outline" 
              className="w-full" 
              onClick={() => setResult(null)}
            >
              Importar otro archivo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}