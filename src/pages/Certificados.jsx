import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import UploadADA from '@/components/certificados/UploadADA';
import CertificadoEditor from '@/components/certificados/CertificadoEditor';
import CertificadoPreview from '@/components/certificados/CertificadoPreview';
import CertificadosLista from '@/components/certificados/CertificadosLista';
import CertificadosAutomatizados from '@/components/certificados/CertificadosAutomatizados';
import { toast } from 'sonner';
import { useCurrentUser } from '@/hooks/useCurrentUser';

// view: 'list' | 'upload' | 'edit' | 'preview'
export default function Certificados() {
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('abono_mensual');
  const [extracted, setExtracted] = useState(null);
  const [editing, setEditing] = useState(null);
  const [previewing, setPreviewing] = useState(null);
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  const { data: certificados = [], isLoading } = useQuery({
    queryKey: ['certificados'],
    queryFn: () => base44.entities.Certificado.list('-created_date'),
  });

  // Al guardar: siempre crea un registro nuevo (nunca actualiza el existente)
  // y si el estado es 'emitido', crea automáticamente una SolicitudCertificado
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      // Si viene de edición aprobada → eliminar el viejo y crear uno nuevo (nuevo ID)
      if (editing?.id && editing?.estado === 'aprobado') {
        await base44.entities.Certificado.delete(editing.id);
      }
      // Siempre emitido al guardar
      const payload = { ...data, id: undefined, estado: 'emitido' };
      const cert = await base44.entities.Certificado.create(payload);

      // Crear solicitud de aprobación automáticamente
      const numero = `CERT-${cert.id.slice(-6).toUpperCase()}`;
      await base44.entities.SolicitudCertificado.create({
        numero,
        titulo: `Certificado N°${cert.numero} — ${cert.contratista || cert.emprendimiento || ''}`,
        establecimiento: cert.emprendimiento || cert.obra_servicio || '',
        jefe_sitio: user?.full_name || user?.email || '',
        jefe_sitio_email: user?.email || '',
        descripcion_trabajo: cert.obra_servicio || '',
        monto_solicitado: cert.monto_contratado || 0,
        porcentaje_avance: cert.porcentaje_avance || 0,
        periodo: cert.mes_periodo || '',
        estado: 'enviada',
        certificado_id: cert.id,
        historial: [{
          fecha: new Date().toISOString(),
          estado: 'enviada',
          usuario: user?.full_name || user?.email || '',
          comentario: 'Certificado emitido — enviado automáticamente para aprobación',
        }]
      });

      return cert;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificados'] });
      queryClient.invalidateQueries({ queryKey: ['solicitudes-cert'] });
      toast.success('Certificado emitido y enviado a aprobación gerencial');
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
    // Si está aprobado, avisar que editar genera nuevo ID y pierde la aprobación
    if (certificado.estado === 'aprobado') {
      if (!window.confirm('Este certificado ya fue aprobado. Editarlo generará un nuevo certificado con nuevo ID y perderá la aprobación actual. ¿Continuar?')) return;
    }
    setEditing(certificado);
    setExtracted(certificado);
    setView('edit');
  };

  const handlePreview = (formData) => {
    setPreviewing(formData);
    setView('preview');
  };

  const handlePreviewPDF = (cert) => {
    setPreviewing(cert);
    setView('preview');
  };

  const handleSave = (formData) => {
    // Siempre crea nuevo (nunca pasa ID al mutationFn para que no haga update)
    saveMutation.mutate(formData);
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
    const fromList = previewing?.estado === 'aprobado' && !editing;
    return (
      <CertificadoPreview
        form={previewing}
        onBack={() => fromList ? setView('list') : setView('edit')}
        onSave={handleSave}
        saving={saveMutation.isPending}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificados"
        subtitle="Gestión de certificados manuales y automáticos"
        actionLabel="Nuevo Certificado"
        onAction={() => setView('upload')}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="abono_mensual">🟣 Abono Mensual</TabsTrigger>
          <TabsTrigger value="obra">🟠 Obra</TabsTrigger>
          <TabsTrigger value="informe">🔵 Informe</TabsTrigger>
          <TabsTrigger value="automaticos">⚡ Automáticos</TabsTrigger>
        </TabsList>

        <TabsContent value="abono_mensual" className="mt-6">
          <CertificadosLista
            certificados={certificados.filter(c => c.tipo === 'abono_mensual')}
            isLoading={isLoading}
            onNew={() => setView('upload')}
            onEdit={handleEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
            onPreviewPDF={handlePreviewPDF}
            emptyLabel="No hay certificados de Abono Mensual"
          />
        </TabsContent>

        <TabsContent value="obra" className="mt-6">
          <CertificadosLista
            certificados={certificados.filter(c => c.tipo === 'obra')}
            isLoading={isLoading}
            onNew={() => setView('upload')}
            onEdit={handleEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
            onPreviewPDF={handlePreviewPDF}
            emptyLabel="No hay certificados de Obra"
          />
        </TabsContent>

        <TabsContent value="informe" className="mt-6">
          <CertificadosLista
            certificados={certificados.filter(c => c.tipo === 'informe')}
            isLoading={isLoading}
            onNew={() => setView('upload')}
            onEdit={handleEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
            onPreviewPDF={handlePreviewPDF}
            emptyLabel="No hay certificados de Informe"
          />
        </TabsContent>

        <TabsContent value="automaticos" className="mt-6">
          <CertificadosAutomatizados />
        </TabsContent>
      </Tabs>
    </div>
  );
}