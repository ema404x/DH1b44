import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload, X, FileText, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function SolicitudForm({ solicitud, user, onSaved, onCancel }) {
  const isEdit = !!solicitud;
  const [form, setForm] = useState({
    titulo: solicitud?.titulo || '',
    establecimiento: solicitud?.establecimiento || '',
    descripcion_trabajo: solicitud?.descripcion_trabajo || '',
    monto_solicitado: solicitud?.monto_solicitado || '',
    porcentaje_avance: solicitud?.porcentaje_avance || '',
    periodo: solicitud?.periodo || '',
    prioridad: solicitud?.prioridad || 'normal',
    adjuntos: solicitud?.adjuntos || [],
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('adjuntos', [...form.adjuntos, { nombre: file.name, url: file_url, tipo: file.type }]);
      toast.success('Archivo adjuntado');
    } finally {
      setUploading(false);
    }
  };

  const removeAdjunto = (idx) => {
    set('adjuntos', form.adjuntos.filter((_, i) => i !== idx));
  };

  const handleSend = async (asDraft = false) => {
    if (!form.titulo || !form.establecimiento) {
      toast.error('Completá el título y el establecimiento');
      return;
    }
    setSaving(true);
    try {
      const numero = `SOL-${Date.now().toString().slice(-5)}`;
      const payload = {
        ...form,
        monto_solicitado: parseFloat(form.monto_solicitado) || 0,
        porcentaje_avance: parseFloat(form.porcentaje_avance) || 0,
        numero: solicitud?.numero || numero,
        jefe_sitio: user?.full_name || user?.email || '',
        jefe_sitio_email: user?.email || '',
        estado: asDraft ? 'borrador' : 'enviada',
        historial: [
          ...(solicitud?.historial || []),
          {
            fecha: new Date().toISOString(),
            estado: asDraft ? 'borrador' : 'enviada',
            usuario: user?.full_name || user?.email,
            comentario: asDraft ? 'Guardado como borrador' : 'Solicitud enviada para aprobación',
          }
        ]
      };
      if (isEdit) {
        await base44.entities.SolicitudCertificado.update(solicitud.id, payload);
      } else {
        await base44.entities.SolicitudCertificado.create(payload);
      }
      toast.success(asDraft ? 'Borrador guardado' : 'Solicitud enviada correctamente');
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          {isEdit ? 'Editar Solicitud' : 'Nueva Solicitud de Certificado'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Título *</label>
            <Input value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ej: Certificado N°3 - Pintura aulas" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Establecimiento *</label>
            <Input value={form.establecimiento} onChange={e => set('establecimiento', e.target.value)} placeholder="Nombre del colegio / obra" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Período</label>
            <Input value={form.periodo} onChange={e => set('periodo', e.target.value)} placeholder="Ej: Mayo 2025" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Prioridad</label>
            <Select value={form.prioridad} onValueChange={v => set('prioridad', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Monto solicitado ($)</label>
            <Input type="number" value={form.monto_solicitado} onChange={e => set('monto_solicitado', e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">% Avance de obra</label>
            <Input type="number" min="0" max="100" value={form.porcentaje_avance} onChange={e => set('porcentaje_avance', e.target.value)} placeholder="0" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase">Descripción del trabajo realizado</label>
          <textarea
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[90px] resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Describí los trabajos realizados en el período..."
            value={form.descripcion_trabajo}
            onChange={e => set('descripcion_trabajo', e.target.value)}
          />
        </div>

        {/* Adjuntos */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase">Documentos y fotos adjuntos</label>
          {form.adjuntos.length > 0 && (
            <div className="space-y-1.5">
              {form.adjuntos.map((a, i) => (
                <div key={i} className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-2 text-sm">
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate">{a.nombre}</a>
                  <button onClick={() => removeAdjunto(i)} className="ml-2 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
          <label className="cursor-pointer inline-flex items-center gap-2 text-xs text-primary border border-dashed border-primary/40 rounded-md px-3 py-2 hover:bg-primary/5 transition-colors">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? 'Subiendo...' : 'Adjuntar archivo'}
            <input type="file" className="hidden" onChange={handleFile} disabled={uploading} />
          </label>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
          <Button variant="outline" onClick={() => handleSend(true)} disabled={saving}>
            Guardar borrador
          </Button>
          <Button onClick={() => handleSend(false)} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar para aprobación
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}