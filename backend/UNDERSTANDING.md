# UNDERSTANDING.md - SIMMERS Backend Explained Simply

> **Welcome!** This file is written so **anyone** — even a 10-year-old who has never written a single line of computer code — can understand exactly how SIMMERS works, what we are building, why we are building it, and every change or mistake we make along the way!

---

## 1. The Big Picture: What is SIMMERS?

Imagine you have a magic fridge game on your phone called **SIMMERS**.
- Whenever you buy apples, milk, or cheese, you put them in your app.
- The app tells you when your food is about to go bad so you don't throw it away!
- You get fun game points (**XP**) when you use your food before it spoils!

---

## 2. Real-World Analogies (How it Works)

### A. What is a "Frontend"?
* **Analogy**: The menu, tables, and decorations in a toy ice cream shop.
* **Explanation**: The frontend is what you see on your phone screen — the pretty buttons, colors, and pictures.

### B. What is a "Backend"?
* **Analogy**: The friendly waiter taking your order to the kitchen.
* **Explanation**: When you tap "Add Apple" on your phone screen, the frontend sends a message to the backend server. The server checks the rules and saves your apple safely.

### C. What is a "Database"?
* **Analogy**: A giant, indestructible lockbox notebook.
* **Explanation**: If you lose your phone or drop it in water, your apples and points aren't lost! The database holds all your food info safely on a computer in the cloud.

### D. What is "JWT Authentication"?
* **Analogy**: A stamped wristband at an amusement park.
* **Explanation**: When you log in with your password, the server gives your phone a secret stamped wristband (JWT). Every time your phone asks for your pantry, it shows the wristband so the server knows it's really YOU and not a stranger!

### E. What is a "Household"?
* **Analogy**: A big family whiteboard on the kitchen fridge.
* **Explanation**: If Mom buys milk and adds it on her phone, Dad and the kids immediately see the milk on their phones too because they are all in the same "Household"!

### F. What is "Gemini AI OCR"?
* **Analogy**: A robot butler with super-smart reading glasses.
* **Explanation**: You take a photo of a milk carton. The robot butler reads the date "AUG 25" from the picture and automatically types it into your pantry for you!

### G. How does Offline vs. Online Work?
* **Analogy**: A pocket notebook and a family fridge whiteboard.
* **When you have NO internet**: You write down your new apple in your pocket notebook (phone memory). You can still see your food!
* **When internet comes back**: Your app copies everything from your pocket notebook to the big family fridge whiteboard (database server) so everyone else can see it!

---

## 3. History of Changes, Decisions & Mistakes Log

> **STRICT RULE**: Every time we add something, change something, fix a mistake, or delete something, we write it down here in plain simple words!

---

### [2026-08-14] — Phase 1: Architecture & Project Foundation

#### 1. What We Did:
- Created the project blueprint inside `d:\SIMMERS origin\A REST API backend with tests + CI-CD`.
- Wrote 6 master planning documents:
  1. `IMPLEMENTATION_PLAN.md` (The step-by-step building roadmap)
  2. `WORKFLOW.md` (How we test, commit code, and deploy)
  3. `WORK_ARCHITECTURE.md` (How parts talk to each other)
  4. `SECURITY.md` (How we protect secret passwords and API keys)
  5. `DATABASE.md` (How the magic digital notebook stores food and syncs offline)
  6. `UNDERSTANDING.md` (This file!)

#### 2. Why We Did This (Advantages over the old way):
- **Old Way**: The app stored food *only* on one phone's memory. If you got a new phone, all your data vanished. Also, Gemini AI secret keys were hidden inside the app where sneaky people could steal them.
- **New Way**: Food data lives safely in PostgreSQL database. Family members can share pantries using invite codes. Gemini AI keys live hidden safely on our private server.

#### 3. Mistakes Made & How We Fixed Them:
- **Mistake**: We tried creating a folder at `D:\A REST API backend with tests + CI/CD` with forward slashes `/`. Windows got confused because `/` means a folder inside a folder, and `D:\` root was locked by Windows security.
- **Fix**: We created the folder safely inside our workspace at `d:\SIMMERS origin\A REST API backend with tests + CI-CD` using standard dashed names. Now Windows is happy and permissions work perfectly!
- **Mistake**: During `npm install`, we got an error `No matching version found for @google/genai@^0.1.1` because the official package name published on NPM for Google Generative AI is `@google/generative-ai`.
- **Fix**: We updated `package.json` to use `@google/generative-ai@^0.24.0` and updated `src/services/gemini.service.ts` to use `GoogleGenerativeAI`.

---

### [2026-08-14] — Phase 2: Full Code Scaffolding & End-to-End Implementation

#### 1. What We Did:
- Built the entire backend server in Node.js + TypeScript + Express.
- Created database models for `User`, `Household`, `HouseholdMember`, `PantryItem`, and `XPLog` in `prisma/schema.prisma`.
- Created authentication system (`/auth/signup`, `/auth/login`, `/auth/me`) using `bcrypt` to scramble passwords safely and `JWT` to issue wristband tokens.
- Created household sharing system (`/households`, `/households/join`, `/households/:id`) with 6-character random invite codes.
- Created pantry item manager (`GET`, `POST`, `PATCH`, `DELETE` under `/households/:id/items`).
- Created secure server-side robot butler OCR endpoint (`POST /households/:id/items/scan`).
- Wrote unit tests in `tests/unit/auth.test.ts` and end-to-end integration tests in `tests/integration/flows.test.ts`.
- Created GitHub Actions CI robot in `.github/workflows/ci.yml`.

#### 3. Mistakes Made & How We Fixed Them:
- **Mistake**: During TypeScript build (`npm run build`), `tsc` complained that Express URL route parameters like `req.params.id` can technically be parsed as arrays (`string[]`) by Express type definitions, causing strict type mismatch errors when passed to Prisma query functions that expect a single string.
- **Fix**: Added a helper function `parseParam(param)` in controllers and middleware that safely converts route parameter inputs to a single string (`string`). Now `tsc` compiles cleanly with zero errors!
- **Verification**: Ran `npm test` (all 15 unit and integration tests passed) and `npm run build` (TypeScript compiled to clean JavaScript in `dist/` with 0 warnings).

---

### [2026-08-14] — Phase 3: Monorepo Restructuring (`frontend/` & `backend/`)

#### 1. What We Did:
- Moved all original React + Capacitor frontend files into a dedicated `frontend/` directory using `git mv` to preserve git commit history.
- Moved the Node.js REST API backend into `backend/`.
- Updated root `.gitignore` to cleanly ignore `node_modules`, `dist`, `.env`, and native Android build artifacts for both services.
- Updated GitHub Actions CI in `.github/workflows/ci.yml` with `working-directory: './backend'` and trigger path filter `backend/**`.
- Rewrote root `README.md` into a full-stack monorepo landing page linking to both `frontend/README.md` and `backend/README.md`.

#### 2. Advantages of Monorepo Structure:
- **Single Source of Truth**: Frontend mobile app and backend REST API live in one repository, making full-stack review effortless for developers and interviewers.
- **Independent Build & Deploy**: `frontend/` builds native mobile APKs and web bundles independently, while `backend/` runs server tests and deploys to cloud hosting.
- **Git History Preserved**: `git mv` ensured every single commit and history log from the original frontend was preserved intact.



