import React from 'react';
import { mockVehicles } from '../Dashboard/dashboardData';
import FleetOverviewList from '../Dashboard/FleetOverviewList';

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

      <FleetOverviewList vehicles={mockVehicles} />
    </div>
  );
};

export default VehiclesPage;
