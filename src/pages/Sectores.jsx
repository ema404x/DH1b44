import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Eye, Plus, Building2, Users, Shield, LogIn } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function Sectores() {
  const { isAdmin, currentUser, employeeSector } = useCurrentUser();
  const navigate = useNavigate();
  const [sectores, setSectores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [observando, setObservando] = useState(null);
  const [obsData, setObsData] = useState(null);
  const [obsLoading, setObsLoading] = useState(false);
  const [switching, setSwitching] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    clave: '', nombre: '', descripcion: '', color: '#3b82f6', icono: '🏢', config: '{}'
  });

  useEffect(() => {
    if (isAdmin) loadSectores();
  }, [isAdmin]);

  const loadSectores = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Sector.list('orden', 100);
      setSectores(data);
    } catch (e) {
      toast.error('Error al cargar sectores');
    } finally {
      setLoading(false);
    }
  };

  const handleCrear = async () => {
    if (!form.clave.trim() || !form.nombre.trim()) {
      toast.error('Clave y nombre son obligatorios');
      return;
    }
    let config = {};
    try {
      config = JSON.parse(form.config || '{}');
    } catch (_) {
      toast.error('Configuración JSON inválida');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Sector.create({
        clave: form.clave.trim().toLowerCase(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        color: form.color,
        icono: form.icono,
        config,
        activo: true,
        orden: sectores.length + 1
      });
      toast.success(`Sector "${form.nombre}" creado`);
      setDialogOpen(false);
      setForm({ clave: '', nombre: '', descripcion: '', color: '#3b82f6', icono: '🏢', config: '{}' });
      loadSectores();
    } catch (e) {
      toast.error(e.message || 'Error al crear sector');
    } finally {
      setSaving(false);
    }
  };

  const handleObservar = async (sectorClave, sectorNombre) => {
    setSwitching(sectorClave);
    try {
      // Cambiar el sector del usuario actual — esto lo "mete" dentro del sector
      await base44.auth.updateMe({ sector_id: sectorClave });
      toast.success(`Ingresaste al sector: ${sectorNombre}`, { duration: 3000 });
      // Navegar al dashboard para ver los datos del sector
      navigate('/');
      // Recargar para que todos los contextos (auth, queries) se refresquen
      setTimeout(() => window.location.reload(), 500);
    } catch (e) {
      toast.error('Error al cambiar de sector: ' + (e.message || ''));
      setSwitching(null);
    }
  };

  const handleVerResumen = async (sectorClave) => {
    setObservando(sectorClave);
    setObsData(null);
    setObsLoading(true);
    try {
      const res = await base44.functions.invoke('observarSector', { sector_id: sectorClave });
      setObsData(res.data);
    } catch (e) {
      toast.error('Error al observar sector: ' + (e.message || ''));
    } finally {
      setObsLoading(false);
    }
  };

  const toggleActivo = async (sector) => {
    try {
      await base44.entities.Sector.update(sector.id, { activo: !sector.activo });
      loadSectores();
    } catch (e) {
      toast.error('Error al actualizar sector');
    }
  };

  const currentSectorId = currentUser?.sector_id || currentUser?.data?.sector_id || employeeSector || 'escuela';

  const entityLabels = {
    WorkOrder: 'Órdenes de Trabajo', Employee: 'Empleados', Certificado: 'Certificados',
    SolicitudCertificado: 'Solicitudes', ObraCertificacion: 'Obras (Certificación)',
    AbonoMaestro: 'Abonos Maestros', Edificio: 'Edificios', LocationData: 'Ubicaciones',
    Tablet: 'Tablets', OrdenRutina: 'Órdenes de Rutina', InspeccionColegio: 'Inspecciones',
    EquipamientoCalefaccion: 'Equipos Calefacción', ForoHilo: 'Hilos Foro',
    ForoNotificacion: 'Notificaciones Foro', RutinaEdificio: 'Rutinas por Edificio'
  };

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Acceso restringido a administradores</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Sectores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona unidades de negocio. Usá <strong>Observar</strong> para ingresar completamente a un sector.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" /> Nuevo Sector
        </Button>
      </div>

      {/* Indicador de sector actual */}
      <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-center gap-3">
        <div className="text-2xl">
          {sectores.find(s => s.clave === currentSectorId)?.icono || '🏢'}
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Sector activo</p>
          <p className="font-bold text-lg">
            {sectores.find(s => s.clave === currentSectorId)?.nombre || currentSectorId}
          </p>
        </div>
        <Badge variant="default" className="text-xs">Estás aquí</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="skeleton h-44 rounded-xl" />)
        ) : sectores.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No hay sectores creados. Creá el primero.
          </div>
        ) : (
          sectores.map(s => {
            const isCurrent = s.clave === currentSectorId;
            return (
              <Card key={s.id} className={`card-lift ${isCurrent ? 'border-primary border-2' : ''}`}>
                <CardHeader className="flex flex-row items-center gap-3 pb-3">
                  <div className="text-3xl">{s.icono || '🏢'}</div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="truncate">{s.nombre}</span>
                      {isCurrent && <Badge variant="default" className="text-xs">Actual</Badge>}
                      {!isCurrent && !s.activo && <Badge variant="secondary" className="text-xs">Inactivo</Badge>}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground font-mono">{s.clave}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {s.descripcion && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{s.descripcion}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border border-border" style={{ background: s.color }} />
                    <span className="text-xs text-muted-foreground font-mono">{s.color}</span>
                    {s.config && Object.keys(s.config).length > 0 && (
                      <Badge variant="outline" className="text-xs ml-auto">
                        {Object.keys(s.config).length} config
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant={isCurrent ? "secondary" : "default"}
                      disabled={isCurrent || switching === s.clave || !s.activo}
                      onClick={() => handleObservar(s.clave, s.nombre)}
                    >
                      {switching === s.clave ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <LogIn className="w-4 h-4" />
                      )}
                      {isCurrent ? 'En este sector' : 'Observar'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleVerResumen(s.clave)}>
                      <Eye className="w-4 h-4" /> Resumen
                    </Button>
                    {!isCurrent && (
                      <div className="flex items-center gap-1.5 ml-auto text-xs text-muted-foreground">
                        <Switch checked={s.activo} onCheckedChange={() => toggleActivo(s)} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Dialog Observar (resumen) */}
      <Dialog open={!!observando} onOpenChange={(open) => { if (!open) { setObservando(null); setObsData(null); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" /> Resumen: {observando}
            </DialogTitle>
          </DialogHeader>
          {obsLoading ? (
            <div className="py-8 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !obsData ? (
            <div className="py-8 text-center text-muted-foreground">Sin datos</div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">Usuarios asignados</span>
                </div>
                <p className="text-2xl font-bold">{obsData.usuarios?.total ?? 0}</p>
                {obsData.usuarios?.recientes?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {obsData.usuarios.recientes.map(u => (
                      <Badge key={u.id} variant="secondary" className="text-xs">{u.nombre} ({u.rol})</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                {Object.entries(obsData.resumen || {}).map(([entity, info]) => (
                  <div key={entity} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">{entityLabels[entity] || entity}</span>
                    <div className="flex items-center gap-3">
                      {info.error ? (
                        <Badge variant="destructive" className="text-xs">error</Badge>
                      ) : (
                        <>
                          <Badge variant={info.total > 0 ? 'default' : 'secondary'} className="text-xs">
                            {info.total} {info.total === 1 ? 'registro' : 'registros'}
                          </Badge>
                          {info.total > 0 && info.recientes[0]?.updated_date && (
                            <span className="text-xs text-muted-foreground">
                              últ. {new Date(info.recientes[0].updated_date).toLocaleDateString('es-AR')}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Crear */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Sector</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Clave (identificador único)</Label>
              <Input
                value={form.clave}
                onChange={e => setForm({ ...form, clave: e.target.value })}
                placeholder="ej: bapro, sanidad, camara"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se usará como sector_id en todos los registros. Sin espacios, minúsculas.
              </p>
            </div>
            <div>
              <Label>Nombre visible</Label>
              <Input
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="ej: Banco Provincia"
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input
                value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Alcance del sector"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Color</Label>
                <input
                  type="color"
                  value={form.color}
                  onChange={e => setForm({ ...form, color: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-transparent cursor-pointer"
                />
              </div>
              <div>
                <Label>Icono (emoji)</Label>
                <Input
                  value={form.icono}
                  onChange={e => setForm({ ...form, icono: e.target.value })}
                  maxLength={2}
                />
              </div>
            </div>
            <div>
              <Label>Configuración personalizable (JSON)</Label>
              <Textarea
                value={form.config}
                onChange={e => setForm({ ...form, config: e.target.value })}
                className="font-mono text-xs"
                rows={4}
                placeholder='{"comunas": ["8A","8B","10A"], "rubros": ["EDUCACION"]}'
              />
              <p className="text-xs text-muted-foreground mt-1">
                Define las reglas de negocio propias del sector (comunas, rubros, plantillas, etc.).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCrear} disabled={saving}>
              {saving ? 'Creando...' : 'Crear Sector'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}