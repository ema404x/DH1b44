import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { lazyPages } from '@/lib/lazyPages';
import FichajeCard from '@/components/operario-home/FichajeCard';

const { FicharCuenta } = lazyPages;

function Marco({ children }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed left-0 right-0 top-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-lg">
        <WifiOff className="h-3.5 w-3.5 shrink-0" /> Sin conexión · solo fichaje
      </div>
      <main className="px-4 pb-8 pt-14">{children}</main>
    </div>
  );
}

/**
 * La app abrió sin red para un operario habilitado a fichar sin conexión que
 * no tiene el modo sin conexión de lectura: solo Fichar, el escáner y fichar-cuenta.
 * Al volver la señal, AuthContext sale de este modo y se ve la app de siempre.
 */
export default function FichajeSinConexionApp() {
  return (
    <Routes>
      <Route path="/fichar-cuenta" element={<Marco><FicharCuenta /></Marco>} />
      <Route path="*" element={(
        <Marco>
          <div className="mx-auto flex w-full max-w-md flex-col gap-5 page-enter">
            <FichajeCard />
          </div>
        </Marco>
      )} />
    </Routes>
  );
}