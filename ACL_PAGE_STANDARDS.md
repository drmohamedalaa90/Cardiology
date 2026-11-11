# ACL Standard Page Header — Required for new pages

Use the **same Basic Edition navigation/header** across all new ACL pages. The canonical implementation is in:

- `assets/js/acl-standard-header.js` — header markup, authentication-aware member name/avatar, Expert Edition locked modal, refresh/contact/logout.
- `assets/css/basic-universal-shell.css` — existing Basic Edition header design tokens and styles.
- `assets/css/acl-standard-header.css` — fixed positioning, spacing, and responsive overrides.

## Every new Basic Edition HTML page

Add these links inside `<head>`:

```html
<link rel="stylesheet" href="assets/css/basic-universal-shell.css?v=20261023-simple">
<link rel="stylesheet" href="assets/css/acl-standard-header.css?v=1">
```

Add the script near the end of `<body>`:

```html
<script type="module" src="assets/js/acl-standard-header.js?v=1"></script>
```

The script automatically inserts the same header and accounts for its fixed height, so content starts below it. Do **not** copy and paste a different header into each page. Use the shared file. It will not duplicate the header if a Basic Universal shell has already inserted one.

For existing full Basic Edition pages that already load `assets/js/basic-universal-shell.js`, keep that shell; do not install the standard header a second time. New standalone pages (including assessment/practice pages) should use this lightweight shared header and keep any existing activity-specific logic unchanged.

The Quiz Arena uses integrity monitoring. Never change quiz timers, window/tab integrity events, grade submission or participant state as part of header styling. The header's refresh/logout navigation remains standard browser behavior and does not override the quiz assessment rules.

The current standard integration covers:

- `basic-special-course.html`
- `acl-quiz-arena.html`
- `acl-ecg-interpretation.html`

Future page implementations should follow this convention before release. CSS version parameters should be incremented whenever the shared header assets change.
