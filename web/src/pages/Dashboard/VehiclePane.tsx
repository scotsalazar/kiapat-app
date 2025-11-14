import type { KeyboardEvent } from 'react';
import { MockVehicle } from './types';
import { mockVehicles as defaultVehicles } from './dashboardData';

interface VehiclePaneProps {
  vehicles?: MockVehicle[];
  className?: string;
  showHeader?: boolean;
  onVehicleSelect?: (vehicle: MockVehicle) => void;
}

const STATUS_STYLES: Record<MockVehicle['status'], string> = {
  delivering: 'border-green-200/70 bg-green-100 text-green-700 dark:border-emerald-400/40 dark:bg-emerald-950/40 dark:text-emerald-200',
  idle: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200',
  loading: 'border-amber-200/70 bg-amber-100 text-amber-700 dark:border-amber-400/40 dark:bg-amber-950/40 dark:text-amber-200',
  maintenance: 'border-rose-200/70 bg-rose-100 text-rose-700 dark:border-rose-400/40 dark:bg-rose-950/40 dark:text-rose-200',
};

const VehiclePane = ({
  vehicles = defaultVehicles,
  className = '',
  showHeader = true,
  onVehicleSelect,
}: VehiclePaneProps) => {
  const containerClasses = `flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`.trim();

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>, vehicle: MockVehicle) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onVehicleSelect?.(vehicle);
    }
  };

  return (
    <section className={containerClasses}>
      {showHeader && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Fleet overview</p>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Active vehicles</h2>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Updated moments ago</p>
            <p>ETA placeholders shown for demo</p>
          </div>
        </div>
      )}

      <div className="mt-5 grid flex-1 gap-4 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
        {vehicles.map((vehicle) => (
          <article
            key={vehicle.id}
            role={onVehicleSelect ? 'button' : undefined}
            tabIndex={onVehicleSelect ? 0 : undefined}
            onClick={onVehicleSelect ? () => onVehicleSelect(vehicle) : undefined}
            onKeyDown={onVehicleSelect ? (event) => handleKeyDown(event, vehicle) : undefined}
            className="flex min-h-[230px] min-w-[250px] flex-col gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 text-sm text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200"
            style={onVehicleSelect ? { cursor: 'pointer' } : undefined}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{vehicle.id}</p>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{vehicle.driverName}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{vehicle.routeName}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[vehicle.status]}`}>
                {vehicle.status}
              </span>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between rounded-xl bg-white/80 px-3 py-2 text-slate-600 shadow-sm dark:bg-slate-900/70 dark:text-slate-200">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Speed</dt>
                <dd className="text-base font-semibold text-slate-900 dark:text-slate-100">{vehicle.speedKph} km/h</dd>
              </div>
              <div className="flex items-baseline justify-between rounded-xl bg-white/80 px-3 py-2 text-slate-600 shadow-sm dark:bg-slate-900/70 dark:text-slate-200">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Capacity</dt>
                <dd className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {vehicle.currentLoadKg}/{vehicle.capacityKg} kg
                </dd>
              </div>
            </dl>

            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-4 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Last known position</p>
              <p className="text-sm text-slate-600 dark:text-slate-200">
                Lat {vehicle.location.lat.toFixed(4)}, Lng {vehicle.location.lng.toFixed(4)}
              </p>
              <p>Last ping: {new Date(vehicle.lastReported).toLocaleTimeString()}</p>
              <p>ETA to destination: {vehicle.etaMinutes ? `${vehicle.etaMinutes} mins` : 'Awaiting dispatch'}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default VehiclePane;
