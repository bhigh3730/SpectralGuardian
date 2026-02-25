/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRedMode, setIsRedMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('spectral_matrix_red_mode') === 'true';
    }
    return false;
  });
  const [glitch, setGlitch] = useState(false);

  // Stealth Gesture State
  const rightTaps = useRef(0);
  const lastRightTapTime = useRef(0);
  const gestureTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width: number, height: number, columns: number;
    const fontSize = 16;
    let drops: number[] = [];
    let speeds: number[] = [];
    
    const CYAN_MAIN = '#0099FF';
    const CYAN_HEAD = '#FFFFFF';
    const RED_MAIN = '#ff0033';
    const RED_HEAD = '#FFFFFF';

    const chars = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ1234567890$+-*/=%\"'#&_(),.;:?!";

    const init = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      columns = Math.min(Math.floor(width / fontSize), 80);
      
      drops = [];
      speeds = [];
      for (let i = 0; i < columns; i++) {
        drops[i] = Math.random() * -100;
        speeds[i] = 0.8 + Math.random() * 0.7;
      }
    };

    let animationFrameId: number;
    const startTime = Date.now();

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
      ctx.fillRect(0, 0, width, height);

      const mainColor = isRedMode ? RED_MAIN : CYAN_MAIN;
      const headColor = isRedMode ? RED_HEAD : CYAN_HEAD;
      
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        
        ctx.fillStyle = headColor;
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        ctx.fillStyle = mainColor;
        ctx.fillText(text, i * fontSize, (drops[i] - 1) * fontSize);

        let speedMult = 1;
        if (Date.now() - startTime < 5000) {
          speedMult = 0.5;
        }

        drops[i] += speeds[i] * speedMult;

        if (drops[i] * fontSize > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
      }
      animationFrameId = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', init);
    init();
    draw();

    return () => {
      window.removeEventListener('resize', init);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isRedMode]);

  const resetGesture = () => {
    rightTaps.current = 0;
    if (gestureTimeout.current) clearTimeout(gestureTimeout.current);
  };

  const handleZoneRight = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastRightTapTime.current > 5000) {
      rightTaps.current = 0;
    }
    rightTaps.current++;
    lastRightTapTime.current = now;

    if (gestureTimeout.current) clearTimeout(gestureTimeout.current);
    
    if (rightTaps.current >= 5) {
      const newMode = !isRedMode;
      setIsRedMode(newMode);
      localStorage.setItem('spectral_matrix_red_mode', String(newMode));
      
      setGlitch(true);
      setTimeout(() => setGlitch(false), 800);
      resetGesture();
    } else {
      gestureTimeout.current = setTimeout(resetGesture, 5000);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-['Oxanium'] select-none">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oxanium:wght@300;500;700&display=swap');
      `}</style>
      
      <canvas 
        ref={canvasRef} 
        className={`block w-full h-full transition-opacity duration-1000 ${isRedMode ? 'opacity-20' : 'opacity-100'}`}
      />

      {!isRedMode ? (
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-white z-10 w-[90%] pointer-events-none bg-black/45 p-8 rounded-lg backdrop-blur-[2px] transition-all duration-700 ${glitch ? 'brightness-[1.8]' : ''}`}
        >
          <h1 
            className="text-4xl md:text-5xl m-0 tracking-[0.5rem] font-bold transition-all duration-500"
            style={{ textShadow: '0 0 10px rgba(0, 153, 255, 0.5)' }}
          >
            BENJAMIN HIGHTOWER
          </h1>
          <div className="text-[0.7rem] md:text-xs mt-4 tracking-[0.2rem] opacity-80 font-light">
            CONTENT CREATOR • DIGITAL ALCHEMIST • SONIC ARCHITECT
          </div>
          <div className="mt-8 text-sm md:text-base pointer-events-auto">
            <a 
              href="mailto:BHigh3730@gmail.com" 
              className="transition-all duration-300 relative hover:text-white text-[#0099FF]"
              style={{ textShadow: '0 0 15px #0099FF' }}
            >
              BHigh3730@gmail.com
            </a>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-black/80 backdrop-blur-sm p-6 md:p-12 animate-in fade-in duration-1000">
          <div className="max-w-4xl mx-auto">
            <header className="flex justify-between items-end border-b border-white/10 pb-6 mb-8">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-[0.3rem] text-[#ff0033] m-0">SPECTRAL</h1>
                <div className="text-[10px] text-white/40 tracking-widest mt-1">AUTHOR: BENJAMIN HIGHTOWER</div>
              </div>
              <div className="px-3 py-1 border border-[#0099FF] text-[#0099FF] text-[10px] rounded-full uppercase tracking-tighter">
                System: Secure
              </div>
            </header>

            <section className="mb-10">
              <div className="flex items-center gap-4 mb-6">
                <span className="text-[10px] uppercase tracking-[0.2rem] text-white/40">Security Protocols</span>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 p-6 rounded-sm hover:bg-white/10 transition-colors cursor-pointer group">
                  <h3 className="text-sm font-bold tracking-wider text-[#0099FF] m-0 group-hover:text-white transition-colors">Port Shield</h3>
                  <p className="text-[11px] text-white/40 mt-2 leading-relaxed">Active VPN tunnel blocking 5900, 3389, 5555.</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-6 rounded-sm hover:bg-white/10 transition-colors cursor-pointer group">
                  <h3 className="text-sm font-bold tracking-wider text-[#0099FF] m-0 group-hover:text-white transition-colors">Risk Scanner</h3>
                  <p className="text-[11px] text-white/40 mt-2 leading-relaxed">Audit installed packages for risky permissions.</p>
                </div>
              </div>
            </section>

            <section className="mb-10">
              <div className="flex items-center gap-4 mb-6">
                <span className="text-[10px] uppercase tracking-[0.2rem] text-white/40">Traffic Analysis</span>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="bg-black border border-white/5 h-48 overflow-y-auto p-4 font-mono text-[10px] text-white/30">
                <div className="mb-1">[04:50:05] SpectralShield initialized.</div>
                <div className="mb-1">[04:50:07] Guardian Service linked successfully.</div>
                <div className="mb-1">[04:50:10] Monitoring loop started on port 5555.</div>
                <div className="mb-1 text-[#ff0033]">[04:51:22] Blocked suspicious outbound on port 3389.</div>
              </div>
            </section>

            <footer className="text-center text-[9px] text-white/20 tracking-[0.1rem] mt-12 pb-8">
              &copy; 2026 SPECTRAL MATRIX • DIGITAL ALCHEMIST • SONIC ARCHITECT
            </footer>
          </div>

          <button 
            onClick={() => {
              setIsRedMode(false);
              localStorage.setItem('spectral_matrix_red_mode', 'false');
            }}
            className="fixed bottom-8 right-8 w-12 h-12 bg-[#ff0033] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,0,51,0.4)] cursor-pointer hover:scale-110 transition-transform z-50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      )}

      {/* Stealth Touch Zone - No visual cues */}
      <div 
        onMouseDown={handleZoneRight}
        onTouchStart={handleZoneRight}
        className="absolute bottom-0 right-0 w-1/4 h-[15%] z-50 cursor-default"
      />
    </div>
  );
}
