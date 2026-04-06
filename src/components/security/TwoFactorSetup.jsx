import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, RefreshCw, Loader2, Shield } from 'lucide-react';
import { useState as useStateImport } from 'react';

export default function TwoFactorSetup() {
  const [step, setStep] = useState('idle'); // idle | qr | verify | done
  const [qrUrl, setQrUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [verifyToken, setVerifyToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [enabled2FA, setEnabled2FA] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('twoFactorAuth', { action: 'setup' });
      setQrUrl(res.data.qrUrl);
      setSecret(res.data.secret);
      setBackupCodes(res.data.backupCodes);
      setStep('qr');
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verifyToken.length !== 6) {
      alert('El token debe tener 6 dígitos');
      return;
    }
    setLoading(true);
    try {
      await base44.functions.invoke('twoFactorAuth', { action: 'verify', token: verifyToken });
      setStep('done');
      setEnabled2FA(true);
    } catch (err) {
      alert('Token inválido');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (confirm('¿Deshabilitar 2FA? Perderás acceso seguro.')) {
      try {
        await base44.functions.invoke('twoFactorAuth', { action: 'disable' });
        setEnabled2FA(false);
        setStep('idle');
      } catch (err) {
        alert('Error al deshabilitar 2FA');
      }
    }
  };

  if (enabled2FA) {
    return (
      <Card className="p-6 bg-green-50 border-green-200">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-6 w-6 text-green-600" />
          <h3 className="font-bold text-green-900">2FA Habilitado</h3>
        </div>
        <p className="text-sm text-green-800 mb-4">Tu cuenta está protegida con autenticación de dos factores.</p>
        <Button variant="outline" onClick={handleDisable} className="text-destructive hover:text-destructive">
          Deshabilitar 2FA
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {step === 'idle' && (
        <Card className="p-6">
          <h3 className="font-bold mb-2">Autenticación de Dos Factores (2FA)</h3>
          <p className="text-sm text-muted-foreground mb-4">Protege tu cuenta con un código de una sola vez generado por tu teléfono.</p>
          <Button onClick={handleSetup} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            Configurar 2FA
          </Button>
        </Card>
      )}

      {step === 'qr' && (
        <Card className="p-6">
          <h3 className="font-bold mb-4">Paso 1: Escanea el Código QR</h3>
          <div className="mb-4 p-4 bg-muted rounded-lg">
            <img src={qrUrl} alt="QR Code" className="w-48 h-48 mx-auto" />
          </div>
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 font-semibold mb-2">Códigos de Backup:</p>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, i) => (
                <code key={i} className="text-xs bg-white p-2 rounded border">{code}</code>
              ))}
            </div>
            <p className="text-xs text-yellow-700 mt-2">Guarda estos códigos en un lugar seguro. Los necesitarás si pierdes acceso a tu autenticador.</p>
          </div>
          <Button
            onClick={() => setStep('verify')}
            className="w-full"
          >
            Ya escaneé el QR
          </Button>
        </Card>
      )}

      {step === 'verify' && (
        <Card className="p-6">
          <h3 className="font-bold mb-4">Paso 2: Verifica tu Código</h3>
          <p className="text-sm text-muted-foreground mb-4">Ingresa el código de 6 dígitos de tu autenticador:</p>
          <Input
            placeholder="000000"
            maxLength="6"
            value={verifyToken}
            onChange={(e) => setVerifyToken(e.target.value.replace(/\D/g, ''))}
            className="mb-4 text-center text-2xl tracking-widest font-mono"
          />
          <Button
            onClick={handleVerify}
            disabled={loading || verifyToken.length !== 6}
            className="w-full gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verificar'}
          </Button>
        </Card>
      )}

      {step === 'done' && (
        <Card className="p-6 bg-green-50 border-green-200">
          <h3 className="font-bold text-green-900 mb-2">✓ 2FA Activado</h3>
          <p className="text-sm text-green-800">Tu cuenta está protegida. Se te pedirá un código cada vez que inicies sesión.</p>
        </Card>
      )}
    </div>
  );
}