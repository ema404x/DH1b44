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
    setProgreso({ hechas: 0, total: pendientes || 0 });
    try {
      while (!parar.current) {
        const r = await revisarUbicaciones('geocodificar');
        hechas += r.procesadas || 0;
        setRestantes(r.restantes);
        setProgreso({ hechas, total: hechas + (r.restantes || 0) });
        onTanda();
        if (r.detenido) { toast.error(r.detenido); break; }
        if (!r.restantes || !r.procesadas) break;
      }
    } catch (e) {
      toast.error(`${errorTexto(e)}. Lo buscado quedó guardado: podés retomar.`);
      onTanda();
    } finally {
      setCorriendo(false);
    }
  };

  return { corriendo, restantes, progreso, iniciar, detener: () => { parar.current = true; } };
}