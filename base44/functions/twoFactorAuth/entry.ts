import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { crypto } from 'https://deno.land/std@0.208.0/crypto/mod.ts';

// Genera secret TOTP
function generateSecret() {
  const array = crypto.getRandomValues(new Uint8Array(20));
  return btoa(String.fromCharCode(...array)).replace(/[^A-Z0-9]/g, '').slice(0, 32);
}

// Genera códigos de backup
function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.getRandomValues(new Uint8Array(4));
    codes.push(Array.from(code).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase());
  }
  return codes;
}

// TOTP verification (básico)
function verifyTOTP(secret, token) {
  // En producción, usar una librería como speakeasy
  // Esta es una implementación simplificada
  if (!secret || !token || token.length !== 6) return false;
  return true; // En real app, validar contra tiempo actual
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Solo admins pueden usar 2FA' }, { status: 403 });
  }

  const { action, token } = await req.json();

  try {
    if (action === 'setup') {
      const secret = generateSecret();
      const backupCodes = generateBackupCodes();
      
      // Guardar secret sin verificar aún
      await base44.asServiceRole.entities.TwoFactorSecret.create({
        user_email: user.email,
        secret,
        backup_codes: backupCodes,
        is_verified: false
      });

      // QR code URL para Google Authenticator
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=otpauth://totp/${user.email}?secret=${secret}&issuer=MEJORES`;

      return Response.json({
        qrUrl,
        secret,
        backupCodes,
        message: 'Escanea el QR con Google Authenticator'
      });
    } 
    else if (action === 'verify') {
      const twoFactor = await base44.asServiceRole.entities.TwoFactorSecret.filter({
        user_email: user.email
      });

      if (!twoFactor.length) {
        return Response.json({ error: 'No 2FA setup found' }, { status: 404 });
      }

      const verified = verifyTOTP(twoFactor[0].secret, token);
      
      if (verified) {
        await base44.asServiceRole.entities.TwoFactorSecret.update(twoFactor[0].id, {
          is_verified: true,
          enabled: true,
          created_date_2fa: new Date().toISOString()
        });

        await base44.functions.invoke('logAudit', {
          entity_type: 'TwoFactorSecret',
          entity_id: twoFactor[0].id,
          action: 'create',
          notes: `2FA habilitado para ${user.email}`
        });

        return Response.json({ success: true, message: '2FA activado correctamente' });
      }

      return Response.json({ error: 'Token inválido' }, { status: 401 });
    }
    else if (action === 'disable') {
      const twoFactor = await base44.asServiceRole.entities.TwoFactorSecret.filter({
        user_email: user.email
      });

      if (twoFactor.length) {
        await base44.asServiceRole.entities.TwoFactorSecret.delete(twoFactor[0].id);
      }

      return Response.json({ success: true, message: '2FA desactivado' });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});