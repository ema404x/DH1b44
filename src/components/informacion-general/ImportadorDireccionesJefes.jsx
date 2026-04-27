import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, CheckCircle2, AlertCircle, Loader2, Building2, Users, FileSpreadsheet, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function ImportadorDireccionesJefes({ onSuccess }) {
  const fileRef = useRef();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const handleFile = async (file) => {
    if (!file) return;
    setResult(null);
    setLoading(true);

    try {
      // Subir archivo
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadRes.file_url;

      // Procesar con función backend
      const response = await base44.functions.invoke('importarDireccionesJefes', {
        file_url: fileUrl,
      });

      const result = response.data;

      queryClient.invalidateQueries({ queryKey: ['direcciones', 'locations'] });

      setResult({
        success: result.success,
        direccionesCreadas: result.direccionesCreadas,
        escuelasCreadas: result.escuelasCreadas,
        errores: result.errores || [],
        message: result.message,
      });

      if (result.success && result.escuelasCreadas > 0) {
        toast.success(`✅ ${result.direccionesCreadas} direcciones y ${result.escuelasCreadas} escuelas importadas`);
        setTimeout(() => {
          onSuccess?.();
          setResult(null);
        }, 2000);
      }
    } catch (error) {
      toast.error('Error: ' + error.message);
      setResult({
        success: false,
        errores: [error.message],
        message: error.message,
      });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
      {/* Info Card */}
      <motion.div variants={item}>
        <Card className="border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 backdrop-blur">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-4">
              <FileSpreadsheet className="h-6 w-6 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-cyan-200/90">
                <p className="font-semibold mb-2">📋 Formato del Excel:</p>
                <ul className="list-disc list-inside text-xs space-y-1 ml-0">
                  <li><strong>Jefe de Sitio</strong> - Nombre del responsable</li>
                  <li><strong>Comuna</strong> - COMUNA 8A, 8B o 10A</li>
                  <li><strong>Dirección</strong> - Domicilio de la dirección</li>
                  <li><strong>Escuela / Establecimiento</strong> - Nombre exacto</li>
                </ul>
                <p className="text-xs text-cyan-300/70 mt-2 italic">Se procesa automáticamente la hoja "Detalle por Escuela"</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Upload Zone */}
      {!result && (
        <motion.div variants={item}>
          <Card className="border-dashed border-2 border-cyan-500/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 hover:border-cyan-500/70 transition-all cursor-pointer">
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
                className="w-full py-12 flex flex-col items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="h-12 w-12"
                    >
                      <Loader2 className="h-12 w-12 text-cyan-400" />
                    </motion.div>
                    <span className="font-semibold text-slate-300">Importando y distribuyendo datos...</span>
                  </>
                ) : (
                  <>
                    <motion.div
                      className="h-14 w-14 rounded-lg bg-gradient-to-br from-cyan-500/30 to-blue-500/20 flex items-center justify-center"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Upload className="h-7 w-7 text-cyan-400" />
                    </motion.div>
                    <div className="text-center">
                      <p className="font-semibold text-slate-100">Carga tu Excel</p>
                      <p className="text-xs text-slate-400 mt-1">Arrastra o haz clic para seleccionar</p>
                    </div>
                  </>
                )}
              </button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Result */}
      {result && (
        <motion.div variants={item}>
          <Card className={`border-0 backdrop-blur ${
            result.success
              ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30'
              : 'bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30'
          }`}>
            <CardContent className="pt-6 space-y-4">
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3">
                {result.success ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0" />
                )}
                <div>
                  <p className="font-semibold text-white">{result.success ? '✅ Importación exitosa' : '❌ Error en la importación'}</p>
                  <p className="text-sm text-slate-300 mt-1">{result.message}</p>
                </div>
              </motion.div>

              {result.success && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 backdrop-blur rounded-lg p-3 border border-emerald-500/30 text-center">
                    <p className="text-sm text-slate-400 mb-1">Direcciones</p>
                    <p className="text-2xl font-bold text-emerald-300">{result.direccionesCreadas}</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur rounded-lg p-3 border border-emerald-500/30 text-center">
                    <p className="text-sm text-slate-400 mb-1">Escuelas</p>
                    <p className="text-2xl font-bold text-emerald-300">{result.escuelasCreadas}</p>
                  </div>
                </motion.div>
              )}

              {result.errores?.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white/5 backdrop-blur rounded-lg p-3 border border-red-500/30 max-h-32 overflow-y-auto">
                  <p className="text-xs font-semibold text-red-300 mb-2">⚠️ {result.errores.length} error(es):</p>
                  <ul className="text-xs text-red-200/80 space-y-1">
                    {result.errores.slice(0, 5).map((e, i) => (
                      <li key={i}>• {e}</li>
                    ))}
                    {result.errores.length > 5 && <li className="text-red-300/60">... y {result.errores.length - 5} más</li>}
                  </ul>
                </motion.div>
              )}

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setResult(null)}
                  className="flex-1"
                >
                  Cargar otro archivo
                </Button>
                {result.success && (
                  <Button
                    size="sm"
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800"
                    onClick={() => {
                      onSuccess?.();
                      setResult(null);
                    }}
                  >
                    Ir al Directorio
                  </Button>
                )}
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}