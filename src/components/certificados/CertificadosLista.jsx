import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Eye, Trash2, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const estadoStyle = {
  borrador: 'bg-slate-100 text-slate-600 border-slate-200',
  emitido: 'bg-blue-50 text-blue-700 border-blue-200',
  aprobado: 'bg-green-50 text-green-700 border-green-200',
};

export default function CertificadosLista({ certificados, isLoading, onNew, onEdit, onDelete }) {
  const [exporting, setExporting] = useState(null);

  const handleExport = async (cert, format) => {
    setExporting(`${cert.id}-${format}`);
    try {
      const res = await base44.functions.invoke('exportCertificado', {
        certificadoId: cert.id,
        format: format
      });
      const blob = new Blob([res.data], { 
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
    <div className="space-y-3">
      {certificados.map((c) => (
        <div key={c.id} className="bg-card border rounded-xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">Certificado N° {c.numero}</span>
              <Badge className={`text-xs border ${estadoStyle[c.estado] || estadoStyle.borrador}`}>{c.estado}</Badge>
              <Badge variant="outline" className="text-xs">{c.tipo === 'abono_mensual' ? 'Abono Mensual' : 'Obra'}</Badge>
            </div>
            <div className="text-sm text-muted-foreground truncate mt-0.5">{c.contratista} · {c.emprendimiento}</div>
            <div className="text-xs text-muted-foreground mt-0.5">ADA: {c.ada_numero} {c.mes_periodo ? `· ${c.mes_periodo}` : ''}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-bold text-primary">{fmt(c.monto_contratado)}</div>
            <div className="text-xs text-muted-foreground">{c.created_date ? format(new Date(c.created_date), 'dd/MM/yyyy', { locale: es }) : ''}</div>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(c)} title="Editar"><Eye className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleExport(c, 'excel')} disabled={exporting === `${c.id}-excel`} title="Descargar Excel">{exporting === `${c.id}-excel` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleExport(c, 'pdf')} disabled={exporting === `${c.id}-pdf`} title="Descargar PDF">{exporting === `${c.id}-pdf` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(c.id)} title="Eliminar"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}