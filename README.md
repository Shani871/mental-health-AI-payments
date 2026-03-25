# MindBridge Health Platform

Full-stack mental health SaaS using Spring Boot + React, built phase-wise from the development report.

Full project documentation: [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md)

## Implemented Scope

- Phase 1: JWT auth, refresh token, role-based guards, rate limiting, global API responses, Swagger support
- Phase 2: therapist profiles, document uploads, slot management, Redis slot locking, booking lifecycle + reschedule/cancel policies
- Phase 3: payments (Razorpay + Stripe-style flow + Cash), webhooks, invoice generation, refunds, payouts, commission engine
- Phase 4: structured PHQ-9/GAD-7 assessment, risk classification, emergency alerts, encrypted AI chat history, mood tracking, therapist AI summaries
- Phase 5: Zoom meeting creation, meeting metadata entity, attendance tracking, email reminders, SMS service hook, in-app notifications, review moderation flow
- Phase 6: structured request logging, security headers, actuator/prometheus metrics, Docker + Nginx setup, CI pipeline with OWASP dependency scan

## Local Run

### 1) Start infra (MySQL + Redis)
```bash
cd backend
docker compose up -d db redis
```

### 2) Run backend (MySQL `Health` database defaults)
```bash
cd ..
npm run dev:backend
```

If MySQL needs a password/user, run with your credentials:
```bash
DB_USERNAME=root DB_PASSWORD='your_mysql_password' npm run dev:backend
```

### 3) Run frontend
```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`  
Backend API: `http://localhost:8080`  
Swagger UI: `http://localhost:8080/swagger-ui/index.html`

## Full Docker Stack (frontend + backend + mysql + redis + nginx)

```bash
cd backend
docker compose up --build
```

Nginx entrypoint: `http://localhost`

## Default Admin

- Email: `admin@mentalsaas.com`
- Password: `admin123`

## What You Need To Provide (Your Side)

Set these environment variables before production-like usage:

- `OPENAI_API_KEY` for AI backend calls
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` for live Razorpay payments/webhooks
- `MAIL_USERNAME`, `MAIL_PASSWORD` for transactional emails
- `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` for real Zoom meetings
- `SMS_PROVIDER` (+ provider-specific credentials if replacing mock SMS)
- `ENCRYPTION_KEY` (strong secret, min 16 chars) for encrypted fields

Optional production infrastructure:

- AWS S3 bucket (if replacing local file storage with S3)
- HTTPS certificate + domain for Nginx SSL
- Prometheus/Grafana deployment for monitoring
- GitHub Actions secrets for CI/CD deploy steps

## Notes

- Backend dev profile now points to MySQL (`Health`) by default via `npm run dev:backend`.
- Optional H2 fallback: `npm run dev:backend:h2`.
- Current backend tests may fail on Java 25 due Mockito agent-attach restrictions; compile/build are passing.
