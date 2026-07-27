export interface AllergenItem {
  id: string;
  name: string;
  recordedAt: string;
  suspected: boolean;
  updatedAt: string;
}

export interface DeletedAllergenItem extends AllergenItem {
  deletedAt: string;
}

export interface AllergenBackupData {
  items?: unknown;
  deletedItems?: unknown;
}
