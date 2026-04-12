# AI Ad Manager

This repository contains the early scaffold for the AI Ad Manager product described in `stage-1-problem-mvp.md` through `stage-7-launch-plan.md`.

## Structure

- `frontend/` — Next.js app with Tailwind CSS for the dealer-facing UI
- `backend/` — Express API skeleton for auth, dashboard, and integrations
- `stage-*.md` — product planning and requirements

## Getting started

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000` by default and the backend runs on `http://localhost:4000`.

## Next steps

1. Implement authentication with NextAuth and Google OAuth
2. Build the account connection flow for Google Ads and Meta Ads
3. Add dashboard metrics and data aggregation API routes
4. Create campaign templates and the campaign launcher UI
5. Add lead inbox and budget management features
6. Connect to PostgreSQL and deploy on Railway/Vercel
