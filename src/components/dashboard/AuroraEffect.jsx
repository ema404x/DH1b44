import React from 'react';
import { motion } from 'framer-motion';

export default function AuroraEffect() {
  return (
    <div className="fixed inset-x-0 top-0 h-64 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>

      {/* Banda verde — la más prominente y lenta */}
      <motion.div
        className="absolute inset-x-0 top-0 h-48"
        style={{
          background: 'radial-gradient(ellipse 140% 80% at 50% -20%, rgba(0,210,100,0.18) 0%, rgba(0,200,120,0.08) 55%, transparent 80%)',
          filter: 'blur(30px)',
        }}
        animate={{ x: ['-5%', '5%', '-3%', '4%', '-5%'], scaleY: [1, 1.08, 0.95, 1.04, 1] }}
        transition={{ duration: 25, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}
      />

      {/* Banda azul/cian — más angosta y desplazada */}
      <motion.div
        className="absolute inset-x-0 top-0 h-36"
        style={{
          background: 'radial-gradient(ellipse 110% 60% at 35% -15%, rgba(0,180,220,0.13) 0%, rgba(0,160,200,0.06) 55%, transparent 80%)',
          filter: 'blur(35px)',
        }}
        animate={{ x: ['3%', '-4%', '2%', '-3%', '3%'], scaleY: [0.95, 1.05, 1, 1.08, 0.95] }}
        transition={{ duration: 30, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror', delay: 4 }}
      />

      {/* Toque violeta muy leve a la derecha */}
      <motion.div
        className="absolute top-0 right-0 h-32 w-2/3"
        style={{
          background: 'radial-gradient(ellipse 80% 55% at 80% -10%, rgba(130,60,220,0.10) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
        animate={{ x: ['0%', '-6%', '2%', '-4%', '0%'], opacity: [0.6, 1, 0.5, 0.9, 0.6] }}
        transition={{ duration: 35, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror', delay: 8 }}
      />

      {/* Línea de brillo finísima en el borde superior */}
      <motion.div
        className="absolute top-0 inset-x-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent 5%, rgba(0,210,100,0.25) 30%, rgba(0,180,220,0.20) 60%, transparent 90%)',
        }}
        animate={{ opacity: [0.4, 0.8, 0.3, 0.7, 0.4] }}
        transition={{ duration: 18, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}
      />

      {/* Fade hacia el contenido */}
      <div
        className="absolute bottom-0 inset-x-0 h-20"
        style={{ background: 'linear-gradient(to bottom, transparent, hsl(215,30%,10%))' }}
      />
    </div>
  );
}