import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { revisarUbicaciones, errorTexto } from './api';

// Busca direcciones en tandas, una tanda por vez (el servidor espera 1 s entre consultas).
export default function useGeocodificar(onTanda) {
  const [corriendo, setCorriendo] = useState(false);
  const [restantes, setRestantes] = useState(null);
  const parar = useRef(false);

  const iniciar = async () => {
    parar.current = false;
    setCorriendo(true);
    try {
      while (!parar.current) {
        const r = await revisarUbicaciones('geocodificar');
        setRestantes(r.restantes);
        onTanda();
        if (r.detenido) { toast.error(r.detenido); break; }
        if (!r.restantes || !r.procesadas) break;
      }
    } catch (e) {
      toast.error(errorTexto(e));
    } finally {
      setCorriendo(false);
    }
  };

  return { corriendo, restantes, iniciar, detener: () => { parar.current = true; } };
}