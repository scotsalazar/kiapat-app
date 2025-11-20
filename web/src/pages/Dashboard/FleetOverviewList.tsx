import React from 'react';
import { useTranslation } from 'react-i18next';
import { MockVehicle } from './types';
import { mockVehicles as defaultVehicles } from './dashboardData';

interface FleetOverviewListProps {
  vehicles?: MockVehicle[];
  className?: string;
}

const statusStyles: Record<MockVehicle['status'], string> = {
  delivering: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  idle: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200',
  loading: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  maintenance: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
};

const statusLabels: Record<MockVehicle['status'], string> = {
  delivering: 'Delivering',
  idle: 'Idle',
  loading: 'Loading',
  maintenance: 'Maintenance',
};

const FleetOverviewList: React.FC<FleetOverviewListProps> = ({ vehicles = defaultVehicles, className = '' }) => {
  const { t } = useTranslation();

  return (
    <div className={`overflow-x-auto ${className}`.trim()}>
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-300">
          <tr>
            <th className="px-6 py-3">{t('common.labels.driver')}</th>
            <th className="px-6 py-3">Plate</th>
            <th className="px-6 py-3">Route</th>
            <th className="px-6 py-3">Load</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3">ETA</th>
            <th className="px-6 py-3">Last ping</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
          {vehicles.length === 0 ? (
            <tr>
              <td className="px-6 py-6 text-center text-sm text-slate-500" colSpan={7}>
                No fleet data available. Connect telemetry to see vehicles here.
              </td>
            </tr>
          ) : (
            vehicles.map((vehicle) => {
              const etaLabel =
                vehicle.etaMinutes > 0
                  ? `~${vehicle.etaMinutes} min`
                  : vehicle.status === 'maintenance'
                  ? '—'
                  : 'N/A';
              const lastPing = new Date(vehicle.lastReported).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              });
              const loadPercent = Math.round((vehicle.currentLoadKg / vehicle.capacityKg) * 100);

              return (
                <tr key={vehicle.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{vehicle.driver}</td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-200">{vehicle.plate}</td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-200">{vehicle.route}</td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-indigo-500"
                          style={{ width: `${Math.min(loadPercent, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-600 dark:text-slate-300">{loadPercent}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[vehicle.status]}`}>
                      {statusLabels[vehicle.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-200">{etaLabel}</td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-200">{lastPing}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default FleetOverviewList;
