import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Zap } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import UploadADA from '@/components/certificados/UploadADA';
import CertificadoEditor from '@/components/certificados/CertificadoEditor';
import CertificadoPreview from '@/components/certificados/CertificadoPreview';
import CertificadosLista from '@/components/certificados/CertificadosLista';
import CertificadosAutomatizados from '@/components/certificados/CertificadosAutomatizados';
import GeneracionMasiva from '@/components/certificados/GeneracionMasiva';
import AbonoMaestroPanel from '@/components/certificados/AbonoMaestroPanel';
import { toast } from 'sonner';
import { useCurrentUser } from '@/hooks/useCurrentUser';

// view: 'list' | 'upload' | 'edit' | 'preview'
export default function Certificados() {
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('abono_mensual');
  const [comunaFiltro, setComunaFiltro] = useState('Todas');
  const [mesFiltro, setMesFiltro] = useState('Todos');
  const [showMasiva, setShowMasiva] = useState(false);
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
      // Bug #3 fix: también limpiar la SolicitudCertificado huérfana asociada al viejo ID
      if (editing?.id && editing?.estado === 'aprobado') {
        await base44.entities.Certificado.delete(editing.id);
        try {
          const solicitudes = await base44.entities.SolicitudCertificado.filter({ certificado_id: editing.id });
          for (const sol of solicitudes) {
            await base44.entities.SolicitudCertificado.delete(sol.id);
          }
        } catch (_) { /* no bloquear si falla */ }
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
        monto_solicitado: cert.subtotal || cert.monto_contratado || 0,
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

  const detectarComuna = (cert) => {
    const texto = `${cert.emprendimiento || ''} ${cert.obra_servicio || ''}`.toUpperCase();
    if (texto.includes('8A') || texto.includes('8 A')) return '8A';
    if (texto.includes('8B') || texto.includes('8 B')) return '8B';
    if (texto.includes('10A') || texto.includes('10 A')) return '10A';
    return null;
  };

  const filtrarPorComuna = (certs) => {
    return certs.filter(c => {
      if (comunaFiltro === 'Todas') return true;
      const comunaDetectada = detectarComuna(c);
      return comunaDetectada === comunaFiltro;
    });
  };

  const getMeses = () => {
    const meses = new Set();
    certificados.forEach(c => {
      if (c.created_date) {
        const date = new Date(c.created_date);
        const mes = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        meses.add(mes);
      }
    });
    return Array.from(meses).sort().reverse();
  };

  const filtrarPorMes = (certs) => {
    if (mesFiltro === 'Todos') return certs;
    return certs.filter(c => {
      if (!c.created_date) return false;
      const date = new Date(c.created_date);
      const mes = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return mes === mesFiltro;
    });
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

      {/* Filtros por comuna y mes */}
       <div className="flex gap-4 flex-wrap items-center">
         <div className="flex gap-2 flex-wrap">
           {['Todas', '8A', '8B', '10A'].map(c => (
             <button
               key={c}
               onClick={() => setComunaFiltro(c)}
               className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                 comunaFiltro === c
                   ? 'bg-primary text-primary-foreground border-primary'
                   : 'border-border text-muted-foreground hover:border-primary/50'
               }`}
             >
               {c}
             </button>
           ))}
         </div>
         <select
           value={mesFiltro}
           onChange={(e) => setMesFiltro(e.target.value)}
           className="px-3 py-1.5 rounded-md border border-input bg-background text-xs font-medium"
         >
           <option value="Todos">Todos los meses</option>
           {getMeses().map(mes => (
             <option key={mes} value={mes}>{mes}</option>
           ))}
         </select>
       </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="abono_mensual">🟣 Abono Mensual</TabsTrigger>
          <TabsTrigger value="obra">🟠 Obra</TabsTrigger>
          <TabsTrigger value="informe">🔵 Informe</TabsTrigger>
          <TabsTrigger value="automaticos">⚡ Automáticos</TabsTrigger>
          <TabsTrigger value="abonos_maestro">📋 Abonos Maestros</TabsTrigger>
        </TabsList>

        <TabsContent value="abono_mensual" className="mt-6">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowMasiva(true)} className="gap-2 bg-violet-600 hover:bg-violet-700">
              <Zap className="h-4 w-4" /> Generar Masivo
            </Button>
          </div>
          <CertificadosLista
            certificados={filtrarPorMes(filtrarPorComuna(certificados.filter(c => c.tipo === 'abono_mensual')))}
            isLoading={isLoading}
            onNew={() => setView('upload')}
            onEdit={handleEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
            onPreviewPDF={handlePreviewPDF}
            emptyLabel="No hay certificados de Abono Mensual"
          />
          <GeneracionMasiva
            open={showMasiva}
            onClose={() => setShowMasiva(false)}
            onSuccess={() => { setShowMasiva(false); queryClient.invalidateQueries({ queryKey: ['certificados'] }); }}
          />
        </TabsContent>

        <TabsContent value="obra" className="mt-6">
          <CertificadosLista
            certificados={filtrarPorMes(filtrarPorComuna(certificados.filter(c => c.tipo === 'obra')))}
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
            certificados={filtrarPorMes(filtrarPorComuna(certificados.filter(c => c.tipo === 'informe')))}
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

        <TabsContent value="abonos_maestro" className="mt-6">
          <AbonoMaestroPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}