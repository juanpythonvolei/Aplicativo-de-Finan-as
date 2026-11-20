# Security Specification — Vértice Finance

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every workspace, private profile, account, category, transaction, budget, and goal is scoped under `/users/{userId}` and includes `userId == request.auth.uid`. Cross-user reads, lists, or writes are strictly impossible.
2. **Verified Email Requirement**: All authenticated reads and writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Isolation**: User PII (`email`, `displayName`, `photoURL`) is isolated in `/users/{userId}/private/profile` and never stored on `/users/{userId}` or financial subcollections. `allow list` on `/users` and `/users/{userId}/private` is explicitly `false`.
4. **Parent Workspace Gate & Relational Integrity**: Every subcollection document (`accounts`, `categories`, `transactions`, `budgets`, `goals`) requires the parent `/users/{userId}` workspace document to exist (`exists(...)` / `existsAfter(...)`). Transactions additionally verify that `accountId` exists in `/users/{userId}/accounts`.
5. **Temporal Integrity & Immutability**: `createdAt` must equal `request.time` on creation and cannot be modified on update. `updatedAt` must equal `request.time` on every write. `userId` is immutable after creation.
6. **Terminal State Locking**: Financial goals reaching `'completed'` or `'cancelled'` status cannot be mutated afterwards.
7. **Strict Schema & Size Guards**: Every document enforces exact `keys().hasAll(...)` and `keys().hasOnly(...)` on create, `affectedKeys().hasOnly(...)` action branches on update, strict type checks, regex IDs (`^[a-zA-Z0-9_\-]+$`), and `.size()` bounds on all strings.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Cross-Tenant Read**: User B attempts `get(/users/userA/accounts/acc1)`.
2. **Blanket User Enumeration**: Authenticated user attempts `list(/users)`.
3. **Identity Spoofing on Create**: User A attempts to create `/users/userA/transactions/tx1` with `userId: "userB"`.
4. **Shadow Ghost Field Injection**: User A creates an account with an extra `isAdmin: true` or `tier: "enterprise"` field.
5. **Timestamp Forgery**: User A creates a transaction with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
6. **Unverified Email Bypass**: A token with `email_verified: false` attempts to write a budget.
7. **Orphaned Transaction**: User A attempts to create a transaction referencing a non-existent `accountId: "nonexistent_acc"`.
8. **ID Poisoning (1MB ID)**: User A attempts to create a document with a 2,000-character document ID containing invalid characters (`../admin`).
9. **Value Type Poisoning on Update**: User A attempts to update `account.balance` to a string `"999999"` or `transaction.amount` to `-500`.
10. **Immutable Field Tampering**: User A attempts to change `createdAt` or `userId` during a transaction update.
11. **Terminal State Mutation**: User A attempts to modify `currentAmount` on a goal whose `status` is already `'completed'`.
12. **PII Snooping**: User B attempts `get(/users/userA/private/profile)`.

## 3. Test Runner Specification (`firestore.rules.test.ts`)
```ts
// Verification suite targeting Firebase Emulator Suite (@firebase/rules-unit-testing)
// Asserts assertFails (PERMISSION_DENIED) for all 12 adversarial payloads above
// and assertSucceeds for valid owner CRUD operations with serverTimestamp().
```
