import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import UploadADA from '@/components/certificados/UploadADA';
import CertificadoEditor from '@/components/certificados/CertificadoEditor';
import CertificadoPreview from '@/components/certificados/CertificadoPreview';
import CertificadosLista from '@/components/certificados/CertificadosLista';

// view: 'list' | 'upload' | 'edit' | 'preview'
export default function Certificados() {
  const [view, setView] = useState('list');
  const [extracted, setExtracted] = useState(null);   // datos extraídos del ADA
  const [editing, setEditing] = useState(null);        // certificado en edición
  const [previewing, setPreviewing] = useState(null);  // form para preview
  const queryClient = useQueryClient();

  const { data: certificados = [], isLoading } = useQuery({
    queryKey: ['certificados'],
    queryFn: () => base44.entities.Certificado.list('-created_date'),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => data.id
      ? base44.entities.Certificado.update(data.id, data)
      : base44.entities.Certificado.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificados'] });
      setView('list');
      setExtracted(null);
      setEditing(null);
      setPreviewing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Certificado.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['certificados'] }),
  });

  const handleExtracted = (data) => {
    setExtracted(data);
    setView('edit');
  };

  const handleEdit = (certificado) => {
    setEditing(certificado);
    setExtracted(certificado);
    setView('edit');
  };

  const handlePreview = (formData) => {
    setPreviewing(formData);
    setView('preview');
  };

  const handleSave = (formData) => {
    const dataToSave = editing ? { ...formData, id: editing.id } : formData;
    saveMutation.mutate(dataToSave);
  };

  if (view === 'upload') {
    return (
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setView('list')}>← Volver</Button>
        </div>
        <UploadADA onExtracted={handleExtracted} />
      </div>
    );
  }

  if (view === 'edit') {
    return (
      <CertificadoEditor
        initialData={extracted}
        onSave={handleSave}
        onCancel={() => { setView('list'); setExtracted(null); setEditing(null); }}
        onPreview={handlePreview}
        saving={saveMutation.isPending}
      />
    );
  }

  if (view === 'preview') {
    return (
      <CertificadoPreview
        form={previewing}
        onBack={() => setView('edit')}
        onSave={handleSave}
        saving={saveMutation.isPending}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificados"
        subtitle="Generación automática de certificados desde ADA / Órdenes de Compra"
        actionLabel="Nuevo Certificado"
        onAction={() => setView('upload')}
      />
      <CertificadosLista
        certificados={certificados}
        isLoading={isLoading}
        onNew={() => setView('upload')}
        onEdit={handleEdit}
        onDelete={(id) => deleteMutation.mutate(id)}
      />
    </div>
  );
}