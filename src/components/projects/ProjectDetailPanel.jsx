import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  X, MapPin, Calendar, DollarSign, Upload, FileText, Image, 
  Trash2, Download, Loader2, Pencil, User, ClipboardList
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import StatusBadge from '@/components/shared/StatusBadge';

const typeLabels = {
  obra_nueva: 'Obra Nueva', remodelacion: 'Remodelación',
  mantenimiento_preventivo: 'Mant. Preventivo', mantenimiento_correctivo: 'Mant. Correctivo',
  emergencia: 'Emergencia', inspeccion: 'Inspección',
};

function FileIcon({ type }) {
  if (type?.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />;
  return <FileText className="h-4 w-4 text-slate-500" />;
}

export default function ProjectDetailPanel({ project, onClose, onEdit }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.update(project.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const newDocs = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        newDocs.push({
          name: file.name,
          url: file_url,
          type: file.type,
          uploaded_at: new Date().toISOString(),
        });
      }
      const currentDocs = project.documents || [];
      await updateMutation.mutateAsync({ documents: [...currentDocs, ...newDocs] });
      toast.success(`${newDocs.length} archivo(s) cargado(s)`);
    } catch (err) {
      toast.error('Error al subir archivo: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDoc = async (index) => {
    const docs = [...(project.documents || [])];
    docs.splice(index, 1);
    await updateMutation.mutateAsync({ documents: docs });
    toast.success('Archivo eliminado');
  };

  const formatDate = (d) => d ? format(new Date(d), 'dd MMM yyyy', { locale: es }) : '—';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-background shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b bg-card">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              {project.code && <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{project.code}</span>}
              <StatusBadge value={project.status} />
              <StatusBadge value={project.priority} type="priority" />
            </div>
            <h2 className="text-xl font-bold leading-tight">{project.name}</h2>
            {project.type && <span className="text-xs text-muted-foreground">{typeLabels[project.type] || project.type}</span>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Avance de obra</span>
              <span className="text-sm font-bold text-primary">{project.progress || 0}%</span>
            </div>
            <Progress value={project.progress || 0} className="h-2" />
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4">
            {project.client_name && (
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="text-sm font-medium">{project.client_name}</p>
                </div>
              </div>
            )}
            {project.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Dirección</p>
                  <p className="text-sm font-medium">{project.address}</p>
                </div>
              </div>
            )}
            {(project.start_date || project.end_date) && (
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Período</p>
                  <p className="text-sm font-medium">{formatDate(project.start_date)} → {formatDate(project.end_date)}</p>
                </div>
              </div>
            )}
            {project.estimated_budget > 0 && (
              <div className="flex items-start gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Presupuesto estimado</p>
                  <p className="text-sm font-medium">${project.estimated_budget?.toLocaleString()}</p>
                </div>
              </div>
            )}
            {project.actual_cost > 0 && (
              <div className="flex items-start gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Costo real</p>
                  <p className="text-sm font-medium">${project.actual_cost?.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {project.description && (
            <div>
              <p className="text-sm font-semibold mb-1 flex items-center gap-1.5"><ClipboardList className="h-4 w-4" /> Descripción</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/40 rounded-lg p-3">{project.description}</p>
            </div>
          )}

          {/* Notes */}
          {project.notes && (
            <div>
              <p className="text-sm font-semibold mb-1">Notas</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/40 rounded-lg p-3">{project.notes}</p>
            </div>
          )}

          {/* Documents */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Archivos adjuntos
                {project.documents?.length > 0 && (
                  <span className="text-xs text-muted-foreground">({project.documents.length})</span>
                )}
              </p>
              <Button
                size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                {uploading ? 'Subiendo...' : 'Cargar archivo'}
              </Button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
            </div>

            {(!project.documents || project.documents.length === 0) ? (
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Arrastrá o hacé clic para subir archivos</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, imágenes, planillas, etc.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {project.documents.map((doc, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 group">
                    <FileIcon type={doc.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      {doc.uploaded_at && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(doc.uploaded_at), 'dd/MM/yyyy HH:mm')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => handleDeleteDoc(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}