# KeepDue 
**Zero-Knowledge Document & Deadline Tracking B2B SaaS**

KeepDue is a highly secure, Enterprise-ready platform designed to help EU businesses track critical documents and deadlines. Built with a focus on absolute privacy, it features a Workspace-owned architecture and AES-256-GCM encryption, ensuring that sensitive data remains completely inaccessible to anyone without the correct workspace keys.

## Architecture & Tech Stack

Built from concept to fully working prototype in three weeks utilizing **AI-assisted development** workflows for rapid deployment and code optimization.

* **Backend:** Node.js, Express
* **Database:** SQLite running in **WAL (Write-Ahead Logging) mode** for robust, concurrent read/write operations.
* **Frontend:** Vanilla JavaScript, EJS templates, Custom CSS (SaaS 3.0 aesthetic).
* **Payment Processing:** Full Stripe integration via secure Webhooks (handling checkouts, subscription updates, failures, and tier downgrades).
* **Internationalization (i18n):** Cookie-based English (`en`) and Greek (`el`) localization.

## Enterprise-Grade Security (Zero-Knowledge)

Security is the foundational pillar of KeepDue, utilizing multi-layered defense mechanisms:

* **Streaming AES-256-GCM Encryption:** All files are encrypted using Node's `crypto` streams before touching the disk (`input.pipe(cipher).pipe(output)`), ensuring zero memory bloat during large uploads. 
* **Granular Rate Limiting:** Custom `express-rate-limit` policies applied dynamically across different routes (e.g., stricter limits on login, registration, and 2FA endpoints vs. global traffic).
* **Robust Authentication:** * Native implementation of **TOTP 2FA** (via `speakeasy`) and **Email OTP** fallback.
  * Secure session management via `connect-sqlite3` with strict concurrent session invalidation.
* **Role-Based Access Control (RBAC):** Custom factory middleware (`requireRole(['owner', 'editor', 'viewer'])`) enforcing strict data boundaries across Workspace junction tables.
* **Infrastructure Defense:** Configured with `helmet` (Strict CSP, HSTS, Referrer Policy), anti-CSRF tokens (`csurf`), and robust XSS sanitization.

## Core Features & Automations

* **Workspace-Owned Model:** Seamless invitation flows, workspace switching, and member management tailored for Enterprise teams.
* **Automated Cron Jobs:** `node-cron` orchestrates daily tasks:
  * Dynamic, user-defined alert policies (triggering targeted Email and Viber notifications via Nodemailer).
  * Automated, rolling 14-day database backups.
  * Expired session cleanup.
* **Secure Data Export:**
  * **Excel Reports:** Dynamic `.xlsx` report generation mapping encrypted database records to localized spreadsheets using `exceljs`.
  * **Bulk ZIP Export:** On-the-fly decryption and archiving of user files using `archiver`, streaming the decrypted files directly to the client as a `.zip` without storing decrypted data on the server.
* **Secure Sharing Protocol:** Ability to generate self-destructing, time-limited links for external auditors to view specific encrypted documents.
