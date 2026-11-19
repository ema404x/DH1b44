import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { revisarUbicaciones, errorTexto } from './api';

// Busca direcciones por tandas (máx. 15 por llamada; el servidor espera 1 s entre consultas).
// Lo ya buscado queda en caché, así que si se corta se puede retomar.
export default function useGeocodificar(onTanda) {
  const [corriendo, setCorriendo] = useState(false);
  const [restantes, setRestantes] = useState(null);
  const [progreso, setProgreso] = useState({ hechas: 0, total: 0 });
  const parar = useRef(false);

  const iniciar = async (pendientes) => {
    parar.current = false;
    setCorriendo(true);
    let hechas = 0;
    let fallidas = 0;
    setProgreso({ hechas: 0, total: pendientes || 0, fallidas: 0, detenido: null });
    try {
      while (!parar.current) {
        const r = await revisarUbicaciones('geocodificar');
        if (r.ok === false) {
          toast.error(`${r.error}. Lo buscado quedó guardado: podés seguir con el botón.`);
          onTanda();
          break;
        }
        hechas += r.procesadas || 0;
        fallidas += r.fallidas || 0;
        setRestantes(r.restantes);
        setProgreso({ hechas, total: hechas + (r.restantes || 0), fallidas, detenido: r.detenido || null });
        onTanda();
        if (r.detenido) { toast.error(`${r.detenido} Podés seguir con el botón.`); break; }
        if (!r.restantes || !r.procesadas) {
          if (r.fallidas) toast.warning(`${fallidas} direcciones no respondieron a tiempo. Podés reintentarlas con el botón.`);
          break;
        }
      }
      if (fallidas > 0 && !parar.current) toast.message(`Búsqueda terminada con ${fallidas} consultas fallidas; quedaron pendientes para reintentar.`);
    } catch (e) {
      toast.error(`${errorTexto(e)}. Lo buscado quedó guardado: podés retomar.`);
      onTanda();
    } finally {
      setCorriendo(false);
    }
  };

  return { corriendo, restantes, progreso, iniciar, detener: () => { parar.current = true; } };
}