export interface Product {
  id: number;
  size: string;
  color: string;
  price_per_tray?: number | null;
  price_per_dozen?: number | null;
  price_per_pcs?: number | null;
  is_active: boolean;
}

export interface ProductPayload {
  size: string;
  color: string;
  price_per_tray?: number | null;
  price_per_dozen?: number | null;
  price_per_pcs?: number | null;
  is_active?: boolean;
}
