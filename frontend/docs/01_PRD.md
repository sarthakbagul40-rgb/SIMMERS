# Product Requirements Document (PRD)

## Kitchen Hero (Pantry RPG)
**Version:** 1.0  
**Status:** Approved  
**Author:** Antigravity AI & Developer  
**Platform:** Progressive Web App (PWA) / Web App  
**Target Audience:** Students, budget-conscious households, young adults.  

---

## 1. Product Overview
**Kitchen Hero** is a gamified food waste tracker designed to reduce household food waste. Unlike dry, utility-style inventory trackers, Kitchen Hero wraps pantry tracking into a light Tamagotchi-style RPG. The health, level, and emotional state of a virtual mascot (a cute animated refrigerator blob named "Bitey") directly reflect the user's real-world food conservation habits.

---

## 2. Core Problem & Solution
* **The Problem:** 
  1. Traditional tracking apps require excessive manual entry, leading to quick churn.
  2. Users lack motivation to check food expiry dates until it's too late.
  3. People struggle to find recipes for random expiring items.
* **The Solution:** 
  1. **Lightning-fast logging:** 8 preset buttons covering the most wasted global foods (Milk, Eggs, Bread, etc.) allow 1-tap logging in under 4 seconds.
  2. **Mascot Loss Aversion:** Gamifying food preservation with a mascot whose health suffers when food goes bad.
  3. **Rescue Quests:** Scanning for expiring items and suggesting a 1-sentence local recipe quest for +75 XP.

---

## 3. Key Feature Requirements

### FR-01: Express Mascot States
* Mascot is the hero of the application, taking up 60% of the Home screen.
* Mascot transitions dynamically between states:
  * **Idle:** Gentle breathing animation.
  * **Happy:** Jump animation with floating particle effects when items are saved.
  * **Celebrate:** Level-up spin with gold glow and banner flash.
  * **Hurt:** Shaking shiver animation when items spoil.
  * **Sad:** Slumped downcast pose with tear indicators when health is below 50%.
* **Level Progression:** Every 100 XP levels up the mascot. Higher levels unlock dynamic cosmetics: Chef Hat (Lv. 5), Gold Crown (Lv. 10), Space Helmet (Lv. 15).

### FR-02: Rapid Pantry Logging
* Pre-configured quick-add buttons for the top 8 globally wasted foods.
* Custom item form with name entry and shelf-life range slider (1 to 30 days).
* Storage capacity capped at 50 active items for free tier. Unlimited slots on Pro Pass.

### FR-03: Expiry Visualization
* List of items sorted strictly by urgency (expired/red first, warning/yellow next, safe/green last).
* Tapping an item opens a card containing action options:
  * **Mark Consumed:** Awards XP (+25 for short 1-3d, +50 for medium 4-7d, +75 for long 8d+).
  * **Spoiled/Expired:** Deducts 10% health from mascot.
  * **Extend Shelf-Life:** Extend by +1d, +3d, or +7d.
  * **Delete:** Quiet delete with no penalty.

### FR-04: Daily Streak & Shields
* Consecutive daily food saving activity maintains a streak.
* Missed days break the streak.
* **Streak Shields:** Secondary currency (🛡️) used to revive a broken streak (cost: 50 shields).
* Users earn 50 Streak Shields by watching a simulated rewarded video ad.

### FR-05: Rescue Recipe Quests
* Scanning pantry for items expiring in <= 48 hours.
* Auto-matching items to local recipes or using Gemini API (if user enters their API key in Settings).
* Displays a 1-2 sentence recipe instruction.
* Claims +75 XP when all involved ingredients are marked consumed.

### FR-06: Settings & Privacy
* Mascot name editor.
* Dark Mode / Light Mode toggle.
* Simulated In-App Purchase for Pro Pass ($1.99 / ₹149 one-time).
* JSON Export / Import local backup system.
* Custom Gemini API Key input field.
