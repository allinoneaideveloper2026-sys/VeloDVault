# VeloDVault incident response plan (draft, 3 Nov 2026)
Owner: [OWNER NAME]   Backup: [BACKUP NAME]   Contact: [SECURITY EMAIL]
Have a lawyer confirm legal deadlines before launch.

## 1. What counts as an incident
Lost or stolen signing key, hosting account takeover, defaced or altered app files, malicious code found in the app, leaked personal data (for example support mailbox), or a vulnerability report that is being exploited.

## 2. First hour
1. Write down the time you learned of it and who reported it.
2. Contain: change passwords and keys for hosting, GitHub, Google Cloud and the support mailbox; turn on two-step verification; unpublish or roll back the affected release.
3. Keep evidence: save logs, screenshots, the altered files and the report.

## 3. Assess (same day)
- What data could be affected (sign-in emails, feedback tickets, anything else)?
- How many people, since when, and is it still happening?
- Rate it: Low (no personal data), Medium (limited personal data), High (personal data exposed or code altered).

## 4. Notify
| Who | When | How |
|---|---|---|
| Data Protection Board of India | As the data protection rules require; the rules call for an initial intimation and a detailed report within 72 hours | Board channel; keep a copy |
| Affected people | Without delay for personal data breaches | Email and a notice inside the app: what happened, what data, what to do, contact |
| CERT-In | Check the current rule on reporting cyber incidents within hours of noticing | Official CERT-In channel |
| Google Play / hosting provider | If the app package or account is involved | Support channel |

## 5. Recover
Rebuild from a clean copy of the source in your Drive, rotate all secrets, publish a fixed release, confirm integrity, then re-enable.

## 6. Review (within 7 days)
Root cause, what worked, what to change, update the Compliance Matrix and this plan. Practise a short drill every quarter.
