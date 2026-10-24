import React from 'react';
import { ShieldCheck, Wifi, Terminal, HardDrive } from 'lucide-react';

export const FooterBar: React.FC = () => {
  return (
    <footer className="h-8 bg-white border-t border-slate-200 flex items-center justify-between px-4 lg:px-6 shrink-0 text-[10px] text-slate-500 font-medium select-none z-20">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-700 uppercase tracking-wider">
            System Operational
          </span>
        </div>
        <span className="text-slate-300">|</span>
        <div className="hidden sm:flex items-center gap-1">
          <Wifi className="w-3 h-3 text-slate-400" />
          <span className="font-mono">14ms latency</span>
        </div>
        <span className="hidden sm:inline text-slate-300">|</span>
        <div className="hidden md:flex items-center gap-1 text-slate-600">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          <span>PCI-DSS & HIPAA Compliant</span>
        </div>
      </div>

      <div className="hidden lg:flex items-center gap-2 font-mono text-slate-400">
        <HardDrive className="w-3 h-3" />
        <span>NODE: US-EAST-CLINICAL-01</span>
        <span>·</span>
        <span>FHIR v4.0.1</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden sm:inline font-mono text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
          CMD+K SEARCH
        </span>
        <div className="flex items-center gap-1 text-slate-600 font-mono">
          <Terminal className="w-3 h-3 text-blue-600" />
          <span className="font-semibold">MEDCORE OS v4.2.1</span>
        </div>
      </div>
    </footer>
  );
};
