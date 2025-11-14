import React from 'react';
import { mockVehicles, type MockVehicle } from '../Dashboard/dashboardData';

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

const VehiclesPage: React.FC = () => {
  const fleetTotals = React.useMemo(() => {
    const totals = mockVehicles.reduce(
      (acc, vehicle) => {
        acc.capacity += vehicle.capacityKg;
        acc.load += vehicle.currentLoadKg;
        acc.delivering += vehicle.status === 'delivering' ? 1 : 0;
        acc.idle += vehicle.status === 'idle' ? 1 : 0;
        acc.loading += vehicle.status === 'loading' ? 1 : 0;
        acc.maintenance += vehicle.status === 'maintenance' ? 1 : 0;
        return acc;
      },
      { capacity: 0, load: 0, delivering: 0, idle: 0, loading: 0, maintenance: 0 }
    );

    return {
      ...totals,
      utilization: totals.capacity ? Math.round((totals.load / totals.capacity) * 100) : 0,
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Fleet Operations
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Vehicles</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Monitoring Kidapawan-based logistics vehicles with live status, load levels, and driver activity.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Active vehicles</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{mockVehicles.length}</p>
          <p className="mt-1 text-xs text-slate-400">
            {fleetTotals.delivering} delivering · {fleetTotals.loading} loading
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Fleet load</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
            {fleetTotals.load.toLocaleString()} kg
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {fleetTotals.capacity.toLocaleString()} kg capacity · {fleetTotals.utilization}% utilized
          </p>
          <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${fleetTotals.utilization}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Idle & maintenance</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
            {fleetTotals.idle + fleetTotals.maintenance}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {fleetTotals.idle} idle · {fleetTotals.maintenance} in maintenance
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
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
              {mockVehicles.map((vehicle) => {
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
      </div>
    </div>
  );
};

export default VehiclesPage;
