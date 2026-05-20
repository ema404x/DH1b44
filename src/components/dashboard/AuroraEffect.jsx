import React from 'react';
import { motion } from 'framer-motion';

export default function AuroraEffect() {
  return (
    <div className="fixed inset-x-0 top-0 h-[50vh] pointer-events-none z-0 overflow-hidden">

      {/* Verde brillante — color más icónico de aurora */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-full"
        style={{
          background: 'radial-gradient(ellipse 120% 60% at 50% -5%, rgba(0,255,120,0.22) 0%, rgba(0,220,100,0.14) 40%, transparent 70%)',
          filter: 'blur(20px)',
        }}
        animate={{ scaleX: [1, 1.07, 0.95, 1.05, 1], x: [0, 20, -14, 10, 0] }}
        transition={{ duration: 14, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}
      />

      {/* Cian/turquesa — transición natural */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-[80%]"
        style={{
          background: 'radial-gradient(ellipse 100% 50% at 40% -8%, rgba(0,210,230,0.18) 0%, rgba(0,180,200,0.10) 50%, transparent 72%)',
          filter: 'blur(18px)',
        }}
        animate={{ scaleX: [1, 0.95, 1.09, 0.97, 1], x: [0, -22, 16, -8, 0] }}
        transition={{ duration: 17, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror', delay: 1.5 }}
      />

      {/* Violeta profundo — borde superior típico */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-[60%]"
        style={{
          background: 'radial-gradient(ellipse 90% 40% at 65% -5%, rgba(160,80,255,0.20) 0%, rgba(120,50,220,0.12) 50%, transparent 72%)',
          filter: 'blur(22px)',
        }}
        animate={{ x: [0, 18, -12, 6, 0], opacity: [0.8, 1, 0.65, 0.95, 0.8] }}
        transition={{ duration: 20, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror', delay: 3 }}
      />

      {/* Rosa/magenta — acento lateral derecho */}
      <motion.div
        className="absolute top-0 right-[-5%] h-full w-[55vw]"
        style={{
          background: 'radial-gradient(ellipse 75% 45% at 90% -5%, rgba(255,60,180,0.14) 0%, rgba(200,50,160,0.08) 55%, transparent 72%)',
          filter: 'blur(24px)',
        }}
        animate={{ x: [0, -14, 10, -6, 0], opacity: [0.7, 1, 0.55, 0.9, 0.7] }}
        transition={{ duration: 22, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror', delay: 0.8 }}
      />

      {/* Filamentos verticales de luz verde */}
      {[12, 28, 48, 67, 83].map((left, i) => (
        <motion.div
          key={i}
          className="absolute top-0"
          style={{
            left: `${left}%`,
            width: '2px',
            height: `${25 + i * 5}vh`,
            background: `linear-gradient(to bottom, ${
              ['rgba(0,255,120,0.35)', 'rgba(0,210,230,0.3)', 'rgba(160,80,255,0.28)', 'rgba(0,255,120,0.3)', 'rgba(0,210,230,0.25)'][i]
            } 0%, transparent 100%)`,
            filter: 'blur(4px)',
          }}
          animate={{ opacity: [0.4, 0.9, 0.4, 0.8, 0.4], scaleY: [0.9, 1.05, 0.85, 1, 0.9] }}
          transition={{ duration: 8 + i * 2, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror', delay: i * 0.6 }}
        />
      ))}

      {/* Línea de brillo en el borde superior */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,255,120,0.5) 25%, rgba(0,210,230,0.5) 50%, rgba(160,80,255,0.5) 75%, transparent 100%)',
        }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}
      />

      {/* Degradado de fade-out hacia el contenido */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[40%]"
        style={{ background: 'linear-gradient(to bottom, transparent 0%, hsl(215,30%,10%) 100%)' }}
      />
    </div>
  );
}