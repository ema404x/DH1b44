import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Pencil, Trash2, Phone, Mail, QrCode, MapPin, Building2,
  CheckCircle2, XCircle, RefreshCw, Signature
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import StatusBadge from '@/components/shared/StatusBadge';

const roleBadgeColors = {
  jefe_sitio: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
  inspector:  'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
  supervisor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  gerente:    'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  admin:      'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  tecnico:    'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  operario:   'bg-slate-500/20 text-slate-300 border border-slate-500/30',
};

const comunaColors = {
  '8A':  'bg-emerald-500/20 text-emerald-300',
  '8B':  'bg-sky-500/20 text-sky-300',
  '10A': 'bg-orange-500/20 text-orange-300',
};

const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

/**
 * Determina el estado de vinculación de un empleado.
 * @returns {{ level: 'ok'|'error', label: string, detail: string }}
 */
export function getLinkStatus(emp, users = [], rolePermissions = []) {
  if (!emp.email?.trim()) {
    return { level: 'error', label: 'Sin email', detail: 'No tiene email configurado, no puede ingresar' };
  }
  const platformUser = emp.user_id ? users.find(u => u.id === emp.user_id) : null;
  if (!emp.user_id) {
    return { level: 'error', label: 'Sin vincular', detail: 'Tiene email pero no está vinculado a un usuario de plataforma' };
  }
  if (!platformUser) {
    return { level: 'error', label: 'Usuario roto', detail: 'El user_id no corresponde a un usuario activo en la plataforma' };
  }
  if (platformUser.email?.toLowerCase().trim() !== emp.email?.toLowerCase().trim()) {
    return { level: 'error', label: 'Email no coincide', detail: `Email de plataforma (${platformUser.email}) no coincide con la ficha (${emp.email})` };
  }
  // Verificar que el rol tenga permisos configurados
  if (emp.role && rolePermissions.length > 0) {
    const roleNorm = emp.role.toLowerCase().trim();
    const hasRolePerm = rolePermissions.some(rp => rp.role_name?.toLowerCase().trim() === roleNorm);
    if (!hasRolePerm) {
      return { level: 'error', label: 'Sin permisos', detail: `El rol "${emp.role}" no tiene permisos configurados en Control de Acceso` };
    }
  }
  return { level: 'ok', label: 'Vinculado', detail: 'Puede ingresar al sistema correctamente' };
}

const sectorBadgeColors = {
  bapro:   'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  escuela: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
};

export default function EmployeeCard({
  emp, canEdit, canDelete, roleLabel, roleBadgeClass, sectorLabel, item, users, rolePermissions, onEdit, onDelete, onQR, onRelink, isRelinking, onSign
}) {
  const linkStatus = getLinkStatus(emp, users, rolePermissions);
  const hasIssue = linkStatus.level === 'error';

  return (
    <motion.div key={emp.id} variants={item}>
      <Card className={`group border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur hover:shadow-xl transition-all border-l-4 ${
        hasIssue
          ? 'border-l-red-500 hover:shadow-red-500/20'
          : 'border-l-emerald-500 hover:shadow-cyan-500/20'
      } border-y border-r border-slate-700/50`}>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 flex-shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-semibold">{getInitials(emp.full_name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-white">{emp.full_name}</p>
                  {sectorLabel && (
                    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium mt-1 ${sectorBadgeColors[emp.sector_id] || 'bg-slate-500/20 text-slate-300 border border-slate-500/30'}`}>
                      <Building2 className="h-2.5 w-2.5" />
                      {sectorLabel}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium ${roleBadgeClass}`}>
                      {roleLabel}
                    </span>
                    {emp.assigned_comuna && (
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${comunaColors[emp.assigned_comuna] || 'bg-slate-500/20 text-slate-300'}`}>
                        <MapPin className="h-2.5 w-2.5" />
                        {emp.assigned_comuna}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-cyan-400 hover:text-cyan-300" onClick={() => onQR(emp)} title="QR de fichaje">
                    <QrCode className="h-3.5 w-3.5" />
                  </Button>
                  {canEdit && (
                    <Button variant="ghost" size="icon" className={`h-7 w-7 ${emp.firma_url ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-400 hover:text-emerald-300'}`} onClick={() => onSign(emp)} title="Cargar firma">
                      <Signature className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => onEdit(emp)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar empleado?</AlertDialogTitle>
                          <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(emp.id)}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge value={emp.status || 'activo'} />
                {hasIssue ? (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30"
                    title={linkStatus.detail}
                  >
                    <XCircle className="h-2.5 w-2.5" /> {linkStatus.label}
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                    title={linkStatus.detail}
                  >
                    <CheckCircle2 className="h-2.5 w-2.5" /> {linkStatus.label}
                  </span>
                )}
                {hasIssue && canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isRelinking}
                    onClick={() => onRelink(emp)}
                    className="h-5 px-1.5 text-[10px] gap-1 text-amber-400 hover:text-amber-300"
                  >
                    <RefreshCw className={`h-2.5 w-2.5 ${isRelinking ? 'animate-spin' : ''}`} />
                    Re-vincular
                  </Button>
                )}
              </div>

              {emp.assigned_location && (
                <p className="text-xs text-cyan-400 mt-2 flex items-center gap-1">
                  <MapPin className="h-3 w-3 flex-shrink-0" />{emp.assigned_location}
                </p>
              )}
              {emp.assigned_jefe_sitio && emp.role !== 'jefe_sitio' && (
                <p className="text-xs text-violet-400 mt-1 flex items-center gap-1">
                  <Building2 className="h-3 w-3 flex-shrink-0" />Jefe: {emp.assigned_jefe_sitio}
                </p>
              )}

              <div className="mt-3 space-y-1">
                {emp.phone && <p className="text-xs text-slate-400 flex items-center gap-1.5"><Phone className="h-3 w-3" />{emp.phone}</p>}
                {emp.email && <p className="text-xs text-slate-400 flex items-center gap-1.5"><Mail className="h-3 w-3" />{emp.email}</p>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}