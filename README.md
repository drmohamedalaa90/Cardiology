# ACL Expert Edition — Step 3.1 to 3.3 Package

This package combines:

- **3.1 Candidate quiz entry**
- **3.2 Personal-information and eligibility check**
- **3.3 One-question-at-a-time quiz presentation**

## Included features

### Scheduled access
- Opens and closes according to configured Cairo time.
- Clear locked, open, and closed states.
- Displays opening time, closing time, duration, and question count.

### Participant verification
- Full name
- Email
- Phone number
- Academic level
- Public, passcode-protected, or minimum-score access
- Eligibility error messages

### Quiz interface
- One question per page
- Scenario and optional question image
- Single-best-answer options
- Previous and next navigation
- Quiz-level timer
- Autosave after every answer
- Save and exit
- Resume after tab closure or disconnection
- Mobile-responsive ACL visual theme

## How to run

Open `index.html` in a browser.

For reliable local testing, serve the folder using a basic local server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Main configuration

Edit `config.js`.

### Access type

```js
access: {
  type: "public"
}
```

Supported values:

```js
"public"
"passcode"
"minimumScore"
```

Example passcode module:

```js
access: {
  type: "passcode",
  passcode: "mitral2026",
  minimumAclScore: 70
}
```

Example score-unlocked module:

```js
access: {
  type: "minimumScore",
  passcode: "",
  minimumAclScore: 70
}
```

## Important production note

This starter uses `localStorage` to demonstrate autosave and resume.

For the live ACL platform, replace local storage with your backend database so that:

- one participant cannot start multiple attempts on different devices;
- participant eligibility is verified from the real ACL database;
- the passcode is not exposed in front-end code;
- attempts are stored centrally;
- quiz schedules are enforced by the server;
- admins can monitor starts and progress.

The UI and state flow are already structured so the storage functions can later be replaced by Firebase, Supabase, or your existing backend API.
