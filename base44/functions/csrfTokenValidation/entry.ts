import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { crypto } from 'https://deno.land/std@0.208.0/crypto/mod.ts';

const csrfTokens = new Map(); // En producción, usar base44 entities

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, token } = await req.json();

  try {
    if (action === 'generate') {
      const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
      const tokenHex = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      
      csrfTokens.set(tokenHex, {
        user: user.email,
        created: Date.now(),
        used: false
      });

      // Limpiar tokens viejos (>1 hora)
      for (const [key, value] of csrfTokens) {
        if (Date.now() - value.created > 3600000) {
          csrfTokens.delete(key);
        }
      }

      return Response.json({ token: tokenHex });
    }
    else if (action === 'validate') {
      const tokenData = csrfTokens.get(token);
      
      if (!tokenData || tokenData.user !== user.email || tokenData.used) {
        return Response.json({ valid: false }, { status: 403 });
      }

      if (Date.now() - tokenData.created > 3600000) {
        csrfTokens.delete(token);
        return Response.json({ valid: false }, { status: 403 });
      }

      tokenData.used = true;
      return Response.json({ valid: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});