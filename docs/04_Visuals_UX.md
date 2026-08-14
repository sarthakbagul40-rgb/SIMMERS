# Visuals & UX Design Guide

## Kitchen Hero (Pantry RPG)
**Version:** 1.0  
**Status:** Approved  

---

## 1. Color Palette Tokens (Modern HSL)
Our application uses customized HSL color coordinates for maximum brightness, sleek contrast, and dark mode responsiveness.

```
       Dark Theme BG                   Card BG                      Primary
    [ hsl(224, 45%, 8%) ]        [ hsl(223, 40%, 12%) ]      [ hsl(263, 90%, 55%) ]
            |                              |                           |
            +-------------[ Body.dark-mode ]                           +--- Gradients
            |                                                               |
    [ hsl(220, 30%, 96%) ]       [ hsl(220, 20%, 93%) ]                     v
       Light Theme BG                  Card BG                 (Primary to Indigo)
```

### Expiry Indicators
* **Safe (Green):** `hsl(142, 76%, 36%)` (Gradient fill: `hsl(142, 70%, 45%)` to `hsl(142, 72%, 29%)`)
* **Warning (Yellow):** `hsl(38, 92%, 50%)` (Gradient fill: `hsl(48, 96%, 53%)` to `hsl(38, 92%, 35%)`)
* **Danger (Red):** `hsl(0, 72%, 51%)` (Gradient fill: `hsl(0, 84%, 60%)` to `hsl(0, 72%, 35%)`)

---

## 2. Mascot Design & Expression States
The mascot is drawn entirely inside `<svg>` utilizing paths and shapes to prevent pixelation on high-res displays.

```
                    +------------------------+
                    |    Chef Hat / Crown    |  <-- Toggleable Overlays
                    +------------------------+
                    |      Bubble Helmet     |
                    +------------------------+
                    |      [ Mascot ]        |
                    |    Rounded Rect Body   |  <-- Dynamically colored gradient
                    |                        |      (Green/Yellow/Red/Slate)
                    |     (o) Face (o)       |
                    |         (__)           |  <-- Expressive eyes & mouth
                    +------------------------+
                    |      Stubby Limbs      |
                    +------------------------+
```

### Visual State Matrix
| State | Eyes (`<path>` / `<circle>`) | Mouth (`<path>`) | Body Color | Animation Class |
|-------|------------------------------|------------------|------------|-----------------|
| **Idle** | Round circles + white reflection highlights | Small upward curve | Based on Health | `mascot-breathing` |
| **Happy** | Upward arc paths (`^ ^`) | Open half-circle | Based on Health | `mascot-jump` |
| **Celebrate** | Upward arc paths (`^ ^`) | Open half-circle | Golden glow overlay | `mascot-spin-glow` |
| **Hurt** | Crossed line paths (`x x`) | Tiny open circle | Based on Health | `mascot-shiver` |
| **Sad** | Downward slanted line paths | Frown curve | Slate grey gradient | `mascot-droop` |

---

## 3. Screen Layout Guidelines (Vibe Checks)

### A. Home Screen (Mascot Center Stage)
* Mascot dominates **60% of vertical space**. No side navigation or menus are shown to avoid clutter.
* Progress bars (XP & Health) sit at the lower 30% of the screen.
* Tactile, rounded action buttons sit at the very bottom.

### B. Pantry List (Inventory Cards)
* Clear cards with subtle glassmorphic borders (`1px solid var(--border-dark)`).
* Cards slide to the right slightly on hover to simulate physical lists.
* Status badges (`safe`, `warning`, `danger`) glow softly using low opacity background colors.
