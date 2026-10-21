// PulseCISC-32 Official Brand SVG Icon & Logo
import React from 'react';

interface PulseLogoProps {
  size?: number | string;
  className?: string;
  glow?: boolean;
}

export const PulseLogo: React.FC<PulseLogoProps> = ({
  size = 36,
  className = '',
  glow = true,
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center flex-shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Dynamic ambient backlight glow */}
      {glow && (
        <div
          className="absolute inset-0 rounded-xl bg-gradient-to-br from-sky-500/30 via-indigo-500/20 to-purple-500/30 blur-md pointer-events-none transform scale-110"
          aria-hidden="true"
        />
      )}

      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 drop-shadow-md"
        role="img"
        aria-label="PulseCISC-32 Logo"
      >
        <defs>
          {/* Background Gradient for Silicon Chip Substrate */}
          <linearGradient id="pl-chipBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0e1726" />
            <stop offset="50%" stopColor="#080c16" />
            <stop offset="100%" stopColor="#03060c" />
          </linearGradient>

          {/* Outer Chip Border Gradient: Electric Cyan to Neon Purple */}
          <linearGradient id="pl-chipBorder" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f0ff" />
            <stop offset="35%" stopColor="#38bdf8" />
            <stop offset="70%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>

          {/* Pulse Waveform Gradient: Cyberpunk Cyan through Indigo to Fuchsia */}
          <linearGradient id="pl-pulseWave" x1="14" y1="32" x2="50" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00f0ff" />
            <stop offset="30%" stopColor="#38bdf8" />
            <stop offset="65%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#e879f9" />
          </linearGradient>

          {/* Pin Gradients */}
          <linearGradient id="pl-pinCyan" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id="pl-pinPurple" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>

          {/* Radial Core Glow */}
          <radialGradient id="pl-dieCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.22" />
            <stop offset="70%" stopColor="#818cf8" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 16 Bus Pins (32-Bit Dual-Bus Identity: 4 per side) */}
        <g strokeLinecap="round" strokeWidth="2.4">
          {/* Top Pins (Clock & Control / Cyan) */}
          <path d="M20 5v7M28 5v7M36 5v7M44 5v7" stroke="url(#pl-pinCyan)" />
          {/* Bottom Pins (Data Bus / Violet) */}
          <path d="M20 52v7M28 52v7M36 52v7M44 52v7" stroke="url(#pl-pinPurple)" />
          {/* Left Pins (Address Lines / Cyan) */}
          <path d="M5 20h7M5 28h7M5 36h7M5 44h7" stroke="url(#pl-pinCyan)" />
          {/* Right Pins (Status & Execution / Violet) */}
          <path d="M52 20h7M52 28h7M52 36h7M52 44h7" stroke="url(#pl-pinPurple)" />
        </g>

        {/* Main Chip Package Base */}
        <rect
          x="12"
          y="12"
          width="40"
          height="40"
          rx="9"
          fill="url(#pl-chipBg)"
          stroke="url(#pl-chipBorder)"
          strokeWidth="1.8"
        />

        {/* Silicon Die Window */}
        <rect
          x="19"
          y="19"
          width="26"
          height="26"
          rx="5"
          fill="#050813"
          stroke="#38bdf8"
          strokeOpacity="0.3"
          strokeWidth="1"
        />

        {/* Central Wafer Core Glow */}
        <rect
          x="19"
          y="19"
          width="26"
          height="26"
          rx="5"
          fill="url(#pl-dieCoreGlow)"
        />

        {/* Micro-Architecture Circuit Traces & Alignment Markers */}
        <g stroke="#38bdf8" strokeOpacity="0.22" strokeWidth="1" strokeLinecap="round">
          <path d="M19 25h3M19 39h3M42 25h3M42 39h3" />
          <path d="M25 19v3M39 19v3M25 42v3M39 42v3" />
        </g>
        <circle cx="23" cy="23" r="0.9" fill="#38bdf8" opacity="0.6" />
        <circle cx="41" cy="23" r="0.9" fill="#c084fc" opacity="0.6" />
        <circle cx="23" cy="41" r="0.9" fill="#38bdf8" opacity="0.6" />
        <circle cx="41" cy="41" r="0.9" fill="#c084fc" opacity="0.6" />

        {/* === PULSE WAVEFORM (Dynamic Multi-Cycle Clock Signal) === */}
        {/* Layer 1: Ambient Neon Glow Aura */}
        <path
          d="M14 32h8l4-13 6 26 5-19 4 6h9"
          fill="none"
          stroke="#00f0ff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.28"
        />

        {/* Layer 2: Main Gradient Pulse Line */}
        <path
          d="M14 32h8l4-13 6 26 5-19 4 6h9"
          fill="none"
          stroke="url(#pl-pulseWave)"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Layer 3: Ultra-Crisp White Hot Core Beam */}
        <path
          d="M14 32h8l4-13 6 26 5-19 4 6h9"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        />

        {/* Apex Clock Impulse Sparks */}
        {/* Positive Peak (Cyan Flash) */}
        <circle cx="26" cy="19" r="3.6" fill="#00f0ff" opacity="0.4" />
        <circle cx="26" cy="19" r="2" fill="#ffffff" />

        {/* Negative Trough (Purple Spark) */}
        <circle cx="32" cy="45" r="3.2" fill="#a855f7" opacity="0.4" />
        <circle cx="32" cy="45" r="1.6" fill="#f5d0fe" />
      </svg>
    </div>
  );
};
