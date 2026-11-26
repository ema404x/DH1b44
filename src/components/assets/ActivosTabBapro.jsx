import React, { useState, useMemo, useCallback, useContext } from 'react';
import { AuthContext } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AssetFormDialog from '@/components/assets/AssetFormDialog';
import ImportarActivosWizard from '@/components/assets/importar-wizard/ImportarActivosWizard';
import AssetQRModal from '@/components/assets/AssetQRModal';
import { useActivosVisibles } from '@/hooks/useActivosVisibles';
import { exportActivosToExcel, exportActivosToPDF } from '@/utils/exportActivosExcel';
import { ordenarSedes } from '@/components/assets/bapro/sedesBapro';
import { useCatalogoBaproUrl } from '@/components/assets/bapro/useCatalogoBaproUrl';
import { useFiltroBapro } from '@/components/assets/bapro/useFiltroBapro';
import SedesPanelBapro from '@/components/assets/bapro/SedesPanelBapro';
import SedeBuscador from '@/components/assets/bapro/SedeBuscador';
import BaproStats from '@/components/assets/bapro/BaproStats';
import BaproToolbar from '@/components/assets/bapro/BaproToolbar';
import BaproTabla from '@/components/assets/bapro/BaproTabla';
import BaproPaginacion from '@/components/assets/bapro/BaproPaginacion';
import BaproVacio from '@/components/assets/bapro/BaproVacio';

const POR_PAGINA = 50;

/** Catálogo de Activos del sector BAPRO: panel de sedes, búsqueda, filtros y paginado. */
export default function ActivosTabBapro() {
  const [f, actualizar] = useCatalogoBaproUrl();
  const [resetKey, setResetKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [qrAsset, setQrAsset] = useState(null);
  const qc = useQueryClient();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const { data: assets = [], isLoading } = useActivosVisibles();
  const { data: sedesRaw = [] } = useQuery({ queryKey: ['edificios'], queryFn: () => base44.entities.Edificio.list('-updated_date', 500) });
  const sedes = useMemo(() => ordenarSedes(sedesRaw), [sedesRaw]);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Asset.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });

  const openFicha = useCallback((a) => navigate(`/activos/${a.id}`), [navigate]);
  const openEdit = useCallback((a) => { setEditing(a); setDialogOpen(true); }, []);

  const { base, conteos, filtrado, activosSede } = useFiltroBapro(assets, sedes, f);
  const sedeSel = f.sede === 'all' ? null : sedes.find(s => s.id === f.sede);

  const openNew = () => {
    setEditing(sedeSel ? { location_id: sedeSel.id, sede: sedeSel.nombre } : null);
    setDialogOpen(true);
  };

  const opciones = useMemo(() => [
    { value: 'all', label: 'Todas las sedes', count: base.length },
    ...sedes.map(s => ({ value: s.id, label: s.nombre, count: conteos[s.id] || 0, tipo: s.tipo_sede })),
  ], [sedes, conteos, base.length]);

  const hayFiltros = !!f.q || f.tipo !== 'all' || f.estado !== 'all';
  const limpiar = () => { actualizar({ q: '', tipo: 'all', estado: 'all' }); setResetKey(k => k + 1); };

  const totalPaginas = Math.max(1, Math.ceil(filtrado.length / POR_PAGINA));
  const pagina = Math.min(f.p, totalPaginas);
  const filas = filtrado.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <div className="space-y-5">
      <BaproStats activos={activosSede} sedeNombre={sedeSel?.nombre} />
      <div className="flex gap-5">
        <SedesPanelBapro options={opciones} value={f.sede} onChange={sede => actualizar({ sede })}
          puedeEditarTipo={user?.role === 'admin'}
          onCambiarTipo={async (id, tipo_sede) => { await base44.entities.Edificio.update(id, { tipo_sede }); qc.invalidateQueries({ queryKey: ['edificios'] }); qc.invalidateQueries({ queryKey: ['edificios-mapa-bapro'] }); }} />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="lg:hidden">
            <SedeBuscador options={opciones} value={f.sede} onChange={sede => actualizar({ sede })} />
          </div>
          <BaproToolbar
            f={f} actualizar={actualizar} resetKey={resetKey} hayFiltros={hayFiltros} onLimpiar={limpiar}
            onImportar={() => setImportOpen(true)} onNuevo={openNew}
            onExcel={() => exportActivosToExcel(filtrado, sedes)} onPdf={() => exportActivosToPDF(filtrado, sedes)}
          />
          <BaproTabla
            rows={filas} sedes={sedes} isLoading={isLoading}
            vacio={<BaproVacio sedeVacia={!!sedeSel && activosSede.length === 0} hayFiltros={hayFiltros} onNuevo={openNew} onImportar={() => setImportOpen(true)} onLimpiar={limpiar} />}
            onEdit={openEdit} onOpen={openFicha} onQr={setQrAsset} onDelete={deleteMutation.mutate}
          />
          {filtrado.length > 0 && (
            <BaproPaginacion
              pagina={pagina} totalPaginas={totalPaginas} total={filtrado.length}
              desde={(pagina - 1) * POR_PAGINA + 1} hasta={Math.min(pagina * POR_PAGINA, filtrado.length)}
              onPagina={p => actualizar({ p })}
            />
          )}
        </div>
      </div>

      <AssetFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} sedes={sedes} assets={assets} bapro />
      <ImportarActivosWizard open={importOpen} onOpenChange={setImportOpen} />
      <AssetQRModal open={!!qrAsset} onOpenChange={(o) => !o && setQrAsset(null)} asset={qrAsset} />
    </div>
  );
}