import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isModoOperario } from '@/lib/modoOperario';

/**
 * Envuelve la ruta "/". Con modo_operario encendido lleva a /operario;
 * apagado devuelve la pantalla de siempre sin tocar nada.
 */
export default function InicioSegunModo({ children }) {
  const { user } = useAuth();
  if (isModoOperario(user)) return <Navigate to="/operario" replace />;
  return children;
}