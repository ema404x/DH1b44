import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

export default function HistorialAcumulados({ adaNumero, ocNumero, contraista, montoContratado }) {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adaNumero) {
      setLoading(false);
      return;
    }

    const cargarHistorial = async () => {
      try {
        // Buscar certificados aprobados/emitidos de la misma ADA, excluir borradores
        const todosCerts = await base44.entities.Certificado.filter({ ada_numero: adaNumero });
        const filtrados = todosCerts
          .filter(c => c.estado !== 'borrador')
          .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        setCerts(filtrados);
      } catch (e) {
        console.error('Error cargando historial:', e);
      } finally {
        setLoading(false);
      }
    };

    cargarHistorial();
  }, [adaNumero]);

  if (loading) return null;
  if (!certs.length) return null;

  const totalCertificado = certs.reduce((acc, c) => acc + (c.subtotal || 0), 0);
  const pct = montoContratado > 0 ? (totalCertificado / montoContratado) * 100 : 0;

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="font-semibold text-sm text-emerald-900 mb-2">Histórico de Certificaciones</div>
          <div className="space-y-1.5">
            {certs.map((cert, idx) => (
              <div key={cert.id} className="flex justify-between text-xs text-emerald-800 bg-white/50 px-2 py-1 rounded">
                <span>
                  <strong>Cert. {idx + 1}</strong> ({new Date(cert.created_date).toLocaleDateString('es-AR')})
                </span>
                <span className="font-semibold">{fmt(cert.subtotal || 0)}</span>
              </div>
            ))}
            <div className="border-t border-emerald-200 pt-1 flex justify-between text-xs font-bold text-emerald-900">
              <span>Total acumulado:</span>
              <span>{fmt(totalCertificado)}</span>
            </div>
            <div className="flex justify-between text-xs text-emerald-700">
              <span>Falta certificar:</span>
              <span>{fmt(Math.max(0, montoContratado - totalCertificado))}</span>
            </div>
            <div className="flex justify-between text-xs font-semibold text-emerald-900">
              <span>% certificado:</span>
              <span>{pct.toFixed(1)}%</span>
            </div>
          </div>
          {pct >= 100 && (
            <div className="mt-2 text-xs bg-emerald-100 text-emerald-900 px-2 py-1 rounded font-semibold">
              ✓ OC completamente certificada
            </div>
          )}
        </div>
      </div>
    </div>
  );
}