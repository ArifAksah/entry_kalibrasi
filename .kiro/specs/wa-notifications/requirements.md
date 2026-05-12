# Requirements Document

## Introduction

This feature adds WhatsApp notification capabilities to the BMKG Calibration System using the Baileys library (WhiskeySockets/Baileys). A separate Node.js service maintains a persistent WhatsApp Web socket connection and exposes an internal HTTP API for sending messages. The Next.js application communicates with this service to send automated plain-text WhatsApp messages for key calibration workflow events: account confirmation, certificate completion (sertifikat terbit), and draft submission to verifiers.

## Glossary

- **WA_Service**: A standalone Node.js service that maintains a WhatsApp Web socket connection via the Baileys library and exposes HTTP endpoints for sending messages and checking connection status.
- **Baileys_Client**: The Baileys library instance within the WA_Service that manages the WhatsApp multi-device connection, authentication state, and message sending.
- **Auth_State_Store**: A local filesystem folder used by the WA_Service to persist WhatsApp session credentials so that the service does not require QR code re-scanning on restart.
- **Next_App**: The existing Next.js dashboard application that triggers WhatsApp notifications by calling the WA_Service internal HTTP API.
- **Send_Message_Endpoint**: The HTTP endpoint (`POST /send-message`) exposed by the WA_Service that accepts a phone number and message text, then sends a WhatsApp message.
- **Status_Endpoint**: The HTTP endpoint (`GET /status`) exposed by the WA_Service that returns the current WhatsApp session connection state.
- **Personel_Record**: A row in the `personel` database table containing personnel information including the `phone` field used as the WhatsApp recipient number.
- **Penandatangan**: The authorized signer (level 4 verifier) assigned to a certificate via the `authorized_by` field.
- **Calibrator**: The personnel who creates and submits draft certificates for verification.
- **Verifier**: Personnel assigned to verify a certificate at levels 1 through 3 (verifikator_1, verifikator_2, verifikator_3).

## Requirements

### Requirement 1: WA Service Initialization and Session Management

**User Story:** As a system administrator, I want the WA Service to maintain a persistent WhatsApp connection with automatic session recovery, so that the service can send messages without manual intervention after initial setup.

#### Acceptance Criteria

1. WHEN the WA_Service starts, THE Baileys_Client SHALL attempt to restore the session from the Auth_State_Store.
2. IF the Auth_State_Store contains valid session credentials, THEN THE Baileys_Client SHALL connect to WhatsApp without requiring a QR code scan.
3. IF the Auth_State_Store does not contain valid session credentials, THEN THE WA_Service SHALL display a QR code in the terminal console for the administrator to scan.
4. WHEN the Baileys_Client establishes a connection, THE WA_Service SHALL persist the authentication state to the Auth_State_Store.
5. WHEN the Baileys_Client authentication state changes, THE WA_Service SHALL update the Auth_State_Store to reflect the current credentials.
6. THE WA_Service SHALL use Baileys multi-device support for the WhatsApp connection.
7. IF the WhatsApp connection is lost, THEN THE Baileys_Client SHALL attempt to reconnect automatically using the stored session credentials.

### Requirement 2: WA Service HTTP API

**User Story:** As a developer, I want the WA Service to expose a simple HTTP API, so that the Next.js application can send WhatsApp messages and check service health programmatically.

#### Acceptance Criteria

1. THE WA_Service SHALL expose the Send_Message_Endpoint at `POST /send-message` accepting a JSON body with `phone` (string) and `message` (string) fields.
2. WHEN the Send_Message_Endpoint receives a valid request and the Baileys_Client is connected, THE WA_Service SHALL send the message text to the specified phone number via WhatsApp.
3. WHEN the Send_Message_Endpoint successfully sends a message, THE WA_Service SHALL return an HTTP 200 response with a JSON body containing `{ success: true }`.
4. IF the `phone` field is missing or empty in the Send_Message_Endpoint request, THEN THE WA_Service SHALL return an HTTP 400 response with a JSON body containing an error description.
5. IF the `message` field is missing or empty in the Send_Message_Endpoint request, THEN THE WA_Service SHALL return an HTTP 400 response with a JSON body containing an error description.
6. IF the Baileys_Client is not connected when the Send_Message_Endpoint receives a request, THEN THE WA_Service SHALL return an HTTP 503 response with a JSON body indicating the service is not connected to WhatsApp.
7. THE WA_Service SHALL expose the Status_Endpoint at `GET /status` returning a JSON body with a `connected` boolean field indicating the current WhatsApp session state.
8. THE WA_Service SHALL listen on the port specified by the `PORT` environment variable, defaulting to 3001 if not set.
9. THE WA_Service SHALL format the phone number by ensuring it uses the international format (e.g., prepending "62" for Indonesian numbers if the number starts with "0") and appending "@s.whatsapp.net" before sending via Baileys.

### Requirement 3: Next.js WhatsApp Client Module

**User Story:** As a developer, I want a centralized WhatsApp client module in the Next.js app, so that all API routes can send WhatsApp messages using a consistent interface.

#### Acceptance Criteria

1. THE Next_App SHALL provide a reusable function that accepts a phone number (string) and message text (string) as parameters and returns a result object containing a `success` boolean and, on failure, an `error` string.
2. THE Next_App SHALL read the WA_Service base URL from the `WA_SERVICE_URL` environment variable.
3. WHEN the reusable function is called, THE Next_App SHALL send an HTTP POST request to the Send_Message_Endpoint of the WA_Service with the phone number and message text.
4. IF the `WA_SERVICE_URL` environment variable is missing or empty, THEN THE Next_App SHALL return a failure result indicating missing configuration without making an HTTP request.
5. IF the WA_Service is unreachable or returns a non-success HTTP status, THEN THE Next_App SHALL log the error and return a failure result without throwing an unhandled exception.
6. IF the WA_Service is unreachable or returns a non-success HTTP status, THEN THE Next_App SHALL not block or fail the calling API route operation.

### Requirement 4: Account Confirmation WhatsApp Notification

**User Story:** As a newly registered personnel, I want to receive a WhatsApp message confirming my account creation, so that I have immediate confirmation on my phone.

#### Acceptance Criteria

1. WHEN an admin successfully registers a new personnel via the personnel registration API, THE Next_App SHALL send a WhatsApp message to the registered personnel's phone number from the Personel_Record.
2. THE Account Confirmation WhatsApp message SHALL include the personnel's name in the greeting.
3. THE Account Confirmation WhatsApp message SHALL include the system name "Sistem Kalibrasi BMKG".
4. THE Account Confirmation WhatsApp message SHALL be plain text without rich formatting.
5. IF the Personel_Record does not contain a phone number, THEN THE Next_App SHALL skip sending the WhatsApp notification and log a warning indicating the missing phone number for the personnel.
6. IF the WhatsApp notification fails to send, THEN THE personnel registration API SHALL still return a successful registration response.
7. IF the WhatsApp notification fails to send, THEN THE Next_App SHALL log the failure including the personnel identifier and the error message.

### Requirement 5: Certificate Completion WhatsApp Notification

**User Story:** As a penandatangan (signer), I want to receive a WhatsApp message when a certificate I signed is fully completed, so that I am immediately informed of the certificate issuance.

#### Acceptance Criteria

1. WHEN a certificate status changes to "completed" after successful signing via the Sign_Level_3_API, THE Next_App SHALL send a WhatsApp message to the Penandatangan's phone number from the Personel_Record.
2. THE Certificate Completion WhatsApp message SHALL include the certificate number (no_certificate).
3. THE Certificate Completion WhatsApp message SHALL include the completion date and time formatted in Indonesian locale using the Asia/Jakarta timezone.
4. THE Certificate Completion WhatsApp message SHALL be plain text without rich formatting.
5. IF the Penandatangan's Personel_Record does not contain a phone number, THEN THE Next_App SHALL skip sending the WhatsApp notification and log a warning indicating the missing phone number for the Penandatangan user ID.
6. IF the WhatsApp notification fails to send, THEN THE Sign_Level_3_API SHALL still return a successful signing response.
7. IF the WhatsApp notification fails to send, THEN THE Next_App SHALL log the failure including the Penandatangan identifier and the error message.

### Requirement 6: Draft Submitted to Verifiers WhatsApp Notification

**User Story:** As a verifier, I want to receive a WhatsApp message when a draft certificate is submitted for my review, so that I am promptly notified of pending verification tasks.

#### Acceptance Criteria

1. WHEN a calibrator sends a draft certificate to verifiers via the send-to-verifiers API, THE Next_App SHALL send a WhatsApp message to each assigned Verifier's phone number from the Personel_Record.
2. THE Draft Submission WhatsApp message SHALL include the certificate number (no_certificate) or certificate identifier.
3. THE Draft Submission WhatsApp message SHALL include the name of the Calibrator who submitted the draft.
4. THE Draft Submission WhatsApp message SHALL be plain text without rich formatting.
5. THE Next_App SHALL send individual WhatsApp messages to each of the assigned verifiers (verifikator_1, verifikator_2, verifikator_3) and the Penandatangan (authorized_by).
6. IF a Verifier's Personel_Record does not contain a phone number, THEN THE Next_App SHALL skip sending the WhatsApp notification to that Verifier and log a warning indicating the missing phone number.
7. IF a WhatsApp notification fails to send to one Verifier, THEN THE Next_App SHALL continue sending notifications to the remaining Verifiers.
8. IF any WhatsApp notification fails to send, THEN THE send-to-verifiers API SHALL still return a successful response.
9. IF any WhatsApp notification fails to send, THEN THE Next_App SHALL log the failure including the Verifier identifier and the error message.

### Requirement 7: Phone Number Handling

**User Story:** As a developer, I want consistent phone number formatting across all WhatsApp notifications, so that messages are delivered regardless of how phone numbers are stored in the database.

#### Acceptance Criteria

1. THE WA_Service SHALL accept phone numbers in formats starting with "0" (local Indonesian), "62" (country code), or "+62" (international with plus).
2. WHEN the phone number starts with "0", THE WA_Service SHALL replace the leading "0" with "62" before sending.
3. WHEN the phone number starts with "+62", THE WA_Service SHALL remove the leading "+" before sending.
4. WHEN the phone number starts with "62", THE WA_Service SHALL use the number as-is for sending.
5. IF the phone number after normalization is fewer than 10 digits or greater than 15 digits, THEN THE WA_Service SHALL return an HTTP 400 response indicating an invalid phone number format.
