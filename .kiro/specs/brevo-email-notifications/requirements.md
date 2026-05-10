# Requirements Document

## Introduction

This feature integrates Brevo (formerly Sendinblue) as the transactional email service for the BMKG Calibration System. The integration replaces the currently disabled nodemailer/Gmail approach with Brevo's API (sib-api-v3-sdk). Only two email use cases are in scope: account confirmation upon signup, and signer notification when a certificate is fully signed and completed (terbit).

## Glossary

- **Brevo_Service**: The Brevo transactional email API client configured with the project's API key, responsible for sending emails via the Brevo platform.
- **Email_Sender**: The configured sender identity (noreplysimkalnmkg@gmail.com) used as the "from" address for all outgoing emails.
- **Account_Confirmation_Email**: A transactional email sent to a newly registered user to confirm their account creation.
- **Signer_Notification_Email**: A transactional email sent to the penandatangan (authorized signer) when a certificate has been fully signed and its status changes to "completed".
- **Penandatangan**: The authorized signer (level 4 verifier) assigned to a certificate via the `authorized_by` field.
- **Signup_API**: The Next.js API route at `app/api/auth/signup-simple/route.ts` that handles user registration.
- **Sign_Level_3_API**: The Next.js API route at `app/api/certificate-verification/sign-level-3/route.ts` that handles the final signing step, after which the certificate status becomes "completed".

## Requirements

### Requirement 1: Brevo Email Service Configuration

**User Story:** As a system administrator, I want a centralized Brevo email service module, so that all email sending uses a consistent, maintainable configuration.

#### Acceptance Criteria

1. THE Brevo_Service SHALL use the Brevo API (sib-api-v3-sdk package) to send transactional emails.
2. THE Brevo_Service SHALL authenticate using the API key stored in an environment variable (BREVO_API_KEY).
3. THE Brevo_Service SHALL use "noreplysimkalnmkg@gmail.com" as the Email_Sender address for all outgoing emails.
4. THE Brevo_Service SHALL expose a reusable function that accepts recipient email, subject (maximum 150 characters), and HTML body (maximum 1 MB) as parameters and returns a result object containing a success boolean and, on success, the message ID, or on failure, an error message string.
5. IF the recipient email parameter is empty or not a valid email format, THEN THE Brevo_Service SHALL return a failure result indicating invalid recipient without calling the Brevo API.
6. IF the Brevo API returns an error, THEN THE Brevo_Service SHALL log the error details including recipient email and error message.
7. IF the Brevo API returns an error, THEN THE Brevo_Service SHALL return a failure result containing the error message without throwing an unhandled exception.
8. IF the BREVO_API_KEY environment variable is missing or empty, THEN THE Brevo_Service SHALL return a failure result indicating missing configuration without calling the Brevo API.

### Requirement 2: Account Confirmation Email on Signup

**User Story:** As a new user, I want to receive a confirmation email after creating my account, so that I know my registration was successful.

#### Acceptance Criteria

1. WHEN a user account is successfully created via the Signup_API, THE Brevo_Service SHALL send an Account_Confirmation_Email to the registered email address.
2. THE Account_Confirmation_Email SHALL include the user's name (from the `name` field in the signup request body) in the greeting.
3. THE Account_Confirmation_Email SHALL include the BMKG Calibration System branding (system name and organization).
4. THE Account_Confirmation_Email SHALL have the subject line "Konfirmasi Akun - Sistem Kalibrasi BMKG".
5. IF the Account_Confirmation_Email fails to send, THEN THE Signup_API SHALL still return a successful registration response to the user.
6. IF the Account_Confirmation_Email fails to send, THEN THE Signup_API SHALL log the email failure including the recipient email address and the error message for troubleshooting.
7. THE Signup_API SHALL invoke the Account_Confirmation_Email sending after the user record is committed to the database but without blocking the API response to the user.

### Requirement 3: Signer Notification Email on Certificate Completion

**User Story:** As a penandatangan (signer), I want to receive an email notification when a certificate I signed is fully completed, so that I have a record of the completed signing.

#### Acceptance Criteria

1. WHEN a certificate status changes to "completed" after successful signing via the Sign_Level_3_API, THE Brevo_Service SHALL send a Signer_Notification_Email to the Penandatangan's email address.
2. THE Signer_Notification_Email SHALL include the certificate number (no_certificate) in the email body.
3. THE Signer_Notification_Email SHALL include the date and time of completion formatted in Indonesian locale (e.g., "dd MMMM yyyy, HH:mm WIB") using the Asia/Jakarta timezone.
4. THE Signer_Notification_Email SHALL have the subject line "Sertifikat Terbit - [no_certificate]" where [no_certificate] is the actual certificate number.
5. THE Signer_Notification_Email SHALL include a link to view the completed certificate constructed as "{NEXT_PUBLIC_SITE_URL}/certificates/{certificateId}/view".
6. IF the Signer_Notification_Email fails to send, THEN THE Sign_Level_3_API SHALL still return a successful signing response to the user.
7. IF the Signer_Notification_Email fails to send, THEN THE Sign_Level_3_API SHALL log the email failure including the recipient email address and the error message returned by the Brevo_Service.
8. THE Sign_Level_3_API SHALL retrieve the Penandatangan's email address from the personel record associated with the `authorized_by` user ID.
9. IF the Penandatangan's personel record does not contain an email address, THEN THE Sign_Level_3_API SHALL skip sending the Signer_Notification_Email and log a warning indicating the missing email for the `authorized_by` user ID.
10. THE Sign_Level_3_API SHALL invoke the Signer_Notification_Email sending after the signing response is committed to the database but without blocking the API response to the user.

### Requirement 4: Email HTML Template Consistency

**User Story:** As a system administrator, I want all emails to follow a consistent visual template, so that the system presents a professional and unified appearance.

#### Acceptance Criteria

1. THE Brevo_Service SHALL use a shared HTML email template structure for both the Account_Confirmation_Email and the Signer_Notification_Email, consisting of a header section, a content section, and a footer section in that order.
2. THE Brevo_Service SHALL include in the header section the system name "BMKG - Sistem Kalibrasi" and subtitle "Direktorat Data dan Komputasi".
3. THE Brevo_Service SHALL include in the footer section the copyright text "© 2025 BMKG - Direktorat Data dan Komputasi".
4. THE Brevo_Service SHALL apply all CSS styles as inline style attributes on HTML elements, without using external stylesheets or embedded `<style>` blocks, to ensure rendering in Gmail, Outlook, and Yahoo Mail.
5. THE Brevo_Service SHALL place email-specific content (greeting, body text, links) within the content section located between the header and footer.
