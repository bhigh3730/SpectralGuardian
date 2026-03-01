/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Shield, Radio, Wifi, Bluetooth, Activity, Zap, AlertTriangle, Terminal, Cpu, Globe, X, Trash2, Ban, Pin, Settings, Sliders, Battery, Thermometer, Volume2, VolumeX, CircuitBoard, Cloud, MapPin } from 'lucide-react';

interface Device {
  id: string;
  name: string;
  type: 'WIFI' | 'BT' | 'DIRECT' | 'CELL' | 'INTERNAL';
  category: 'DEVICE' | 'ENTITY';
  rssi: number;
  distance: number; // in meters
  threat: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: string;
  timestamp: string;
  isPinned?: boolean;
  isBlacklisted?: boolean;
  frequencyBand?: 'X' | 'K' | 'KA';
  location?: { lat: number; lng: number };
}

interface EmfData {
  time: string;
  value: number;
}

type ScanDepth = 'TARGETED' | 'NON-TARGETED' | 'FULL_SPECTRUM';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRedMode, setIsRedMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('spectral_matrix_red_mode') === 'true';
    }
    return false;
  });
  const [glitch, setGlitch] = useState(false);
  const [emfHistory, setEmfHistory] = useState<EmfData[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [internalDevices, setInternalDevices] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<string[]>([]);
  
  // Advanced Settings
  const [scanDepth, setScanDepth] = useState<ScanDepth>('TARGETED');
  const [sensitivity, setSensitivity] = useState(50);
  const [refreshRate, setRefreshRate] = useState(60);
  const [activeBands, setActiveBands] = useState<('X' | 'K' | 'KA')[]>(['X', 'K', 'KA']);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [pendingRefreshRate, setPendingRefreshRate] = useState(60);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeProfile, setActiveProfile] = useState<'NONE' | 'DEVICE' | 'ENTITY' | 'INTERNAL'>('NONE');
  
  const audioCtx = useRef<AudioContext | null>(null);
  const oscillator = useRef<OscillatorNode | null>(null);
  const gainNode = useRef<GainNode | null>(null);

  // Audio Feedback Logic
  useEffect(() => {
    if (audioEnabled && isRedMode) {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        gainNode.current = audioCtx.current.createGain();
        gainNode.current.connect(audioCtx.current.destination);
        gainNode.current.gain.value = 0;
      }
      
      if (!oscillator.current) {
        oscillator.current = audioCtx.current.createOscillator();
        oscillator.current.type = 'sawtooth';
        oscillator.current.connect(gainNode.current!);
        oscillator.current.start();
      }
    } else {
      if (oscillator.current) {
        oscillator.current.stop();
        oscillator.current.disconnect();
        oscillator.current = null;
      }
      if (gainNode.current) {
        gainNode.current.disconnect();
        gainNode.current = null;
      }
      if (audioCtx.current) {
        audioCtx.current.close();
        audioCtx.current = null;
      }
    }
  }, [audioEnabled, isRedMode]);

  useEffect(() => {
    if (audioEnabled && oscillator.current && gainNode.current && emfHistory.length > 0) {
      const latestEmf = emfHistory[emfHistory.length - 1].value;
      
      // Find closest device for proximity audio
      const closestDevice = [...devices].sort((a, b) => a.distance - b.distance)[0];
      
      if (closestDevice) {
        // Update Audio Profile based on closest detection
        const profile = closestDevice.type === 'INTERNAL' ? 'INTERNAL' : closestDevice.category;
        setActiveProfile(profile);

        // Waveform Profile
        if (profile === 'ENTITY') oscillator.current.type = 'square';
        else if (profile === 'INTERNAL') oscillator.current.type = 'sine';
        else oscillator.current.type = 'sawtooth';

        // Base frequency depends on active bands
        let baseFreq = 200;
        if (activeBands.includes('KA')) baseFreq = 800;
        else if (activeBands.includes('K')) baseFreq = 500;
        else if (activeBands.includes('X')) baseFreq = 300;

        // Proximity modulation: closer = higher pitch + faster jitter
        const proximityMod = Math.max(0, (100 - closestDevice.distance) / 10);
        const jitter = profile === 'ENTITY' ? (Math.random() - 0.5) * 50 : 0;
        const freq = baseFreq + (latestEmf * 3) + (proximityMod * 20) + jitter;
        
        oscillator.current.frequency.setTargetAtTime(freq, audioCtx.current!.currentTime, 0.05);
        
        // Volume based on intensity and proximity
        const volume = Math.min((latestEmf / 200) + (proximityMod / 50), 0.15);
        gainNode.current.gain.setTargetAtTime(volume, audioCtx.current!.currentTime, 0.05);
      } else {
        setActiveProfile('NONE');
        gainNode.current.gain.setTargetAtTime(0, audioCtx.current!.currentTime, 0.1);
      }
    }
  }, [emfHistory, audioEnabled, activeBands, devices]);
  
  // Stealth Gesture State
  const rightTaps = useRef(0);
  const lastRightTapTime = useRef(0);
  const gestureTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isRedMode) return;

    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Geolocation error:", error);
          setLogs(prev => [`GPS ERROR: ${error.message}`, ...prev].slice(0, 5));
        },
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setLogs(prev => ["GPS NOT SUPPORTED BY HARDWARE", ...prev].slice(0, 5));
    }
  }, [isRedMode]);

  // Simulation for Web Preview
  useEffect(() => {
    if (!isRedMode) return;

    const interval = setInterval(() => {
      // Simulate EMF
      const newValue = 30 + Math.random() * 40 + (Math.random() > 0.9 ? 50 : 0);
      setEmfHistory(prev => {
        const next = [...prev, { time: new Date().toLocaleTimeString(), value: newValue }];
        return next.slice(-20);
      });

      // Simulate Devices based on Scan Depth
      const spawnChance = scanDepth === 'FULL_SPECTRUM' ? 0.9 : scanDepth === 'NON-TARGETED' ? 0.6 : 0.3;
      
      if (Math.random() < spawnChance) {
        const types: ('WIFI' | 'BT' | 'DIRECT' | 'CELL' | 'INTERNAL')[] = ['WIFI', 'BT', 'DIRECT', 'CELL', 'INTERNAL'];
        const bands: ('X' | 'K' | 'KA')[] = ['X', 'K', 'KA'];
        const id = Math.random().toString(36).substr(2, 9).toUpperCase();
        const type = types[Math.floor(Math.random() * types.length)];
        const band = bands[Math.floor(Math.random() * bands.length)];

        // Skip if blacklisted or internal already found
        if (blacklist.includes(id) || internalDevices.has(id)) return;
        if (!activeBands.includes(band)) return;

        const rssi = -20 - Math.floor(Math.random() * 70);
        const distance = Math.pow(10, (-30 - rssi) / 20); // Estimated distance in meters

        const newDevice: Device = {
          id,
          name: type === 'INTERNAL' ? `CORE_COMPONENT_${Math.floor(Math.random() * 99)}` : `ENTITY_${Math.floor(Math.random() * 9999)}`,
          type,
          category: type === 'INTERNAL' ? 'DEVICE' : (Math.random() > 0.5 ? 'DEVICE' : 'ENTITY'),
          rssi,
          distance,
          threat: Math.random() > 0.8 ? 'HIGH' : 'LOW',
          details: type === 'INTERNAL' ? 'SYSTEM HARDWARE DETECTED' : 'TRANSMITTING ENCRYPTED PACKETS',
          timestamp: new Date().toLocaleTimeString(),
          frequencyBand: band,
          location: {
            lat: (userLocation?.lat || 34.0522) + (Math.random() - 0.5) * 0.002,
            lng: (userLocation?.lng || -88.2437) + (Math.random() - 0.5) * 0.002
          }
        };

        setDevices(prev => {
          // Keep pinned devices, filter out blacklisted/internal
          const filtered = prev.filter(d => !blacklist.includes(d.id) && !internalDevices.has(d.id));
          const next = [newDevice, ...filtered].sort((a, b) => b.rssi - a.rssi);
          return next.slice(0, 15);
        });

        if (type === 'INTERNAL') {
          setInternalDevices(prev => new Set(prev).add(id));
          setLogs(prev => [`INTERNAL COMPONENT DETERMINED: ${id}`, ...prev].slice(0, 5));
        }
      }

      // Simulate Logs
      if (Math.random() > 0.8) {
        const events = [
          "PORT 5555 ATTEMPT BLOCKED",
          "NEW WIFI DIRECT HANDSHAKE DETECTED",
          "EMF SPIKE DETECTED IN SECTOR 7",
          "ENCRYPTED PACKET INTERCEPTED",
          "CORE SENSOR FUSION STABLE"
        ];
        setLogs(prev => [events[Math.floor(Math.random() * events.length)], ...prev].slice(0, 5));
      }
    }, 1000 / (refreshRate / 60)); // Adjust simulation speed based on refresh rate

    return () => clearInterval(interval);
  }, [isRedMode, scanDepth, refreshRate, activeBands, blacklist, internalDevices]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width: number, height: number, columns: number;
    const fontSize = 16;
    let drops: number[] = [];
    let speeds: number[] = [];
    
    const CYAN_MAIN = '#00FFCC'; // Alien Cyan
    const CYAN_HEAD = '#FFFFFF';
    const RED_MAIN = '#FF0033'; // Spectral Red
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

  const handleRefreshRateChange = (rate: number) => {
    if (rate > 60) {
      setPendingRefreshRate(rate);
      setShowWarning(true);
    } else {
      setRefreshRate(rate);
    }
  };

  const confirmRefreshRate = () => {
    setRefreshRate(pendingRefreshRate);
    setShowWarning(false);
  };

  const cancelRefreshRate = () => {
    setShowWarning(false);
  };

  const removeDevice = (id: string) => {
    setDevices(prev => prev.filter(d => d.id !== id));
  };

  const blacklistDevice = (id: string) => {
    setBlacklist(prev => [...prev, id]);
    removeDevice(id);
  };

  const togglePinDevice = (id: string) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, isPinned: !d.isPinned } : d));
  };

  const unblacklistDevice = (id: string) => {
    setBlacklist(prev => prev.filter(bid => bid !== id));
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-['Oxanium'] select-none text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oxanium:wght@300;500;700&display=swap');
        .glow-cyan { text-shadow: 0 0 15px #00FFCC; }
        .glow-red { text-shadow: 0 0 15px #FF0033; }
        .border-glow-cyan { box-shadow: 0 0 10px rgba(0, 255, 204, 0.3); border-color: rgba(0, 255, 204, 0.5); }
        .border-glow-red { box-shadow: 0 0 10px rgba(255, 0, 51, 0.3); border-color: rgba(255, 0, 51, 0.5); }
      `}</style>
      
      <canvas 
        ref={canvasRef} 
        className={`fixed inset-0 block w-full h-full transition-opacity duration-1000 ${isRedMode ? 'opacity-10' : 'opacity-100'}`}
      />

      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          <div className="bg-[#111] border border-[#FF0033] p-8 rounded-2xl max-w-md w-full border-glow-red animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-4 mb-6 text-[#FF0033]">
              <AlertTriangle className="w-10 h-10" />
              <h2 className="text-xl font-bold tracking-widest uppercase">Thermal Warning</h2>
            </div>
            <p className="text-sm text-white/70 leading-relaxed mb-8">
              Scanning at high refresh rates (up to 120fps) for prolonged periods may cause the device to <span className="text-[#FF0033] font-bold">overheat</span> or potentially <span className="text-[#FF0033] font-bold">damage battery and display components</span>.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={confirmRefreshRate}
                className="flex-1 py-3 bg-[#FF0033] text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-[#FF0033]/80 transition-colors"
              >
                Proceed (120fps)
              </button>
              <button 
                onClick={cancelRefreshRate}
                className="flex-1 py-3 bg-white/10 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Interface: Spectral Detector (Intro) */}
      {!isRedMode && (
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-10 w-[90%] pointer-events-none bg-black/45 p-8 rounded-lg backdrop-blur-[2px] transition-all duration-700 ${glitch ? 'brightness-[1.8]' : ''}`}
        >
          <h1 
            className="text-4xl md:text-5xl m-0 tracking-[0.5rem] font-bold transition-all duration-500 glow-cyan"
          >
            BENJAMIN HIGHTOWER
          </h1>
          <div className="text-[0.7rem] md:text-xs mt-4 tracking-[0.2rem] opacity-80 font-light text-[#00FFCC]">
            CONTENT CREATOR • DIGITAL ALCHEMIST • SONIC ARCHITECT
          </div>
          <div className="mt-8 text-sm md:text-base pointer-events-auto">
            <a 
              href="mailto:BHigh3730@gmail.com" 
              className="transition-all duration-300 relative hover:text-white text-[#00FFCC] glow-cyan"
            >
              BHigh3730@gmail.com
            </a>
          </div>
        </div>
      )}

      {/* Spectral Guardian Application (Dashboard) */}
      {isRedMode && (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-black/90 backdrop-blur-md p-4 md:p-8 animate-in fade-in zoom-in duration-700">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Header Section */}
            <header className="lg:col-span-4 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/10 pb-6 mb-2">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#FF0033]/10 border border-[#FF0033]/30 rounded-lg">
                  <Shield className="w-8 h-8 text-[#FF0033]" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-[0.4rem] text-[#FF0033] m-0">SPECTRAL GUARDIAN</h1>
                  <div className="text-[10px] text-[#00FFCC] tracking-[0.2rem] mt-1 uppercase">Advanced Sensor Fusion Core v5.0</div>
                </div>
              </div>
              <div className="mt-4 md:mt-0 flex items-center gap-6">
                <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                  <Battery className={`w-4 h-4 ${refreshRate > 60 ? 'text-[#FF0033]' : 'text-green-500'}`} />
                  <div className="text-[10px] font-bold uppercase tracking-widest">{refreshRate} FPS</div>
                </div>
                <div className="px-4 py-2 border border-[#00FFCC]/40 bg-[#00FFCC]/5 text-[#00FFCC] text-[10px] rounded-full uppercase tracking-widest font-bold animate-pulse">
                  Live Feed Active
                </div>
              </div>
            </header>

            {/* Settings Sidebar */}
            <aside className="lg:col-span-1 space-y-6">
              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl border-glow-cyan">
                <div className="flex items-center gap-2 mb-6 text-[#00FFCC]">
                  <Settings className="w-4 h-4" />
                  <span className="text-xs font-bold tracking-widest uppercase">Detection Config</span>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-3">Scan Depth</label>
                    <div className="grid grid-cols-1 gap-2">
                      {(['TARGETED', 'NON-TARGETED', 'FULL_SPECTRUM'] as ScanDepth[]).map(depth => (
                        <button 
                          key={depth}
                          onClick={() => setScanDepth(depth)}
                          className={`py-2 px-3 text-[9px] font-bold rounded border transition-all ${scanDepth === depth ? 'bg-[#00FFCC] text-black border-[#00FFCC]' : 'bg-transparent text-white/60 border-white/10 hover:border-white/30'}`}
                        >
                          {depth.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-3">Sensitivity: {sensitivity}%</label>
                    <input 
                      type="range" min="0" max="100" value={sensitivity} 
                      onChange={(e) => setSensitivity(parseInt(e.target.value))}
                      className="w-full accent-[#00FFCC]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-3">Frequency Bands</label>
                    <div className="flex gap-2">
                      {(['X', 'K', 'KA'] as const).map(band => (
                        <button 
                          key={band}
                          onClick={() => setActiveBands(prev => prev.includes(band) ? prev.filter(b => b !== band) : [...prev, band])}
                          className={`flex-1 py-2 text-[10px] font-bold rounded border transition-all ${activeBands.includes(band) ? 'bg-[#FF0033] text-white border-[#FF0033]' : 'bg-transparent text-white/40 border-white/10'}`}
                        >
                          {band}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-3">Refresh Rate</label>
                    <div className="flex gap-2">
                      {[30, 60, 120].map(fps => (
                        <button 
                          key={fps}
                          onClick={() => handleRefreshRateChange(fps)}
                          className={`flex-1 py-2 text-[10px] font-bold rounded border transition-all ${refreshRate === fps ? 'bg-[#00FFCC] text-black border-[#00FFCC]' : 'bg-transparent text-white/40 border-white/10'}`}
                        >
                          {fps}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-3">Audio Feedback</label>
                    <button 
                      onClick={() => setAudioEnabled(!audioEnabled)}
                      className={`w-full py-2 flex items-center justify-center gap-2 text-[10px] font-bold rounded border transition-all ${audioEnabled ? 'bg-[#FF0033] text-white border-[#FF0033]' : 'bg-transparent text-white/40 border-white/10'}`}
                    >
                      {audioEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                      {audioEnabled ? 'AUDIO ACTIVE' : 'AUDIO MUTED'}
                    </button>
                    {audioEnabled && (
                      <div className="mt-2 text-center">
                        <div className="text-[8px] text-white/40 uppercase mb-1">Active Profile</div>
                        <div className={`text-[10px] font-bold tracking-widest ${activeProfile === 'ENTITY' ? 'text-[#FF0033]' : 'text-[#00FFCC]'}`}>
                          {activeProfile}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Blacklist Management */}
              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                <div className="flex items-center gap-2 mb-6 text-[#FF0033]">
                  <Ban className="w-4 h-4" />
                  <span className="text-xs font-bold tracking-widest uppercase">Blacklist</span>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                  {blacklist.length === 0 ? (
                    <div className="text-[9px] text-white/20 italic">No entities banned.</div>
                  ) : (
                    blacklist.map(id => (
                      <div key={id} className="flex justify-between items-center p-2 bg-white/5 rounded border border-white/5">
                        <span className="text-[9px] font-mono text-white/60">{id}</span>
                        <button onClick={() => unblacklistDevice(id)} className="text-[8px] text-[#00FFCC] hover:underline">UNBAN</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>

            {/* Center Column: Data Cards & Visualization */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl border-glow-red">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#FF0033]" />
                    <span className="text-xs font-bold tracking-widest uppercase">EMF Spectrum Analysis</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Thermometer className={`w-4 h-4 ${refreshRate > 60 ? 'text-[#FF0033] animate-pulse' : 'text-white/40'}`} />
                      <span className="text-[10px] text-white/40 uppercase tracking-widest">Core Temp: {refreshRate > 60 ? '108°F' : '93°F'}</span>
                    </div>
                    <div className="text-2xl font-bold text-white font-mono">
                      {emfHistory[emfHistory.length - 1]?.value.toFixed(2) || '0.00'} <span className="text-xs text-white/40">µT</span>
                    </div>
                  </div>
                </div>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={emfHistory}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FF0033" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#FF0033" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="time" hide />
                      <YAxis domain={[0, 150]} hide />
                      <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #FF0033', fontSize: '10px' }} itemStyle={{ color: '#FF0033' }} />
                      <Area type="monotone" dataKey="value" stroke="#FF0033" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Data Cards List */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Radio className="w-4 h-4 text-[#00FFCC]" />
                  <span className="text-xs font-bold tracking-widest uppercase">Detected Entity Matrix</span>
                </div>
                <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {devices.map((device) => (
                    <div 
                      key={device.id} 
                      className={`relative overflow-hidden bg-white/5 border p-5 rounded-2xl transition-all group ${device.type === 'INTERNAL' ? 'border-[#00FFCC]/50 bg-[#00FFCC]/5' : 'border-white/10 hover:bg-white/10'}`}
                    >
                      {/* Vibrant Green for Internal Components */}
                      {device.type === 'INTERNAL' && (
                        <div className="absolute top-0 right-0 px-3 py-1 bg-[#00FFCC] text-black text-[8px] font-bold uppercase tracking-widest rounded-bl-lg">
                          Internal Component
                        </div>
                      )}

                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${device.type === 'INTERNAL' ? 'bg-[#00FFCC]/20 text-[#00FFCC]' : 'bg-white/5 text-white/60'}`}>
                            {device.category === 'DEVICE' ? (
                              <CircuitBoard className="w-5 h-5" />
                            ) : (
                              <div className="relative w-5 h-5">
                                <Cloud className="w-5 h-5 animate-pulse opacity-60" />
                                <div className="absolute inset-0 bg-white/20 blur-sm rounded-full animate-ping" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className={`text-sm font-bold tracking-wider ${device.type === 'INTERNAL' ? 'text-[#00FFCC]' : 'text-white'}`}>{device.name}</div>
                            <div className="text-[10px] text-white/40 font-mono mt-1 uppercase tracking-widest">
                              ID: {device.id} | BAND: {device.frequencyBand} | RSSI: {device.rssi}dBm
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="h-1 w-16 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 ${device.distance < 10 ? 'bg-[#FF0033]' : 'bg-[#00FFCC]'}`} 
                                  style={{ width: `${Math.max(5, 100 - device.distance)}%` }} 
                                />
                              </div>
                              <span className="text-[9px] text-white/60 font-mono uppercase">Dist: {device.distance.toFixed(1)}m</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          {device.location && (
                            <a 
                              href={`https://www.google.com/maps?q=${device.location.lat},${device.location.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-white/5 text-[#00FFCC] border border-[#00FFCC]/20 rounded-lg hover:bg-[#00FFCC]/10 transition-all"
                              title="View Location"
                            >
                              <MapPin className="w-3 h-3" />
                            </a>
                          )}
                          <button onClick={() => togglePinDevice(device.id)} className={`p-2 rounded-lg border transition-all ${device.isPinned ? 'bg-[#00FFCC] text-black border-[#00FFCC]' : 'bg-white/5 text-white/40 border-white/10 hover:text-white'}`}>
                            <Pin className="w-3 h-3" />
                          </button>
                          <button onClick={() => blacklistDevice(device.id)} className="p-2 bg-white/5 text-white/40 border border-white/10 rounded-lg hover:text-[#FF0033] hover:border-[#FF0033] transition-all">
                            <Ban className="w-3 h-3" />
                          </button>
                          <button onClick={() => removeDevice(device.id)} className="p-2 bg-white/5 text-white/40 border border-white/10 rounded-lg hover:text-red-500 hover:border-red-500 transition-all">
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <button onClick={() => removeDevice(device.id)} className="p-2 bg-white/5 text-white/40 border border-white/10 rounded-lg hover:text-white hover:border-white transition-all">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
                        <div>
                          <div className="text-[8px] text-white/40 uppercase tracking-widest mb-1">Threat Assessment</div>
                          <div className={`text-[10px] font-bold ${device.threat === 'HIGH' ? 'text-[#FF0033]' : 'text-green-500'}`}>{device.threat}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[8px] text-white/40 uppercase tracking-widest mb-1">Last Transmission</div>
                          <div className="text-[10px] text-white/60 font-mono">{device.timestamp}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: System Status & Logs */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                <div className="flex items-center gap-2 mb-6 text-[#00FFCC]">
                  <Cpu className="w-4 h-4" />
                  <span className="text-xs font-bold tracking-widest uppercase">Core Diagnostics</span>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-[8px] text-white/40 uppercase">CPU Load</div>
                      <div className="text-[10px] text-[#00FFCC] font-bold">{refreshRate > 60 ? '78%' : '24%'}</div>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-[#00FFCC] transition-all duration-500" style={{ width: refreshRate > 60 ? '78%' : '24%' }} />
                    </div>
                  </div>
                  <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-[8px] text-white/40 uppercase">Memory</div>
                      <div className="text-[10px] text-[#00FFCC] font-bold">1.2 GB</div>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-[#00FFCC]" style={{ width: '45%' }} />
                    </div>
                  </div>
                  <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                    <div className="flex justify-between items-center">
                      <div className="text-[8px] text-white/40 uppercase">GPS Status</div>
                      <div className={`text-[10px] font-bold ${userLocation ? 'text-[#00FFCC]' : 'text-[#FF0033]'}`}>
                        {userLocation ? 'LOCKED' : 'ACQUIRING...'}
                      </div>
                    </div>
                    {userLocation && (
                      <div className="text-[8px] text-white/20 font-mono mt-1 text-right">
                        {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex-1">
                <div className="flex items-center gap-2 mb-6 text-[#FF0033]">
                  <Terminal className="w-4 h-4" />
                  <span className="text-xs font-bold tracking-widest uppercase">Guardian Event Log</span>
                </div>
                <div className="space-y-3 font-mono text-[9px]">
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-2 text-white/40">
                      <span className="text-[#FF0033] shrink-0">[{new Date().toLocaleTimeString()}]</span>
                      <span className="break-all">{log}</span>
                    </div>
                  ))}
                  <div className="flex gap-2 text-[#00FFCC] animate-pulse">
                    <span>{'>'}</span>
                    <span>AWAITING SENSOR INPUT...</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#FF0033]/10 border border-[#FF0033]/30 p-6 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-[#FF0033]" />
                  <span className="text-xs font-bold tracking-widest uppercase text-[#FF0033]">Emergency Protocol</span>
                </div>
                <p className="text-[10px] text-white/60 leading-relaxed mb-4">
                  In case of critical infiltration, the Port Shield will automatically rotate encryption keys and isolate the device from the network.
                </p>
                <button className="w-full py-2 bg-[#FF0033] text-white text-[10px] font-bold uppercase tracking-widest rounded hover:bg-[#FF0033]/80 transition-colors">
                  Initiate Lockdown
                </button>
              </div>
            </div>
          </div>

          {/* Return to Stealth Mode */}
          <button 
            onClick={() => {
              setIsRedMode(false);
              localStorage.setItem('spectral_matrix_red_mode', 'false');
            }}
            className="fixed bottom-8 right-8 w-14 h-14 bg-[#FF0033] rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,0,51,0.5)] cursor-pointer hover:scale-110 transition-transform z-50 group"
          >
            <Shield className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
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
