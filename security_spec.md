# Security Specification: Smart Ride (E-Y Investment Limited)

## 1. Data Invariants
1. **Strict PII & Wallet Isolation**: `/users/{userId}/private/{docId}` is accessible ONLY when `request.auth.uid == userId` and `docId == 'wallet'`.
2. **Ownership Integrity**: Every document in `/bankAccounts`, `/budgets`, `/transactions`, `/bids`, and `/bookings` MUST have `uid == request.auth.uid`.
3. **Verified Identity**: All writes require `request.auth != null && request.auth.token.email_verified == true`.
4. **Immutable Ownership & Creation Timestamps**: `uid` and `createdAt` cannot be modified during updates (`incoming().uid == existing().uid`).
5. **Server Timestamp Enforcement**: `createdAt` on create and `updatedAt` on update must equal `request.time`.
6. **Strict Schema & Key Allowlisting**: Every entity helper (`isValidUserWallet`, `isValidBankAccount`, `isValidBudgetCategory`, `isValidTransactionRecord`, `isValidProxyBid`, `isValidInspectionBooking`) enforces `hasAll` and `hasOnly` with string `.size()` boundaries.
7. **Secure List Queries**: Every `allow list` rule enforces `resource.data.uid == request.auth.uid`.
8. **Terminal State Locking**: Once a `Booking` reaches `status == 'COMPLETED'` or `'CANCELLED'`, or a `Bid` reaches `status == 'WON'` or `'REFUNDED'`, no further updates are permitted.

## 2. The "Dirty Dozen" Payloads
1. **Shadow Field Injection**: `{ uid: "u1", name: "Fuel", currency: "NGN", allocatedAmount: 1000, spentAmount: 0, alertThresholdPct: 80, updatedAt: SERVER_TIME, isAdmin: true }` -> Rejected by `hasOnly`.
2. **Unverified Email Write**: Authenticated user with `email_verified: false` attempting `create` on `/budgets/b1` -> Rejected by `isVerifiedUser()`.
3. **Cross-User PII Read**: User `u2` attempting `get` on `/users/u1/private/wallet` -> Rejected by `isOwner(userId)`.
4. **Blanket List Scraping**: User `u1` issuing unfiltered `list` query on `/transactions` -> Rejected by `resource.data.uid == request.auth.uid`.
5. **Owner Spoofing on Create**: User `u1` creating `/bids/bid1` with `uid: "u2"` -> Rejected by `data.uid == request.auth.uid`.
6. **Owner Mutation on Update**: User `u1` updating `/budgets/b1` to change `uid` to `"u2"` -> Rejected by `affectedKeys().hasOnly(...)` and `incoming().uid == existing().uid`.
7. **ID Poisoning Attack**: Document ID with 300 chars or special characters `../admin` -> Rejected by `isValidId(id)`.
8. **Denial of Wallet String Flood**: `description` with 50,000 characters in `/transactions/t1` -> Rejected by `data.description.size() <= 240`.
9. **Client Timestamp Forgery**: Creating `/transactions/t1` with past `createdAt` timestamp -> Rejected by `incoming().createdAt == request.time`.
10. **Terminal State Reversal**: Updating `/bookings/bk1` when `existing().status == 'COMPLETED'` -> Rejected by terminal state guard.
11. **Negative Financial Injection**: Creating `/bids/bid1` with `maxProxyBidUsd: -500` -> Rejected by `data.maxProxyBidUsd > 0`.
12. **Invalid Enum Injection**: Creating `/bankAccounts/ba1` with `currency: "EUR"` -> Rejected by `data.currency in ['NGN', 'USD']`.
