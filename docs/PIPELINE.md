# CI/CD Pipeline

InterviewU uses two parallel GitHub Actions pipelines triggered on push to `main`, with OIDC authentication to AWS (no stored credentials).

## Frontend Pipeline

```
Push to main (frontend/**)
        │
        ▼
┌───────────────┐
│    ESLint     │
│  TypeScript   │
│  Trivy Scan   │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Deploy Alpha  │
│  S3 Sync +    │
│  CF Invalidate│
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Deploy Prod  │
│  S3 Sync +    │
│  CF Invalidate│
└───────────────┘
```

## Backend & Infrastructure Pipeline

```
Push to main (backend/** or infrastructure/**)
        │
        ▼
┌───────────────────────────┐
│  Backend Tests (pytest)   │
│  CDK Synth + Diff         │
│  Trivy Scan               │
└─────────┬─────────────────┘
          │
          ▼
┌───────────────────────────┐
│    CDK Deploy (Alpha)     │
│  Account: Alpha           │
│  Region: eu-west-2        │
└─────────┬─────────────────┘
          │
          ▼
┌───────────────────────────┐
│  Integration Tests Alpha  │
└─────────┬─────────────────┘
          │
          ▼
┌───────────────────────────┐
│    CDK Deploy (Prod)      │
│  Account: Prod            │
│  Region: eu-west-2        │
└───────────────────────────┘
```

## Pipeline Features

| Feature | Description |
|---------|-------------|
| **OIDC Auth** | GitHub assumes IAM roles via OpenID Connect — no stored secrets |
| **Trivy Scanning** | Container and dependency vulnerability scanning on every build |
| **Parallel Pipelines** | Frontend and backend deploy independently |
| **Integration Tests** | Automated tests run against Alpha before promoting to Prod |
| **Multi-Environment** | Isolated Alpha and Production AWS accounts |
| **CloudFront Invalidation** | Cache cleared automatically after frontend deploy |
