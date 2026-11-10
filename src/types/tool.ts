export interface AllergenItem {
  id: string;
  name: string;
  recordedAt: string;
  suspected: boolean;
  note: string;
  rating: number;
  updatedAt: string;
}

export interface DeletedAllergenItem extends AllergenItem {
  deletedAt: string;
}

export interface AllergenBackupData {
  items?: unknown;
  deletedItems?: unknown;
}
