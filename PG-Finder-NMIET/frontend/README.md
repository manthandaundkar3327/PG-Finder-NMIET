# CampusNMIET PG Finder — Static Frontend + Node.js Backend

This version uses a **static frontend** (HTML, CSS and browser JavaScript) and a **Node.js + Express backend**. The backend serves the static files and provides REST-style APIs for login, registration, PG search and vacancy publishing.

## Structure

```text
PG's Finder(v7)-static-node/
├── public/
│   ├── index.html
│   ├── find-pg.html
│   ├── login.html
│   ├── create-vacancy.html
│   ├── style.css
│   ├── script.js
│   └── pg_logic.c
├── server.js
├── package.json
└── README.md
```

`campusnest.db` is created automatically after the first server start, so it does not need to be included in the ZIP.

## Run locally

1. Install Node.js LTS.
2. Extract this folder.
3. Open a terminal inside the project folder.
4. Run:

```bash
npm install
npm start
```

5. Open:

```text
http://localhost:3000
```

Do **not** double-click the HTML files. The Node.js server must serve the static frontend because the frontend communicates with `/api/...` endpoints.

## Demo login

Email: `student@example.com`

Password: `12345`

## Backend APIs

- `GET /api/health` — server health check
- `GET /api/session` — current login status
- `POST /api/register` — create student account
- `POST /api/login` — login
- `POST /api/logout` — logout
- `GET /api/pgs` — search/filter available PGs
- `POST /api/pgs` — publish a vacancy (login required)
- `GET /api/my-pgs` — current user's vacancies (login required)
- `DELETE /api/pgs/:id` — delete own vacancy (login required)

## Important for deployment

Set a strong `SESSION_SECRET` environment variable on the hosting platform. For a real production website, use a persistent session store and a hosted database instead of the default in-memory session store.


## v11 fix
- Fixed duplicate vacancy creation when editing: the create-vacancy submit handler is disabled on edit-vacancy.html, so editing performs only the PUT update.
