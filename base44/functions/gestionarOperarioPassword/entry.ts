import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Salt fijo para la clave compartida de operario (kiosko/tablet). No es por
// usuario (es un secreto compartido); el threat model es atacante anónimo, no
// un admin con acceso a DB (ese ya tiene la app). El hash evita guardar el
// texto plano y permite rotar la clave sin redeploy.
const OPERARIO_SALT = 'b44-operario-salt-v1';

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Solo administradores pueden gestionar la clave de operario' }, { status: 403 });
  }

  const { action, password } = await req.json();

  try {
    // ── set: hashear y guardar (upsert del registro único) ──
    if (action === 'set') {
      if (!password || String(password).length < 4) {
        return Response.json({ error: 'La clave debe tener al menos 4 caracteres' }, { status: 400 });
      }
      const hash = await sha256Hex(String(password) + OPERARIO_SALT);
      const now = new Date().toISOString();
      const existing = await base44.asServiceRole.entities.SecurityConfig.list().catch(() => []);

      let record;
      if (existing.length > 0) {
        record = await base44.asServiceRole.entities.SecurityConfig.update(existing[0].id, {
          operario_password_hash: hash,
          operario_password_updated_at: now,
          operario_password_updated_by: user.email,
        });
      } else {
        record = await base44.asServiceRole.entities.SecurityConfig.create({
          operario_password_hash: hash,
          operario_password_updated_at: now,
          operario_password_updated_by: user.email,
        });
      }

      // Audit log (best-effort)
      await base44.functions.invoke('logAudit', {
        entity_type: 'SecurityConfig',
        entity_id: record.id,
        action: 'update',
        notes: `Clave de operario actualizada por ${user.email}`,
      }).catch(() => {});

      return Response.json({ success: true });
    }

    // ── status: si hay clave configurada y cuándo se actualizó (sin exponer el hash) ──
    if (action === 'status') {
      const existing = await base44.asServiceRole.entities.SecurityConfig.list().catch(() => []);
      const rec = existing[0];
      return Response.json({
        configured: !!rec?.operario_password_hash,
        updated_at: rec?.operario_password_updated_at || null,
        updated_by: rec?.operario_password_updated_by || null,
      });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});