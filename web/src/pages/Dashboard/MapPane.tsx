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

const statusIdentifiers: Record<VehicleStatus, string> = {
  delivering: 'D',
  loading: 'L',
  idle: 'I',
  maintenance: 'M',
};

const escapeSvgText = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const createTruckSvg = ({
  bodyColor,
  accentColor,
  plateText,
  statusIdentifier,
}: {
  bodyColor: string;
  accentColor: string;
  plateText: string;
  statusIdentifier: string;
}) => `
  <svg width="96" height="48" viewBox="0 0 96 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="12" width="60" height="24" rx="8" fill="${bodyColor}" />
    <rect x="62" y="16" width="28" height="20" rx="6" fill="${accentColor}" />
    <rect x="10" y="20" width="36" height="12" rx="4" fill="white" />
    <text x="28" y="28" font-size="10" font-family="'Inter', 'Segoe UI', sans-serif" fill="#0f172a" font-weight="700" text-anchor="middle">
      ${escapeSvgText(plateText)}
    </text>
    <circle cx="74" cy="26" r="10" fill="white" fill-opacity="0.9" />
    <text x="74" y="30" font-size="12" font-family="'Inter', 'Segoe UI', sans-serif" fill="#0f172a" font-weight="700" text-anchor="middle">
      ${escapeSvgText(statusIdentifier)}
    </text>
    <rect x="6" y="14" width="52" height="4" rx="2" fill="rgba(255,255,255,0.35)" />
    <circle cx="24" cy="40" r="6" fill="#0f172a" />
    <circle cx="24" cy="40" r="3" fill="#e2e8f0" />
    <circle cx="66" cy="40" r="6" fill="#0f172a" />
    <circle cx="66" cy="40" r="3" fill="#e2e8f0" />
  </svg>
`;

const svgToDataUrl = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const getVehicleSvg = (vehicleId: string, status: VehicleStatus) => {
  const { pinColor, accentColor } = statusStyles[status];
  return createTruckSvg({
    bodyColor: pinColor,
    accentColor,
    plateText: vehicleId,
    statusIdentifier: statusIdentifiers[status],
  });
};

const getVehicleIconDataUrl = (vehicleId: string, status: VehicleStatus) =>
  svgToDataUrl(getVehicleSvg(vehicleId, status));

const createVehicleIcon = (
  vehicleId: string,
  status: VehicleStatus,
  sizeFactory: () => { scaledSize: google.maps.Size; anchor: google.maps.Point }
) => {
  const { scaledSize, anchor } = sizeFactory();
  return {
    url: getVehicleIconDataUrl(vehicleId, status),
    scaledSize,
    anchor,
  } satisfies google.maps.Icon;
};

const MapPane = ({ className = '', showHeader = true }: MapPaneProps) => {
  const vehicles = mockVehicles;
  const hasVehicles = vehicles.length > 0;
  const [vehiclePositions, setVehiclePositions] = useState<Record<string, Coordinate>>(
    () => getInitialVehiclePositions()
  );
  const [hoveredVehicleId, setHoveredVehicleId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const center = useMemo(() => KIDAPAWAN_CITY_COORDINATES, []);

  const fallbackMarkers = useMemo(() => {
    if (!hasVehicles) {
      return [];
    }

    const positions = vehicles.map(
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

    return vehicles.map((vehicle, index) => {
      const position = positions[index];
      const normalizedX = ((position.lng - minLng) / lngRange) * 100;
      const normalizedY = ((position.lat - minLat) / latRange) * 100;

      return {
        vehicle,
        positionStyle: {
          left: `${normalizedX}%`,
          top: `${100 - normalizedY}%`,
        },
        iconUrl: getVehicleIconDataUrl(vehicle.id, vehicle.status),
      };
    });
  }, [hasVehicles, vehiclePositions, vehicles]);

  useEffect(() => {
    if (!hasVehicles) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setVehiclePositions((prev) => {
        const nextPositions: Record<string, Coordinate> = { ...prev };
        vehicles.forEach((vehicle) => {
          const previous = prev[vehicle.id] ?? vehicle.location;
          nextPositions[vehicle.id] = jitterCoordinates(previous, JITTER_RADIUS_METERS);
        });
        return nextPositions;
      });
    }, JITTER_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasVehicles, vehicles]);

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

  const vehicleIconFactory = useMemo(() => {
    if (!isLoaded || !window.google?.maps) {
      return null;
    }

    const sizeFactory = () => ({
      scaledSize: new window.google.maps.Size(96, 48),
      anchor: new window.google.maps.Point(48, 48),
    });

    const cache = new Map<string, google.maps.Icon>();
    return (vehicleId: string, status: VehicleStatus) => {
      const cacheKey = `${vehicleId}-${status}`;
      if (!cache.has(cacheKey)) {
        cache.set(cacheKey, createVehicleIcon(vehicleId, status, sizeFactory));
      }
      return cache.get(cacheKey)!;
    };
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
              Add <code className="rounded bg-slate-100 px-1 py-0.5">VITE_GOOGLE_MAPS_API_KEY</code> for an interactive view.
              {hasVehicles
                ? ' This fallback keeps vehicle placements fresh without Google Maps.'
                : ' Vehicle telemetry is not connected yet.'}
            </p>
          </header>
        )}
        <div className="flex-1">
          {hasVehicles ? (
            <div className={`relative w-full overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 ${MAP_DIMENSION_CLASSES}`}>
              <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.05)_25%,transparent_25%),linear-gradient(-120deg,rgba(15,23,42,0.05)_25%,transparent_25%)] bg-[length:40px_40px]" />
              {fallbackMarkers.map(({ vehicle, positionStyle, iconUrl }) => (
                <div
                  key={vehicle.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={positionStyle}
                >
                  <img
                    src={iconUrl}
                    alt={`${vehicle.id} ${statusIdentifiers[vehicle.status]} icon`}
                    className="h-12 w-24 drop-shadow"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div
              className={`flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 ${MAP_DIMENSION_CLASSES}`}
              aria-label="No vehicle data connected"
            >
              No vehicle data connected. Add telemetry to start tracking.
            </div>
          )}
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
            {hasVehicles
              ? `Monitoring ${vehicles.length} active logistics vehicles across the valley corridor.`
              : 'No vehicle telemetry available yet. Connect fleet data to see live tracking.'}
          </p>
        </header>
      )}
      <div className="flex-1">
        {hasVehicles ? (
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
            {vehicles.map((vehicle) => {
              const position = vehiclePositions[vehicle.id] ?? vehicle.location;
              const icon = vehicleIconFactory?.(vehicle.id, vehicle.status);

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

              const hoveredVehicle = vehicles.find((vehicle) => vehicle.id === hoveredVehicleId);
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
        ) : (
          <div
            className={`flex h-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 ${MAP_DIMENSION_CLASSES}`}
            aria-label="No vehicle data connected"
          >
            No vehicle data connected. Add telemetry to start tracking.
          </div>
        )}
      </div>
    </section>
  );
};

export default MapPane;
