import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Pencil, QrCode, Cpu } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import AssetFormDialog from '@/components/assets/AssetFormDialog';
import AssetJerarquia from '@/components/assets/ficha/AssetJerarquia';
import AssetTimeline from '@/components/assets/ficha/AssetTimeline';
import AssetDocumentos from '@/components/assets/ficha/AssetDocumentos';
import QRCodeModal from '@/components/shared/QRCodeModal';
import { fmtCurrency } from '@/lib/format';

const typeLabels = {
  equipo_electrico: 'Eléctrico', equipo_mecanico: 'Mecánico', instalacion_hvac: 'HVAC',
  instalacion_sanitaria: 'Sanitario', estructura: 'Estructura', vehiculo: 'Vehículo',
  herramienta: 'Herramienta', sistemas_informaticos: 'Informático', mobiliario: 'Mobiliario',
  seguridad: 'Seguridad', otro: 'Otro',
};
const statusColors = {
  operativo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  en_mantenimiento: 'bg-amber-100 text-amber-700 border-amber-200',
  fuera_de_servicio: 'bg-red-100 text-red-700 border-red-200',
  baja: 'bg-gray-100 text-gray-500 border-gray-200',
};
const critColors = {
  baja: 'bg-slate-100 text-slate-600', media: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700', critica: 'bg-red-100 text-red-700',
};

function Row({ k, v, extra }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right flex items-center gap-2">{v || '—'}{extra}</span>
    </div>
  );
}

// Ficha UpKeep-style: header + jerarquía + timeline + specs + QR del activo.
export default function ActivoFicha() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => base44.entities.Asset.get(id),
    enabled: !!id,
  });
  const { data: sedes = [] } = useQuery({ queryKey: ['edificios'], queryFn: () => base44.entities.Edificio.list('-updated_date', 500) });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list('-updated_date', 500) });

  if (isLoading) return <div className="p-6"><div className="skeleton h-48" /></div>;
  if (!asset) return <div className="p-6 text-center text-muted-foreground">Activo no encontrado.</div>;

  const sedeName = sedes.find((s) => s.id === asset.location_id)?.nombre || asset.sede || '—';
  const qrValue = `${window.location.origin}/portal-operario?asset=${asset.id}`;
  const nextMaint = asset.next_maintenance ? differenceInDays(new Date(asset.next_maintenance), new Date()) : null;
  const maintColor = nextMaint == null ? '' : nextMaint < 0 ? 'text-red-600' : nextMaint <= 14 ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className="p-4 sm:p-6 space-y-5 page-enter max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/activos')}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-lg font-bold">Ficha del Activo</h1>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center"><Cpu className="h-5 w-5 text-primary" /></div>
              <div>
                <div className="text-xl font-bold leading-tight">{asset.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{asset.code || 'Sin código'}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setQrOpen(true)}><QrCode className="h-4 w-4" /> QR</Button>
              <Button size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Editar</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="outline" className={statusColors[asset.status]}>{(asset.status || '').replace('_', ' ')}</Badge>
            <Badge className={critColors[asset.criticality]}>Criticidad {asset.criticality}</Badge>
            <Badge variant="outline">{typeLabels[asset.type] || 'Otro'}</Badge>
            {asset.parent_asset_id && <Badge variant="outline">Sub-activo</Badge>}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <AssetJerarquia asset={asset} />
          <AssetTimeline assetId={asset.id} assetName={asset.name} />
          <AssetDocumentos asset={asset} />
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Especificaciones</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1.5">
              <Row k="Marca" v={asset.brand} />
              <Row k="Modelo" v={asset.model} />
              <Row k="N° Serie" v={asset.serial_number} />
              <Row k="Sede" v={sedeName} />
              <Row k="Área" v={asset.area} />
              <Row k="Jefe de sitio" v={asset.jefe_sitio} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Mantenimiento</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1.5">
              <Row k="Último" v={asset.last_maintenance || '—'} />
              <Row k="Próximo" v={asset.next_maintenance || '—'} extra={nextMaint != null ? <span className={maintColor}>{nextMaint < 0 ? `Vencido ${Math.abs(nextMaint)}d` : `En ${nextMaint}d`}</span> : null} />
              <Row k="Frecuencia" v={`${asset.maintenance_frequency_days || 90} días`} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Compras</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1.5">
              <Row k="Costo adquisición" v={asset.purchase_cost ? fmtCurrency(asset.purchase_cost) : '—'} />
              <Row k="Fecha compra" v={asset.purchase_date || '—'} />
              <Row k="Garantía hasta" v={asset.warranty_expiry || '—'} />
            </CardContent>
          </Card>
        </div>
      </div>

      <AssetFormDialog open={editOpen} onOpenChange={setEditOpen} editing={asset} sedes={sedes} assets={assets} />
      <QRCodeModal open={qrOpen} onClose={() => setQrOpen(false)} title={asset.name} subtitle={asset.code || sedeName} value={qrValue} />
    </div>
  );
}