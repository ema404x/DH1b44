import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const rateLimitStore = new Map(); // En producción, usar Redis

function isRateLimited(identifier, maxAttempts = 10, windowSeconds = 60) {
  const now = Date.now();
  const key = identifier;
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, []);
  }

  const timestamps = rateLimitStore.get(key);
  const recentTimestamps = timestamps.filter(t => now - t < windowSeconds * 1000);

  if (recentTimestamps.length >= maxAttempts) {
    return { limited: true, remainingSeconds: Math.ceil((recentTimestamps[0] + windowSeconds * 1000 - now) / 1000) };
  }

  recentTimestamps.push(now);
  rateLimitStore.set(key, recentTimestamps);

  return { limited: false };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { endpoint, maxAttempts = 10, windowSeconds = 60 } = await req.json();

  try {
    const identifier = `${user.email}:${endpoint}`;
    const result = isRateLimited(identifier, maxAttempts, windowSeconds);

    if (result.limited) {
      await base44.functions.invoke('logAudit', {
        entity_type: 'RateLimit',
        entity_id: identifier,
        action: 'update',
        notes: `Rate limit activado para ${identifier}`
      });

      return Response.json({
        limited: true,
        message: `Demasiados intentos. Intenta de nuevo en ${result.remainingSeconds}s`,
        remainingSeconds: result.remainingSeconds
      }, { status: 429 });
    }

    return Response.json({ limited: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});