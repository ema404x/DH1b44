import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, FileCheck2, Clock, CheckCircle2, XCircle, SendHorizonal } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import SolicitudForm from '@/components/aprobacion/SolicitudForm';
import SolicitudCard from '@/components/aprobacion/SolicitudCard';
import SolicitudDetalle from '@/components/aprobacion/SolicitudDetalle';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const tabsAdmin = [
  { value: 'todas', label: 'Todas' },
  { value: 'enviada', label: 'Enviadas' },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'aprobada', label: 'Aprobadas' },
  { value: 'rechazada', label: 'Rechazadas' },
];

const tabsJefe = [
  { value: 'todas', label: 'Todas' },
  { value: 'borrador', label: 'Borradores' },
  { value: 'enviada', label: 'Enviadas' },
  { value: 'aprobada', label: 'Aprobadas' },
  { value: 'rechazada', label: 'Rechazadas' },
];

export default function AprobacionCertificados() {
  const { user, isAdmin, isSuperAdmin } = useCurrentUser();
  const qc = useQueryClient();
  const [view, setView] = useState('list'); // 'list' | 'form' | 'detalle'
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState('todas');
  const [search, setSearch] = useState('');

  const { data: solicitudes = [], isLoading } = useQuery({
    queryKey: ['solicitudes-cert'],
    queryFn: () => base44.entities.SolicitudCertificado.list('-created_date'),
  });

  // Filtrar por rol: solo superAdmin ve todas; el resto ve las suyas
  const misSolicitudes = isSuperAdmin
    ? solicitudes
    : solicitudes.filter(s => s.jefe_sitio_email === user?.email || s.created_by === user?.email);

  // Filtro tab + search
  const filtered = misSolicitudes.filter(s => {
    const matchTab = tab === 'todas' || s.estado === tab;
    const matchSearch = !search ||
      s.titulo?.toLowerCase().includes(search.toLowerCase()) ||
      s.establecimiento?.toLowerCase().includes(search.toLowerCase()) ||
      s.jefe_sitio?.toLowerCase().includes(search.toLowerCase()) ||
      s.numero?.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const counts = {
    enviada: misSolicitudes.filter(s => s.estado === 'enviada').length,
    en_revision: misSolicitudes.filter(s => s.estado === 'en_revision').length,
    aprobada: misSolicitudes.filter(s => s.estado === 'aprobada').length,
    rechazada: misSolicitudes.filter(s => s.estado === 'rechazada').length,
    borrador: misSolicitudes.filter(s => s.estado === 'borrador').length,
  };

  const handleNew = () => { setEditing(null); setView('form'); };
  const handleEdit = (sol) => { setEditing(sol); setView('form'); };
  const handleView = (sol) => { setSelected(sol); setView('detalle'); };
  const handleSaved = () => { qc.invalidateQueries({ queryKey: ['solicitudes-cert'] }); setView('list'); setEditing(null); setSelected(null); };

  const tabs = isSuperAdmin ? tabsAdmin : tabsJefe;

  if (view === 'form') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setView('list')}>← Volver</Button>
        </div>
        <SolicitudForm
          solicitud={editing}
          user={user}
          onSaved={handleSaved}
          onCancel={() => setView('list')}
        />
      </div>
    );
  }

  if (view === 'detalle' && selected) {
    return (
      <div className="space-y-4">
        <SolicitudDetalle
          solicitud={selected}
          isAdmin={isSuperAdmin}
          user={user}
          onClose={() => setView('list')}
          onSaved={handleSaved}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprobación de Certificados"
        subtitle={isSuperAdmin ? 'Revisá, aprobá o rechazá solicitudes de certificados de obra' : 'Enviá solicitudes de certificados para aprobación de gerencia'}
        actionLabel={!isSuperAdmin ? 'Nueva solicitud' : undefined}
        onAction={!isSuperAdmin ? handleNew : undefined}
      />

      {/* KPIs */}
      {(() => {
        const kpis = isSuperAdmin ? [
          { label: 'Enviadas', value: counts.enviada, icon: SendHorizonal, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'En revisión', value: counts.en_revision, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Aprobadas', value: counts.aprobada, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Rechazadas', value: counts.rechazada, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
        ] : [
          { label: 'Borradores', value: counts.borrador, icon: FileCheck2, color: 'text-slate-400', bg: 'bg-slate-400/10' },
          { label: 'Enviadas', value: counts.enviada, icon: SendHorizonal, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Aprobadas', value: counts.aprobada, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Rechazadas', value: counts.rechazada, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
        ];
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="flex items-center gap-3 bg-card border border-border rounded-xl p-4">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div>
                  <div className="text-xl font-bold">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, establecimiento, jefe..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {isSuperAdmin && (
          <Button variant="outline" onClick={handleNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva solicitud
          </Button>
        )}
      </div>

      {/* Tabs + lista */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          {tabs.map(t => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs gap-1.5">
              {t.label}
              {counts[t.value] > 0 && (
                <span className="bg-primary/20 text-primary text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none">
                  {counts[t.value]}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map(t => (
          <TabsContent key={t.value} value={t.value} className="mt-5">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FileCheck2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No hay solicitudes</p>
                {!isSuperAdmin && <p className="text-sm mt-1">Creá una nueva solicitud de certificado</p>}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(sol => (
                  <SolicitudCard
                    key={sol.id}
                    solicitud={sol}
                    isAdmin={isSuperAdmin}
                    onView={handleView}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}