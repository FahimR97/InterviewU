# User Stories

## 2.1. Must Have

### End User

**Story 1: Create an account and access the platform**

As an end user I want to create an account and securely access the platform so that my progress and data are protected.

Acceptance Criteria:
- I can create an account using my email address through the platform signup flow.
- I receive a temporary password and must change it on first login.
- I can log in using my email address and password.
- I can only access protected areas of the platform after authentication.

---

**Story 2: Browse and Filter Questions**

As an end user, I want to browse and filter questions by category and difficulty so that I can focus my preparation.

Acceptance Criteria:
- I can view interview questions after logging in.
- I can filter questions by category.
- I can filter questions by difficulty.
- The question list updates based on the selected filters.

---

**Story 3: Receive AI-Powered Feedback**

As an end user, I want to submit an answer and receive AI-powered feedback with a score so that I can understand how I performed.

Acceptance Criteria:
- I can submit an answer to a selected question.
- The platform returns AI-generated feedback and a score.
- The feedback highlights how well I answered and where I can improve.
- I can review the result within the platform.

---

**Story 4: View Performance Analytics**

As an end user, I want to view my performance analytics and progress over time so that I can identify strengths and areas to improve.

Acceptance Criteria:
- I can view analytics based on my submitted answers.
- I can see trends in my performance over time.
- I can identify stronger and weaker areas from the dashboard.
- My analytics are specific to my own activity.

---

### Administrator

**Story 1: Manage Interview Questions**

As an administrator, I want to add, edit and delete interview questions so that the question bank stays accurate and current.

Acceptance Criteria:
- I can create new interview questions.
- I can edit existing interview questions.
- I can delete interview questions.
- Changes are reflected in the question bank after the action is completed.

---

**Story 2: Restrict Modification to Authorised Users**

As an administrator, I want only authorised users to be able to modify questions so that content remains controlled.

Acceptance Criteria:
- Only admin users can create, edit or delete questions.
- Non-admin users cannot access admin-only actions.
- Read access remains available to authenticated non-admin users.
- Role checks are enforced at the API level.

---

### Developer

**Story 1: Define Infrastructure as Code**

As a developer, I want infrastructure defined as code so that environments are consistent and reproducible.

Acceptance Criteria:
- Infrastructure resources are defined programmatically.
- Infrastructure changes are version controlled.
- The same infrastructure can be deployed repeatedly in a consistent way.
- Environment configuration is managed through code.

---

**Story 2: Build an Automated CI/CD Pipeline**

As a developer, I want an automated CI/CD pipeline so that changes are tested and deployed reliably.

Acceptance Criteria:
- Code changes trigger automated validation steps.
- The pipeline includes testing and validation before deployment.
- Failed checks prevent unsuitable changes from progressing.
- Deployments are triggered through the pipeline rather than being carried out manually.
- Production deployment requires manual approval before changes are released.

---

**Story 3: Maintain Separate Alpha and Production Environments**

As a developer, I want separate Alpha and Production environments so that changes can be validated before reaching users.

Acceptance Criteria:
- Alpha and Production exist as separate environments.
- Changes can be tested in Alpha before release to Production.
- Production is protected from direct unvalidated changes.
- Environment separation reduces deployment risk.

---

## 2.2. Should Have

| Priority | User Story |
|----------|------------|
| Should Have | I want a Test Mode with a timer and code editor so I can simulate real interview conditions. |
| Should Have | I want to set my interview date and see a countdown so I can stay motivated. |
| Should Have | I want my settings to persist across devices so I can switch between laptop and desktop seamlessly. |
| Should Have | I want to reset my password if I forget it so I can regain access to my account. |
| Should Have | I want to search and filter questions so I can find and manage specific content efficiently. (Admin) |
| Should Have | I want to bulk upload questions via CSV so I can add content at scale. (Admin) |
| Should Have | I want vulnerability scanning on every build so that security issues are caught early. (Developer) |
| Should Have | I want OIDC-based deployment credentials so that no long-lived AWS access keys are stored. (Developer) |
| Should Have | I want CloudWatch monitoring and alarms so that I am alerted to errors and performance issues. (Developer) |
| Should Have | I want custom metrics so that I have business-level visibility into platform behaviour. (Developer) |
| Should Have | I want threat modelling documented so that known attack vectors are identified and mitigated. (Developer) |

---

## 2.3. Nice to Have

| Priority | User Story |
|----------|------------|
| Nice to Have | I want to see detailed analytics breakdowns including radar charts, heatmaps and difficulty views so I can get deeper insight into my performance. (End User) |
| Nice to Have | I want to use a whiteboard in Test Mode so I can work through system design problems visually. (End User) |
| Nice to Have | I want to export questions as CSV so I can back up or audit the question bank. (Admin) |
| Nice to Have | I want to bulk delete questions so I can remove outdated content efficiently. (Admin) |
| Nice to Have | I want X-Ray tracing so I can debug request flows across services. (Developer) |
| Nice to Have | I want budget alerts so I am notified if costs exceed expectations. (Developer) |
| Nice to Have | I want Dependabot with auto-merge so low-risk dependency updates are handled automatically. (Developer) |