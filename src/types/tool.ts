export interface WarehouseItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  updatedAt: string;
}

export interface DeletedWarehouseItem extends WarehouseItem {
  deletedAt: string;
}

export interface WarehouseBackupData {
  items?: unknown;
  deletedItems?: unknown;
}
