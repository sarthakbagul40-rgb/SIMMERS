# SIMMERS 🍲 — Full-Stack Gamified Food Waste Tracker & Household Pantry RPG

![CI Status](https://github.com/sarthakbagul40-rgb/SIMMERS/actions/workflows/ci.yml/badge.svg)
[![TypeScript](https://img.shields.io/badge/TypeScript-Full--Stack-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.3-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.4-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)

---

## 🌟 Project Overview

**SIMMERS** turns grocery management into a fun, rewarding daily RPG quest! Never let your food go bad again — track expiry dates, scan product labels with AI, level up your hero mascot **Sproutling**, complete daily cooking quests, and share a live household pantry with family members and roommates.

The application is engineered as a production-style full-stack monorepo comprising a **React / TypeScript / Capacitor** cross-platform mobile application and a **Node.js / Express / Prisma / PostgreSQL** REST API service.

---

## 🏗️ Repository Architecture (Monorepo)

```
SIMMERS/
├── frontend/               # React 19 + TypeScript + Vite 6 + Capacitor 8 Mobile App
│   ├── src/                # UI Components, RPG Mascot state, Local storage engine
│   ├── android/            # Native Android Capacitor Project
│   └── README.md           # Mobile app & frontend details
├── backend/                # Node.js + Express + Prisma ORM + PostgreSQL REST API
│   ├── src/                # Routes, Controllers, Middleware, Gemini AI Vision OCR
│   ├── prisma/             # Schema definitions & database migrations
│   ├── tests/              # Vitest unit tests & Supertest integration suite
│   ├── DATABASE.md         # Database schema & Hybrid Sync Engine docs
│   ├── SECURITY.md         # Threat model, JWT auth & API key protection docs
│   └── README.md           # REST API specification & setup guide
├── .github/
│   └── workflows/
│       └── ci.yml          # GitHub Actions CI workflow for backend tests
├── UNDERSTANDING.md        # Beginner guide & mandatory change/decision log
└── README.md               # Top-level monorepo landing page
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (v20 LTS recommended)
- **npm**: v9.0.0 or higher

---

### 2. Running the Backend REST API (`backend/`)
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Run database setup & Prisma generation
npx prisma db push

# Run Vitest unit & integration tests (15/15 passing)
npm test

# Start Express development server
npm run dev
```
The REST API will start at `http://localhost:3000`. Detailed specs: [backend/README.md](file:///d:/SIMMERS%20origin/backend/README.md)

---

### 3. Running the Frontend Mobile App (`frontend/`)
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite web dev server
npm run dev
```
Open `http://localhost:5173` in your browser. Detailed mobile & Capacitor setup: [frontend/README.md](file:///d:/SIMMERS%20origin/frontend/README.md)

---

## 🔗 How Frontend & Backend Connect

1. **Authentication & Token Handling**:
   - The frontend authenticates via `POST /auth/login` or `POST /auth/signup`.
   - The server returns a signed JWT token stored securely in client preferences.
   - Subsequent requests attach `Authorization: Bearer <token>`.

2. **Multi-User Household Syncing**:
   - Users create or join a household via a 6-character invite code.
   - Pantry items sync in real time from `GET /households/:id/items`.
   - When offline, the client falls back to local storage ([storage.ts](file:///d:/SIMMERS%20origin/frontend/src/services/storage.ts)); when internet is restored, changes reconcile automatically via Last-Write-Wins based on `updatedAt`.

3. **Server-Side AI Vision OCR**:
   - Product label image scans route through `POST /households/:id/items/scan`.
   - The server calls Google Gemini Vision API internally, preventing API key exposure in client APK builds.

---

## 📐 Key Design Decisions

1. **Monorepo Architecture**:
   - Combining `frontend/` and `backend/` in a single repository enables atomic commits, shared documentation, and seamless full-stack code reviews for technical interviewers.

2. **JWT Token Authentication vs. Cookie Sessions**:
   - Capacitor cross-platform webviews on Android and iOS frequently encounter third-party cookie restrictions. Using standard Bearer JWT tokens ensures reliable cross-device authentication.

3. **Server-Side AI API Key Protection**:
   - Initial client prototypes embedded `VITE_GEMINI_API_KEY` in mobile code, creating security vulnerabilities if decompiled. Processing OCR scans server-side keeps Gemini keys safe in server environment variables.

4. **Household-Scoped Middleware Guard**:
   - Instead of duplicating permission checks in every controller, `requireHouseholdMember` middleware queries the `HouseholdMember` join table on every household route, enforcing `403 Forbidden` consistently.

---

## 🧪 Automated Testing & CI/CD Pipeline

```bash
cd backend
npm test
```

- **Unit Tests**: Test password hashing, JWT generation/decoding, and invite code uniqueness.
- **Integration Tests**: Supertest HTTP suite covering end-to-end user journeys (signup $\rightarrow$ household creation $\rightarrow$ invite join $\rightarrow$ item CRUD $\rightarrow$ OCR scanning).
- **GitHub Actions CI**: Every push and PR automatically runs linting, TypeScript compilation checks, and the Vitest suite via [.github/workflows/ci.yml](file:///d:/SIMMERS%20origin/.github/workflows/ci.yml).
