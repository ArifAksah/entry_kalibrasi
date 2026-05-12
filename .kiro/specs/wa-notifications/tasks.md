# Implementation Plan: WhatsApp Notifications (wa-notifications)

## Overview

This plan implements WhatsApp notification capabilities for the BMKG Calibration System. It creates a standalone WA service (`wa-service/`) using Express + Baileys, a client module (`lib/wa.ts`) in the Next.js app, message builder functions (`lib/wa-messages.ts`), and integrates notifications into three existing API routes using the fire-and-forget pattern.

## Tasks

- [x] 1. Set up WA Service project structure and configuration
  - [x] 1.1 Create `wa-service/` directory with `package.json`, `tsconfig.json`, and `.env.example`
    - Initialize `wa-service/package.json` with dependencies: express, @whiskeysockets/baileys, pino, dotenv, @types/express, typescript, ts-node-dev
    - Create `tsconfig.json` targeting ES2020 with strict mode
    - Create `.env.example` with `PORT=3001`
    - Add `auth_info/` to `.gitignore`
    - _Requirements: 1.1, 2.8_

  - [x] 1.2 Implement phone number normalization utility (`wa-service/src/phone-utils.ts`)
    - Implement `normalizePhoneNumber(phone: string): PhoneNormalizationResult`
    - Handle formats: leading `0` → replace with `62`, leading `+62` → remove `+`, leading `62` → as-is
    - Validate digit count is 10–15 after normalization
    - Append `@s.whatsapp.net` to produce JID
    - _Requirements: 2.9, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 1.3 Write property tests for phone number normalization
    - **Property 1: Phone number normalization preserves identity**
    - **Property 2: Phone number length validation**
    - **Validates: Requirements 2.9, 7.1, 7.2, 7.3, 7.4, 7.5**
    - Use fast-check (install in wa-service devDependencies) with minimum 100 iterations
    - Test file: `wa-service/src/__tests__/phone-utils.property.test.ts`

- [x] 2. Implement WA Service Baileys client and HTTP routes
  - [x] 2.1 Implement Baileys client manager (`wa-service/src/baileys-client.ts`)
    - Create `BaileysClientManager` class with `initialize()`, `isConnected()`, `sendMessage(jid, text)` methods
    - Use `useMultiFileAuthState` for session persistence in `auth_info/` directory
    - Handle connection events: QR code display in terminal, auto-reconnect on disconnect
    - Persist auth state on credential updates
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 2.2 Implement Express HTTP routes (`wa-service/src/routes.ts`)
    - `POST /send-message`: Validate `phone` and `message` fields, normalize phone, send via Baileys client
    - Return 400 for missing/empty `phone` or `message`, 400 for invalid phone format after normalization
    - Return 503 if Baileys client is not connected
    - Return 200 with `{ success: true }` on successful send
    - `GET /status`: Return `{ connected: boolean }` based on Baileys client state
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 2.3 Create entry point (`wa-service/src/index.ts`)
    - Load environment variables with dotenv
    - Initialize Baileys client
    - Start Express server on `PORT` env var (default 3001)
    - Wire routes to Express app
    - _Requirements: 1.1, 2.8_

  - [ ]* 2.4 Write unit tests for WA Service routes
    - Test request validation (missing phone, missing message, empty fields)
    - Test 503 response when client is disconnected
    - Mock Baileys client for route handler tests
    - Test file: `wa-service/src/__tests__/routes.test.ts`
    - _Requirements: 2.1–2.7_

- [x] 3. Checkpoint - Ensure WA Service compiles and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Next.js WA client and message builders
  - [x] 4.1 Create WA client module (`lib/wa.ts`)
    - Implement `sendWhatsApp(params: SendWhatsAppParams): Promise<SendWhatsAppResult>`
    - Read `WA_SERVICE_URL` from environment variable
    - Return failure result if `WA_SERVICE_URL` is missing/empty (no HTTP request)
    - Make HTTP POST to `{WA_SERVICE_URL}/send-message` with phone and message
    - Never throw — catch all errors and return `{ success: false, error: string }`
    - Log errors with `console.error`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 4.2 Write property test for WA client resilience
    - **Property 3: WA client never throws**
    - **Validates: Requirements 3.1, 3.5, 3.6**
    - Generate random error responses, network failures, malformed responses
    - Verify function always returns result object, never throws
    - Test file: `lib/__tests__/wa.test.ts`

  - [x] 4.3 Create message builder functions (`lib/wa-messages.ts`)
    - Implement `buildAccountConfirmationMessage(personnelName: string): string`
    - Implement `buildCertificateCompletionMessage(certificateNumber: string, completionDateTime: string): string`
    - Implement `buildDraftSubmissionMessage(certificateNumber: string, calibratorName: string): string`
    - All functions return plain text (no HTML, no Markdown, no WhatsApp rich text markers)
    - _Requirements: 4.2, 4.3, 4.4, 5.2, 5.3, 5.4, 6.2, 6.3, 6.4_

  - [ ]* 4.4 Write property tests for message builders
    - **Property 4: Message builders produce plain text**
    - **Property 5: Account confirmation message includes personnel name**
    - **Property 6: Certificate completion message includes certificate number and formatted datetime**
    - **Property 7: Draft submission message includes certificate number and calibrator name**
    - **Validates: Requirements 4.2, 4.3, 4.4, 5.2, 5.3, 5.4, 6.2, 6.3, 6.4**
    - Use fast-check with minimum 100 iterations
    - Test file: `lib/__tests__/wa-messages.test.ts`

- [x] 5. Checkpoint - Ensure Next.js client and message builder tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integrate WhatsApp notifications into API routes
  - [x] 6.1 Add WA notification to personnel registration (`app/api/personel/register/route.ts`)
    - Import `sendWhatsApp` from `lib/wa.ts` and `buildAccountConfirmationMessage` from `lib/wa-messages.ts`
    - After successful registration (after email send block), fire-and-forget WA notification
    - Check if `phone` field exists; if missing, log warning and skip
    - Use pattern: `void sendWhatsApp({ phone, message }).then(r => { if (!r.success) console.error(...) })`
    - _Requirements: 4.1, 4.5, 4.6, 4.7_

  - [x] 6.2 Add WA notification to sign-level-3 (`app/api/certificate-verification/sign-level-3/route.ts`)
    - Import `sendWhatsApp` from `lib/wa.ts` and `buildCertificateCompletionMessage` from `lib/wa-messages.ts`
    - In the existing `sendSignerNotification` function (or alongside it), add WA notification
    - Fetch penandatangan's phone from personel table; if missing, log warning and skip
    - Format completion datetime in Indonesian locale with Asia/Jakarta timezone
    - Fire-and-forget pattern, never block the signing response
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7_

  - [x] 6.3 Add WA notification to send-to-verifiers (`app/api/certificates/[id]/send-to-verifiers/route.ts`)
    - Import `sendWhatsApp` from `lib/wa.ts` and `buildDraftSubmissionMessage` from `lib/wa-messages.ts`
    - After successful send-to-verifiers operation, fetch phone numbers for verifikator_1, verifikator_2, verifikator_3, and authorized_by
    - Fetch calibrator name from personel table using `sent_by`
    - Send individual WA messages to each recipient; skip those without phone numbers (log warning)
    - Continue sending to remaining recipients if one fails
    - Fire-and-forget pattern, never block the API response
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [ ]* 6.4 Write property test for fault isolation in multi-recipient send
    - **Property 8: Fault isolation in multi-recipient send**
    - **Validates: Requirements 6.7**
    - Generate random success/failure patterns for multi-send
    - Verify all recipients with phone numbers are attempted regardless of individual failures
    - Test file: `lib/__tests__/wa.test.ts`

- [x] 7. Add environment variable configuration
  - [x] 7.1 Update `.env.example` and `.env.local` with `WA_SERVICE_URL=http://localhost:3001`
    - Add `WA_SERVICE_URL` to the Next.js environment configuration
    - _Requirements: 3.2_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The WA service is a separate Node.js project — run `npm install` in `wa-service/` before starting
- The fire-and-forget pattern mirrors the existing email notification pattern in `lib/brevo.ts`
- fast-check is already installed in the Next.js project; it needs to be added to `wa-service/` devDependencies for property tests there

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "4.1", "4.3"] },
    { "id": 2, "tasks": ["1.3", "2.1", "4.2", "4.4"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["2.4", "6.1", "6.2", "6.3", "7.1"] },
    { "id": 5, "tasks": ["6.4"] }
  ]
}
```
