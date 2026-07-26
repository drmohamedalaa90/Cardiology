# Backend Integration Contract

Replace these front-end-only functions in `app.js`:

- `saveAttempt()`
- `loadAttempt()`
- `validateEligibility()`
- `startNewAttempt()`

Suggested API routes:

## GET /api/quizzes/:quizId/access
Returns:

```json
{
  "status": "open",
  "serverTime": "2026-07-26T20:00:00+03:00",
  "opensAt": "2026-07-26T20:00:00+03:00",
  "closesAt": "2026-07-26T22:00:00+03:00"
}
```

## POST /api/quizzes/:quizId/verify
Body:

```json
{
  "fullName": "Participant Name",
  "email": "participant@example.com",
  "phone": "+201000000000",
  "academicLevel": "Resident",
  "passcode": ""
}
```

Returns:

```json
{
  "eligible": true,
  "participantId": "participant_123"
}
```

## POST /api/quizzes/:quizId/attempts
Creates one active attempt and returns:

```json
{
  "attemptId": "attempt_123",
  "startedAt": "2026-07-26T20:04:00+03:00",
  "expiresAt": "2026-07-26T20:19:00+03:00"
}
```

## PATCH /api/attempts/:attemptId
Autosave body:

```json
{
  "currentQuestionIndex": 1,
  "answers": {
    "q1": 2
  }
}
```

## GET /api/attempts/:attemptId
Restores a saved attempt.

## POST /api/attempts/:attemptId/finish
Marks the attempt complete.

## Security requirements

- Validate quiz opening and closing on the server.
- Keep passcodes only on the server.
- Do not trust a score submitted by the browser.
- Bind attempts to authenticated participant accounts.
- Reject second active attempts when `oneActiveAttempt` is enabled.
- Store timestamps using server time.
