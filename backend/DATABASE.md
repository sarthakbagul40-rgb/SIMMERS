# SIMMERS Backend - Database Architecture & Sync Strategy

This document provides exhaustive documentation for the SIMMERS database architecture, data models, relations, indexing, offline/online synchronization mechanics, conflict resolution, and migration policies.

---

## 1. Database Tech Stack & Architecture

- **Object-Relational Mapping (ORM)**: Prisma ORM (Type-safe SQL query generation, schema migrations, and client generation).
- **Production Database Engine**: PostgreSQL (Relational database with strict foreign keys, indexing, and ACID compliance).
- **Development Fallback**: SQLite (Acceptable for lightweight local offline testing, maintaining 100% Prisma schema compatibility).

---

## 2. Complete Entity Relationship (ER) Diagram

```
┌──────────────────────────┐          ┌──────────────────────────┐
│          User            │          │        Household         │
├──────────────────────────┤          ├──────────────────────────┤
│ id (PK, String)          │          │ id (PK, String)          │
│ email (Unique)           │          │ name (String)            │
│ passwordHash (String)    │          │ inviteCode (Unique)      │
│ displayName (String)     │          │ createdByUserId (FK)     │
│ createdAt (DateTime)     │          │ createdAt (DateTime)     │
└────────────┬─────────────┘          └────────────┬─────────────┘
             │                                     │
             │   ┌─────────────────────────────┐   │
             └───►   HouseholdMember (Join)    ◄───┘
                 ├─────────────────────────────┤
                 │ id (PK, String)             │
                 │ userId (FK -> User)         │
                 │ householdId (FK->Household) │
                 │ role ("owner" | "member")   │
                 │ joinedAt (DateTime)         │
                 └─────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌──────────────────────────┐          ┌──────────────────────────┐
│        PantryItem        │          │          XPLog           │
├──────────────────────────┤          ├──────────────────────────┤
│ id (PK, String)          │          │ id (PK, String)          │
│ householdId (FK)         │          │ userId (FK -> User)      │
│ name (String)            │          │ householdId (FK)         │
│ quantity (Float)         │          │ action (String)          │
│ unit (String)            │          │ xpAmount (Int)           │
│ expiryDate (DateTime?)   │          │ createdAt (DateTime)     │
│ addedByUserId (FK)       │          └──────────────────────────┘
│ createdAt (DateTime)     │
│ updatedAt (DateTime)     │
└──────────────────────────┘
```

---

## 3. Prisma Schema Definition (`prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id           String            @id @default(cuid())
  email        String            @unique
  passwordHash String
  displayName  String
  createdAt    DateTime          @default(now())

  memberships  HouseholdMember[]
  pantryItems  PantryItem[]
  xpLogs       XPLog[]
}

model Household {
  id              String            @id @default(cuid())
  name            String
  inviteCode      String            @unique
  createdByUserId String
  createdAt       DateTime          @default(now())

  members         HouseholdMember[]
  pantryItems     PantryItem[]
  xpLogs          XPLog[]
}

model HouseholdMember {
  id          String   @id @default(cuid())
  userId      String
  householdId String
  role        String   @default("member") // "owner" | "member"
  joinedAt    DateTime @default(now())

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  household   Household @relation(fields: [householdId], references: [id], onDelete: Cascade)

  @@unique([userId, householdId])
}

model PantryItem {
  id            String    @id @default(cuid())
  householdId   String
  name          String
  quantity      Float     @default(1.0)
  unit          String    @default("pcs")
  expiryDate    DateTime?
  addedByUserId String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  household     Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  addedBy       User      @relation(fields: [addedByUserId], references: [id])

  @@index([householdId])
}

model XPLog {
  id          String   @id @default(cuid())
  userId      String
  householdId String
  action      String
  xpAmount    Int
  createdAt   DateTime @default(now())

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  household   Household @relation(fields: [householdId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([householdId])
}
```

---

## 4. Key Relational Rules & Cascades

- **User Deletion**: Deleting a `User` cascades to delete their `HouseholdMember` join rows and `XPLog` entries.
- **Household Deletion**: Deleting a `Household` cascades to delete all associated `PantryItem` rows, `HouseholdMember` rows, and `XPLog` entries.
- **Invite Code Constraint**: `inviteCode` has a `@unique` constraint in the database ensuring two households can never share the same join code.
- **Membership Compound Key**: `@@unique([userId, householdId])` prevents a user from being added to the exact same household twice.

---

## 5. Online vs. Offline Operation Mechanics

### A. How Online Mode Works
1. Mobile app makes an HTTP request to the Express API (e.g. `POST /households/hh_1/items`).
2. Express server validates JWT token and verifies user belongs to household `hh_1`.
3. Prisma executes a parameterized SQL INSERT query against PostgreSQL.
4. Database returns the newly created item record with generated `id`, `createdAt`, and `updatedAt` timestamps.
5. Server sends `201 Created` JSON payload back to the mobile client.
6. Mobile client updates its local UI and updates its local Capacitor offline cache.

### B. How Offline Mode Works
1. Mobile app detects loss of network connectivity (using Capacitor Network plugin).
2. User performs pantry actions (e.g. adding an item, updating quantity).
3. The mobile app writes the action to local storage ([storage.ts](file:///d:/SIMMERS%20origin/src/services/storage.ts)) and tags the item with a `pending_sync: true` flag and a temporary client-side ID (`temp_123`).
4. UI updates instantly locally, giving the user a seamless offline experience without spinners or errors.

### C. How Hybrid Sync & Reconciliation Works (Reconnection)
When network connectivity is restored:

```
┌────────────────────────────────────────────────────────┐
│     Client Reconnects to Internet                      │
└──────────────────────────┬─────────────────────────────┘
                           │
             Fetch Local `pending_sync` Queue
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│     Send Batch Sync Payload to `/households/:id/sync`   │
└──────────────────────────┬─────────────────────────────┘
                           │
             Server Checks `updatedAt` Timestamps
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
  [ Client Version Newer ]     [ Server Version Newer ]
             │                           │
  Update Server Record         Keep Server Record
  (Last-Write-Wins)            Send Updated Server Copy
             │                           │
             └─────────────┬─────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│   Server Returns Reconciled State to Mobile Client     │
│   Client Clears `pending_sync` Flags & Updates Storage │
└────────────────────────────────────────────────────────┘
```

1. **Queue Flushing**: Client sends all `pending_sync` items to the backend.
2. **Conflict Resolution Policy (Last-Write-Wins)**:
   - If an item was modified on both device and server while offline, the backend compares `updatedAt` ISO timestamps.
   - The edit with the most recent `updatedAt` timestamp wins and persists in PostgreSQL.
3. **ID Resolution**: For new items created offline with `temp_123` IDs, the backend inserts them into PostgreSQL, assigns permanent `cuid()` keys, and returns the ID mapping so the client can update local storage references.
