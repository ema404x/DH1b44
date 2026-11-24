import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { normalizeRole } from '../../shared/roles.ts';

// Un admin define la contraseña de la cuenta de un operario.
// La contraseña solo pasa en memoria hacia resetPassword: nunca se guarda ni se loguea.
// Flujo: invitar (o pedir restablecimiento) → tomar el token de la respuesta →
// resetPassword(token, nueva). Si la plataforma no devuelve token, se corta con error claro.

const pickToken = (res: any): string => {
  const d = res?.data ?? res ?? {};
  const t = d.reset_token || d.resetToken || d.token || d?.data?.reset_token || d?.data?.resetToken;
  return typeof t === 'string' ? t : '';
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo un administrador puede definir contraseñas' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const employeeId = typeof body.employeeId === 'string' ? body.employeeId.trim() : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (!employeeId) return Response.json({ error: 'Falta el empleado' }, { status: 400 });
    if (newPassword.length < 8) return Response.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });

    const emp = await base44.asServiceRole.entities.Employee.get(employeeId)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!emp) return Response.json({ error: 'Empleado no encontrado' }, { status: 404 });
    const email = (emp.email || '').toLowerCase().trim();
    if (!email) return Response.json({ error: 'El empleado no tiene email' }, { status: 400 });
    if (normalizeRole(emp.role) !== 'operario') {
      return Response.json({ error: 'Solo se puede definir la contraseña de empleados con cargo Operario' }, { status: 400 });
    }

    // 1) Invitar con rol "user". Si ya existe, pedir un nuevo restablecimiento.
    let token = '';
    try {
      token = pickToken(await base44.users.inviteUser(email, 'user'));
    } catch (_e) {
      token = '';
    }
    if (!token) {
      try {
        token = pickToken(await base44.auth.resetPasswordRequest(email));
      } catch (_e) {
        token = '';
      }
    }
    if (!token) {
      return Response.json({
        error: 'La plataforma no devuelve el token de restablecimiento a la app: solo lo envía por email al operario. '
          + 'Por eso no se puede fijar la contraseña desde aquí. El operario recibió un email para definirla él mismo.',
        code: 'TOKEN_NO_DISPONIBLE',
      }, { status: 501 });
    }

    // 2) Fijar la contraseña con el token.
    try {
      await base44.auth.resetPassword({ resetToken: token, newPassword });
    } catch (e) {
      const status = e?.status || e?.response?.status;
      return Response.json({
        error: 'La plataforma rechazó el cambio de contraseña' + (status ? ` (código ${status})` : '') + '.',
      }, { status: 502 });
    }

    // 3) Auditoría (sin la contraseña).
    await base44.asServiceRole.entities.AuditLog.create({
      entity_type: 'Employee',
      entity_id: emp.id,
      action: 'update',
      user_email: user.email,
      user_role: user.role,
      sector_id: emp.sector_id || null,
      timestamp: new Date().toISOString(),
      changed_fields: ['contraseña'],
      notes: `Contraseña definida por admin para ${emp.full_name || email} (${email})`,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Error interno al definir la contraseña' }, { status: 500 });
  }
}