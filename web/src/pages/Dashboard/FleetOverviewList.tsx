import React from 'react';
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

const FleetOverviewList: React.FC<FleetOverviewListProps> = ({ vehicles = defaultVehicles, className = '' }) => (
  <div className={`overflow-x-auto ${className}`.trim()}>
    <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
      <thead className="bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-300">
        <tr>
          <th className="px-6 py-3">Driver</th>
          <th className="px-6 py-3">Plate</th>
          <th className="px-6 py-3">Route</th>
          <th className="px-6 py-3">Load</th>
          <th className="px-6 py-3">Status</th>
          <th className="px-6 py-3">ETA</th>
          <th className="px-6 py-3">Last ping</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
        {vehicles.map((vehicle) => {
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
              <td className="whitespace-nowrap px-6 py-4">
                <div className="font-medium text-slate-900 dark:text-white">{vehicle.driverName}</div>
                <p className="text-xs text-slate-500">{vehicle.id}</p>
              </td>
              <td className="px-6 py-4">
                <p className="font-medium text-slate-900 dark:text-white">{vehicle.plateNumber}</p>
              </td>
              <td className="px-6 py-4">
                <p className="text-slate-700 dark:text-slate-200">{vehicle.routeName}</p>
                <p className="text-xs text-slate-500">{vehicle.speedKph} kph</p>
              </td>
              <td className="px-6 py-4">
                <p className="font-medium text-slate-900 dark:text-white">
                  {vehicle.currentLoadKg.toLocaleString()} kg
                  <span className="text-xs text-slate-500"> / {vehicle.capacityKg.toLocaleString()} kg</span>
                </p>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${loadPercent}%` }} />
                </div>
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[vehicle.status]}`}>
                  {statusLabels[vehicle.status]}
                </span>
              </td>
              <td className="px-6 py-4 text-slate-700 dark:text-slate-200">{etaLabel}</td>
              <td className="px-6 py-4 text-slate-700 dark:text-slate-200">{lastPing}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default FleetOverviewList;
