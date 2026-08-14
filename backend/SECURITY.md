# SIMMERS Backend - Security Architecture & Posture

This document details the security model, threat mitigations, authentication mechanisms, authorization rules, and data protection practices for the SIMMERS REST API.

---

## 1. Threat Model & Mitigations

| Threat Vector | Risk Description | Applied Mitigation |
| :--- | :--- | :--- |
| **API Key Exposure** | Bundling Gemini API keys inside mobile APKs allows reverse-engineering and quota theft. | Moved Gemini Vision API call **entirely server-side**. Keys exist only in server environment variables. |
| **Credential Theft / Leak** | Plaintext password storage risks leak in case of database dumps. | Passwords hashed using `bcrypt` with a minimum cost factor of **10 rounds**. Passwords never logged or returned. |
| **Unauthorized Household Access** | User A guessing URL of User B's household to steal pantry data. | **Household Authorization Middleware** verifies `HouseholdMember` table membership on every route before executing database queries. Returns `403 Forbidden` if unauthorized. |
| **SQL Injection** | Malicious input manipulating raw database SQL queries. | **Prisma ORM** uses parameterized SQL queries exclusively. No raw string concatenation in SQL. |
| **Man-In-The-Middle (MITM)** | Intercepting tokens or user data in transit. | Production deployment enforces **HTTPS/TLS 1.3** communication with HSTS header. |
| **Tampered JWT Tokens** | Attacker modifying JWT payload to forge identity. | Tokens signed using HMAC SHA-256 (`HS256`) with a strong secret (`JWT_SECRET`). Verification occurs on every protected request. |

---

## 2. Authentication Architecture

- **Token Type**: JSON Web Token (JWT)
- **Header Structure**: `Authorization: Bearer <token>`
- **Token Payload Contents**:
  ```json
  {
    "userId": "usr_cld12345",
    "email": "user@example.com",
    "iat": 1723650000,
    "exp": 1724254800
  }
  ```
- **Signing & Secret Rules**:
  - Signed via `jsonwebtoken` library.
  - `JWT_SECRET` must be set in environment variables (minimum 32 random characters).
  - Verification fails if token signature is invalid or expired.

---

## 3. Authorization & Access Control Rules

1. **Public Routes**:
   - `GET /health` (Server status)
   - `POST /auth/signup` (User creation)
   - `POST /auth/login` (Authentication)

2. **Authenticated Routes (`authMiddleware`)**:
   - `GET /auth/me` (Profile view)
   - `POST /households` (Household creation)
   - `POST /households/join` (Household join)

3. **Household-Scoped Routes (`authMiddleware` + `requireHouseholdMember`)**:
   - `GET /households/:id`
   - `GET /households/:id/items`
   - `POST /households/:id/items`
   - `PATCH /households/:id/items/:itemId`
   - `DELETE /households/:id/items/:itemId`
   - `POST /households/:id/items/scan`

---

## 4. Input Validation & Data Sanitization

- All request bodies pass through validation logic before reaching database query builders.
- Emails normalized to lowercase (`user@example.com`).
- Quantities sanitized to prevent negative numbers or numeric overflow.
- Base64 image payloads checked for size limits before forwarding to Gemini API.

---

## 5. Security Environment Rules

- Never commit `.env` or configuration files containing real secrets to version control.
- Maintain `.env.example` as a template for developers and CI environments.
- Enforce strict `.gitignore` rules covering `.env`, `.env.local`, `node_modules/`, and build artifacts.
