import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isModoOperario } from '@/lib/modoOperario';

/**
 * Envuelve /crear-ot. Con modo_operario encendido lleva a "Proponer OT";
 * apagado devuelve la pantalla de siempre sin tocar nada.
 */
export default function CrearOTSegunModo({ children }) {
  const { user } = useAuth();
  if (isModoOperario(user)) return <Navigate to="/proponer-ot" replace />;
  return children;
}