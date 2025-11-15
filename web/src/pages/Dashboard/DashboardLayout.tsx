import MapPane from './MapPane';
import VehiclePane from './VehiclePane';
import InventoryPane from './InventoryPane';
import { inventoryItems, mockVehicles } from './dashboardData';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface DashboardCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}

const iconClasses = 'h-5 w-5 text-slate-600 dark:text-slate-200';

const MapIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className={iconClasses}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 21s6-5.686 6-10.2C18 7.015 15.313 4 12 4s-6 3.015-6 6.8C6 15.314 12 21 12 21z"
    />
    <circle cx="12" cy="10" r="2" />
  </svg>
);

const DashboardCard = ({ title, description, icon, children, className = '' }: DashboardCardProps) => (
  <section
    className={`flex h-full flex-col rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60 backdrop-blur-sm transition-colors dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-slate-900/30 ${className}`.trim()}
  >
    <header className="flex items-start gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
        {icon}
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold leading-6 tracking-tight text-slate-900 dark:text-white">{title}</p>
        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </header>
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 pt-4">{children}</div>
    </div>
  </section>
);

const DashboardLayout = () => {
  const navigate = useNavigate();

  const handleVehicleSelect = () => {
    navigate('/vehicles');
  };

  return (
    <div className="flex min-h-full flex-1 flex-col gap-8 px-6 py-6 md:px-8">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">Kidapawan operations</p>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white md:text-4xl">
          Field logistics dashboard
        </h1>
        <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
          Live demo data for dispatch leads to monitor vehicle health and inventory readiness inside AppLayout.
        </p>
      </div>

      <div className="grid flex-1 grid-cols-1 items-start gap-6 lg:grid-cols-2 xl:grid-cols-[3fr_2fr]">
        <DashboardCard
          className="h-full"
          title="Live fleet tracking"
          description={`Monitoring ${mockVehicles.length} Kidapawan-based vehicles across active routes.`}
          icon={<MapIcon />}
        >
          <MapPane className="border-0 bg-transparent p-0 shadow-none" showHeader={false} />
        </DashboardCard>

        <section className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60 backdrop-blur-sm transition-colors dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-slate-900/30">
          <header className="flex flex-col gap-2 border-b border-slate-100 pb-5 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Fleet health
            </p>
            <h2 className="text-2xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white">
              Vehicle readiness
            </h2>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Statuses, telemetry, and load factors for every driver on duty plus critical inventory at a glance.
            </p>
          </header>

          <div className="flex flex-1 flex-col gap-6 overflow-hidden pt-5">
            <VehiclePane
              vehicles={mockVehicles}
              className="flex-1 overflow-hidden rounded-2xl border border-slate-100 bg-white/90 p-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60"
              showHeader
              onVehicleSelect={handleVehicleSelect}
            />

            <InventoryPane
              items={inventoryItems}
              className="h-auto shrink-0 rounded-2xl border border-slate-100 bg-white/90 p-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60"
              showHeader
            />
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardLayout;
