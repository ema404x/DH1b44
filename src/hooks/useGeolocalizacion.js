/**
 * Hook para capturar geolocalización del dispositivo.
 * Retorna una función `capturar()` que devuelve los campos GPS listos para guardar en WorkOrder.
 */
export function useGeolocalizacion() {
  const capturar = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ gps_status: 'no_disponible' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            gps_latitude:  pos.coords.latitude,
            gps_longitude: pos.coords.longitude,
            gps_accuracy:  Math.round(pos.coords.accuracy),
            gps_timestamp: new Date().toISOString(),
            gps_status:    'capturado',
          });
        },
        () => {
          resolve({ gps_status: 'denegado' });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });

  return { capturar };
}