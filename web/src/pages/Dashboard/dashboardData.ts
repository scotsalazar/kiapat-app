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
  {
    id: 'FRT-05',
    plateNumber: 'LAU 7721',
    driverName: 'Ares Villarin',
    status: 'delivering',
    routeName: 'Kidapawan City Proper → President Roxas',
    speedKph: 51,
    etaMinutes: 38,
    capacityKg: 5400,
    currentLoadKg: 3200,
    lastReported: '2024-03-15T02:34:00+08:00',
    location: { lat: 7.0241, lng: 125.0813 },
  },
  {
    id: 'FRT-06',
    plateNumber: 'KDN 9085',
    driverName: 'Rico Lizada',
    status: 'idle',
    routeName: 'New Cebu Laydown Yard',
    speedKph: 0,
    etaMinutes: 0,
    capacityKg: 4600,
    currentLoadKg: 0,
    lastReported: '2024-03-15T02:20:00+08:00',
    location: { lat: 7.0074, lng: 125.1152 },
  },
  {
    id: 'FRT-07',
    plateNumber: 'MAA 6643',
    driverName: 'Sheila Tibayan',
    status: 'loading',
    routeName: 'Balindog Cold Storage → Kabacan',
    speedKph: 5,
    etaMinutes: 54,
    capacityKg: 4800,
    currentLoadKg: 700,
    lastReported: '2024-03-15T02:31:00+08:00',
    location: { lat: 7.0003, lng: 125.0978 },
  },
  {
    id: 'FRT-08',
    plateNumber: 'KAP 4412',
    driverName: 'Dino Bacus',
    status: 'maintenance',
    routeName: 'Kidapawan North Service Center',
    speedKph: 0,
    etaMinutes: 0,
    capacityKg: 5100,
    currentLoadKg: 0,
    lastReported: '2024-03-15T01:45:00+08:00',
    location: { lat: 7.0295, lng: 125.1006 },
  },
  {
    id: 'FRT-09',
    plateNumber: 'NAY 2234',
    driverName: 'Juno Orbeta',
    status: 'delivering',
    routeName: 'Kidapawan City Proper → Tulunan',
    speedKph: 47,
    etaMinutes: 27,
    capacityKg: 5000,
    currentLoadKg: 2900,
    lastReported: '2024-03-15T02:33:00+08:00',
    location: { lat: 6.9945, lng: 125.0892 },
  },
  {
    id: 'FRT-10',
    plateNumber: 'LGT 5576',
    driverName: 'Clar Tumbaga',
    status: 'idle',
    routeName: 'Sudapin Auxiliary Depot',
    speedKph: 0,
    etaMinutes: 0,
    capacityKg: 4700,
    currentLoadKg: 1200,
    lastReported: '2024-03-15T02:10:00+08:00',
    location: { lat: 7.0116, lng: 125.0658 },
  },
];

export const inventoryItems: InventoryItem[] = [
  {
    id: 'EGG-301',
    name: 'Cage-free brown eggs (30-egg trays)',
    category: 'Shell Eggs',
    quantity: 1_240,
    unit: 'trays',
    reorderThreshold: 600,
    warehouse: 'Balindog Egg Depot',
    lastUpdated: '2024-03-15T09:05:00+08:00',
  },
  {
    id: 'EGG-302',
    name: 'Salted duck eggs (vacuum 4-pack)',
    category: 'Value-added Eggs',
    quantity: 2_880,
    unit: 'packs',
    reorderThreshold: 1_200,
    warehouse: 'Sudapin Processing Plant',
    lastUpdated: '2024-03-15T08:45:00+08:00',
  },
  {
    id: 'EGG-303',
    name: 'Pasteurized liquid whole eggs (10L totes)',
    category: 'Processed Eggs',
    quantity: 410,
    unit: 'totes',
    reorderThreshold: 250,
    warehouse: 'City Proper Cold Storage',
    lastUpdated: '2024-03-15T07:55:00+08:00',
  },
  {
    id: 'EGG-304',
    name: 'Organic free-range eggs (dozen cartons)',
    category: 'Shell Eggs',
    quantity: 3_450,
    unit: 'cartons',
    reorderThreshold: 1_500,
    warehouse: 'Magsaysay Distribution Hub',
    lastUpdated: '2024-03-14T21:30:00+08:00',
  },
  {
    id: 'EGG-305',
    name: 'Liquid egg whites (5L bag-in-box)',
    category: 'Processed Eggs',
    quantity: 780,
    unit: 'boxes',
    reorderThreshold: 400,
    warehouse: 'City Gym Cold Room',
    lastUpdated: '2024-03-14T18:40:00+08:00',
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
