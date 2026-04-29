import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, Lightbulb, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

export default function TutorialGuide({ module, onBack, isCompleted: moduleCompleted, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  const step = module.steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === module.steps.length - 1;
  const isStepCompleted = completedSteps.includes(currentStep);
  const allStepsCompleted = completedSteps.length === module.steps.length;
  const progressPct = ((currentStep + 1) / module.steps.length) * 100;

  const handleMarkComplete = () => {
    if (!isStepCompleted) {
      const updated = [...completedSteps, currentStep];
      setCompletedSteps(updated);
      if (isLastStep && updated.length === module.steps.length && onComplete) {
        setTimeout(() => onComplete(), 300);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Ambient bg */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl opacity-20" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Back */}
        <Button variant="ghost" onClick={onBack} className="mb-6 gap-2 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Volver al Centro
        </Button>

        {/* Module header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-3xl shadow-xl"
              style={{ backgroundColor: module.color + '30' }}>
              {module.icon}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{module.title}</h1>
              <p className="text-slate-400 mt-0.5">{module.description}</p>
            </div>
          </div>
          <Badge variant="outline" className="border-slate-600 text-slate-400 flex-shrink-0">
            Paso {currentStep + 1} de {module.steps.length}
          </Badge>
        </motion.div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full transition-all ${allStepsCompleted ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1 text-right">
            {completedSteps.length} de {module.steps.length} completados {allStepsCompleted && '✓'}
          </p>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Steps sidebar */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur p-4 sticky top-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Pasos</p>
              <div className="space-y-1.5">
                {module.steps.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentStep(idx)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      idx === currentStep
                        ? 'bg-indigo-600/20 border border-indigo-500/50 text-white'
                        : completedSteps.includes(idx)
                        ? 'bg-emerald-900/20 border border-emerald-500/30 text-emerald-300'
                        : 'hover:bg-slate-700/40 border border-transparent text-slate-400'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        completedSteps.includes(idx)
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : idx === currentStep
                          ? 'border-indigo-400 text-indigo-400'
                          : 'border-slate-600 text-slate-600'
                      }`}>
                        {completedSteps.includes(idx) ? '✓' : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{s.title}</p>
                        <p className="text-xs opacity-60 mt-0.5">{s.duration}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step content */}
          <div className="lg:col-span-2">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur p-6 space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold text-white mb-2">{step.title}</h2>
                <div className="flex gap-2">
                  <Badge variant="outline" className="border-slate-600 text-slate-400 gap-1.5 text-xs">
                    <Clock className="h-3 w-3" /> {step.duration}
                  </Badge>
                  {step.difficulty && (
                    <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">
                      {step.difficulty}
                    </Badge>
                  )}
                </div>
              </div>

              <p className="text-slate-300 leading-relaxed">{step.description}</p>

              {/* Instructions */}
              {step.instructions && (
                <div>
                  <p className="text-sm font-semibold text-white mb-3">Instrucciones:</p>
                  <ol className="space-y-2">
                    {step.instructions.map((instr, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="h-6 w-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0 border border-indigo-500/30">
                          {i + 1}
                        </span>
                        <span className="text-sm text-slate-300 pt-0.5">{instr}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Tips */}
              {step.tips?.length > 0 && (
                <div className="space-y-2">
                  {step.tips.map((tip, i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-lg bg-amber-950/40 border border-amber-500/30">
                      <Lightbulb className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-200">{tip}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Important */}
              {step.important && (
                <div className="flex gap-3 p-3 rounded-lg bg-red-950/40 border border-red-500/30">
                  <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{step.important}</p>
                </div>
              )}

              {/* Example */}
              {step.example && (
                <div>
                  <p className="text-sm font-semibold text-white mb-2">Ejemplo práctico:</p>
                  <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-700/50">
                    <p className="text-sm text-slate-400">{step.example}</p>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Navigation */}
            <div className="flex gap-3 mt-5">
              <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)} disabled={isFirstStep}
                className="gap-2 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/50">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>

              {!isStepCompleted ? (
                <Button variant="secondary" onClick={handleMarkComplete}
                  className="gap-2 bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30">
                  <CheckCircle2 className="h-4 w-4" /> Marcar completado
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium px-2">
                  <CheckCircle2 className="h-4 w-4" /> Paso completado
                </div>
              )}

              <Button onClick={() => setCurrentStep(currentStep + 1)} disabled={isLastStep}
                className="gap-2 ml-auto bg-indigo-600 hover:bg-indigo-700 text-white">
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}