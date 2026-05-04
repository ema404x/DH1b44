import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Eye, Trash2, Download, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { exportCertificadoPDF } from '@/utils/exportCertificadoPDF';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const estadoStyle = {
  borrador: 'bg-slate-100 text-slate-600 border-slate-200',
  emitido:  'bg-blue-50 text-blue-700 border-blue-200',
  aprobado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function CertificadosLista({ certificados, isLoading, onNew, onEdit, onDelete }) {
  const [exporting, setExporting] = useState(null);
  const [exportingPDF, setExportingPDF] = useState(null);
  const [search, setSearch] = useState('');

  const handleExport = async (cert, format) => {
    setExporting(`${cert.id}-${format}`);
    try {
      const res = await base44.functions.invoke('exportCertificado', {
        certificadoData: cert,
        format: format
      });
      const arrayBuffer = await res.data.arrayBuffer?.() || res.data;
      const blob = new Blob([arrayBuffer], { 
        type: format === 'excel' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Certificado_N${cert.numero}_${cert.contratista?.replace(/ /g, '_') || 'default'}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting:', err);
    } finally {
      setExporting(null);
    }
  };

  const filtrados = certificados.filter(c =>
    c.numero?.toString().includes(search) ||
    c.contratista?.toLowerCase().includes(search.toLowerCase()) ||
    c.emprendimiento?.toLowerCase().includes(search.toLowerCase()) ||
    c.ada_numero?.includes(search)
  );

  if (isLoading) return <div className="text-center py-20 text-muted-foreground">Cargando...</div>;

  if (certificados.length === 0) return (
    <div className="text-center py-20">
      <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
      <h3 className="font-semibold text-lg mb-1">No hay certificados aún</h3>
      <p className="text-muted-foreground text-sm mb-6">Subí un ADA y la IA generará el certificado automáticamente</p>
      <Button onClick={onNew} className="gap-2"><Plus className="h-4 w-4" />Nuevo Certificado</Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="Buscar por N°, contratista, ADA..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm"
        />
        <Button onClick={onNew} className="gap-2 shrink-0"><Plus className="h-4 w-4" />Nuevo</Button>
      </div>

      <div className="space-y-3">
        {filtrados.map((c) => (
          <div key={c.id} className="bg-card border rounded-lg p-4 hover:shadow-sm hover:border-primary/20 transition-all group">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold">Certificado N° {c.numero}</h3>
                    <Badge className={`text-xs border ${estadoStyle[c.estado] || estadoStyle.borrador}`}>
                      {c.estado}
                    </Badge>
                    {c.generado_automaticamente && (
                      <Badge variant="secondary" className="text-xs">Automático</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{c.contratista}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
                    <span>{c.emprendimiento}</span>
                    <span className="text-border">·</span>
                    <span>ADA: {c.ada_numero}</span>
                    {c.mes_periodo && (
                      <>
                        <span className="text-border">·</span>
                        <span>{c.mes_periodo}</span>
                      </>
                    )}
                  </div>
                  {c.estado === 'aprobado' && c.aprobado_por && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 mt-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Aprobado por {c.aprobado_por}</span>
                    </div>
                  )}
                  {c.estado === 'emitido' && (
                    <div className="flex items-center gap-1.5 text-xs text-blue-500 mt-1">
                      <Clock className="h-3 w-3" />
                      <span>Pendiente de aprobación gerencial</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className="font-bold text-primary text-lg">{fmt(c.monto_contratado)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {c.created_date ? format(new Date(c.created_date), 'dd/MM', { locale: es }) : '—'}
                </div>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity items-center">
                {c.estado === 'aprobado' && c.firma_gerente_url && (
                  <img src={c.firma_gerente_url} alt="Firma" className="h-8 object-contain border rounded bg-white px-1" title={`Aprobado por ${c.aprobado_por || ''}`} />
                )}
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8" 
                  onClick={() => onEdit(c)} 
                  title="Editar"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8" 
                  onClick={() => handleExport(c, 'excel')} 
                  disabled={exporting === `${c.id}-excel`}
                  title="Descargar Excel"
                >
                  {exporting === `${c.id}-excel` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                  onClick={async () => {
                    setExportingPDF(c.id);
                    await exportCertificadoPDF(c);
                    setExportingPDF(null);
                  }}
                  disabled={exportingPDF === c.id}
                  title="Descargar PDF"
                >
                  {exportingPDF === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 text-destructive hover:text-destructive" 
                  onClick={() => onDelete(c.id)}
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtrados.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No hay certificados que coincidan con tu búsqueda</p>
        </div>
      )}
    </div>
  );
}