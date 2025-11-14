import { Coordinate, InventoryItem, MockVehicle } from './types';

export type { MockVehicle };

export const KIDAPAWAN_CITY_COORDINATES: Coordinate = {
  lat: 7.0107,
  lng: 125.0926,
};

export const mockVehicles: MockVehicle[] = [
  {
    id: 'FRT-01',
    plateNumber: 'KAE 8124',
    driverName: 'Lara Santos',
    status: 'delivering',
    routeName: 'Kidapawan City Proper → Makilala',
    speedKph: 42,
    etaMinutes: 18,
    capacityKg: 4500,
    currentLoadKg: 2100,
    lastReported: '2024-03-15T02:32:00+08:00',
    location: { lat: 7.0142, lng: 125.0991 },
  },
  {
    id: 'FRT-02',
    plateNumber: 'LAR 6612',
    driverName: 'Jun Dizon',
    status: 'loading',
    routeName: 'Kidapawan Warehouse Loop',
    speedKph: 0,
    etaMinutes: 35,
    capacityKg: 5200,
    currentLoadKg: 800,
    lastReported: '2024-03-15T02:25:00+08:00',
    location: { lat: 7.0029, lng: 125.0874 },
  },
  {
    id: 'FRT-03',
    plateNumber: 'NDL 5530',
    driverName: 'Maya Tenorio',
    status: 'delivering',
    routeName: 'Kidapawan City Proper → Mlang',
    speedKph: 58,
    etaMinutes: 42,
    capacityKg: 4800,
    currentLoadKg: 3600,
    lastReported: '2024-03-15T02:29:00+08:00',
    location: { lat: 6.9961, lng: 125.0769 },
  },
  {
    id: 'FRT-04',
    plateNumber: 'NCJ 3477',
    driverName: 'Bryle Custodio',
    status: 'maintenance',
    routeName: 'City Motor Pool',
    speedKph: 0,
    etaMinutes: 0,
    capacityKg: 5000,
    currentLoadKg: 0,
    lastReported: '2024-03-15T01:55:00+08:00',
    location: { lat: 7.0189, lng: 125.1076 },
  },
];

export const inventoryItems: InventoryItem[] = [
  {
    id: 'INV-101',
    name: 'Palay (milled rice)',
    category: 'Grains',
    quantity: 8200,
    unit: 'kg',
    reorderThreshold: 4000,
    warehouse: 'Balindog Dry Storage',
    lastUpdated: '2024-03-14T11:00:00+08:00',
  },
  {
    id: 'INV-102',
    name: 'White corn grits',
    category: 'Grains',
    quantity: 5600,
    unit: 'kg',
    reorderThreshold: 3000,
    warehouse: 'Sudapin Processing Plant',
    lastUpdated: '2024-03-15T08:15:00+08:00',
  },
  {
    id: 'INV-103',
    name: 'Cooking oil (5L containers)',
    category: 'Essentials',
    quantity: 920,
    unit: 'units',
    reorderThreshold: 500,
    warehouse: 'City Proper Cold Storage',
    lastUpdated: '2024-03-15T09:00:00+08:00',
  },
  {
    id: 'INV-104',
    name: 'Bottled water (20L)',
    category: 'Essentials',
    quantity: 1350,
    unit: 'units',
    reorderThreshold: 800,
    warehouse: 'Magsaysay Distribution Hub',
    lastUpdated: '2024-03-14T16:40:00+08:00',
  },
  {
    id: 'INV-105',
    name: 'Relief packs',
    category: 'Prepared Goods',
    quantity: 640,
    unit: 'packs',
    reorderThreshold: 500,
    warehouse: 'City Gym Assembly Area',
    lastUpdated: '2024-03-13T18:20:00+08:00',
  },
];

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
