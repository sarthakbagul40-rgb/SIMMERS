# SIMMERS Backend - Implementation Plan

## Overview
This document outlines the step-by-step technical implementation plan for building a production-ready REST API backend for **SIMMERS** (a gamified pantry & food-waste-tracking application).

The backend replaces the app's isolated client-side storage with multi-user household syncing, JWT authentication, server-side Gemini Vision OCR scanning, automated unit/integration testing, and a continuous integration (CI) pipeline.

---

## 1. Directory & Environment Structure

The backend is built inside `d:\SIMMERS origin\A REST API backend with tests + CI-CD` as an independent Node.js + TypeScript service.

```
A REST API backend with tests + CI-CD/
├── src/
│   ├── controllers/      # HTTP Request handlers
│   ├── routes/           # Express router endpoints
│   ├── services/         # Business logic (Auth, Gemini AI, Household)
│   ├── middleware/       # JWT & Household Authorization middleware
│   ├── lib/              # Shared helpers (Bcrypt, JWT, Invite code generator)
│   ├── app.ts            # Express app configuration & middleware
│   └── server.ts         # HTTP Server listener
├── prisma/
│   └── schema.prisma     # Database models & relationships
├── tests/
│   ├── unit/             # Password, JWT, Invite code unit tests
│   └── integration/      # Supertest HTTP endpoint integration tests
├── .github/
│   └── workflows/
│       └── ci.yml        # GitHub Actions CI workflow
├── .env.example          # Environment variables template
├── package.json          # Node dependencies & scripts
├── tsconfig.json         # TypeScript compiler configuration
└── README.md             # Project documentation & API reference
```

---

## 2. Core Feature Specifications

### A. Authentication & User Accounts
- **Signup (`POST /auth/signup`)**: Validates email/password, hashes password with `bcrypt` (10 rounds), creates `User`, returns JWT.
- **Login (`POST /auth/login`)**: Verifies credentials, generates signed JWT.
- **Current User (`GET /auth/me`)**: Returns profile of authenticated user.

### B. Household Management
- **Create Household (`POST /households`)**: Creates household, assigns requester as `owner`, generates unique 6-character invite code.
- **Join Household (`POST /households/join`)**: Joins household using invite code, assigns `member` role.
- **Get Household (`GET /households/:id`)**: Fetches household info and member list (requires household membership).

### C. Pantry Item CRUD
- **List Items (`GET /households/:id/items`)**: Retrieves pantry items for the household.
- **Add Item (`POST /households/:id/items`)**: Adds pantry item (name, quantity, unit, expiry date).
- **Update Item (`PATCH /households/:id/items/:itemId`)**: Updates item details or marks as consumed/wasted.
- **Delete Item (`DELETE /households/:id/items/:itemId`)**: Removes item from pantry.

### D. Server-Side AI Vision OCR
- **Scan Image (`POST /households/:id/items/scan`)**: Accepts base64/multipart receipt or product image, calls Gemini 1.5/2.0 Flash server-side using secure `GEMINI_API_KEY`, extracts product name and expiry date into structured JSON.

---

## 3. Incremental Development Order

1. **Scaffold Project**: Package setup, TypeScript config, Express server setup, Health check endpoint (`GET /health`).
2. **Database Setup**: Prisma initialization, PostgreSQL schema design, initial migration.
3. **Auth Module**: Password hashing, JWT utility, Signup/Login/Me endpoints, Auth middleware.
4. **Household Module**: Invite code generator, Create/Join/Get endpoints, Household authorization middleware.
5. **Pantry Module**: CRUD endpoints for household pantry items.
6. **Gemini Vision Module**: Server-side image scanning endpoint with error handling & confidence scoring.
7. **Unit Test Suite**: Vitest tests for auth utilities, token parsing, invite code uniqueness.
8. **Integration Test Suite**: Supertest tests for end-to-end user journeys (Signup -> Join -> CRUD -> Scan).
9. **CI Pipeline**: GitHub Actions `.github/workflows/ci.yml` running linting, build, and tests.
10. **Documentation**: `.env.example`, `README.md`, API reference table.

---

## 4. Verification & Testing Strategy

- **Linting**: Execute `npm run lint` (ESLint) to ensure zero formatting or syntax errors.
- **Unit Tests**: `npm test` runs Vitest for pure utility functions.
- **Integration Tests**: Supertest executes HTTP calls against an in-memory/test database.
- **CI Pipeline**: Every git push and pull request runs automated build & test checks.
