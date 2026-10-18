// PulseCISC-32 Screen Size Guard
// Requires minimum 1024x720 resolution in landscape orientation
import React, { useState, useEffect } from 'react';
import {
  RotateCw,
  Maximize2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { PulseLogo } from './PulseLogo';

interface ScreenSizeGuardProps {
  children: React.ReactNode;
  minWidth?: number;
  minHeight?: number;
}

export const ScreenSizeGuard: React.FC<ScreenSizeGuardProps> = ({
  children,
  minWidth = 1024,
  minHeight = 576,
}) => {
  const [windowSize, setWindowSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));
  const [bypassed, setBypassed] = useState<boolean>(false);

  useEffect(() => {
    const updateMetrics = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setWindowSize({ width, height });

      if (width >= minWidth && height >= minHeight && width > height) {
        setBypassed(false);
      }
    };

    updateMetrics();

    window.addEventListener('resize', updateMetrics);
    window.addEventListener('orientationchange', updateMetrics);

    const screenOrientation = window.screen?.orientation;
    if (screenOrientation) {
      screenOrientation.addEventListener('change', updateMetrics);
    }

    return () => {
      window.removeEventListener('resize', updateMetrics);
      window.removeEventListener('orientationchange', updateMetrics);
      if (screenOrientation) {
        screenOrientation.removeEventListener('change', updateMetrics);
      }
    };
  }, [minWidth, minHeight]);

  const isLandscape = windowSize.width > windowSize.height;
  const isWidthOk = windowSize.width >= minWidth;
  const isHeightOk = windowSize.height >= minHeight;
  const isSupported = isWidthOk && isHeightOk && isLandscape;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070a10] flex flex-col">
      {/* Top Banner when bypassed */}
      {!isSupported && bypassed && (
        <div className="w-full flex-shrink-0 bg-amber-950/95 border-b border-amber-500/50 text-amber-200 px-4 py-2 flex items-center justify-between text-xs select-none z-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              Screen size: <strong>{windowSize.width} × {windowSize.height}</strong> ({isLandscape ? 'Landscape' : 'Portrait'}). Recommended minimum is <strong>{minWidth} × {minHeight} Landscape</strong>.
            </span>
          </div>
          <button
            onClick={() => setBypassed(false)}
            className="ml-3 px-2 py-0.5 bg-amber-500/25 hover:bg-amber-500/40 text-amber-200 rounded border border-amber-500/50 text-xs font-medium cursor-pointer"
          >
            Show Warning
          </button>
        </div>
      )}

      {/* Main App */}
      <div
        className="flex-1 w-full overflow-hidden flex flex-col"
        aria-hidden={!isSupported && !bypassed}
      >
        {children}
      </div>

      {/* Screen Size Guard Modal */}
      {!isSupported && !bypassed && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-[#070a10]/95 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="relative w-full max-w-md bg-[#0b101d] border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <PulseLogo size={36} glow />
                <span className="font-bold text-base font-mono">
                  Pulse<span className="text-sky-400">CISC</span>-32
                </span>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {!isLandscape ? 'Portrait Mode' : 'Screen Too Small'}
              </span>
            </div>

            {/* Message */}
            <div className="flex flex-col gap-1.5">
              <h1 className="text-lg font-bold text-white">
                {!isLandscape
                  ? 'Please rotate to landscape'
                  : 'Minimum 1024 × 720 screen required'}
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                {!isLandscape
                  ? 'This application requires landscape orientation to display the CPU datapath and registers properly.'
                  : 'This application is designed for big screens (laptops, tablets, or large unfolded displays) with a minimum of 1024 × 720 in landscape.'}
              </p>
            </div>

            {/* Live Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Orientation */}
              <div
                className={`p-2.5 rounded-xl border flex flex-col gap-1 ${
                  isLandscape
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Orientation</span>
                  <RotateCw className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center justify-between font-semibold">
                  <span>{isLandscape ? 'Landscape' : 'Portrait'}</span>
                  {isLandscape ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                </div>
              </div>

              {/* Dimensions */}
              <div
                className={`p-2.5 rounded-xl border flex flex-col gap-1 ${
                  isWidthOk && isHeightOk
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Resolution</span>
                  <Maximize2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center justify-between font-semibold font-mono">
                  <span>
                    {windowSize.width} × {windowSize.height}
                  </span>
                  {isWidthOk && isHeightOk ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
              <span>Auto-detects resize and rotation</span>
              <button
                type="button"
                onClick={() => setBypassed(true)}
                className="text-slate-500 hover:text-slate-300 underline underline-offset-2 cursor-pointer transition-colors"
              >
                Inspect anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
