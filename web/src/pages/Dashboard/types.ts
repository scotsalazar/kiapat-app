export interface Coordinate {
  lat: number;
  lng: number;
}

export type VehicleStatus = 'idle' | 'delivering' | 'loading' | 'maintenance';

export interface MockVehicle {
  id: string;
  plateNumber: string;
  driverName: string;
  status: VehicleStatus;
  routeName: string;
  speedKph: number;
  etaMinutes: number;
  capacityKg: number;
  currentLoadKg: number;
  lastReported: string;
  location: Coordinate;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  reorderThreshold: number;
  warehouse: string;
  lastUpdated: string;
}
