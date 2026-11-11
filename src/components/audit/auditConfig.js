import { Plus, Edit3, Trash2, Eye, Shield } from 'lucide-react';

export const ACTION_CONFIG = {
  create: { label: 'Creación', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400', icon: Plus },
  update: { label: 'Edición', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', dot: 'bg-blue-400', icon: Edit3 },
  delete: { label: 'Eliminación', color: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-400', icon: Trash2 },
  view:   { label: 'Vista', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: 'bg-slate-400', icon: Eye },
  sign:   { label: 'Firma', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30', dot: 'bg-purple-400', icon: Shield },
};

export const ENTITY_LABELS = {
  WorkOrder: 'Orden de Trabajo', Certificado: 'Certificado', Employee: 'Empleado',
  Client: 'Proveedor', Project: 'Proyecto', SolicitudCertificado: 'Solicitud de Certificado',
  Emergencia: 'Emergencia', RolePermission: 'Permiso de Rol', AbonoMaestro: 'Abono Maestro',
  Material: 'Material', Asset: 'Activo', InspeccionColegio: 'Inspección',
  Pendiente: 'Pendiente', Informe: 'Informe', RequerimientoCompra: 'Requerimiento de Compra',
  OrdenRutina: 'Orden de Rutina', LocationQR: 'Ubicación', EquipamientoCalefaccion: 'Equipo de Calefacción',
  ObraCertificacion: 'Obra de Certificación', Direccion: 'Dirección', FichajeUbicacion: 'Fichaje',
};

export const PIE_COLORS = ['#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#94a3b8'];