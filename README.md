# InterviewU

A full-stack interview preparation platform with AI-powered answer evaluation, built with React, Python Lambda functions, and AWS CDK.

## 📋 Table of Contents
- [Features](#-features)
- [Architecture](#️-architecture)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Project Structure](#-project-structure)
- [Local Development](#-local-development)
- [Deployment](#-deployment)
- [Documentation](#-documentation)
- [Security](#-security)

## ✨ Features
- 🔐 **Secure Authentication** — AWS Cognito with email signup and temporary password flow; self-signup backed by admin Lambda
- 📚 **Question Bank** — 539 interview questions across 7 categories with subcategory filtering
- 👨‍💼 **Admin Dashboard** — Role-based access control with CSV bulk upload for question management
- 🤖 **AI Interview Coach (Marcus)** — AWS Bedrock (Claude 3.7 Sonnet) powered answer evaluation with scoring (0–100)
- 🎯 **Test Mode** — Practice with integrated code editor (Monaco) and whiteboard (Excalidraw)
- 📊 **Analytics Dashboard** — Mode toggle (Practice / Test), activity heatmap, score over time, category radar chart, difficulty breakdown, and interview countdown
- ⚙️ **Settings Persistence** — Interview date and preferences synced across devices
- 🌐 **Multi-Environment** — Separate Alpha and Production deployments with custom domain
- 📱 **Responsive Design** — Works on desktop, tablet, and mobile
- 🔄 **Automated Security Updates** — Dependabot monitors dependencies weekly with auto-merge for minor/patch updates

## 🏗️ Architecture
- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Python 3.11 Lambda functions (5 application Lambdas)
- **Infrastructure**: AWS CDK (TypeScript)
- **Database**: DynamoDB (3 tables)
- **AI**: AWS Bedrock (Claude 3.7 Sonnet)
- **Authentication**: AWS Cognito with role-based access control
- **Hosting**: S3 + CloudFront CDN with custom domain
- **Observability**: CloudWatch Dashboard + custom metrics + Alarms, X-Ray Tracing, CloudTrail
- **Cost Management**: AWS Budgets with email alerts

### Architecture Diagram

```
User → Route 53 → CloudFront → S3 (React SPA)
                                    ↓
                              API Gateway ← Cognito Auth
                             (X-Ray enabled)
                    ↙       ↓       ↓         ↓        ↘
        QuestionsHandler  EvaluateAnswer  Analytics  Settings  AdminCreateUser
               ↓               ↓    ↓        ↓          ↓           ↓
      InterviewQuestions    Bedrock  UserAnswers  UserAnswers  UserSettings  Cognito
                           (Claude)

CloudTrail → S3 + CloudWatch Logs
CloudWatch Alarms → SNS
Budget Alarm → Email Alert
```

## 🚀 CI/CD Pipeline

GitHub Actions with OIDC authentication (no stored credentials):

- **Frontend Pipeline**: ESLint → TypeScript Check → Trivy Scan → Build (Alpha) → Deploy Alpha → Build (Prod) → Deploy Production
- **Backend Pipeline**: Unit Tests → CDK Synth/Diff → Trivy Scan → Deploy Alpha → Integration Tests → Deploy Production

**📊 [View Full Pipeline Diagram](docs/PIPELINE.md)**

### Environments

| Environment | URL |
|-------------|-----|
| **Alpha** | [https://alpha.fahimray.people.aws.dev](https://alpha.fahimray.people.aws.dev) |
| **Production** | [https://fahimray.people.aws.dev](https://fahimray.people.aws.dev) |

## 📁 Project Structure

```
InterviewU/
├── frontend/               # React application
│   └── src/
│       ├── pages/          # Home, Login, Signup, Dashboard, Questions, TestMode, Admin, ChangePassword
│       ├── contexts/       # AuthContext (Cognito), ThemeContext
│       └── services/       # API client
├── backend/
│   └── src/                # Lambda handlers + shared modules
│       ├── questions_handler.py    # CRUD operations (admin-gated writes)
│       ├── evaluate_answer.py      # AI evaluation via Bedrock (persists all modes)
│       ├── analytics_handler.py    # User performance aggregation (practice + test)
│       ├── settings_handler.py     # User preferences (GET/PUT)
│       ├── admin_create_user.py    # Cognito user creation via signup form
│       └── custom_metrics.py      # Custom CloudWatch metric emission
├── infrastructure/
│   └── lib/stacks/         # CDK stack definitions
├── docs/                   # Documentation
│   ├── PIPELINE.md         # CI/CD pipeline diagram
│   ├── USER_STORIES.md     # User stories and acceptance criteria
│   └── THREAT_MODEL.md     # Security threat model
└── .github/workflows/      # GitHub Actions pipelines
```

## 💻 Local Development

### Prerequisites
- Node.js 20+
- Python 3.11+
- AWS CLI configured

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
python -m pytest
```

### Infrastructure
```bash
cd infrastructure
npm install
npm test
npx cdk synth
npx cdk deploy
```

## 🚢 Deployment

Push to `main` triggers automatic deployment:
- Changes to `frontend/**` trigger the Frontend Pipeline
- Changes to `backend/**` or `infrastructure/**` trigger the Backend Pipeline

Each environment gets its own build with environment-specific API and Cognito config injected at build time via `VITE_*` environment variables.

## 📚 Documentation
- **[User Stories](docs/USER_STORIES.md)** — Feature requirements and acceptance criteria
- **[Threat Model](docs/THREAT_MODEL.md)** — Security analysis and mitigations
- **[CI/CD Pipeline](docs/PIPELINE.md)** — Deployment workflows and diagrams

## 🔐 Security
- **Trivy vulnerability scanning** on every build
- **Dependabot** monitors dependencies weekly with auto-merge for minor/patch updates
- **OIDC authentication** for CI/CD (no stored AWS credentials)
- **X-Ray distributed tracing** across all Lambdas and API Gateway
- **CloudTrail audit logging** for all AWS API activity
- **CloudWatch alarms** for errors, throttles, latency, and 5XX responses
- **Custom CloudWatch metrics** for business-level observability (evaluation scores, response times, question access patterns)
- **Budget alerts** for cost monitoring
- **Cognito JWT validation** on all protected endpoints
- **Admin group-based authorisation** for destructive operations
- **HTTPS enforced** on all traffic
- **S3 bucket encryption** and public access blocked
- **DynamoDB encryption at rest** with point-in-time recovery

## 📝 License

Private project — All rights reserved

**Author:** Fahim Rayhan