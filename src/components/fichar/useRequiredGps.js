import { useCallback, useEffect, useState } from 'react';

export default function useRequiredGps() {
  const [gps, setGps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestGps = useCallback(() => {
    setGps(null);
    setError('');
    setLoading(true);
    return new Promise(resolve => {
      const fail = message => {
        setError(message);
        setLoading(false);
        resolve(null);
      };
      if (!navigator.geolocation) {
        fail('Este dispositivo no permite obtener tu ubicación. No podés fichar sin GPS.');
        return;
      }
      navigator.geolocation.getCurrentPosition(position => {
        const coordinates = { lat: position.coords.latitude, lng: position.coords.longitude };
        setGps(coordinates);
        setLoading(false);
        resolve(coordinates);
      }, failure => {
        fail(failure.code === 1
          ? 'Para fichar, activá la ubicación del dispositivo y permití el acceso a este sitio en el navegador.'
          : 'No se pudo obtener tu ubicación. Activá el GPS y volvé a intentar para poder fichar.');
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    });
  }, []);
  useEffect(() => { requestGps(); }, [requestGps]);
  return { gps, loading, error, requestGps };
}