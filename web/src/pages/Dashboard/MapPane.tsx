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
  'flex min-h-[420px] w-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:min-h-[480px] lg:min-h-[560px] dark:border-slate-800 dark:bg-slate-900';
const MAP_DIMENSION_CLASSES = 'h-[420px] sm:h-[480px] lg:h-[560px]';
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

  const fallbackMarkers = useMemo(() => {
    const positions = mockVehicles.map(
      (vehicle) => vehiclePositions[vehicle.id] ?? vehicle.location
    );

    if (!positions.length) {
      return [];
    }

    const latitudes = positions.map((pos) => pos.lat);
    const longitudes = positions.map((pos) => pos.lng);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    const latRange = maxLat - minLat || 1;
    const lngRange = maxLng - minLng || 1;

    return mockVehicles.map((vehicle, index) => {
      const position = positions[index];
      const normalizedX = ((position.lng - minLng) / lngRange) * 100;
      const normalizedY = ((position.lat - minLat) / latRange) * 100;

      return {
        vehicle,
        positionStyle: {
          left: `${normalizedX}%`,
          top: `${100 - normalizedY}%`,
        },
      };
    });
  }, [vehiclePositions]);

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
      <section className={`${containerClasses} justify-between`}>
        {showHeader && (
          <header className="mb-4 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Live fleet snapshot</p>
            <h2 className="text-xl font-semibold leading-tight tracking-tight text-slate-900">Kidapawan City coverage</h2>
            <p className="text-sm leading-relaxed text-slate-500">
              Add <code className="rounded bg-slate-100 px-1 py-0.5">VITE_GOOGLE_MAPS_API_KEY</code> for an interactive view. This
              fallback uses live telemetry to keep vehicle placements fresh.
            </p>
          </header>
        )}
        <div className="flex-1">
          <div className={`relative w-full overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 ${MAP_DIMENSION_CLASSES}`}>
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.05)_25%,transparent_25%),linear-gradient(-120deg,rgba(15,23,42,0.05)_25%,transparent_25%)] bg-[length:40px_40px]" />
            {fallbackMarkers.map(({ vehicle, positionStyle }) => {
              const { label, className } = statusStyles[vehicle.status];
              return (
                <div
                  key={vehicle.id}
                  className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ring-1 ring-black/5 ${className}`}
                  style={positionStyle}
                >
                  <span>{vehicle.id}</span>
                  <span className="text-[10px] uppercase tracking-wide opacity-80">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (loadError) {
    return (
      <div className={`${containerClasses} items-center justify-center text-center`}>
        <div className="space-y-2">
          <p className="text-base font-semibold leading-6 tracking-tight text-rose-600">Unable to load the map</p>
          <p className="text-sm leading-relaxed text-slate-500">{loadError.message}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`${containerClasses} flex-col justify-center`}>
        <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className={`mt-6 w-full animate-pulse rounded-xl bg-slate-100 ${MAP_DIMENSION_CLASSES}`} />
      </div>
    );
  }

  return (
    <section className={containerClasses}>
      {showHeader && (
        <header className="mb-4 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Live fleet tracking</p>
          <h2 className="text-xl font-semibold leading-tight tracking-tight text-slate-900">Kidapawan City coverage</h2>
          <p className="text-sm leading-relaxed text-slate-500">
            Monitoring {mockVehicles.length} active logistics vehicles across the valley corridor
          </p>
        </header>
      )}
      <div className="flex-1">
        <GoogleMap
          center={center}
          zoom={MAP_ZOOM}
          mapContainerClassName={`w-full rounded-xl ${MAP_DIMENSION_CLASSES}`}
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
