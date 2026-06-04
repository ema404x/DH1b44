import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Lock, HardDrive, AlertTriangle, CheckCircle2, Activity, History } from 'lucide-react';
import TwoFactorSetup from '@/components/security/TwoFactorSetup';
import BackupManager from '@/components/security/BackupManager';
import SessionAudit from '@/components/security/SessionAudit';
import SensitiveChangesLog from '@/components/security/SensitiveChangesLog';
import SuspiciousActivityAlerts from '@/components/security/SuspiciousActivityAlerts';

export default function Seguridad() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8 text-green-600" />
          Centro de Seguridad
        </h1>
        <p className="text-muted-foreground mt-1">Protege tu cuenta con las máximas medidas de seguridad</p>
      </div>

      {/* Estado de seguridad */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-green-900">HTTPS Encriptado</p>
              <p className="text-xs text-green-800 mt-1">Todo el tráfico está cifrado</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-green-900">Auditoría Activa</p>
              <p className="text-xs text-green-800 mt-1">Todos los cambios se registran</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-blue-900">Rate Limiting Activo</p>
              <p className="text-xs text-blue-800 mt-1">Protección contra ataques</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="2fa" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="2fa" className="gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">2FA</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-2">
            <HardDrive className="h-4 w-4" />
            <span className="hidden sm:inline">Backups</span>
          </TabsTrigger>
          <TabsTrigger value="encriptacion" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Encriptación</span>
          </TabsTrigger>
          <TabsTrigger value="sesiones" className="gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Sesiones</span>
          </TabsTrigger>
          <TabsTrigger value="cambios" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Cambios</span>
          </TabsTrigger>
          <TabsTrigger value="alertas" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Alertas</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="2fa" className="space-y-4">
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h3 className="font-bold text-blue-900 mb-2">Autenticación de Dos Factores</h3>
            <p className="text-sm text-blue-800">Añade una capa extra de seguridad a tu cuenta. Se te pedirá un código de tu teléfono cada vez que inicies sesión.</p>
          </Card>
          <TwoFactorSetup />
        </TabsContent>

        <TabsContent value="backup" className="space-y-4">
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h3 className="font-bold text-blue-900 mb-2">Backups Automáticos Encriptados</h3>
            <p className="text-sm text-blue-800">Todos tus datos se respaldan automáticamente con encriptación AES-256-GCM. Los backups se retienen 90 días.</p>
          </Card>
          <BackupManager />
        </TabsContent>

        <TabsContent value="encriptacion" className="space-y-4">
          <Card className="p-6">
            <h3 className="font-bold mb-2">Encriptación de Datos</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-semibold text-green-700 mb-2">✓ Habilitado:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>AES-256-GCM para campos sensibles (CUIT, teléfonos, emails)</li>
                  <li>SHA-256 para hashes de firmas digitales</li>
                  <li>HTTPS/TLS 1.3 para tráfico en red</li>
                  <li>Encriptación en reposo de base de datos</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-2">Campos Encriptados:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>CUIT (clientes, contratistas)</li>
                  <li>Teléfonos (empleados, clientes)</li>
                  <li>Emails sensibles</li>
                  <li>Secretos 2FA y códigos de backup</li>
                  <li>Firmas digitales y certificados</li>
                </ul>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-yellow-50 border-yellow-200">
            <p className="text-sm text-yellow-800">
              <strong>Nota:</strong> Para máxima seguridad, tu aplicación debería estar detrás de un WAF (Web Application Firewall) y ejecutarse en una Red Privada Virtual (VPN).
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="sesiones" className="space-y-4">
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h3 className="font-bold text-blue-900 mb-2">Auditoría de Sesiones Activas</h3>
            <p className="text-sm text-blue-800">Visualiza todos los accesos registrados a tu cuenta, incluyendo direcciones IP y dispositivos. Detecta actividad no autorizada.</p>
          </Card>
          <SessionAudit />
        </TabsContent>

        <TabsContent value="cambios" className="space-y-4">
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h3 className="font-bold text-blue-900 mb-2">Historial de Cambios Sensibles</h3>
            <p className="text-sm text-blue-800">Registro completo de modificaciones en datos críticos (certificados, facturas, empleados, permisos). Quién, qué y cuándo.</p>
          </Card>
          <SensitiveChangesLog />
        </TabsContent>

        <TabsContent value="alertas" className="space-y-4">
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h3 className="font-bold text-blue-900 mb-2">Alertas de Actividad Sospechosa</h3>
            <p className="text-sm text-blue-800">Detección automática de patrones anormales: accesos desde múltiples ubicaciones, actividad inusualmente alta, y más.</p>
          </Card>
          <SuspiciousActivityAlerts />
        </TabsContent>
      </Tabs>

      {/* Recomendaciones de seguridad */}
      <Card className="p-6 bg-purple-50 border-purple-200">
        <h3 className="font-bold text-purple-900 mb-3">✓ Checklist de Seguridad Completado</h3>
        <ul className="space-y-2 text-sm text-purple-800">
          <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> Auditoría de cambios en tiempo real</li>
          <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> Control de acceso basado en roles (RBAC)</li>
          <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> Firmas digitales SHA-256 con timestamp</li>
          <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> Rate limiting para prevenir ataques de fuerza bruta</li>
          <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> Validación CSRF en formularios</li>
          <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> 2FA para admins</li>
          <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> Backups encriptados automáticos</li>
          <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> Encriptación AES-256 de campos sensibles</li>
        </ul>
      </Card>
    </div>
  );
}