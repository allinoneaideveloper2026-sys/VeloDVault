# Google Play Data safety worksheet (draft, 3 Nov 2026)
Answers must match the final build. Update when Google sign-in, analytics or notifications are added.

| Question | Answer | Note |
|---|---|---|
| Does the app collect or share user data? | Collects: yes. Shares: no | We do not sell or share data |
| Email address | Collected; required for the account; not shared | Used for sign-in and support |
| User IDs | Collected (account identifier); not shared | |
| Files and documents | Stored encrypted on the device and, for Google sign-in users, in a VeloDVault folder in the user's own Google Drive (drive.file permission); not sent to our servers | Confirm in Play Console how to describe user-controlled Drive storage |
| Name and email from Google sign-in | Collected; used for account identity; not shared | Only if the user signs in with Google |
| Messages (feedback tickets) | Collected when the user sends them; optional | Sent to the support mailbox |
| App activity, diagnostics | Not collected unless the user opts in to anonymous totals | Add if analytics are used |
| Location, contacts, photos library, microphone, health, financial info | Not collected | Document picker is user-initiated |
| Data encrypted in transit | Yes | HTTPS |
| Users can request deletion | Yes | In-app (More), and delete-account.html; give this URL in Play Console |
| Independent security review | No, until the audit is done | Change after the audit |
| Target audience | 18 and above | Not designed for children |
| Ads | None | |
| Privacy policy URL | https://[YOUR-DOMAIN]/privacy.html | |

## Permissions the app requests
INTERNET, CAMERA (only when the user taps Take photo to capture a document; photos are not sent to us), POST_NOTIFICATIONS (local reminders), USE_BIOMETRIC (app lock), RECEIVE_BOOT_COMPLETED (restore reminders after restart). No location, contacts or microphone permission.

## Other answers
Backups: app data excluded from cloud and device backups. Encryption at rest: yes (Android Keystore). Screenshots blocked in release builds.
