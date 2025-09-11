// src/types/ItemRow.ts
export interface ItemRow {
  sku: string;
  productName: string;
  description: string;
  price: string; // keep numeric as string; parse/format at render time
}
