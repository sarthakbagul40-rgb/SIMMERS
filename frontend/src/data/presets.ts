import type { PresetItem } from '../types';

export const PRESET_ITEMS: PresetItem[] = [
  { name: 'Milk', defaultShelfLife: 5, category: 'Dairy', icon: '🥛', isPackaged: true },
  { name: 'Eggs', defaultShelfLife: 21, category: 'Dairy', icon: '🥚', isPackaged: false },
  { name: 'Bread', defaultShelfLife: 3, category: 'Bakery', icon: '🍞', isPackaged: true },
  { name: 'Yogurt', defaultShelfLife: 10, category: 'Dairy', icon: '🍶', isPackaged: true },
  { name: 'Chicken', defaultShelfLife: 3, category: 'Meat', icon: '🍗', isPackaged: false },
  { name: 'Vegetables', defaultShelfLife: 5, category: 'Produce', icon: '🥦', isPackaged: false },
  { name: 'Fruit', defaultShelfLife: 7, category: 'Produce', icon: '🍎', isPackaged: false },
  { name: 'Cheese', defaultShelfLife: 14, category: 'Dairy', icon: '🧀', isPackaged: true }
];
