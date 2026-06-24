import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScanSearch, Loader2, X, Upload, AlertTriangle, CheckCircle2, Wrench, Database, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

export default function AuditoriaSincronizacion({ onClose }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [step, setStep] = useState('idle'); // idle | scanning | done | fixing
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const handleScan = async () => {
    if (!file) return;
    setStep('scanning');
    setError(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFileUrl(file_url);
      const res = await base44.functions.invoke('auditarObrasSincronizacion', { file_url });
      setReport(res.data);
      setStep('done');
    } catch (err) {
      setError(err?.message || 'Error al auditar');
      setStep('idle');
    }
  };

  const handleFix = async () => {
    if (!fileUrl) return;
    setStep('fixing');
    try {
      const res = await base44.functions.invoke('auditarObrasSincronizacion', { file_url: fileUrl, fix: true });
      const data = res.data;
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(`${data.created} obras faltantes importadas`);
      setStep('done');
      setReport(prev => ({ ...prev, faltantesCount: 0, enSistema: (prev?.enSistema || 0) + data.created }));
    } catch (err) {
      toast.error('Error al corregir: ' + (err?.message || 'intente nuevamente'));
      setStep('done');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={step !== 'scanning' && step !== 'fixing' ? onClose : undefined} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ScanSearch className="h-5 w-5 text-primary" />
            <h2 className="text-white font-semibold">Auditoría de sincronización</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={onClose} disabled={step === 'scanning' || step === 'fixing'}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {/* Upload */}
          {step === 'idle' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Subí la planilla de obras (la misma que usás para importar) para comparar contra el sistema y detectar obras no sincronizadas.
              </p>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                <Upload className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-300">{file ? file.name : 'Hacé clic para subir el Excel'}</p>
                <p className="text-xs text-slate-500 mt-1">.xlsx · .xls</p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => setFile(e.target.files[0] || null)} />
              </div>
              {file && (
                <Button className="w-full gap-2" onClick={handleScan}>
                  <ScanSearch className="h-4 w-4" /> Auditar sincronización
                </Button>
              )}
              {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            </div>
          )}

          {step === 'scanning' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm text-slate-400">Analizando planilla contra el sistema…</p>
            </div>
          )}

          {(step === 'done' || step === 'fixing') && report && (
            <div className="space-y-5">
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi icon={FileSpreadsheet} label="En planilla" value={report.planillaTotal} tone="slate" />
                <Kpi icon={Database} label="En sistema" value={report.enSistema} tone="blue" />
                <Kpi icon={AlertTriangle} label="Faltantes" value={report.faltantesCount} tone={report.faltantesCount ? 'amber' : 'green'} />
                <Kpi icon={AlertTriangle} label="Huérfanos" value={report.huerfanosCount} tone={report.huerfanosCount ? 'red' : 'green'} />
              </div>

              {/* Diagnóstico */}
              {report.planillaTotal !== report.enSistema && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Diagnóstico de la discrepancia</p>
                  <p>• Filas en la planilla: <b>{report.planillaTotal}</b> · Obras en el sistema: <b>{report.enSistema}</b> · Diferencia: <b>{report.planillaTotal - report.enSistema}</b></p>
                  {report.filasConCodigoRepetido > 0 && (
                    <p>• <b>{report.filasConCodigoRepetido}</b> filas comparten Nº Orden SAP con otra fila ({report.duplicadosCodigoCount} códigos repetidos). Las que tienen <i>distinto título</i> no se sincronizan con la importación por código.</p>
                  )}
                  <p>• Sin Nº Orden: <b>{report.sinCodigo}</b> · Códigos únicos: <b>{report.codigosUnicos}</b></p>
                </div>
              )}

              {/* Corregir */}
              {report.faltantesCount > 0 ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3">
                  <div className="text-xs text-slate-300">
                    Hay <b className="text-white">{report.faltantesCount}</b> obras en la planilla que no están en el sistema.
                  </div>
                  <Button size="sm" className="gap-1.5" onClick={handleFix} disabled={step === 'fixing'}>
                    {step === 'fixing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
                    {step === 'fixing' ? 'Corrigiendo…' : 'Importar faltantes'}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" /> Sincronización completa: no hay obras faltantes.
                </div>
              )}

              {/* Faltantes */}
              {report.faltantes?.length > 0 && (
                <Section title={`Faltantes (${report.faltantesCount})`} muted>
                  <table className="w-full text-xs">
                    <thead><tr className="text-slate-500 text-left">
                      <th className="py-1.5 font-medium">COM</th><th className="font-medium">Establecimiento</th>
                      <th className="font-medium">Título</th><th className="font-medium text-right">Nº Orden</th>
                    </tr></thead>
                    <tbody>
                      {report.faltantes.map((f, i) => (
                        <tr key={i} className="border-t border-slate-800/60 text-slate-300">
                          <td className="py-1.5 font-mono text-slate-400">{f.comuna}</td>
                          <td className="truncate max-w-[140px]" title={f.client_name}>{f.client_name}</td>
                          <td className="truncate max-w-[220px]" title={f.name}>{f.name}</td>
                          <td className="text-right font-mono text-slate-400">{f.code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              {/* Duplicados por código */}
              {report.duplicadosCodigo?.length > 0 && (
                <Section title={`Nº Orden repetidos en la planilla (${report.duplicadosCodigoCount})`} muted>
                  <div className="flex flex-wrap gap-1.5">
                    {report.duplicadosCodigo.map((d, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-xs font-mono">
                        {d.code} <span className="text-amber-400/70">×{d.count}</span>
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Huérfanos */}
              {report.huerfanos?.length > 0 && (
                <Section title={`Huérfanos — en sistema, no en planilla (${report.huerfanosCount})`} muted>
                  <table className="w-full text-xs">
                    <tbody>
                      {report.huerfanos.map((h, i) => (
                        <tr key={i} className="border-t border-slate-800/60 text-slate-300">
                          <td className="py-1.5 truncate max-w-[120px] font-mono text-slate-400">{h.code}</td>
                          <td className="truncate">{h.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} disabled={step === 'scanning' || step === 'fixing'}>Cerrar</Button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }) {
  const tones = {
    slate: 'border-slate-700 text-slate-300',
    blue: 'border-blue-500/30 text-blue-300',
    amber: 'border-amber-500/30 text-amber-300',
    red: 'border-red-500/30 text-red-300',
    green: 'border-emerald-500/30 text-emerald-300',
  };
  return (
    <div className={`rounded-xl border p-3 bg-slate-800/40 ${tones[tone] || 'border-slate-700'}`}>
      <div className="flex items-center gap-1.5 text-slate-500 mb-1"><Icon className="h-3.5 w-3.5" /><span className="text-[11px] uppercase tracking-wide">{label}</span></div>
      <p className="text-xl font-bold text-white tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{title}</p>
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 max-h-48 overflow-y-auto">{children}</div>
    </div>
  );
}