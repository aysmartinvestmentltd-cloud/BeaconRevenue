import React, { useState } from 'react';
import { RotateCw, Compass, ShieldCheck, Eye, Layers } from 'lucide-react';
import type { SmartRideVehicle } from '../../types/smart-ride';

interface Vehicle360ViewerProps {
  vehicle: SmartRideVehicle;
}

const ANGLES = [
  { deg: 0, label: 'Front Three-Quarter Studio' },
  { deg: 45, label: 'Driver Profile & Alloy Spec' },
  { deg: 90, label: 'Side Silhouette & Glasshouse' },
  { deg: 135, label: 'Rear Three-Quarter Tail' },
  { deg: 180, label: 'Rear Diffuser & Exhaust' },
  { deg: 225, label: 'Passenger Side Quarter' },
  { deg: 270, label: 'Cockpit & Nappa Trim' },
  { deg: 315, label: 'Engine Bay & Strut Tower' },
];

export const Vehicle360Viewer: React.FC<Vehicle360ViewerProps> = ({ vehicle }) => {
  const [angleIndex, setAngleIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'EXTERIOR_360' | 'INTERIOR_COCKPIT' | 'CHASSIS_SCAN'>('EXTERIOR_360');
  const [activeHotspot, setActiveHotspot] = useState<'PRIMARY' | 'SECONDARY' | 'UNDERCARRIAGE'>('PRIMARY');

  const currentAngle = ANGLES[angleIndex] || ANGLES[0];

  const handleNextAngle = () => {
    setAngleIndex((prev) => (prev + 1) % ANGLES.length);
  };

  const handlePrevAngle = () => {
    setAngleIndex((prev) => (prev - 1 + ANGLES.length) % ANGLES.length);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Top Viewer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="font-semibold text-slate-200">{vehicle.lotId}</span>
          <span aria-hidden="true">·</span>
          <span>Smart Ride 360° Optical Inspection Studio</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-emerald-400">{currentAngle.deg}° Yaw</span>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode('EXTERIOR_360')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'EXTERIOR_360'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Exterior 360°
          </button>
          <button
            type="button"
            onClick={() => setViewMode('INTERIOR_COCKPIT')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'INTERIOR_COCKPIT'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Interior Panorama
          </button>
          <button
            type="button"
            onClick={() => setViewMode('CHASSIS_SCAN')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'CHASSIS_SCAN'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Undercarriage & Paint
          </button>
        </div>
      </div>

      {/* Main Interactive SVG Studio Canvas */}
      <div
        data-testid="vehicle-360-canvas"
        className="relative h-72 sm:h-80 w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6 select-none overflow-hidden"
      >
        {/* Subtle Architectural Showroom Grid */}
        <svg
          className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
          viewBox="0 0 800 400"
          preserveAspectRatio="none"
        >
          <defs>
            <radialGradient id="studioGlow" cx="50%" cy="55%" r="50%">
              <stop offset="0%" stopColor={vehicle.accentHex} stopOpacity="0.35" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="800" height="400" fill="url(#studioGlow)" />
          <ellipse cx="400" cy="295" rx="290" ry="42" fill="none" stroke={vehicle.accentHex} strokeWidth="1.5" strokeDasharray="6 6" />
          <ellipse cx="400" cy="295" rx="220" ry="26" fill="none" stroke="#475569" strokeWidth="1" />
        </svg>

        {viewMode === 'EXTERIOR_360' && (
          <div className="relative z-10 w-full max-w-xl flex flex-col items-center">
            <svg
              viewBox="0 0 640 240"
              className="w-full h-44 transition-transform duration-200"
              style={{
                transform: `scaleX(${angleIndex >= 3 && angleIndex <= 5 ? -1 : 1})`,
              }}
              aria-label={`${vehicle.year} ${vehicle.make} ${vehicle.model} 360 Studio Vector`}
            >
              {/* Turntable Shadow */}
              <ellipse cx="320" cy="198" rx="235" ry="18" fill="#020617" opacity="0.85" />
              {/* Executive SUV / Coupe Parametric Body */}
              <path
                d="M95 162 L118 118 L205 104 L268 62 L448 62 L512 108 L552 126 L560 165 L515 174 L125 174 Z"
                fill="#1e293b"
                stroke={vehicle.accentHex}
                strokeWidth="2.5"
              />
              {/* Greenhouse / Cabin Windows */}
              <path
                d="M274 70 L358 70 L358 106 L222 106 Z"
                fill="#0f172a"
                stroke="#64748b"
                strokeWidth="1.5"
              />
              <path
                d="M368 70 L440 70 L492 106 L368 106 Z"
                fill="#0f172a"
                stroke="#64748b"
                strokeWidth="1.5"
              />
              {/* LED Matrix Headlight & DRL */}
              <path d="M104 132 L144 126 L138 142 L102 144 Z" fill="#38bdf8" />
              {/* LED Tail Light Bar */}
              <path d="M538 122 L556 126 L554 142 L534 140 Z" fill="#f43f5e" />
              {/* Forged Executive Alloy Wheels */}
              <g transform="translate(185, 170)">
                <circle r="34" fill="#090d16" stroke="#475569" strokeWidth="4" />
                <circle r="22" fill="#1e293b" stroke={vehicle.accentHex} strokeWidth="2" />
                <circle r="6" fill={vehicle.accentHex} />
              </g>
              <g transform="translate(465, 170)">
                <circle r="34" fill="#090d16" stroke="#475569" strokeWidth="4" />
                <circle r="22" fill="#1e293b" stroke={vehicle.accentHex} strokeWidth="2" />
                <circle r="6" fill={vehicle.accentHex} />
              </g>
            </svg>

            <div className="mt-2 flex items-center gap-4 text-xs text-slate-300">
              <button
                type="button"
                onClick={handlePrevAngle}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                Rotate -45°
              </button>
              <span className="font-medium text-slate-200">{currentAngle.label}</span>
              <button
                type="button"
                onClick={handleNextAngle}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                Rotate +45°
              </button>
            </div>
          </div>
        )}

        {viewMode === 'INTERIOR_COCKPIT' && (
          <div className="relative z-10 w-full max-w-xl bg-slate-950/80 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div>
                <p className="text-sm font-semibold text-white">360° Executive Cabin & Telemetry Verification</p>
                <p className="text-xs text-slate-400">Trim Spec: {vehicle.interiorColor} · Drivetrain: {vehicle.drivetrain}</p>
              </div>
              <Compass className="w-5 h-5 text-emerald-400 shrink-0" />
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <p className="text-slate-400">Odometer Cluster</p>
                <p className="text-sm font-mono tabular-nums font-semibold text-white mt-1">
                  {vehicle.mileageMiles.toLocaleString()} mi
                </p>
                <p className="text-emerald-400 mt-0.5">OBD-II Match Verified</p>
              </div>
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <p className="text-slate-400">Airbag & Restraint</p>
                <p className="text-sm font-semibold text-white mt-1">100% Factory Intact</p>
                <p className="text-emerald-400 mt-0.5">Zero Fault Codes</p>
              </div>
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <p className="text-slate-400">Climate & Acoustics</p>
                <p className="text-sm font-semibold text-white mt-1">38.4°F Vent Output</p>
                <p className="text-emerald-400 mt-0.5">Cabin Pressure Nominal</p>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'CHASSIS_SCAN' && (
          <div className="relative z-10 w-full max-w-xl bg-slate-950/80 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div>
                <p className="text-sm font-semibold text-white">Micron Paint Depth & Undercarriage Laser Scan</p>
                <p className="text-xs text-slate-400">VIN: {vehicle.vin} · Engine: {vehicle.engineNumber}</p>
              </div>
              <Layers className="w-5 h-5 text-emerald-400 shrink-0" />
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <p className="text-slate-400">Factory Clearcoat</p>
                <p className="text-sm font-mono tabular-nums font-semibold text-white mt-1">118 – 126 μm</p>
                <p className="text-slate-400 mt-0.5">OEM Spec Tolerance</p>
              </div>
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <p className="text-slate-400">Frame Rail Geometry</p>
                <p className="text-sm font-mono tabular-nums font-semibold text-white mt-1">±0.01 mm</p>
                <p className="text-emerald-400 mt-0.5">Zero Structural Shift</p>
              </div>
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <p className="text-slate-400">Subframe & Corrosion</p>
                <p className="text-sm font-semibold text-white mt-1">Grade A+ Dry</p>
                <p className="text-emerald-400 mt-0.5">{vehicle.undercarriageNote}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Angle Scrubber + Condition Hotspot Matrix */}
      <div className="p-5 bg-slate-950 border-t border-slate-800 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor={`angle-slider-${vehicle.id}`} className="text-xs font-medium text-slate-400 whitespace-nowrap">
            360° Turntable Scrub ({currentAngle.deg}°)
          </label>
          <input
            id={`angle-slider-${vehicle.id}`}
            type="range"
            min={0}
            max={ANGLES.length - 1}
            value={angleIndex}
            onChange={(e) => setAngleIndex(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
        </div>

        {/* High-Resolution Inspection Hotspot Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            type="button"
            onClick={() => setActiveHotspot('PRIMARY')}
            className={`text-left p-3 rounded-lg border transition-colors ${
              activeHotspot === 'PRIMARY'
                ? 'bg-slate-900 border-emerald-500/60 text-white'
                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-medium text-emerald-400">
              <span>01. Primary Structural</span>
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs text-slate-200 mt-1 line-clamp-2">{vehicle.primaryNote}</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveHotspot('SECONDARY')}
            className={`text-left p-3 rounded-lg border transition-colors ${
              activeHotspot === 'SECONDARY'
                ? 'bg-slate-900 border-emerald-500/60 text-white'
                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-medium text-amber-400">
              <span>02. Cosmetic / Surface</span>
              <Eye className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs text-slate-200 mt-1 line-clamp-2">{vehicle.secondaryNote}</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveHotspot('UNDERCARRIAGE')}
            className={`text-left p-3 rounded-lg border transition-colors ${
              activeHotspot === 'UNDERCARRIAGE'
                ? 'bg-slate-900 border-emerald-500/60 text-white'
                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-medium text-sky-400">
              <span>03. Undercarriage Spec</span>
              <RotateCw className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs text-slate-200 mt-1 line-clamp-2">{vehicle.undercarriageNote}</p>
          </button>
        </div>
      </div>
    </div>
  );
};
