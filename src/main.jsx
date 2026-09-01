import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { queryClientInstance } from '@/lib/query-client'
import { loadAllCacheEntries, validateShape } from '@/lib/persistCache'

// ── Hidratación PRE-RENDER (elimina el flash "0 → N" en cada recarga) ────────
// Antes, useSmartCache hidrataba desde IndexedDB en un useEffect (async,
// DESPUÉS del primer paint) → en cada recarga el header mostraba "0 órdenes"
// (default orders=[]) y luego saltaba al conteo real al llegar la hidratación.
// Hidratar acá, antes de render, hace que el primer paint ya muestre el conteo
// cacheado. El refetch en background (si la data pasó staleTime) swap a un dato
// fresco determinístico (mismo número, backend estable) SIN salto visible.
// Válido para ambos sectores: la query-key es la misma, el dato sectorial se
// persiste por separado naturalmente.
//
// BLINDAJE shape-safe (v3): sólo se hidratan entradas cuyo shape valida contra
// KEY_SHAPES. Una entrada envenenada (shape distinto al declarado) se descarta
// y el QueryClient refetchea fresco — nunca se inyecta un shape incorrecto en
// un consumidor. Cierra el TypeError: orders.filter is not a function.
async function bootstrap() {
  try {
    const entries = await loadAllCacheEntries();
    for (const entry of entries) {
      if (entry.data && validateShape(entry.queryKey, entry.data)) {
        queryClientInstance.setQueryData([entry.queryKey], entry.data, {
          updatedAt: entry.savedAt,
        });
      }
    }
  } catch (_) { /* fallo silencioso — la app arranca igual, useSmartCache hidrata luego */ }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
}

bootstrap();