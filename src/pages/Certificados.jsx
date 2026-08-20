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
import AbonoManualForm from '@/components/certificados/AbonoManualForm';
import { toast } from 'sonner';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import FirmaJefeSitioModal from '@/components/certificados/FirmaJefeSitioModal';

// view: 'list' | 'upload' | 'edit' | 'preview' | 'manual'
export default function Certificados() {
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('abono_mensual');
  const [comunaFiltro, setComunaFiltro] = useState('Todas');
  const [mesFiltro, setMesFiltro] = useState('Todos');
  const [showMasiva, setShowMasiva] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [editing, setEditing] = useState(null);
  const [previewing, setPreviewing] = useState(null);
  const [pendingFirmaData, setPendingFirmaData] = useState(null); // datos del cert esperando firma jefe
  const queryClient = useQueryClient();
  const { user, displayName, isSuperAdmin, loading } = useCurrentUser();

  const { data: certificados = [], isLoading } = useQuery({
    queryKey: ['certificados'],
    queryFn: () => base44.entities.Certificado.list('-created_date', 200),
    enabled: !loading,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Guardar como borrador (crea o actualiza sin emitir)
  const draftMutation = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data, estado: 'borrador' };
      if (editing?.id) {
        // Si ya existe, actualizar en lugar de duplicar
        return base44.entities.Certificado.update(editing.id, payload);
      }
      const { id: _id, ...rest } = payload;
      return base44.entities.Certificado.create(rest);
    },
    onSuccess: (cert) => {
      queryClient.invalidateQueries({ queryKey: ['certificados'] });
      // Actualizar el editing para que futuras operaciones usen el id correcto
      setEditing(cert);
      setExtracted(cert);
      toast.success('Borrador guardado');
    },
    onError: (error) => {
      toast.error('Error al guardar borrador: ' + (error?.message || 'Error desconocido'));
    },
  });

  // Emitir vía función backend (emitirCertificado): garantiza sector_id, crea la
  // solicitud de aprobación, y limpia el borrador previo de forma atómica. Devuelve
  // el cert y su tipo para que la lista swithee a la pestaña correcta.
  const emitirMutation = useMutation({
    mutationFn: async (data) => {
      const res = await base44.functions.invoke('emitirCertificado', {
        data,
        editing_id: editing?.id,
        editing_estado: editing?.estado,
        display_name: displayName,
        user_email: user?.email,
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['certificados'] });
      queryClient.invalidateQueries({ queryKey: ['solicitudes-cert'] });
      // Auto-switch a la pestaña del tipo emitido — antes la lista quedaba en
      // 'abono_mensual' (default) y los certs de obra no se veían.
      if (res?.tipo) setTab(res.tipo);
      if (res?.solicitud_creada === false) {
        toast.warning(res.mensaje || 'Certificado emitido, pero la solicitud de aprobación falló');
      } else {
        toast.success(res.mensaje || 'Certificado emitido y enviado a aprobación gerencial');
      }
      setView('list');
      setExtracted(null);
      setEditing(null);
      setPreviewing(null);
    },
    onError: (error) => {
      toast.error('Error al emitir el certificado: ' + (error?.message || 'Error desconocido'));
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

  const handleDraft = (formData) => {
    draftMutation.mutate(formData);
  };

  const handleEmitir = (formData) => {
    // Para certificados de OBRA: pedir firma del jefe de sitio antes de emitir
    if (formData.tipo === 'obra') {
      setPendingFirmaData(formData);
      return;
    }
    emitirMutation.mutate(formData);
  };

  const handleFirmaJefe = (firmaUrl) => {
    const dataConFirma = {
      ...pendingFirmaData,
      firma_jefe_sitio_url: firmaUrl,
      firmado_por_jefe: displayName,
      fecha_firma_jefe: new Date().toISOString(),
    };
    setPendingFirmaData(null);
    emitirMutation.mutate(dataConFirma);
  };

  const detectarComuna = (cert) => {
    // Pad + normalize para detectar la comuna como token independiente
    // Evita falsos positivos como "18A" → 8A
    const texto = ` ${cert.emprendimiento || ''} ${cert.obra_servicio || ''} `.toUpperCase().replace(/\s+/g, ' ');
    // Normalizar "8 A" → "8A", "10 A" → "10A" (solo si A/B es un token separado)
    const norm = texto.replace(/(\d+)\s+(A|B)(?=\s|$)/g, '$1$2');
    if (norm.includes(' 8A ')) return '8A';
    if (norm.includes(' 8B ')) return '8B';
    if (norm.includes(' 10A ')) return '10A';
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

  if (view === 'manual') {
    return (
      <>
        <FirmaJefeSitioModal
          open={!!pendingFirmaData}
          onClose={() => setPendingFirmaData(null)}
          onFirmado={handleFirmaJefe}
          user={user}
          displayName={displayName}
        />
        <AbonoManualForm
          onSave={handleEmitir}
          onCancel={() => setView('list')}
          saving={emitirMutation.isPending}
        />
      </>
    );
  }

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
      <>
        <FirmaJefeSitioModal
          open={!!pendingFirmaData}
          onClose={() => setPendingFirmaData(null)}
          onFirmado={handleFirmaJefe}
          user={user}
          displayName={displayName}
        />
        <CertificadoEditor
          initialData={extracted}
          onDraft={handleDraft}
          onEmitir={handleEmitir}
          onCancel={() => { setView('list'); setExtracted(null); setEditing(null); }}
          onPreview={handlePreview}
          saving={draftMutation.isPending}
          emitting={emitirMutation.isPending}
        />
      </>
    );
  }

  if (view === 'preview') {
    const fromList = previewing?.estado === 'aprobado' && !editing;
    return (
      <>
        <FirmaJefeSitioModal
          open={!!pendingFirmaData}
          onClose={() => setPendingFirmaData(null)}
          onFirmado={handleFirmaJefe}
          user={user}
          displayName={displayName}
        />
        <CertificadoPreview
          form={previewing}
          onBack={() => fromList ? setView('list') : setView('edit')}
          onEmitir={handleEmitir}
          saving={emitirMutation.isPending}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modal de firma del jefe de sitio — solo para certificados de obra */}
      <FirmaJefeSitioModal
        open={!!pendingFirmaData}
        onClose={() => setPendingFirmaData(null)}
        onFirmado={handleFirmaJefe}
        user={user}
        displayName={displayName}
      />

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
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="abono_mensual" className="text-xs sm:text-sm">🟣 <span className="hidden sm:inline">Abono </span>Mensual</TabsTrigger>
          <TabsTrigger value="obra" className="text-xs sm:text-sm">🟠 Obra</TabsTrigger>
          <TabsTrigger value="informe" className="text-xs sm:text-sm">🔵 Informe</TabsTrigger>
          <TabsTrigger value="automaticos" className="text-xs sm:text-sm">⚡ <span className="hidden sm:inline">Automáticos</span><span className="sm:hidden">Auto</span></TabsTrigger>
          <TabsTrigger value="abonos_maestro" className="text-xs sm:text-sm">📋 <span className="hidden sm:inline">Abonos Maestros</span><span className="sm:hidden">Maestros</span></TabsTrigger>
        </TabsList>

        <TabsContent value="abono_mensual" className="mt-6">
          <div className="flex justify-end gap-2 mb-4">
            <Button variant="outline" onClick={() => setView('manual')} className="gap-2">
              <Plus className="h-4 w-4" /> Cargar Manualmente
            </Button>
            <Button onClick={() => setShowMasiva(true)} className="gap-2 bg-violet-600 hover:bg-violet-700">
              <Zap className="h-4 w-4" /> Generar Masivo
            </Button>
          </div>
          <CertificadosLista
            certificados={filtrarPorMes(filtrarPorComuna(certificados.filter(c => c.tipo === 'abono_mensual')))}
            isLoading={loading || isLoading}
            onNew={() => setView('upload')}
            onEdit={handleEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
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