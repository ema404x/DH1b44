import React from 'react';
import { motion } from 'framer-motion';

export default function AuroraEffect() {
  return (
    <div className="fixed inset-x-0 top-0 h-72 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>

      {/* Banda verde principal */}
      <motion.div
        className="absolute inset-x-0 top-0 h-56"
        style={{
          background: 'radial-gradient(ellipse 150% 85% at 50% -15%, rgba(0,220,110,0.28) 0%, rgba(0,200,130,0.12) 55%, transparent 80%)',
          filter: 'blur(25px)',
        }}
        animate={{ x: ['-8%', '8%', '-5%', '6%', '-8%'], scaleY: [1, 1.12, 0.92, 1.06, 1] }}
        transition={{ duration: 20, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}
      />

      {/* Segunda ola verde — desfasada */}
      <motion.div
        className="absolute inset-x-0 top-0 h-40"
        style={{
          background: 'radial-gradient(ellipse 120% 60% at 60% -10%, rgba(0,240,140,0.18) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
        animate={{ x: ['6%', '-7%', '4%', '-5%', '6%'], scaleY: [0.9, 1.1, 0.95, 1.05, 0.9] }}
        transition={{ duration: 17, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror', delay: 3 }}
      />

      {/* Banda cian/azul */}
      <motion.div
        className="absolute inset-x-0 top-0 h-44"
        style={{
          background: 'radial-gradient(ellipse 120% 65% at 30% -18%, rgba(0,190,230,0.20) 0%, rgba(0,160,210,0.08) 55%, transparent 80%)',
          filter: 'blur(30px)',
        }}
        animate={{ x: ['4%', '-6%', '3%', '-4%', '4%'], scaleY: [0.95, 1.08, 1, 1.1, 0.95] }}
        transition={{ duration: 26, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror', delay: 5 }}
      />

      {/* Violeta — derecha */}
      <motion.div
        className="absolute top-0 right-0 h-36 w-2/3"
        style={{
          background: 'radial-gradient(ellipse 85% 60% at 80% -12%, rgba(140,60,230,0.16) 0%, transparent 70%)',
          filter: 'blur(35px)',
        }}
        animate={{ x: ['0%', '-8%', '3%', '-5%', '0%'], opacity: [0.7, 1, 0.5, 0.95, 0.7] }}
        transition={{ duration: 28, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror', delay: 7 }}
      />

      {/* Línea de brillo superior pulsante */}
      <motion.div
        className="absolute top-0 inset-x-0 h-[2px]"
        style={{
          background: 'linear-gradient(90deg, transparent 5%, rgba(0,220,110,0.45) 28%, rgba(0,190,230,0.38) 58%, rgba(140,60,230,0.25) 80%, transparent 95%)',
        }}
        animate={{ opacity: [0.4, 0.9, 0.35, 0.85, 0.4] }}
        transition={{ duration: 12, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}
      />

      {/* Fade hacia el contenido */}
      <div
        className="absolute bottom-0 inset-x-0 h-24"
        style={{ background: 'linear-gradient(to bottom, transparent, hsl(215,30%,10%))' }}
      />
    </div>
  );
}