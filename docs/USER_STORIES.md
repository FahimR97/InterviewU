# User Stories

## End Users

*"As an end user..."*

- I want to securely log in so that my progress and data are protected.
- I want to browse interview questions by category so I can focus on specific areas (Behavioural, Coding, System Design, Linux, Networking, etc.).
- I want to filter questions by subcategory so I can drill into specific topics (e.g. a specific Leadership Principle).
- I want to filter questions by difficulty level so I can tailor my preparation.
- I want to submit answers and receive AI-powered feedback with a score (0–100) so I can measure my improvement.
- I want a Test Mode with a timer, code editor, and whiteboard so I can simulate real interview conditions.
- I want a dashboard showing my performance analytics (heatmap, score breakdown, category stats) so I can track progress.
- I want to set my interview date and see a countdown so I can stay motivated.
- I want my settings to persist across devices so I can switch between laptop and desktop seamlessly.
- I want to reset my password if I forget it so I can regain access to my account.

### Acceptance Criteria
- Unauthenticated users are redirected to the login page.
- Authenticated users can view all questions and submit answers.
- AI feedback returns a score, strengths, improvements, and suggestions.
- Test Mode enforces a timer and supports code and diagram input.
- Dashboard displays data from the user's answer history.
- Settings persist via the `/settings` API endpoint.

---

## Administrators

*"As an admin..."*

- I want to add new interview questions so the question bank stays current.
- I want to edit existing questions so content can be corrected or improved.
- I want to delete questions that are no longer relevant.
- I want to bulk upload questions via CSV so I can add content efficiently.
- I want to control who can modify questions so only authorised users can make changes.

### Acceptance Criteria
- Only users in the Admin Cognito group can create, edit, or delete questions.
- Non-admin users receive a 403 error when attempting write operations.
- CSV upload parses headers, handles quoted fields, and reports success/failure counts.
- All admin actions are logged via CloudTrail.

---

## Developers

*"As a developer..."*

- I want automated CI/CD pipelines so that changes are tested and deployed reliably.
- I want separate Alpha and Production environments so I can test safely.
- I want integration tests to run against Alpha before promoting to Production.
- I want vulnerability scanning (Trivy) on every build so security issues are caught early.
- I want CloudWatch monitoring and alarms so I'm alerted to errors and performance issues.
- I want X-Ray tracing so I can debug request flows across services.
- I want budget alerts so I'm notified if costs exceed expectations.
- I want infrastructure defined as code (CDK) so environments are reproducible.

### Acceptance Criteria
- Pushing to `main` triggers automated deployment through Alpha → Integration Tests → Production.
- Trivy scan fails the build if critical vulnerabilities are found.
- CloudWatch alarms fire on Lambda errors, throttles, high latency, and API 5XX errors.
- X-Ray traces are visible for all Lambda invocations and API Gateway requests.
- Budget alarm triggers at 80% of the monthly threshold.
