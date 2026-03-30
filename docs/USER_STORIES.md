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
- Role checks are enforced by the platform.

---

### Developer

**Story 1: Secure Backend API**

As a developer, I want to implement secure authentication and authorisation so that only authorised users can access protected resources and data.

Acceptance Criteria:
- Amazon Cognito is used for user authentication.
- Protected API routes use JWT validation through API Gateway.
- Unauthenticated access to protected endpoints returns a 401 response.
- Admin-only actions are restricted to authorised users.
- Service permissions follow least-privilege access.
- Platform access is secured over HTTPS.

---

**Story 2: Scalable Data Layer**

As a developer, I want to use Amazon DynamoDB for application data so that the platform can store and retrieve content reliably at scale.

Acceptance Criteria:
- Amazon DynamoDB is used as the platform's managed data store.
- The platform can persist and retrieve interview questions, user answers, and user settings.
- The data layer supports scalable access with low infrastructure overhead.
- Data is protected through encryption at rest.
- Point-in-time recovery is enabled for data protection.

---

**Story 3: Define Infrastructure as Code**

As a developer, I want infrastructure defined as code so that environments are consistent and reproducible.

Acceptance Criteria:
- Infrastructure resources are defined programmatically.
- Infrastructure changes are version controlled.
- The same infrastructure can be deployed repeatedly in a consistent way.
- Environment configuration is managed through code.

---

**Story 4: Build an Automated CI/CD Pipeline**

As a developer, I want an automated CI/CD pipeline so that changes are tested and deployed reliably.

Acceptance Criteria:
- Code changes trigger automated validation steps.
- The pipeline includes testing, linting, type checking, vulnerability scanning, and infrastructure validation.
- Successful changes are deployed to Alpha automatically.
- Production deployment requires manual approval.

---

**Story 5: Maintain Separate Alpha and Production Environments**

As a developer, I want separate Alpha and Production environments so that changes can be validated before reaching users.

Acceptance Criteria:
- Alpha and Production exist as separate environments.
- Changes can be tested in Alpha before release to Production.
- Production is protected from direct unvalidated changes.
- Environment separation reduces deployment risk.

---

## 2.2. Should Have

### End User

**Story 1: Simulate Real Interview Conditions**

As an end user, I want a Test Mode with a timer so that I can simulate real interview conditions.

Acceptance Criteria:
- I can start a dedicated Test Mode session within the platform.
- A timer is displayed during the session.
- A defined set of questions is presented in sequence.
- The session provides a more structured experience in completing a series of questions than standard question practice.

---

**Story 2: Reset My Password**

As an end user, I want to reset my password if I forget it so that I can regain access to my account.

Acceptance Criteria:
- I can begin a password reset flow from the platform.
- A verification step is required before a new password is set.
- I can set a new password and use it to log in.
- The reset flow works without administrator intervention.

---

**Story 3: Persist My Settings Across Devices**

As an end user, I want my settings to persist across devices so that I can switch between devices seamlessly.

Acceptance Criteria:
- My settings are stored against my user account.
- My settings remain available after logging out and back in.
- The same settings are applied when I access the platform on another device.
- Settings changes are reflected consistently across sessions.

---

### Administrator

**Story 1: Search and Filter Questions for Management**

As an administrator, I want to search and filter questions so that I can find and manage specific content efficiently.

Acceptance Criteria:
- I can search questions by keyword.
- I can filter questions by relevant attributes such as category and difficulty.
- Search and filter results update within the admin view.
- This allows me to locate questions more efficiently for management tasks.

---

**Story 2: Bulk Upload Questions**

As an administrator, I want to bulk upload questions via CSV so that I can add content at scale.

Acceptance Criteria:
- I can upload a CSV file through the admin interface.
- Multiple questions can be added in one action.
- Uploaded content is processed and added to the question bank.
- Bulk upload reduces manual effort when adding larger sets of content.

---

### Developer

**Story 1: Vulnerability Scanning on Every Build**

As a developer, I want vulnerability scanning on every build so that security issues are caught early.

Acceptance Criteria:
- Vulnerability scanning runs automatically in the pipeline.
- Dependency issues are identified before deployment.
- CRITICAL and HIGH findings block the build.
- Scanning applies to relevant project dependencies.

---

**Story 2: OIDC-Based Deployment Credentials**

As a developer, I want OIDC-based deployment credentials so that no long-lived AWS access keys are stored.

Acceptance Criteria:
- The deployment workflow uses OIDC-based role assumption.
- Long-lived AWS deployment keys are not required in repository secrets.
- Deployment access is granted through short-lived credentials.
- This reduces credential management risk.

---

**Story 3: CloudWatch Monitoring and Alarms**

As a developer, I want CloudWatch monitoring and alarms so that I am alerted to errors and performance issues.

Acceptance Criteria:
- Logs and metrics are available through CloudWatch.
- Alarm thresholds are configured for key platform issues.
- Notifications are sent when alarms are triggered.
- Monitoring supports faster identification of operational problems.

---

**Story 4: Custom Metrics for Platform Behaviour**

As a developer, I want custom metrics so that I have business-level visibility into platform behaviour.

Acceptance Criteria:
- The platform emits custom metrics for question usage and AI evaluation activity.
- These include usage, score, mode, response time, and failure metrics.
- The metrics are visible through the monitoring layer.
- They provide visibility beyond default infrastructure metrics.

---

## 2.3. Nice to Have

### End User

**Story 1: Use a Code Editor for Coding Questions**

As an end user, I want a code editor available for coding questions so that I can write and structure code as part of my answer.

Acceptance Criteria:
- Coding questions can be opened in an embedded code editor.
- I can write and edit code directly within the platform.
- The editor supports a more realistic coding response experience.
- I do not need to use an external tool to answer coding questions.

---

**Story 2: Use a Whiteboard for System Design Questions**

As an end user, I want a whiteboard available for system design questions so that I can sketch out diagrams as part of my answer.

Acceptance Criteria:
- System design questions include a whiteboard-style drawing area.
- I can create and adjust diagrams within the platform.
- The whiteboard is available as part of the question experience.
- This supports non-text responses for design-based questions.

---

**Story 3: View Detailed Visual Performance Insights**

As an end user, I want to view my performance through detailed charts and visualisations so that I can get deeper insight into my progress.

Acceptance Criteria:
- I can view charts and visual summaries of my performance.
- The visualisations show trends across my activity over time.
- The dashboard provides more detailed insight than a basic score summary.
- These views help me identify patterns in my performance.

### Administrator
- I want to export questions as CSV so I can back up or audit the question bank.
- I want to bulk delete questions so I can remove outdated content efficiently.

### Developer
- I want X-Ray tracing so I can debug request flows across services.
- I want budget alerts so I am notified if costs exceed expectations.
- I want Dependabot with auto-merge so low-risk dependency updates are handled automatically.