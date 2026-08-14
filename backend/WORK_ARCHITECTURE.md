# SIMMERS Backend - System Architecture & Work Design

This document details the architectural design, component layers, data flows, and technical decisions governing the SIMMERS REST API backend.

---

## 1. High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────┐
│               SIMMERS Client Layer                     │
│      (React + TypeScript + Capacitor Mobile App)       │
└──────────────────────────┬─────────────────────────────┘
                           │
             HTTPS / REST API Requests (JWT Auth)
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│             SIMMERS Express API Server                 │
│                                                        │
│  ┌──────────────────┐        ┌──────────────────────┐  │
│  │ Auth Middleware  │        │ Household Auth Guard │  │
│  └────────┬─────────┘        └──────────┬───────────┘  │
│           │                             │              │
│  ┌────────▼─────────┐        ┌──────────▼───────────┐  │
│  │ Auth Controller  │        │ Household Controller │  │
│  └────────┬─────────┘        └──────────┬───────────┘  │
│           │                             │              │
│  ┌────────▼─────────┐        ┌──────────▼───────────┐  │
│  │ Pantry Controller│        │ Gemini OCR Service   │  │
│  └────────┬─────────┘        └──────────┬───────────┘  │
│           │                             │              │
└───────────┼─────────────────────────────┼──────────────┘
            │                             │
            ▼                             ▼
 ┌──────────────────────┐    ┌──────────────────────────┐
 │  Prisma ORM Layer    │    │  Google Gemini Vision    │
 └──────────┬───────────┘    │  API (Server-to-Server)  │
            │                └──────────────────────────┘
            ▼
 ┌──────────────────────┐
 │ PostgreSQL Database  │
 └──────────────────────┘
```

---

## 2. Layered Architecture Pattern

The backend strictly adheres to a clean, 4-tier layered architecture:

### Tier 1: Router Layer (`/src/routes`)
- Maps HTTP methods and URI paths (`/auth`, `/households`, `/households/:id/items`) to controllers.
- Applies route-specific middleware (`authMiddleware`, `requireHouseholdMember`).

### Tier 2: Middleware & Auth Layer (`/src/middleware`)
- **JWT Auth Middleware (`auth.ts`)**: Extracts Bearer token from `Authorization` header, verifies cryptographic signature using `JWT_SECRET`, attaches decoded `userId` to `req.user`.
- **Household Authorization Middleware (`householdAuth.ts`)**: Queries `HouseholdMember` table to ensure the authenticated user belongs to the requested `householdId`. Rejects unauthorized requests with `403 Forbidden`.

### Tier 3: Controller Layer (`/src/controllers`)
- Extracts parameters, request body, and query parameters.
- Performs input validation (ensuring required fields exist and types are correct).
- Delegates core domain tasks to services/Prisma.
- Returns standardized JSON responses with proper HTTP status codes (200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Internal Error).

### Tier 4: Data Access & Service Layer (`/src/services` & `/prisma`)
- Uses Prisma Client ORM for type-safe database queries.
- Manages transaction safety, foreign key cascades, and database constraints.
- Handles external API calls (Google Gemini AI Vision API) isolated from HTTP transport code.

---

## 3. Key Sequence Flows

### A. User Authentication Flow
1. Client sends `POST /auth/signup` with email, password, and display name.
2. Controller passes password to `bcrypt.hash(password, 10)`.
3. Prisma inserts new `User` record into PostgreSQL.
4. JWT service signs token containing `{ userId: user.id, email: user.email }` using `JWT_SECRET`.
5. Server responds with `201 Created` and JWT token.

### B. Household Access Control Flow
1. Client requests `GET /households/hh_123/items` with `Authorization: Bearer <token>`.
2. `authMiddleware` validates JWT and populates `req.user.id = "usr_abc"`.
3. `requireHouseholdMember` middleware queries database:
   `SELECT * FROM HouseholdMember WHERE userId = "usr_abc" AND householdId = "hh_123"`.
4. If record exists: Request proceeds to `itemController.getItems`.
5. If record does not exist: Server halts execution and returns `403 Forbidden`.

### C. Server-Side OCR Image Scan Flow
1. Client captures image of food label/receipt and sends `POST /households/hh_123/items/scan` with image payload.
2. Server validates JWT & Household Membership.
3. `geminiService` constructs Vision API prompt requesting structured JSON output:
   `{ "itemName": string, "expiryDate": "YYYY-MM-DD", "confidence": number }`.
4. Server calls Gemini API using private server-side `GEMINI_API_KEY`.
5. Gemini processes image and returns JSON response to server.
6. Server sanitizes dates/names and returns structured JSON to mobile client.
7. Mobile client autofills new pantry item modal.
