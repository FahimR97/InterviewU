# User Stories

## End Users

*"As an end user..."*

| Priority | User Story |
|----------|------------|
| Must Have | I want to securely log in so that my progress and data are protected. |
| Must Have | I want to browse and filter questions by category and difficulty so that I can focus my preparation. |
| Must Have | I want to submit an answer and receive AI-powered feedback with a score so that I can understand how I performed. |
| Must Have | I want to view my performance analytics and progress over time so that I can identify strengths and areas to improve. |
| Should Have | I want a Test Mode with a timer, code editor, and whiteboard so I can simulate real interview conditions. |
| Should Have | I want to set my interview date and see a countdown so I can stay motivated. |
| Should Have | I want my settings to persist across devices so I can switch between laptop and desktop seamlessly. |
| Should Have | I want to reset my password if I forget it so I can regain access to my account. |
| Nice to Have | I want to see detailed analytics breakdowns including radar charts, heatmaps and difficulty views so I can get deeper insight into my performance. |
| Nice to Have | I want to use a whiteboard in Test Mode so I can work through system design problems visually. |
| Nice to Have | I want to see my interview date countdown on my dashboard so I can stay aware of how much time I have left. |

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
| Must Have | I want to add, edit and delete interview questions so that the question bank stays accurate and current. |
| Must Have | I want only authorised users to be able to modify questions so that content remains controlled. |
| Should Have | I want to search and filter questions so I can find and manage specific content efficiently. |
| Should Have | I want to bulk upload questions via CSV so I can add content at scale. |
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
| Must Have | I want infrastructure defined as code so that environments are consistent and reproducible. |
| Must Have | I want an automated CI/CD pipeline so that changes are tested and deployed reliably. |
| Must Have | I want separate Alpha and Production environments so that changes can be validated before reaching users. |
| Should Have | I want vulnerability scanning on every build so that security issues are caught early. |
| Should Have | I want OIDC-based deployment credentials so that no long-lived AWS access keys are stored. |
| Should Have | I want CloudWatch monitoring and alarms so that I am alerted to errors and performance issues. |
| Should Have | I want custom metrics so that I have business-level visibility into platform behaviour. |
| Should Have | I want threat modelling documented so that known attack vectors are identified and mitigated. |
| Nice to Have | I want X-Ray tracing so I can debug request flows across services. |
| Nice to Have | I want budget alerts so I am notified if costs exceed expectations. |
| Nice to Have | I want Dependabot with auto-merge so low-risk dependency updates are handled automatically. |

### Acceptance Criteria
- Pushing to `main` triggers automated deployment through Alpha → Integration Tests → Production.
- Production deployment requires manual approval via GitHub Environment protection.
- Trivy scan fails the build if CRITICAL or HIGH vulnerabilities are found.
- CloudWatch alarms fire on Lambda errors, throttles, high latency, and API 5XX errors.
- Custom metrics emit evaluation scores, response times and question access patterns to CloudWatch.
- X-Ray traces are visible for all Lambda invocations and API Gateway requests.
- Budget alarm triggers at 80% of the monthly threshold.