import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuditSystemCheck() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runAudit = async () => {
    setRunning(true);
    setError(null);
    try {
      const response = await base44.functions.invoke('auditarSistema', {});
      setResult(response.data);
    } catch (err) {
      setError(err.message || 'Error ejecutando auditoría');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={runAudit}
        disabled={running}
        className="gap-2 bg-gradient-to-r from-blue-500 to-cyan-600 hover:shadow-lg shadow-blue-500/50 transition-all"
      >
        <Play className="h-4 w-4" />
        {running ? 'Auditando...' : 'Ejecutar Auditoría del Sistema'}
      </Button>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="p-4 border-l-4 border-l-red-500 bg-red-50">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Error</p>
                  <p className="text-red-800 text-sm mt-1">{error}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Header */}
            <Card className="p-4 bg-gradient-to-r from-slate-800 to-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Último chequeo</p>
                  <p className="text-xs text-slate-500 mt-1">{new Date(result.timestamp).toLocaleString('es-AR')}</p>
                </div>
                <div className="text-right">
                  <div className="flex gap-3">
                    {result.summary.critical_issues > 0 && (
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-400">{result.summary.critical_issues}</p>
                        <p className="text-xs text-red-600">Crítico</p>
                      </div>
                    )}
                    {result.summary.warnings > 0 && (
                      <div className="text-center">
                        <p className="text-2xl font-bold text-amber-400">{result.summary.warnings}</p>
                        <p className="text-xs text-amber-600">Advertencias</p>
                      </div>
                    )}
                    {result.summary.critical_issues === 0 && result.summary.warnings === 0 && (
                      <div className="text-center">
                        <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-1" />
                        <p className="text-xs text-green-600">OK</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Issues */}
            {result.issues?.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-red-400">Problemas Detectados</p>
                {result.issues.map((issue, i) => (
                  <Card key={i} className="p-4 border-l-4 border-l-red-500 bg-red-50/10">
                    <div className="flex gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-red-400">{issue.title}</p>
                        <p className="text-sm text-slate-400 mt-1">{issue.description}</p>
                        {issue.data && (
                          <div className="mt-2 text-xs text-slate-500">
                            {Array.isArray(issue.data) && issue.data.length > 0 && (
                              <div className="max-h-32 overflow-y-auto">
                                {issue.data.slice(0, 3).map((d, j) => (
                                  <div key={j} className="py-1 border-t border-slate-700">
                                    {typeof d === 'object' ? (
                                      <pre className="whitespace-pre-wrap break-words text-[10px]">
                                        {JSON.stringify(d, null, 2)}
                                      </pre>
                                    ) : (
                                      d
                                    )}
                                  </div>
                                ))}
                                {issue.data.length > 3 && (
                                  <p className="text-slate-500 italic py-1">+{issue.data.length - 3} más</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Warnings */}
            {result.warnings?.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-amber-400">Advertencias</p>
                {result.warnings.map((warn, i) => (
                  <Card key={i} className="p-4 border-l-4 border-l-amber-500 bg-amber-50/10">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-amber-400">{warn.message}</p>
                        {warn.count && <p className="text-xs text-slate-400 mt-1">Cantidad: {warn.count}</p>}
                        {warn.roles && <p className="text-xs text-slate-400 mt-1">Roles: {warn.roles.join(', ')}</p>}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Success */}
            {result.summary.critical_issues === 0 && result.summary.warnings === 0 && (
              <Card className="p-4 border-l-4 border-l-green-500 bg-green-50/10">
                <div className="flex gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-400">✓ Sistema auditado correctamente. Sin problemas detectados.</p>
                </div>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}