# Threat Model

## Project Background

Interview preparation is often inconsistent, with questions scattered across personal documents and shared drives. InterviewU addresses this by providing a centralised, secure interview question bank with AI-powered answer evaluation, enabling users to prepare effectively while ensuring content is managed safely.

## Service Overview

InterviewU is a serverless web application hosted on AWS. It provides a question bank across 7 categories (Behavioural, Coding, System Design, Linux, Networking, Automation, Operational Excellence), AI-powered answer evaluation via Amazon Bedrock, and a practice test mode with code editor and whiteboard.

## Security Tenets

1. **Least Privilege** — Users, services, and IAM roles are granted only the permissions required.
2. **Secure by Default** — Unauthenticated access is denied; admin actions require explicit authorisation.
3. **Defence in Depth** — Security controls at application, authentication, and infrastructure layers.
4. **Separation of Responsibilities** — Admin, user, and deployment roles are clearly separated.
5. **Auditability** — Key actions are logged via CloudTrail and CloudWatch for accountability.
6. **Automation** — Deployment, scanning, and monitoring are automated to reduce human error.

## Architecture

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React 19 + TypeScript, S3 + CloudFront | User interface |
| Authentication | AWS Cognito | User management, JWT tokens, admin groups |
| API | API Gateway + Cognito Authoriser | Request routing and auth validation |
| Compute | 6 Lambda functions (Python 3.11) | Business logic |
| Database | 3 DynamoDB tables | Questions, answers, settings |
| AI | Amazon Bedrock (Claude 3.7 Sonnet) | Answer evaluation |
| Observability | CloudWatch, X-Ray, CloudTrail | Monitoring, tracing, audit |
| DNS | Route 53 + ACM | Custom domain with SSL |

### Data Flow

```
User → CloudFront → S3 (static frontend)
User → API Gateway → Cognito validates JWT → Lambda → DynamoDB
                                                └──→ Bedrock (AI evaluation)
```

## API Endpoints

| Endpoint | Method | Auth | Description | Key Threats |
|----------|--------|------|-------------|-------------|
| `/questions` | GET | Cognito | List questions | Scraping, enumeration |
| `/questions` | POST | Cognito (Admin) | Create question | Privilege escalation, injection |
| `/questions/{id}` | PUT | Cognito (Admin) | Update question | Mass assignment, injection |
| `/questions/{id}` | DELETE | Cognito (Admin) | Delete question | Accidental/malicious deletion |
| `/answers` | POST | Cognito | Submit for AI evaluation | Prompt injection, oversized payloads |
| `/signup` | POST | **None (public)** | Create user account | Abuse, spam account creation |
| `/analytics` | GET | Cognito | User performance data | Cross-user data access |
| `/settings` | GET/PUT | Cognito | User preferences | Cross-user data modification |
| `/testing` | GET | Cognito | Health check (Alpha only) | Info leakage |

## Threat Analysis

### T1: Unauthorised Access
| | |
|---|---|
| **Threat** | Unauthenticated user accesses protected endpoints |
| **Impact** | Data exposure, unauthorised question modification |
| **Controls** | Cognito JWT validation on all endpoints (except `/signup`), API Gateway authoriser |

### T2: Privilege Escalation
| | |
|---|---|
| **Threat** | Non-admin user performs admin operations (create/edit/delete questions) |
| **Impact** | Unauthorised content modification |
| **Controls** | Lambda checks `cognito:groups` claim for Admin membership, returns 403 if missing |

### T3: Prompt Injection (AI)
| | |
|---|---|
| **Threat** | Malicious input to the `/answers` endpoint manipulates Bedrock model behaviour |
| **Impact** | Inappropriate responses, model misuse |
| **Controls** | Input validation, structured prompt template, Bedrock invocation scoped to specific model ARN |

### T4: Signup Abuse
| | |
|---|---|
| **Threat** | Automated spam account creation via the public `/signup` endpoint |
| **Impact** | Resource exhaustion, unwanted accounts |
| **Controls** | Lambda creates users via `AdminCreateUser` (not self-signup), Cognito rate limits apply |

### T5: Cross-User Data Access
| | |
|---|---|
| **Threat** | User accesses another user's analytics or settings |
| **Impact** | Privacy violation |
| **Controls** | All user-scoped queries use Cognito `sub` from the JWT token, not user-supplied IDs |

### T6: Infrastructure Misconfiguration
| | |
|---|---|
| **Threat** | Overly permissive IAM roles, public S3 buckets, exposed resources |
| **Impact** | Data exposure, service compromise |
| **Controls** | CDK enforces least-privilege IAM, S3 block public access, infrastructure as code ensures consistency |

### T7: Supply Chain Vulnerabilities
| | |
|---|---|
| **Threat** | Vulnerable dependencies in frontend or backend packages |
| **Impact** | Code execution, data theft |
| **Controls** | Trivy scanning on every CI/CD build, Dependabot weekly checks |

### T8: Credential Exposure
| | |
|---|---|
| **Threat** | AWS credentials or secrets committed to the repository |
| **Impact** | Account compromise |
| **Controls** | OIDC for CI/CD (no stored credentials), `.env` files gitignored, sensitive values in environment variables |

## Monitoring & Detection

| Control | Purpose |
|---------|---------|
| CloudWatch Alarms | Lambda errors, throttles, high latency, API 5XX errors |
| X-Ray Tracing | Distributed request tracing across all Lambdas and API Gateway |
| CloudTrail | AWS API activity audit trail (90-day retention) |
| CloudWatch Dashboard | Real-time visibility into all Lambdas, API Gateway, and DynamoDB |
| Budget Alarm | Cost monitoring with email alert at 80% of monthly threshold |

## Assumptions

1. The service is not publicly promoted — access requires a Cognito account.
2. All traffic is served over HTTPS (CloudFront and API Gateway enforce this).
3. The frontend does not access DynamoDB directly — all data flows through API Gateway → Lambda.
4. Interview questions are not classified as sensitive personal data.
5. Changes are deployed exclusively via the CI/CD pipeline, not manually.
