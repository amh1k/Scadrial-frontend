# ScadrialAPI Frontend

This is a standalone React frontend for the Go backend in the repository root. It lives in its own `frontend/` folder so the API and UI stay fully separated.

The frontend is now route-based instead of a one-page prototype.

## What it includes

- Landing page with animated Stormlight-inspired hero art
- User registration route
- Account activation route
- Authentication token login route
- Protected movie listing with filters, sorting, and pagination
- Movie detail route
- Create and edit movie routes

## Routes

- `/`
- `/register`
- `/activate`
- `/login`
- `/movies`
- `/movies/new`
- `/movies/:movieId`
- `/movies/:movieId/edit`

## Local setup

1. Start the Go API with a trusted origin for the Vite dev server:

```bash
go run ./cmd/api -cors-trusted-origins "http://localhost:5173"
```

2. In a separate terminal, install frontend dependencies:

```bash
cd frontend
npm install
```

3. Create a local env file if your API runs somewhere else:

```bash
cp .env.example .env.local
```

4. Start the frontend:

```bash
npm run dev
```

By default, the app talks to `http://localhost:4000`.
