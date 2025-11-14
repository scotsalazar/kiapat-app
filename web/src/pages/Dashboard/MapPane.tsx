import { useEffect, useMemo, useState } from 'react';
import { GoogleMap, MarkerF, useLoadScript } from '@react-google-maps/api';
import {
  KIDAPAWAN_CITY_COORDINATES,
  mockVehicles,
  getInitialVehiclePositions,
  jitterCoordinates,
} from './dashboardData';
import type { Coordinate, VehicleStatus } from './types';

const MAP_ZOOM = 13;
const MAP_CONTAINER_BASE_CLASSES =
  'flex min-h-[320px] w-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:min-h-[420px] lg:h-full dark:border-slate-800 dark:bg-slate-900';
const JITTER_INTERVAL_MS = 6000;
const JITTER_RADIUS_METERS = 120;

interface MapPaneProps {
  className?: string;
  showHeader?: boolean;
}

const statusStyles: Record<VehicleStatus, { label: string; className: string }> = {
  delivering: { label: 'Delivering', className: 'bg-emerald-600 text-white' },
  loading: { label: 'Loading', className: 'bg-amber-400 text-slate-900' },
  idle: { label: 'Idle', className: 'bg-slate-500 text-white' },
  maintenance: { label: 'Maintenance', className: 'bg-rose-600 text-white' },
};

const MapPane = ({ className = '', showHeader = true }: MapPaneProps) => {
  const [vehiclePositions, setVehiclePositions] = useState<Record<string, Coordinate>>(
    () => getInitialVehiclePositions()
  );

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const center = useMemo(() => KIDAPAWAN_CITY_COORDINATES, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setVehiclePositions((prev) => {
        const nextPositions: Record<string, Coordinate> = { ...prev };
        mockVehicles.forEach((vehicle) => {
          const previous = prev[vehicle.id] ?? vehicle.location;
          nextPositions[vehicle.id] = jitterCoordinates(previous, JITTER_RADIUS_METERS);
        });
        return nextPositions;
      });
    }, JITTER_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const { isLoaded, loadError } = useLoadScript({
    id: 'kiapat-dashboard-map',
    googleMapsApiKey: googleMapsApiKey ?? '',
    language: 'en',
  });

  const containerClasses = `${MAP_CONTAINER_BASE_CLASSES} ${className}`.trim();

  if (!googleMapsApiKey) {
    return (
      <div className={`${containerClasses} items-center justify-center text-center`}>
        <div>
          <p className="text-base font-semibold text-slate-900">Google Maps unavailable</p>
          <p className="mt-1 text-sm text-slate-500">
            Add <code className="rounded bg-slate-100 px-1 py-0.5">VITE_GOOGLE_MAPS_API_KEY</code> to your environment to
            visualize fleet positions.
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`${containerClasses} items-center justify-center text-center`}>
        <div>
          <p className="text-base font-semibold text-rose-600">Unable to load the map</p>
          <p className="mt-1 text-sm text-slate-500">{loadError.message}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`${containerClasses} flex-col justify-center`}>
        <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="mt-6 h-48 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  return (
    <section className={containerClasses}>
      {showHeader && (
        <header className="mb-4">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Live fleet tracking</p>
          <h2 className="text-lg font-semibold text-slate-900">Kidapawan City coverage</h2>
          <p className="text-sm text-slate-500">Monitoring {mockVehicles.length} active logistics vehicles</p>
        </header>
      )}
      <div className="flex-1">
        <GoogleMap
          center={center}
          zoom={MAP_ZOOM}
          mapContainerClassName="h-full min-h-[220px] w-full rounded-xl sm:min-h-[300px] lg:min-h-[420px]"
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            styles: [
              {
                featureType: 'poi',
                stylers: [{ visibility: 'off' }],
              },
            ],
          }}
        >
          {mockVehicles.map((vehicle) => {
            const position = vehiclePositions[vehicle.id] ?? vehicle.location;
            const { label, className } = statusStyles[vehicle.status];
            return (
              <MarkerF
                key={vehicle.id}
                position={position}
                title={`${vehicle.driverName} · ${vehicle.routeName}`}
                label={{
                  text: `${vehicle.id} · ${label}`,
                  className: `rounded-full px-2 py-1 text-[11px] font-semibold uppercase shadow-lg ${className}`,
                }}
              />
            );
          })}
        </GoogleMap>
      </div>
    </section>
  );
};

export default MapPane;
