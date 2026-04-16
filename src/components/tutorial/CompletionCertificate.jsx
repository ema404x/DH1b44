import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function CompletionCertificate({ module, userName, onClose }) {
  const certRef = useRef();

  const downloadCertificate = async () => {
    const canvas = await html2canvas(certRef.current, {
      backgroundColor: '#ffffff',
      scale: 2,
    });
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Certificado-${module.title.replace(/\s+/g, '-')}.pdf`);
  };

  const shareCertificate = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Certificado: ${module.title}`,
          text: `He completado el módulo "${module.title}" en DH1 Software`,
        });
      } catch (err) {
        console.log('Error compartiendo:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-3xl shadow-2xl">
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Certificado */}
        <div
          ref={certRef}
          className="bg-gradient-to-br from-slate-50 to-slate-100 p-12 text-center"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.1) 0%, transparent 50%)
            `,
          }}
        >
          {/* Borde decorativo */}
          <div className="border-2 border-primary/30 rounded-lg p-10 inline-block">
            {/* Encabezado */}
            <div className="mb-8">
              <p className="text-primary font-semibold text-lg tracking-widest uppercase">
                Certificado de Logro
              </p>
            </div>

            {/* Contenido principal */}
            <div className="space-y-6">
              <p className="text-slate-600 text-base">Este certificado se otorga a</p>

              <h2 className="text-4xl font-bold text-slate-900">{userName}</h2>

              <div className="border-b-2 border-primary/20 py-4">
                <p className="text-slate-600 text-sm mb-2">Por haber completado exitosamente</p>
                <p className="text-2xl font-semibold text-primary">{module.title}</p>
                <p className="text-slate-500 text-sm mt-2">{module.steps.length} pasos completados</p>
              </div>

              {/* Firma y fecha */}
              <div className="flex justify-between items-end pt-6">
                <div>
                  <div className="h-12 w-32 border-t-2 border-slate-400"></div>
                  <p className="text-xs text-slate-600 mt-2">DH1 Software</p>
                </div>
                <p className="text-sm text-slate-600">
                  {format(new Date(), 'd \'de\' MMMM \'de\' yyyy', { locale: es })}
                </p>
              </div>
            </div>
          </div>

          {/* Insignia/icono */}
          <div className="mt-8">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mx-auto">
              <span className="text-3xl">🏆</span>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="p-6 border-t border-border flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            onClick={downloadCertificate}
            className="gap-2"
          >
            <Download className="h-4 w-4" /> Descargar PDF
          </Button>
          <Button
            onClick={shareCertificate}
            className="gap-2"
          >
            <Share2 className="h-4 w-4" /> Compartir
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
          >
            Cerrar
          </Button>
        </div>
      </Card>
    </div>
  );
}