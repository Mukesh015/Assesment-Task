# Live Polling System

Full-stack election polling app for the Rgrid Phase 1 coding test.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Socket.IO client
- Backend: Node.js, Express, TypeScript, Socket.IO, TypeORM, MySQL
- Seed data: 5 default nominees and one admin user

## Project Structure

```text
client/  React + Tailwind frontend
server/  Express + TypeORM backend
```

## Backend Setup

```bash
cd server
npm install
npm run dev
```

The server runs on `http://localhost:8080`.

`server/.env` is already prepared with the database settings you provided. TypeORM is configured with `synchronize: true` for this coding-test build, so the required tables are created automatically when the server starts.

Default admin login:

```text
username: admin
password: admin123
```

Useful endpoints:

- `GET /api/health`
- `GET /api/nominees`
- `GET /api/results`
- `POST /api/votes`
- `POST /api/admin/login`
- `POST /api/admin/polls`
- `GET /api/admin/results`

## Frontend Setup

```bash
cd client
npm install
npm run dev
```

The client runs on `http://localhost:9090` and talks to the backend through `VITE_API_URL`.

For a custom backend URL, create `client/.env`:

```text
VITE_API_URL=http://localhost:8080
```

## Voting Rules

- Audience users can vote for one nominee.
- One vote is allowed per browser session.
- Admin users can create the active poll with 2-5 nominees.
- Admin users see total votes, nominee vote counts, and a live bar chart.
- Creating a new poll replaces the active poll and resets votes.
- Vote updates are pushed to the admin dashboard in real time over Socket.IO.

## Docker

From the repository root:

```bash
docker compose up --build
```

Services:

- `client`: React app on `http://localhost:9090`
- `server`: API on `http://localhost:8080`
- `mysql`: MySQL database on port `3306`

The Docker setup uses the same database name and admin database user declared in the compose file. The server waits for MySQL before connecting through Docker networking.
