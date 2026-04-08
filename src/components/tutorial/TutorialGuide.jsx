import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, Lightbulb, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TutorialGuide({ module, onBack }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  const step = module.steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === module.steps.length - 1;
  const isCompleted = completedSteps.includes(currentStep);

  const handleMarkComplete = () => {
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep]);
    }
  };

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progressPercent = ((currentStep + 1) / module.steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={onBack}
            className="mb-6 gap-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Volver al Centro
          </Button>

          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className={`h-16 w-16 rounded-lg flex items-center justify-center text-3xl`}
                style={{ backgroundColor: module.color + '20' }}>
                {module.icon}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">{module.title}</h1>
                <p className="text-muted-foreground mt-1">{module.description}</p>
              </div>
            </div>
            <Badge variant="secondary">
              Paso {currentStep + 1} de {module.steps.length}
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {completedSteps.length} de {module.steps.length} pasos completados
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Steps Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pasos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {module.steps.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentStep(idx)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      idx === currentStep
                        ? 'bg-primary/10 border border-primary text-foreground'
                        : completedSteps.includes(idx)
                        ? 'bg-emerald-50 border border-emerald-200'
                        : 'hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-1 h-5 w-5 rounded-full border-2 flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                        completedSteps.includes(idx)
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : idx === currentStep
                          ? 'border-primary text-primary'
                          : 'border-slate-300'
                      }`}>
                        {completedSteps.includes(idx) ? '✓' : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{s.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.duration}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Step Content */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{step.title}</CardTitle>
                <div className="flex gap-2 mt-3">
                  <Badge variant="outline" className="gap-1.5">
                    <Clock className="h-3 w-3" /> {step.duration}
                  </Badge>
                  <Badge variant="outline" className="gap-1.5">
                    Dificultad: {step.difficulty || 'Básica'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Main Description */}
                <div className="space-y-3">
                  <p className="text-base text-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Instructions */}
                {step.instructions && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-foreground">Instrucciones:</h3>
                    <ol className="space-y-2">
                      {step.instructions.map((instr, idx) => (
                        <li key={idx} className="flex gap-3">
                          <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-sm text-foreground pt-0.5">
                            {instr}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Tips */}
                {step.tips && step.tips.length > 0 && (
                  <div className="space-y-3">
                    {step.tips.map((tip, idx) => (
                      <div key={idx} className="flex gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <Lightbulb className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-900">{tip}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Important */}
                {step.important && (
                  <div className="flex gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-900">{step.important}</p>
                  </div>
                )}

                {/* Example */}
                {step.example && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground">Ejemplo práctico:</h3>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-sm text-slate-700">{step.example}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={isFirstStep}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>

              {!isCompleted && (
                <Button
                  variant="secondary"
                  onClick={handleMarkComplete}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" /> Marcar como completado
                </Button>
              )}

              {isCompleted && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Paso completado
                </div>
              )}

              <Button
                onClick={handleNext}
                disabled={isLastStep}
                className="gap-2 ml-auto"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}