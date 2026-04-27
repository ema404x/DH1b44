import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, FileSpreadsheet, Brain, CheckCircle2, AlertCircle, Loader2, ArrowRight, RefreshCw, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import ImportStepUpload from '@/components/importar/ImportStepUpload';
import ImportStepMapping from '@/components/importar/ImportStepMapping';
import ImportStepConfirm from '@/components/importar/ImportStepConfirm';
import ImportStepResult from '@/components/importar/ImportStepResult';

const STEPS = ['Subir Archivo', 'Mapeo IA', 'Confirmar', 'Resultado'];

export default function ImportarDatos() {
  const [step, setStep] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [mappingResult, setMappingResult] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUploaded = async (file, fileUrl, rawData) => {
    setUploadedFile({ file, fileUrl, rawData });
    setIsProcessing(true);
    setStep(1);

    try {
      const response = await base44.functions.invoke('smartImportAnalyze', {
        file_url: fileUrl,
        raw_data: rawData,
      });
      // El SDK wrappea la respuesta en response.data, y la función retorna el objeto directo
      const result = response.data?.sheets ? response.data : response.data?.response;
      setMappingResult(result);
    } catch (error) {
      toast.error('Error al analizar el archivo: ' + error.message);
      setStep(0);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMappingConfirmed = (confirmedMapping) => {
    setMappingResult(confirmedMapping);
    setStep(2);
  };

  const handleImportConfirmed = async (finalMapping) => {
    setIsProcessing(true);
    try {
      const response = await base44.functions.invoke('smartImportExecute', {
        mapping: finalMapping,
        raw_data: uploadedFile.rawData,
      });
      const result = response.data?.results ? response.data : response.data?.response;
      setImportResult(result);
      setStep(3);
    } catch (error) {
      toast.error('Error al importar: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setStep(0);
    setUploadedFile(null);
    setMappingResult(null);
    setImportResult(null);
    setIsProcessing(false);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Importación Inteligente</h1>
            <p className="text-sm text-muted-foreground">La IA detecta y mapea automáticamente tus datos</p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              i === step ? 'bg-primary text-primary-foreground' :
              i < step ? 'bg-emerald-100 text-emerald-700' :
              'bg-muted text-muted-foreground'
            }`}>
              {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-4 w-4 text-xs flex items-center justify-center rounded-full border border-current">{i + 1}</span>}
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
          </React.Fragment>
        ))}
        {step > 0 && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="ml-auto gap-1.5 text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" /> Nueva importación
          </Button>
        )}
      </div>

      {/* Step Content */}
      {step === 0 && <ImportStepUpload onFileUploaded={handleFileUploaded} />}
      {step === 1 && (
        isProcessing ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Brain className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">Analizando con IA...</p>
                <p className="text-sm text-muted-foreground mt-1">Detectando entidades y mapeando columnas automáticamente</p>
              </div>
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </CardContent>
          </Card>
        ) : mappingResult ? (
          <ImportStepMapping
            mappingResult={mappingResult}
            onConfirm={handleMappingConfirmed}
            onBack={() => setStep(0)}
          />
        ) : null
      )}
      {step === 2 && mappingResult && (
        <ImportStepConfirm
          mappingResult={mappingResult}
          onConfirm={handleImportConfirmed}
          onBack={() => setStep(1)}
          isLoading={isProcessing}
        />
      )}
      {step === 3 && importResult && (
        <ImportStepResult
          result={importResult}
          onReset={handleReset}
        />
      )}
    </div>
  );
}