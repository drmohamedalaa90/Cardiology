ACL Direct Home Fix — 2026-08-22

Replace these files in the v2-development branch:
- index.html
- pathways.html
- assets/js/auth.js

Result:
- Opening the ACL root goes directly to home.html?edition=expert.
- Old pathways.html links also go directly to the Expert dashboard.
- Sign-in and immediate post-registration sessions go directly to the Expert dashboard.
- Basic Edition is NOT deleted. Users can still switch to it from the Editions menu in the drawer.
