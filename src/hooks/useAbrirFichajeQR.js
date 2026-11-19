import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { puedeFicharConCuenta } from '@/lib/fichajeCuenta';
import { irAFichajePublico } from '@/lib/modoOperario';

// QR de fichaje escaneado dentro de la app: operario con ficha → fichar con cuenta;
// cualquier otro caso → fichaje público, igual que antes.
export function useAbrirFichajeQR() {
  const navigate = useNavigate();
  const { isAuthenticated, hasEmployeeRecord, userPermissions } = useAuth();
  return useCallback((locId) => {
    if (puedeFicharConCuenta({ isAuthenticated, hasEmployeeRecord, userPermissions })) {
      navigate(`/fichar-cuenta?loc=${encodeURIComponent(locId)}`);
      return;
    }
    irAFichajePublico(locId);
  }, [navigate, isAuthenticated, hasEmployeeRecord, userPermissions]);
}