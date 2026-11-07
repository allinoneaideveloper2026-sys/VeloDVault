# Publish checklist (tick in order)
Items marked OWNER need you; the rest are in this package.

## Before going online
- [ ] OWNER: replace every [PLACEHOLDER] in index.html and the .html pages (owner name and address, support email, grievance officer, security email, domain, retention, response times). Search for "[".
- [ ] OWNER: have a lawyer review privacy.html, terms.html and the grievance and deletion pages.
- [ ] OWNER: trademark search for VeloDVault on the official registry.
- [ ] Confirm TESTING is false (it is in this build).

## Hosting (use Cloudflare Pages, free: it applies the _headers file)
- [ ] OWNER: create a free Cloudflare account, Workers & Pages, Create, Pages, Upload assets, upload the whole folder.
- [ ] Turn on HTTPS only and "Always use HTTPS".
- [ ] Open the site, More, Security: content policy should show Active.
- [ ] Check https://securityheaders.com shows A or better for your address.
- [ ] Put your real domain in .well-known/security.txt and privacy page links.
(GitHub Pages also works but cannot apply the security headers; the content policy tag in index.html still applies.)

## Google Play
- [ ] OWNER: Play Console account.
- [ ] OWNER: follow ANDROID-BUILD.md (app id, private repo, signing key, build).
- [ ] OWNER: follow GOOGLE-SETUP.md (Drive API, consent screen, Web and Android clients; add Play's signing SHA-1).
- [ ] Target API 36 is already set in the project; confirm in Play Console.
- [ ] Test on a real phone: sign-in, Drive folder appears, reminder test, lock, restore on a second phone.
- [ ] Fill Data safety using play-data-safety.md; paste the privacy policy and account deletion URLs.
- [ ] Content rating, 18+ audience, no ads.
- [ ] Closed test: 12 testers for 14 days for new personal accounts.

## Security
- [ ] Turn on two-step verification for GitHub, Cloudflare, Google and the support mailbox.
- [ ] Keep incident-response-plan.md where you can find it.
- [ ] Independent security review before the production release.
- [ ] Monthly: review dependencies (there are none), headers, and the Compliance Matrix.
