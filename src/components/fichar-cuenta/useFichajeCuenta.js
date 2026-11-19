import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { nuevoOpId } from '@/lib/fichajeCuenta';

const invocar = async (payload) => (await base44.functions.invoke('ficharConCuenta', payload)).data || {};

// Estado (solo lectura) + confirmación con idempotencia: el mismo client_op_id
// se reutiliza en los reintentos hasta que el servidor confirme.
export default function useFichajeCuenta(locId) {
  const qc = useQueryClient();
  const opId = useRef(nuevoOpId());
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [errorEnvio, setErrorEnvio] = useState(null);

  const estado = useQuery({
    queryKey: ['fichar-cuenta', 'estado', locId],
    queryFn: () => invocar({ action: 'estado', locationId: locId }),
    enabled: Boolean(locId) && navigator.onLine,
    staleTime: 0,
    retry: false,
  });

  const confirmar = async (gps) => {
    if (enviando) return null;
    setEnviando(true);
    setErrorEnvio(null);
    try {
      const data = await invocar({
        action: 'fichar', locationId: locId, client_op_id: opId.current,
        latitude: gps.lat, longitude: gps.lng, accuracy: gps.accuracy,
        deviceInfo: navigator.userAgent,
      });
      if (data.ok) {
        setResultado(data);
        qc.invalidateQueries({ queryKey: ['fichar-cuenta'] });
      } else {
        setErrorEnvio({ code: data.code, mensaje: data.error || 'No se pudo registrar el fichaje.' });
      }
      return data;
    } catch {
      setErrorEnvio({ code: 'red', mensaje: 'No hay conexión con el servidor. Hace falta conexión para fichar con tu cuenta.' });
      return null;
    } finally {
      setEnviando(false);
    }
  };

  return { estado, confirmar, enviando, resultado, errorEnvio };
}