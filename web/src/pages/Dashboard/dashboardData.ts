import { Coordinate, InventoryItem, MockVehicle } from './types';

export type { MockVehicle };

export const KIDAPAWAN_CITY_COORDINATES: Coordinate = {
  lat: 7.0107,
  lng: 125.0926,
};

export const mockVehicles: MockVehicle[] = [];

export const inventoryItems: InventoryItem[] = [];

const METERS_PER_DEGREE_LAT = 111_320;

export const jitterCoordinates = (
  base: Coordinate,
  radiusMeters = 150
): Coordinate => {
  const latOffset = ((Math.random() - 0.5) * 2 * radiusMeters) / METERS_PER_DEGREE_LAT;
  const lngScale =
    Math.cos((base.lat * Math.PI) / 180) * METERS_PER_DEGREE_LAT || METERS_PER_DEGREE_LAT;
  const lngOffset = ((Math.random() - 0.5) * 2 * radiusMeters) / lngScale;

  return {
    lat: Number((base.lat + latOffset).toFixed(6)),
    lng: Number((base.lng + lngOffset).toFixed(6)),
  };
};

export const getInitialVehiclePositions = (
  radiusMeters = 150
): Record<string, Coordinate> =>
  mockVehicles.reduce<Record<string, Coordinate>>((acc, vehicle) => {
    acc[vehicle.id] = jitterCoordinates(vehicle.location, radiusMeters);
    return acc;
  }, {});
