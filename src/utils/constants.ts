export const ITEM_CATEGORIES = [
  'Electronics',
  'Bags & Backpacks',
  'Keys',
  'Wallets & Cards',
  'Clothing & Accessories',
  'Books & Notebooks',
  'ID / Documents',
  'Water Bottles & Containers',
  'Jewelry & Watches',
  'Sports Equipment',
  'Other',
] as const;

export const ITEM_COLORS = [
  'Black',
  'White',
  'Gray',
  'Blue',
  'Red',
  'Green',
  'Yellow',
  'Orange',
  'Purple',
  'Pink',
  'Brown',
  'Multicolor',
  'Other',
] as const;

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const ITEM_IMAGES_BUCKET = 'item-images';
export const PROFILE_PHOTOS_BUCKET = 'profile-photos';
