# Loyalty points and payment OTP integration

The cashier UI redeems loyalty points at a fixed rate of **100 points = $1**. A patient's available balance is stored as `Patient.loyaltyPoints`; successful local invoice settlement deducts the corresponding points and records the amount redeemed on the payment transaction. Balances default to zero unless they are supplied by a trusted patient/loyalty account source.

## Required backend endpoints

The Vite app does not include an SMS backend. The UI calls these same-origin endpoints and will block points settlement if they are missing, return invalid responses, or reject a code. SMS provider credentials must stay on the server and must never be added to Vite client environment variables.

### `POST /api/loyalty/otp/request`

Request body:

```json
{ "invoiceId": "INV-2026-0081" }
```

The authenticated backend must resolve the invoice and registered patient phone from trusted records, enforce rate limits, create a short-lived single-use challenge, send the code through the configured SMS provider, and return only:

```json
{ "challengeId": "opaque-challenge-id", "maskedPhone": "***-***-1234" }
```

### `POST /api/loyalty/otp/verify`

Request body:

```json
{ "challengeId": "opaque-challenge-id", "code": "123456" }
```

On successful verification, return a short-lived, single-use authorization token bound to the authenticated cashier, patient, invoice, and requested points amount:

```json
{ "authorizationToken": "opaque-single-use-token" }
```

The production invoice settlement endpoint must validate and consume this authorization atomically with the loyalty balance deduction and invoice payment. The current demo context persists invoice and point balances in browser state; it is not a substitute for server-side authorization, durable accounting, or a PCI-DSS-compliant payment processor.
