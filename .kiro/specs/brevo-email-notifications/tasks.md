# Implementation Plan: Brevo Email Notifications

## Overview

This plan implements Brevo transactional email integration for the BMKG Calibration System. The implementation creates a new `lib/brevo.ts` module for sending emails via the Brevo API, a `lib/email-templates.ts` module for HTML template generation, and integrates both into the signup and certificate signing API routes using a fire-and-forget pattern.

## Tasks

- [x] 1. Set up dependencies and project structure
  - [x] 1.1 Install @getbrevo/brevo and fast-check packages
    - Run `npm install @getbrevo/brevo` to add the Brevo SDK
    - Run `npm install --save-dev fast-check` to add the property testing library
    - Verify packages are added to package.json
    - _Requirements: 1.1_

  - [x] 1.2 Add BREVO_API_KEY to environment configuration
    - Add `BREVO_API_KEY` entry to `.env.example` with a placeholder value
    - Add `BREVO_API_KEY` entry to `.env.local` (empty, for local dev)
    - _Requirements: 1.2_

- [x] 2. Implement email templates module
  - [x] 2.1 Create `lib/email-templates.ts` with shared template wrapper and email builders
    - Implement `wrapInEmailTemplate(contentHtml: string): string` that wraps content in header/content/footer structure
    - Header: gradient background with "BMKG - Sistem Kalibrasi" and subtitle "Direktorat Data dan Komputasi"
    - Footer: "© 2025 BMKG - Direktorat Data dan Komputasi"
    - All CSS must be inline style attributes only (no `<style>` or `<link rel="stylesheet">` tags)
    - Implement `buildAccountConfirmationHtml({ userName }): string` with greeting including user name and BMKG branding
    - Implement `buildSignerNotificationHtml({ certificateNumber, completionDateTime, viewUrl }): string` with cert number, date, and link
    - _Requirements: 2.2, 2.3, 3.2, 3.3, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 2.2 Write property tests for email templates
    - Create `lib/__tests__/email-templates.property.test.ts`
    - **Property 3: Account confirmation template includes user name**
    - **Property 4: Signer notification template includes dynamic content**
    - **Property 5: Signer notification subject line format**
    - **Property 6: Template structure ordering**
    - **Property 7: No embedded stylesheets**
    - Use `fast-check` with minimum 100 iterations per property
    - **Validates: Requirements 2.2, 3.2, 3.4, 3.5, 4.1, 4.4, 4.5**

  - [ ]* 2.3 Write unit tests for email templates
    - Create `lib/__tests__/email-templates.test.ts`
    - Test account confirmation email includes BMKG branding (Req 2.3)
    - Test template header contains system name and subtitle (Req 4.2)
    - Test template footer contains copyright text (Req 4.3)
    - Test signer notification includes formatted date with WIB (Req 3.3)
    - _Requirements: 2.3, 3.3, 4.2, 4.3_

- [x] 3. Implement Brevo email service module
  - [x] 3.1 Create `lib/brevo.ts` with sendEmail function
    - Define `SendEmailParams` interface (to, subject, htmlContent)
    - Define `SendEmailResult` interface (success, messageId?, error?)
    - Implement `sendEmail(params: SendEmailParams): Promise<SendEmailResult>`
    - Validate BREVO_API_KEY is present; return failure if missing
    - Validate recipient email format; return failure if invalid (empty, no @, no domain)
    - Truncate subject to 150 characters if exceeded
    - Return failure if htmlContent exceeds 1 MB
    - Configure Brevo SDK with API key and sender (noreplysimkalnmkg@gmail.com / "BMKG Sistem Kalibrasi")
    - Call Brevo transactional email API
    - On success: return `{ success: true, messageId }`
    - On error: log with `console.error` (recipient + error message), return `{ success: false, error }`
    - Never throw unhandled exceptions
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 3.2 Write property tests for Brevo service
    - Create `lib/__tests__/brevo.property.test.ts`
    - **Property 1: Invalid email rejection**
    - **Property 2: Error containment**
    - **Property 8: Valid inputs produce success result**
    - Mock the Brevo SDK for all property tests
    - Use `fast-check` with minimum 100 iterations per property
    - **Validates: Requirements 1.4, 1.5, 1.7**

  - [ ]* 3.3 Write unit tests for Brevo service
    - Create `lib/__tests__/brevo.test.ts`
    - Test sendEmail returns failure when BREVO_API_KEY is missing (Req 1.8)
    - Test sendEmail uses correct sender address "noreplysimkalnmkg@gmail.com" (Req 1.3)
    - Test sendEmail logs error details on API failure (Req 1.6)
    - Mock the Brevo SDK
    - _Requirements: 1.3, 1.6, 1.8_

- [x] 4. Checkpoint - Verify core modules
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Integrate email into Signup API
  - [x] 5.1 Add account confirmation email to `app/api/auth/signup-simple/route.ts`
    - Import `sendEmail` from `lib/brevo.ts` and `buildAccountConfirmationHtml` from `lib/email-templates.ts`
    - Create `sendAccountConfirmationEmail(email: string, name: string): Promise<void>` helper function
    - Build HTML using `buildAccountConfirmationHtml({ userName: name })`
    - Call `sendEmail` with subject "Konfirmasi Akun - Sistem Kalibrasi BMKG"
    - On failure: log error with `console.error` including recipient email and error message
    - Invoke with `void sendAccountConfirmationEmail(email, userData?.name || '')` after successful user creation (fire-and-forget, no await)
    - Ensure the API still returns successful response regardless of email outcome
    - _Requirements: 2.1, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 5.2 Write integration tests for Signup API email integration
    - Create `app/api/auth/signup-simple/__tests__/route.test.ts`
    - Test that sendEmail is called after successful user creation (Req 2.1)
    - Test that signup returns success even when email fails (Req 2.5)
    - Test that email failure is logged (Req 2.6)
    - Mock Supabase and Brevo SDK
    - _Requirements: 2.1, 2.5, 2.6, 2.7_

- [x] 6. Integrate email into Sign Level 3 API
  - [x] 6.1 Add signer notification email to `app/api/certificate-verification/sign-level-3/route.ts`
    - Import `sendEmail` from `lib/brevo.ts` and `buildSignerNotificationHtml` from `lib/email-templates.ts`
    - Create `sendSignerNotification(certificateId: number, certificateNumber: string, authorizedByUserId: string): Promise<void>` helper function
    - Query `personel` table for email using `authorized_by` user ID
    - If no email found: log warning with `console.warn` and return early (skip email)
    - Format completion date/time in Indonesian locale with Asia/Jakarta timezone and "WIB" suffix
    - Construct view URL as `${NEXT_PUBLIC_SITE_URL}/certificates/${certificateId}/view`
    - Build HTML using `buildSignerNotificationHtml({ certificateNumber, completionDateTime, viewUrl })`
    - Call `sendEmail` with subject `Sertifikat Terbit - ${certificateNumber}`
    - On failure: log error with `console.error` including recipient email and error message
    - Invoke with `void sendSignerNotification(cert.id, cert.no_certificate, cert.authorized_by)` after certificate status is updated to "completed" (fire-and-forget, no await)
    - Ensure the API still returns successful signing response regardless of email outcome
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [ ]* 6.2 Write integration tests for Sign Level 3 API email integration
    - Create `app/api/certificate-verification/sign-level-3/__tests__/route.test.ts`
    - Test that notification is sent after cert completion (Req 3.1)
    - Test that signing returns success even when email fails (Req 3.6)
    - Test that email failure is logged (Req 3.7)
    - Test that personel table is queried for email (Req 3.8)
    - Test that email is skipped when personel has no email (Req 3.9)
    - Mock Supabase and Brevo SDK
    - _Requirements: 3.1, 3.6, 3.7, 3.8, 3.9, 3.10_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `@getbrevo/brevo` package is used instead of the deprecated `sib-api-v3-sdk`
- All email sending uses fire-and-forget pattern (`void fn()`) to never block API responses
- The existing `lib/email.ts` (nodemailer/Gmail) is left untouched; the new modules are independent

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3"] },
    { "id": 3, "tasks": ["5.1", "6.1"] },
    { "id": 4, "tasks": ["5.2", "6.2"] }
  ]
}
```
