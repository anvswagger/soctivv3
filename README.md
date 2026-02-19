# SoctivCRM

Enterprise CRM platform built with React, TypeScript, and Supabase.

## Project Info

- **Frontend**: Vite + React + TypeScript + shadcn-ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Platform**: Web + PWA (Capacitor for iOS/Android)

## Environment Setup

### 1. Clone and Install

```sh
git clone <repository-url>
cd soctivcrm
npm install
```

### 2. Environment Variables

Copy the example environment file and fill in your values:

```sh
cp .env.example .env
```

Required variables:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Anonymous publishable key for client (or use `VITE_SUPABASE_ANON_KEY`)
- `VITE_WEB_PUSH_PUBLIC_KEY` - VAPID public key for push notifications

Optional variables:
- `SUPABASE_ACCESS_TOKEN` - Supabase CLI token (needed for CLI deploy workflows)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for server-side scripts/Edge Functions
- `VITE_ENABLE_PUSH_DEV=true` - Enable push testing in development
- `VITE_SENTRY_DSN` - Sentry DSN for error tracking

### 3. Supabase Setup

Run migrations and deploy Edge Functions:

```bash
# Apply database migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy --project-ref <your-project-ref>
```

### 4. Start Development Server

```sh
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Utility Scripts

- `node scripts/check-env.js` - Validate environment configuration
- `node scripts/fix-mojibake.js` - Fix Arabic text encoding issues

## Notifications Setup

For full Web/PWA push notification + IF/THEN automation setup:
- See `docs/notifications-setup.md`
- Run `scripts/setup-notifications.ps1` (Windows PowerShell)

## Deployment

### Build

```sh
npm run build
```

### Deploy to Netlify

This repo runs `npm run ci:env` in `netlify.toml` before `npm run build`. Netlify deploys fail fast if required runtime vars are missing.

Set these in Netlify UI:
- Site settings -> Build & deploy -> Environment variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (or legacy `VITE_SUPABASE_ANON_KEY`)

### Deploy to Supabase

```bash
supabase functions deploy --project-ref <your-project-ref>
supabase db push
```

## Feature Overview

### Core Features

- **Leads Management**: Track, qualify, and convert leads
- **Appointments**: Schedule and manage client appointments
- **Focus Mode**: Dedicated workspace for call center agents
- **Analytics Dashboard**: Super admin analytics and reporting

### Notification System

- **In-App Notifications**: Real-time notifications within the app
- **Push Notifications**: Web push notifications via VAPID
- **SMS Reminders**: Appointment reminders via Ersaal API
- **Approval Workflows**: User approval with push notifications

### Analytics & Tracking

- Event tracking for user actions
- Super admin analytics dashboard
- Funnel tracking and conversion metrics

## Security

- Row Level Security (RLS) enabled on all tables
- Supabase Auth for user authentication
- Rate limiting on public endpoints
- Input validation with Zod schemas

## License

MIT
