# Publish checklist (tick in order)
Items marked OWNER need you; the rest are in this package.

## Before going online
- [ ] OWNER: replace every [PLACEHOLDER] in index.html and the .html pages (owner name and address, support email, grievance officer, security email, domain, retention, response times). Search for "[".
- [ ] OWNER: have a lawyer review privacy.html, terms.html and the grievance and deletion pages.
- [ ] OWNER: trademark search for VeloDVault on the official registry.
- [ ] Confirm TESTING is false (it is in this build).

## Website (free, Cloudflare Pages): public pages for Google Play
- [ ] OWNER: Cloudflare account > Workers & Pages > Create > Pages > Connect to Git > pick the private repo.
- [ ] Build command: `node scripts/build-site.js`   Build output directory: `site`
- [ ] The site holds only the landing page and the policy pages. The web version of the app is NOT published.
- [ ] Use in Play Console: privacy policy `https://YOUR-SITE/privacy.html`, account deletion `https://YOUR-SITE/delete-account.html`.
- [ ] Optional: in the Pages project settings add a variable SITE_URL with your site address so security.txt lists the security page.
- [ ] Renew the Expires date in www/.well-known/security.txt every year.
- [ ] Check https://securityheaders.com for your address (the _headers file sets the security headers).
- [ ] To publish the web version later as an unlisted preview at /app/: change the build command to `node scripts/build-site.js --with-app`. It stays out of search engines. Add Google web sign-in before promoting it.

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
