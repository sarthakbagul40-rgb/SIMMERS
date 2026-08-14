# SIMMERS Backend — Production REST API Service

![CI Status](https://github.com/sarthakbagul40-rgb/SIMMERS/actions/workflows/ci.yml/badge.svg)

Production-ready REST API backend for **SIMMERS** (a gamified pantry and food-waste-tracking application). Built with Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, Vitest, and Google Gemini AI Vision OCR.

---

## 🚀 System Features

- 🔒 **Secure Auth**: JWT authentication with Bcrypt password hashing (10 rounds).
- 🏠 **Multi-User Household Sync**: Shared family pantries with unique 6-character invite code join flow.
- 🤖 **Server-Side AI Vision OCR**: Secure Gemini 2.5 Flash OCR endpoint that hides API keys from client APK builds.
- 🛡️ **Household Access Control**: Strict middleware verification ensuring users can only read/write their own household data.
- 🧪 **Automated Test Suite**: Unit tests for utilities and Supertest integration tests for HTTP flows.
- ⚙️ **CI/CD Pipeline**: GitHub Actions automated linting, building, and testing on every pull request.

---

## 📖 API Reference Table

| Endpoint | Method | Auth Required | Description |
| :--- | :---: | :---: | :--- |
| `GET /health` | GET | No | Server status & health check |
| `POST /auth/signup` | POST | No | Create user account & receive JWT |
| `POST /auth/login` | POST | No | Authenticate user & receive JWT |
| `GET /auth/me` | GET | Yes | Fetch authenticated user profile |
| `POST /households` | POST | Yes | Create household & generate unique invite code |
| `POST /households/join` | POST | Yes | Join a household using invite code |
| `GET /households/:id` | GET | Yes + Member | Get household details and member list |
| `GET /households/:id/items` | GET | Yes + Member | List all pantry items in household |
| `POST /households/:id/items` | POST | Yes + Member | Add a new item to pantry |
| `PATCH /households/:id/items/:itemId` | PATCH | Yes + Member | Update pantry item quantity/details |
| `DELETE /households/:id/items/:itemId` | DELETE | Yes + Member | Remove item from pantry |
| `POST /households/:id/items/scan` | POST | Yes + Member | Server-side Gemini Vision OCR label scan |

---

## 🛠️ Quick Start & Setup Instructions

### 1. Install Dependencies
```bash
cd "A REST API backend with tests + CI-CD"
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in your configuration:
```bash
cp .env.example .env
```

### 3. Database Migration
Run Prisma schema generation and database migration:
```bash
npx prisma generate
npx prisma db push
```

### 4. Run Development Server
```bash
npm run dev
```
Server runs at `http://localhost:3000`.

---

## 🧪 Testing

Run the full automated test suite (unit + integration tests):
```bash
npm test
```

Run test suite in watch mode:
```bash
npm run test:watch
```

---

## 📐 Design Decisions

1. **Why JWT over Cookie Sessions?**
   - SIMMERS operates primarily as a mobile application built with React + Capacitor. Standard cookie sessions face cross-origin credential restrictions on native webviews, whereas `Authorization: Bearer <token>` headers work seamlessly on Web, Android, and iOS builds.

2. **Why Server-Side Gemini AI Vision?**
   - The initial SIMMERS mobile prototype processed OCR calls client-side using `VITE_GEMINI_API_KEY`. Decompiling an Android APK easily exposes embedded keys. Moving the scan to `POST /households/:id/items/scan` keeps your Gemini API key hidden safely in server environment variables.

3. **Household Access Authorization Model**
   - Instead of checking user permissions manually in every controller function, a dedicated `requireHouseholdMember` middleware queries the `HouseholdMember` join table before controller execution. Any unauthorized access returns `403 Forbidden` consistently across all endpoints.
