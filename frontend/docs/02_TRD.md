# Technical Requirements Document (TRD)

## Kitchen Hero (Pantry RPG)
**Version:** 1.0  
**Status:** Approved  
**Platform:** React, TypeScript, Vite, PWA  

---

## 1. System Architecture
The application runs entirely client-side as a single-page React app, structured as an offline-first PWA. All state, business rules, and settings are handled in-memory and synced synchronously to `localStorage` for sub-millisecond query performance.

```
+-------------------------------------------------------------+
|                     Client App (Browser)                    |
|                                                             |
|   +-------------------+    State Sync    +--------------+   |
|   |   React UI/Views  |<================>|  db.ts Store |   |
|   |  (Home, Pantry,   |                  |  (LocalState)|   |
|   |   Quests, Config) |                  +-------+------+   |
|   +---------+---------+                          |          |
|             | Uses                               | Saves    |
|             v                                    v          |
|   +---------+---------+                  +-------+------+   |
|   |    Mascot SVG     |                  | LocalStorage |   |
|   |   & CSS Engine    |                  +--------------+   |
|   +-------------------+                                     |
|                                                             |
+-------------------------------------------------------------+
```

---

## 2. Technical Stack
* **Build Tool:** Vite (configured with TypeScript and SWC compiler).
* **Language:** TypeScript 5.0+ (utilizing strict mode).
* **View Library:** React 19.
* **Styling:** Vanilla CSS 3 with HSL variables for instant light/dark mode skinning.
* **Storage:** LocalStorage API with strict JSON validation models.
* **AI Integration:** Google Gemini REST API client calling `gemini-2.5-flash` model directly from the browser (only if user configures a key).
* **Deployment target:** PWA standard.

---

## 3. Storage Schema & Serialization
All keys in localStorage are scoped:
* `pantry_rpg_user`: User profile, current level, current XP, mascot health, streak count, and currency.
* `pantry_rpg_items`: An array of pantry objects containing item descriptors and statuses.
* `pantry_rpg_quests`: Active and expired cooking quests.
* `pantry_rpg_settings`: Preferences including theme mode, notification state, and custom API keys.

---

## 4. Key Technical Solutions

### A. Dynamic Mascot Animation Engine
* Built with pure React state-driven SVGs.
* Uses custom CSS keyframe classes (`mascot-breathing`, `mascot-jump`, `mascot-droop`, `mascot-spin-glow`) to achieve hardware-accelerated 60fps renders.
* Relies on inline React styles for dynamic HSL values representing health degradation:
  * Green: `hsl(142, 76%, 36%)`
  * Orange/Yellow: `hsl(38, 92%, 50%)`
  * Red: `hsl(0, 72%, 51%)`

### B. Gemini API Key Safety
* The developer’s budget remains $0 because **no global developer API key is bundled**.
* The AI service loads the API key dynamically from the user's local settings (`settings.geminiApiKey`).
* If no key is set or the user is offline, the app transparently shifts to a local heuristic recipe matching algorithm.

### C. Offline Recipe Matcher
* Runs a keyword inclusion matching array.
* Parses strings into lowercase tokens.
* Scans a static list of 12 highly versatile, low-ingredient recipes and selects the recipe with the highest overlap of expiring ingredients.

### D. AdMob Rewarded Video Simulation
* Implements a modal overlay timer using a React `useEffect` interval loop.
* Restricts user interactions during the 5-second countdown to simulate real video ads, then increments `user.streakShields` and saves state.
