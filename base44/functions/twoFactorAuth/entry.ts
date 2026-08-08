import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { crypto } from 'https://deno.land/std@0.208.0/crypto/mod.ts';

// Genera secret TOTP en base32 estándar (RFC 4648: A-Z, 2-7)
function generateSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 0x1f];
  return out.slice(0, 32);
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

// Base32 decode (RFC 4648) — los secretos TOTP vienen en base32
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(str) {
  const cleaned = (str || '').replace(/[^A-Za-z2-7]/g, '').toUpperCase();
  const bytes = [];
  let buffer = 0, bits = 0;
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    buffer = (buffer << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

// TOTP (RFC 6238) con HMAC-SHA1 — valida el código contra el secreto y la
// marca de tiempo actual, con una ventana de tolerancia de ±30s por desfase.
async function computeTOTP(secretBytes, counter) {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setUint32(4, counter); // big-endian, low 32 bits
  const key = await crypto.subtle.importKey(
    'raw', secretBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) |
                 ((hmac[offset + 1] & 0xff) << 16) |
                 ((hmac[offset + 2] & 0xff) << 8) |
                 (hmac[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, '0');
}

async function verifyTOTP(secret, token) {
  if (!secret || !token || !/^\d{6}$/.test(String(token))) return false;
  const secretBytes = base32Decode(secret);
  if (secretBytes.length === 0) return false;
  const counter = Math.floor(Date.now() / 30000);
  for (let delta = -1; delta <= 1; delta++) {
    if (await computeTOTP(secretBytes, counter + delta) === String(token)) return true;
  }
  return false;
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

      const verified = await verifyTOTP(twoFactor[0].secret, token);
      
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