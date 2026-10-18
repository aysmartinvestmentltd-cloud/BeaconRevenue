import React from 'react';
import { CheckCircle2, Clock, Anchor, Truck, ShieldCheck, MapPin } from 'lucide-react';
import type { SmartRideVehicle } from '../../types/smart-ride';

interface LogisticsTimelineProps {
  vehicle: SmartRideVehicle;
  onAdvanceStage?: (lotId: string) => void;
}

const MILESTONES = [
  {
    index: 0,
    title: '01. Smart Ride US Yard Acquisition',
    subtitle: 'Title verification, 150-point mechanical check & export release',
    icon: ShieldCheck,
  },
  {
    index: 1,
    title: '02. Enclosed US Port Marshalling',
    subtitle: 'Insured carrier dispatch to Newark, Houston, or Savannah terminal',
    icon: Truck,
  },
  {
    index: 2,
    title: '03. Ocean RoRo / Container Transit',
    subtitle: 'Atlantic marine crossing with Bill of Lading telemetry',
    icon: Anchor,
  },
  {
    index: 3,
    title: '04. Tin Can / Apapa Customs Clearing',
    subtitle: 'Nigeria Customs Service assessment, duty settlement & terminal exit',
    icon: Clock,
  },
  {
    index: 4,
    title: '05. E-Y Investment Lagos Hub Handover',
    subtitle: 'Victoria Island executive detailing & client key delivery',
    icon: MapPin,
  },
];

export const LogisticsTimeline: React.FC<LogisticsTimelineProps> = ({
  vehicle,
  onAdvanceStage,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <p className="text-xs text-slate-400">
            Smart Ride US-to-Lagos Ocean & Customs Pipeline · Lot {vehicle.lotId}
          </p>
          <h3 className="text-lg font-semibold text-white mt-0.5">
            {vehicle.year} {vehicle.make} {vehicle.model} — {vehicle.usDeparturePort} to {vehicle.defaultDestinationPort}
          </h3>
        </div>
        {onAdvanceStage && vehicle.logisticsStageIndex < 4 && (
          <button
            type="button"
            onClick={() => onAdvanceStage(vehicle.lotId)}
            className="px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Simulate Next Milestone
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
        {MILESTONES.map((step) => {
          const Icon = step.icon;
          const isCompleted = step.index <= vehicle.logisticsStageIndex;
          const isCurrent = step.index === vehicle.logisticsStageIndex;

          return (
            <div
              key={step.index}
              className={`p-4 rounded-xl border transition-colors ${
                isCurrent
                  ? 'bg-emerald-950/30 border-emerald-500/70'
                  : isCompleted
                  ? 'bg-slate-950/70 border-slate-800'
                  : 'bg-slate-950/30 border-slate-800/60 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon
                  className={`w-4 h-4 ${
                    isCompleted ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                />
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  {isCurrent ? 'Active Stage' : isCompleted ? 'Verified' : 'Scheduled'}
                </span>
              </div>
              <p className="text-sm font-semibold text-white mt-3">{step.title}</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{step.subtitle}</p>
              {isCompleted && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Cleared by E-Y Logistics</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
