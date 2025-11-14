import { MockVehicle } from './types';
import { mockVehicles as defaultVehicles } from './dashboardData';

interface VehiclePaneProps {
  vehicles?: MockVehicle[];
}

const STATUS_STYLES: Record<MockVehicle['status'], string> = {
  delivering: 'bg-green-100 text-green-700 border border-green-200',
  idle: 'bg-slate-100 text-slate-600 border border-slate-200',
  loading: 'bg-amber-100 text-amber-700 border border-amber-200',
  maintenance: 'bg-rose-100 text-rose-700 border border-rose-200',
};

const VehiclePane = ({ vehicles = defaultVehicles }: VehiclePaneProps) => {
  return (
    <section className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">Fleet overview</p>
          <h2 className="text-2xl font-semibold text-slate-900">Active vehicles</h2>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>Updated moments ago</p>
          <p>ETA placeholders shown for demo</p>
        </div>
      </div>

      <div className="mt-5 grid max-h-[400px] gap-4 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
        {vehicles.map((vehicle) => (
          <article
            key={vehicle.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{vehicle.id}</p>
                <h3 className="text-lg font-semibold text-slate-900">{vehicle.driverName}</h3>
                <p className="text-xs text-slate-500">{vehicle.routeName}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[vehicle.status]}`}>
                {vehicle.status}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-2 text-[13px]">
              <div className="rounded-lg bg-white/80 p-2">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Speed</dt>
                <dd className="font-semibold text-slate-900">{vehicle.speedKph} km/h</dd>
              </div>
              <div className="rounded-lg bg-white/80 p-2">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Capacity</dt>
                <dd className="font-semibold text-slate-900">
                  {vehicle.currentLoadKg}/{vehicle.capacityKg} kg
                </dd>
              </div>
            </dl>

            <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 p-3 text-xs text-slate-600">
              <p className="font-medium text-slate-900">Last known position</p>
              <p>
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
