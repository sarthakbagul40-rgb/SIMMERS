# SIMMERS 🍲
### *Smart AI-Powered Gamified Food Waste Tracker & Household Pantry RPG*

[![TypeScript](https://img.shields.io/badge/TypeScript-82.5%25-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.1-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.4-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)

---

## 🌟 Overview

**SIMMERS** turns grocery management into a fun, rewarding daily RPG quest! Never let your food go bad again — track expiry dates, scan product labels with AI, level up your hero mascot **Sproutling**, complete daily cooking quests, and collaborate with your household to eliminate food waste.

---

## ✨ Key Features

### 📸 AI Expiry Label Scanner
- Take a photo of any grocery packet or receipt.
- **Google Gemini Vision OCR** automatically detects expiration dates, product names, and remaining shelf life in seconds.
- Integrated zoomable image lightbox and desktop gallery fallback.

### 🐾 Sproutling Hero Mascot & RPG Leveling
- Meet your interactive companion, **Sproutling**!
- Earn XP by consuming food before it expires and completing cooking quests.
- Unlock hero ranks (Sous Chef, Master Culinary, Cosmic Gastronome) and outfits (Chef Hat, Crown, Astronaut Suit).
- Mascot health decreases if items spoil — rescue items to keep Sproutling happy!

### 📜 Daily Quests & Smart AI Recipe Generator
- Dynamic recipe suggestions generated based on items closest to expiring in your pantry.
- Complete cooking quests to earn **+75 XP** and level up faster.

### 👨‍👩‍👧 Multi-Device Household Sync
- Create or join a **Household Group** with a unique code.
- Real-time pantry synchronization across devices for family members and roommates.
- Device recovery keys ensure seamless data migration across phone upgrades.

### 🏷️ Intelligent Pantry Management
- Quick Add preset cards for common groceries (Milk, Eggs, Bread, Produce).
- Automatic sorting by urgency (*Expired*, *1-3 Days Left*, *Safe*).
- **Long-Life Badges** for non-perishables (365+ days shelf life).
- 5-second non-blocking **Undo Toast** for accidental spoil actions.

### 📶 100% Offline-First PWA & Mobile Native
- Works offline seamlessly using Capacitor Preferences & LocalStorage fallback.
- Native Android app support with push notifications before items expire.

---

## 🛠️ Tech Stack

- **Frontend Core:** React 19, TypeScript, Vanilla CSS (Glassmorphism, Design Tokens, Micro-animations)
- **Build System:** Vite 6, Oxlint
- **Mobile Runtime:** Capacitor 8 (Camera, Local Notifications, App Lifecycle, Preferences)
- **AI Engine:** Google Gemini API (Vision Label OCR & Recipe Synthesis)
- **Architecture:** Offline-First, Local-Storage Sync Engine

---

## 🚀 Getting Started

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sarthakbagul40-rgb/SIMMERS.git
   cd SIMMERS
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env` and add your optional Gemini API key:
   ```bash
   cp .env.example .env
   ```
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Start local development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 📱 Mobile Build Commands (Android)

To sync and launch on an Android device/emulator using Capacitor:

```bash
# Build production bundle
npm run build

# Sync web assets to Android project
npx cap sync android

# Open Android Studio project
npx cap open android
```

---

## 🧪 Code Quality & Verification

Run automated type-checking and linter suites:

```bash
# TypeScript compilation check
npx tsc --noEmit

# Oxlint Linter check
npm run lint
```

---

## 🔐 Security & Privacy

- **Zero Secret Exposure:** `.env` and secret credentials are automatically excluded from Git via `.gitignore`.
- **Input Sanitization:** All user inputs (item names, mascot names) are sanitized against XSS attacks.
- **Data Ownership:** All pantry data remains encrypted on your local device with optional encrypted cloud backup.

---

<p align="center">Built with ❤️ to eliminate food waste worldwide 🌎</p>

