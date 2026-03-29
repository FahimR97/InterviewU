# User Stories

## End Users

*"As an end user..."*

| Priority | User Story |
|----------|------------|
| Must Have | I want to securely log in so that my progress and data are protected. |
| Must Have | I want to browse interview questions by category so I can focus on specific areas (Behavioural, Coding, System Design, Linux, Networking, etc.). |
| Must Have | I want to filter questions by subcategory and difficulty so I can tailor my preparation. |
| Must Have | I want to submit answers and receive AI-powered feedback with a star rating (1–5) so I can measure my improvement. |
| Should Have | I want a Test Mode with a timer, code editor, and whiteboard so I can simulate real interview conditions. |
| Should Have | I want a dashboard showing my performance analytics (score trends, heatmap, category and difficulty breakdowns) so I can track progress. |
| Should Have | I want to set my interview date and see a countdown so I can stay motivated. |
| Should Have | I want my settings to persist across devices so I can switch between laptop and desktop seamlessly. |
| Nice to Have | I want to reset my password if I forget it so I can regain access to my account. |

### Acceptance Criteria
- Unauthenticated users are redirected to the login page.
- Authenticated users can view all questions and submit answers.
- AI feedback returns a 1–5 star score, strengths, improvements, suggestions and a coaching comment.
- Test Mode enforces a timer and supports code and diagram input.
- Dashboard displays data from the user's answer history.
- Settings persist via the `/settings` API endpoint.

---

## Administrators

*"As an admin..."*

| Priority | User Story |
|----------|------------|
| Must Have | I want to add new interview questions so the question bank stays current. |
| Must Have | I want to edit existing questions so content can be corrected or improved. |
| Must Have | I want to delete questions that are no longer relevant. |
| Must Have | I want to control who can modify questions so only authorised users can make changes. |
| Should Have | I want to bulk upload questions via CSV so I can add content efficiently. |
| Should Have | I want to search and filter questions so I can find and manage specific content. |
| Nice to Have | I want to export questions as CSV so I can back up or audit the question bank. |
| Nice to Have | I want to bulk delete questions so I can remove outdated content efficiently. |

### Acceptance Criteria
- Only users in the Admin Cognito group can create, edit, or delete questions.
- Non-admin users receive a 403 error when attempting write operations.
- Admin users are redirected to the admin console on login, not the user dashboard.
- CSV upload parses headers, handles quoted fields, and reports success and failure counts.
- All admin actions are logged via CloudTrail.

---

## Developers

*"As a developer..."*

| Priority | User Story |
|----------|------------|
| Must Have | I want automated CI/CD pipelines so that changes are tested and deployed reliably. |
| Must Have | I want separate Alpha and Production environments so I can test safely before releasing. |
| Must Have | I want infrastructure defined as code (CDK) so environments are reproducible. |
| Must Have | I want OIDC-based deployment credentials so no long-lived AWS access keys are stored. |
| Should Have | I want integration tests to run against Alpha before promotion to Production. |
| Should Have | I want vulnerability scanning (Trivy) on every build so security issues are caught early. |
| Should Have | I want CloudWatch monitoring and alarms so I am alerted to errors and performance issues. |
| Should Have | I want X-Ray tracing so I can debug request flows across services. |
| Nice to Have | I want budget alerts so I am notified if costs exceed expectations. |
| Nice to Have | I want Dependabot with auto-merge so low-risk dependency updates are handled automatically. |

### Acceptance Criteria
- Pushing to `main` triggers automated deployment through Alpha → Integration Tests → Production.
- Production deployment requires manual approval via GitHub Environment protection.
- Trivy scan fails the build if CRITICAL or HIGH vulnerabilities are found.
- CloudWatch alarms fire on Lambda errors, throttles, high latency, and API 5XX errors.
- X-Ray traces are visible for all Lambda invocations and API Gateway requests.
- Budget alarm triggers at 80% of the monthly threshold.