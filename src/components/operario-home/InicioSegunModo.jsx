import React from 'react';
import { Navigate } from 'react-router-dom';
import { useModoOperario } from '@/hooks/useModoOperario';

/**
 * Envuelve la ruta "/". Con modo_operario encendido lleva a /operario;
 * apagado devuelve la pantalla de siempre sin tocar nada.
 */
export default function InicioSegunModo({ children }) {
  if (useModoOperario()) return <Navigate to="/operario" replace />;
  return children;
}