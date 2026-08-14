# Database & Storage Structure

## Kitchen Hero (Pantry RPG)
**Version:** 1.0  
**Status:** Approved  

---

## 1. Storage Backend Choices
To guarantee **100% free hosting and operations**, our database runs entirely client-side using `localStorage`. This removes any dependency on database services like PostgreSQL, Firebase FireStore, or Supabase Database, allowing the PWA to operate fully offline.

---

## 2. Key-Value Schemas

### A. User Profile Store (`pantry_rpg_user`)
Key user level progress, metrics, and streak status.

```typescript
interface UserState {
  currentLevel: number;        // integer, range 1-50
  currentXp: number;           // integer, range 0-99
  mascotHealth: number;        // integer, range 0-100
  streakDays: number;          // integer, consecutive days count
  streakShields: number;       // integer, shields currency count
  lastActionDate: string |null; // YYYY-MM-DD local date string
  totalItemsConsumed: number;  // integer, vanity statistic
  mascotName: string;          // string, user-selected name
}
```

### B. Pantry Inventory Store (`pantry_rpg_items`)
Stores active, consumed, and spoiled inventory items.

```typescript
type ItemStatus = 'active' | 'consumed' | 'spoiled';

interface PantryItem {
  id: string;             // generated unique ID (e.g., 7-char alphanumeric)
  name: string;           // string, food name (e.g., "Milk")
  shelfLifeDays: number;  // integer, total days shelf life
  dateAdded: string;      // ISO 8601 string when added
  status: ItemStatus;     // enum: active, consumed, spoiled
  markedAt: string | null; // ISO 8601 string when status marked
}
```

### C. Quests Store (`pantry_rpg_quests`)
Stores active and expired recipe quests generated for expiring ingredients.

```typescript
type QuestStatus = 'active' | 'completed' | 'expired';

interface Quest {
  id: string;                 // generated unique ID
  expiringItemIds: string[];  // array of item IDs required to complete quest
  recipe: string;             // string, 1-2 sentence recipe instructions
  status: QuestStatus;        // enum: active, completed, expired
  xpReward: number;           // integer, default: 75 XP
  createdAt: string;          // ISO 8601 string
  expiresAt: string;          // ISO 8601 string (createdAt + 48 hours)
}
```

### D. Settings Store (`pantry_rpg_settings`)
Saves configuration preferences and dynamic API keys.

```typescript
interface UserSettings {
  notificationEnabled: boolean; // boolean
  notificationTime: string;    // "HH:MM" time format (e.g., "08:00")
  darkMode: boolean;           // boolean
  geminiApiKey: string;        // string, user-provided API key
}
```

---

## 3. Performance Indexes (Simulated)
Since the dataset size is small (typically < 200 items in a local pantry), standard array filters (`items.filter(...)`) achieve O(N) lookup times under **0.5 milliseconds**, making dedicated index engines redundant.

We optimize queries by keeping arrays flat and parsing data into indexed state maps on component mount.
