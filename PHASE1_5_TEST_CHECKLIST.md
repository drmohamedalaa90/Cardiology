# Phase 1.5 release checklist

## Authentication
- [ ] Email confirmation is required.
- [ ] Username and email login both work.
- [ ] Wrong password is rejected.
- [ ] Duplicate username is blocked.
- [ ] Forgot/reset password works.
- [ ] Session survives refresh; sign-out protects private pages.

## Administration and security
- [ ] Student cannot open admin.html.
- [ ] Student cannot change role, status, locked name, or verified email.
- [ ] Admin can suspend and restore accounts.
- [ ] Suspended user cannot sign in.
- [ ] A suspended existing session is removed on protected-page access.
- [ ] CSV export works.

## Quiz and progress
- [ ] Answers save to cloud.
- [ ] Closing and reopening restores the attempt.
- [ ] Another device restores the same attempt.
- [ ] Only one open attempt exists per module.
- [ ] Completion saves score, time, duration, and status.
- [ ] Continue and Review work from My Progress.

## Browser and mobile
- [ ] Normal and Incognito windows use the GitHub Pages URL.
- [ ] Repository search has zero references to acl.drmohamedalaa.org.
- [ ] Phase 1.5 CSS/JS URLs include ?v=1.5.
- [ ] Login, modules, quiz, profile, progress, and admin pages work on mobile.

Do not merge to main if any authentication bypass, unauthorized admin access, suspended-user access, lost progress, or failed cross-device restore remains.
