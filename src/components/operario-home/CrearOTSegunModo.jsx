import React from 'react';
import { Navigate } from 'react-router-dom';
import { useModoOperario } from '@/hooks/useModoOperario';

/**
 * Envuelve /crear-ot. Con modo_operario encendido lleva a "Proponer OT";
 * apagado devuelve la pantalla de siempre sin tocar nada.
 */
export default function CrearOTSegunModo({ children }) {
  if (useModoOperario()) return <Navigate to="/proponer-ot" replace />;
  return children;
}