import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PortalOperarioApp from '@/pages/PortalOperarioApp';
import OperarioHeader from '@/components/operario-home/OperarioHeader';
import FichajeCard from '@/components/operario-home/FichajeCard';
import AccesosOperario from '@/components/operario-home/AccesosOperario';
import EmergenciaRapidaDialog from '@/components/operario-home/EmergenciaRapidaDialog';
import { abrirEscanerOperario } from '@/lib/modoOperario';

/**
 * Inicio operario (/operario) — pantalla de inicio del "Modo operario (beta)".
 * Las OT, sus acciones, el escáner y el soporte sin conexión son los de
 * PortalOperarioApp en su variante compacta: misma consulta, mismo caché y misma cola.
 */
export default function OperarioHome() {
  const location = useLocation();
  const navigate = useNavigate();
  const [emergenciaOpen, setEmergenciaOpen] = useState(false);

  // Llegada desde "Escanear" de la barra inferior estando en otra pantalla.
  useEffect(() => {
    if (!location.state?.escanear) return;
    abrirEscanerOperario();
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 page-enter">
      <OperarioHeader />
      <FichajeCard />
      <AccesosOperario onEmergencia={() => setEmergenciaOpen(true)} />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Mis OT</h2>
        <PortalOperarioApp compacto />
      </section>

      <EmergenciaRapidaDialog open={emergenciaOpen} onOpenChange={setEmergenciaOpen} />
    </div>
  );
}