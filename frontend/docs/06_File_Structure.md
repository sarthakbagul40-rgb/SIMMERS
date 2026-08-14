# File Structure & Modules

## Kitchen Hero (Pantry RPG)
**Version:** 1.0  
**Status:** Approved  

---

## 1. Directory Tree Diagram
The codebase is structured under the standard Vite-React TypeScript template. All custom modules are modularized in the `src/` directory.

```
d:/TRACKING APP/pantry-rpg/
├── docs/                             # Project Architecture Docs
│   ├── 01_PRD.md
│   ├── 02_TRD.md
│   ├── 03_Workflow_Implementation_Plan.md
│   ├── 04_Visuals_UX.md
│   ├── 05_Database_Structure.md
│   ├── 06_File_Structure.md
│   └── 07_Security_Plan.md
├── public/                           # Static assets
│   └── favicon.svg
├── src/
│   ├── assets/                       # Images/icons
│   ├── components/                   # UI Elements
│   │   ├── Mascot.tsx                # Expressive Mascot SVG Component
│   │   └── Mascot.css                # Mascot Animation Keyframes
│   ├── data/
│   │   └── presets.ts                # Predefined food presets list
│   ├── services/
│   │   ├── db.ts                     # LocalStorage State Manager
│   │   ├── backup.ts                 # JSON Export/Import Service
│   │   └── recipeGenerator.ts        # Local & Gemini AI Recipe Engine
│   ├── types/
│   │   └── index.ts                  # Shared TypeScript Interfaces
│   ├── App.tsx                       # Main Application Shell & Views
│   ├── index.css                     # Global Design Tokens & Styles
│   └── main.tsx                      # App Entrypoint
├── package.json                      # Dependencies (React, Vite, TS)
└── tsconfig.json                     # TypeScript configuration
```

---

## 2. Module Responsibilities

### A. `src/types/index.ts`
Holds all data model types. This is the single source of truth for schema validation during JSON backup imports.

### B. `src/services/db.ts`
* Manages database read and write locks on LocalStorage.
* Contains gamification arithmetic (XP milestones, levels, health deducts).
* Evaluates streak statuses based on calendar day changes.

### C. `src/services/recipeGenerator.ts`
* Houses the local matched recipes list.
* Conducts local matching logic (highest overlap of expiring ingredients).
* Handles REST payload formatting for `gemini-2.5-flash` API connections.

### D. `src/services/backup.ts`
* Exports active local state into a downloadable JSON file.
* Reads uploaded files, performs schema consistency validation, and overrides localStorage keys on success.

### E. `src/components/Mascot.tsx`
* Computes active cosmetics (hats, crowns, helmets) based on level thresholds.
* Controls blink intervals and particle effect arrays.
* Translates state variables (`happy`, `sad`, `celebrate`, `hurt`) into CSS animation classes.
