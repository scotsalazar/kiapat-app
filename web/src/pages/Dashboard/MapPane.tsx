import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, InfoWindowF, MarkerF, useLoadScript } from '@react-google-maps/api';
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

const statusStyles: Record<
  VehicleStatus,
  { label: string; className: string; pinColor: string; accentColor: string }
> = {
  delivering: {
    label: 'Delivering',
    className: 'bg-emerald-600 text-white',
    pinColor: '#059669',
    accentColor: '#bbf7d0',
  },
  loading: {
    label: 'Loading',
    className: 'bg-amber-400 text-slate-900',
    pinColor: '#d97706',
    accentColor: '#fef3c7',
  },
  idle: {
    label: 'Idle',
    className: 'bg-slate-500 text-white',
    pinColor: '#475569',
    accentColor: '#cbd5f5',
  },
  maintenance: {
    label: 'Maintenance',
    className: 'bg-rose-600 text-white',
    pinColor: '#dc2626',
    accentColor: '#fecdd3',
  },
};

const createPinSvg = (pinColor: string, accentColor: string) => `
  <svg width="48" height="56" viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 0C13.5066 0 5 8.50659 5 19C5 32.25 24 56 24 56C24 56 43 32.25 43 19C43 8.50659 34.4934 0 24 0Z" fill="${pinColor}" />
    <circle cx="24" cy="21" r="11" fill="white" fill-opacity="0.9" />
    <circle cx="24" cy="21" r="7" fill="${accentColor}" />
  </svg>
`;

const svgToDataUrl = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const createMarkerIcon = (pinColor: string, accentColor: string): google.maps.Icon => {
  const svg = createPinSvg(pinColor, accentColor);
  const scaledSize = new window.google.maps.Size(48, 56);
  return {
    url: svgToDataUrl(svg),
    scaledSize,
    anchor: new window.google.maps.Point(24, 56),
  };
};

const MapPane = ({ className = '', showHeader = true }: MapPaneProps) => {
  const [vehiclePositions, setVehiclePositions] = useState<Record<string, Coordinate>>(
    () => getInitialVehiclePositions()
  );
  const [hoveredVehicleId, setHoveredVehicleId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

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

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const scheduleHoverClear = () => {
    clearHoverTimeout();
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredVehicleId(null);
    }, 180);
  };

  const statusIconMap = useMemo(() => {
    if (!isLoaded || !window.google?.maps) {
      return null;
    }

    return Object.entries(statusStyles).reduce<Record<VehicleStatus, google.maps.Icon>>(
      (acc, [status, style]) => {
        acc[status as VehicleStatus] = createMarkerIcon(style.pinColor, style.accentColor);
        return acc;
      },
      {} as Record<VehicleStatus, google.maps.Icon>
    );
  }, [isLoaded]);

  const infoWindowOptions = useMemo(() => {
    if (!isLoaded || !window.google?.maps) {
      return undefined;
    }

    return {
      pixelOffset: new window.google.maps.Size(0, -48),
    } satisfies google.maps.InfoWindowOptions;
  }, [isLoaded]);

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
            const icon = statusIconMap?.[vehicle.status];

            const handleMouseOver = () => {
              clearHoverTimeout();
              setHoveredVehicleId(vehicle.id);
            };

            const handleMouseOut = () => {
              scheduleHoverClear();
            };

            const handleClick = () => {
              clearHoverTimeout();
              setHoveredVehicleId((current) => (current === vehicle.id ? null : vehicle.id));
            };

            return (
              <MarkerF
                key={vehicle.id}
                position={position}
                title={`${vehicle.driverName} · ${vehicle.routeName}`}
                icon={icon ?? undefined}
                onMouseOver={handleMouseOver}
                onMouseOut={handleMouseOut}
                onClick={handleClick}
              />
            );
          })}
          {(() => {
            if (!hoveredVehicleId) {
              return null;
            }

            const hoveredVehicle = mockVehicles.find((vehicle) => vehicle.id === hoveredVehicleId);
            if (!hoveredVehicle) {
              return null;
            }

            const position = vehiclePositions[hoveredVehicle.id] ?? hoveredVehicle.location;
            const { label, className } = statusStyles[hoveredVehicle.status];

            return (
              <InfoWindowF
                position={position}
                options={infoWindowOptions}
                onCloseClick={() => setHoveredVehicleId(null)}
              >
                <div
                  className="w-64 space-y-3 text-slate-900"
                  onMouseEnter={clearHoverTimeout}
                  onMouseLeave={scheduleHoverClear}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {hoveredVehicle.id}
                      </p>
                      <p className="text-sm font-semibold text-slate-900">{hoveredVehicle.driverName}</p>
                      <p className="text-xs text-slate-500">{hoveredVehicle.routeName}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${className}`}>
                      {label}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-xs text-slate-500">
                    <div>
                      <dt className="font-semibold uppercase tracking-wide text-slate-400">Speed</dt>
                      <dd className="text-sm font-semibold text-slate-900">{hoveredVehicle.speedKph} km/h</dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase tracking-wide text-slate-400">ETA</dt>
                      <dd className="text-sm font-semibold text-slate-900">{hoveredVehicle.etaMinutes} min</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="font-semibold uppercase tracking-wide text-slate-400">Load</dt>
                      <dd className="text-sm font-semibold text-slate-900">
                        {hoveredVehicle.currentLoadKg.toLocaleString()} kg
                        <span className="text-xs font-medium text-slate-500">
                          {' '}
                          / {hoveredVehicle.capacityKg.toLocaleString()} kg
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
              </InfoWindowF>
            );
          })()}
        </GoogleMap>
      </div>
    </section>
  );
};

export default MapPane;
