# Kiapat Inventory & Sales MVP

This repository contains a minimal yet functional MVP for **Kiapat**, an egg delivery business in Kidapawan City. The system consists of a Python backend (FastAPI) and a mobile‑first React frontend. It covers core flows such as authentication, inventory IN/OUT, sales invoices with signature capture, and role‑based GUIs for the Inventory Manager (admin) and Driver.

## Contents

- `server/` – FastAPI application, SQLAlchemy models, Alembic migrations, tests and Makefile.
- `web/` – Vite + React + TypeScript + Tailwind frontend with role‑based pages and assets.
- `render.yaml` – example configuration for deploying the backend on Render. The frontend can be deployed to Netlify/Vercel.

## Quickstart (Local Development)

### Prerequisites

- Python 3.10+
- Node.js 16+
- SQLite (bundled with Python)

### Backend

1. **Install dependencies**:

   ```bash
   cd server
   python -m venv venv
   . venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Configure environment**:

   Copy `.env.example` to `.env` and adjust values if necessary. During local dev you can leave defaults – SQLite will be created under `server/data/kiapat.db`.

3. **Run the API**:

   ```bash
   make dev
   ```

   The API will be available at `http://localhost:8000`. Swagger docs live at `/docs`.

   On Windows systems without `make`, you can run the backend directly:

   ```cmd
   python -m uvicorn app.main:app --reload --port 8000
   ```

   Or simply execute the provided `run_app.bat` script from the repository root to set up dependencies and launch both backend and frontend at once:

   ```cmd
   run_app.bat
   ```

4. **Seeding**: the backend seeds itself on startup if no users exist.  The first time the API runs it will automatically create the admin (`admin/admin123`), driver (`driver/pass123`) and all size/color combinations with sample prices.  You no longer need to call the seed endpoint manually.  A `/api/admin/seed` endpoint still exists if you wish to trigger seeding explicitly.

5. **Run tests**:

   ```bash
   make test
   ```

   The automated tests cover authentication, inventory IN flows and driver invoice flows.

### Frontend

1. **Install dependencies**:

   ```bash
   cd web
   npm install
   ```

2. **Configure API base URL & Google Maps**:

   Create a `.env` file in `web/` and set:

   ```bash
   VITE_API_BASE_URL=http://localhost:8000
   VITE_GOOGLE_MAPS_API_KEY=<demo-or-personal-key>
   ```

   The dashboard map widgets read the Google Maps API key via `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`, so make sure the value is available in every environment (the repository includes `.env.example` as a reference). When running locally `VITE_API_BASE_URL` enables Vite’s proxy so that calls to `/api` are forwarded to the backend.

3. **Run the frontend**:

   ```bash
   npm run dev
   ```

   The app will be served at `http://localhost:5173`. Sign in using the seeded credentials. Admin users land on the inventory manager dashboard while drivers land on the sales invoice screen.

4. **Build for production**:

   ```bash
   npm run build
   ```

   The static files will be output in `web/dist/` and can be deployed to Netlify or Vercel. Ensure that `VITE_API_BASE_URL` points to your hosted backend.

### Database Migrations & Postgres

SQLite is used by default for ease of development. To migrate to PostgreSQL:

1. Set `DATABASE_URL` to a Postgres connection string, e.g.:

   ```bash
   export DATABASE_URL=postgresql+psycopg2://user:password@host:port/dbname
   ```

2. Install the optional `psycopg2` driver (not pinned in requirements). You can add `psycopg2-binary` to `server/requirements.txt`.

3. Run Alembic migrations:

   ```bash
   cd server
   alembic upgrade head
   ```

4. Update your deployment environment variables accordingly. Postgres will handle concurrency better than SQLite in production.

## Deploying

### Backend (Render)

The included `render.yaml` defines a web service. Create a new service on [Render](https://render.com/), point it to this repository and import the environment variables defined in `.env`. The service will install dependencies and launch Uvicorn with the FastAPI app.

### Frontend (Netlify/Vercel)

Deploy the `web` directory as a static site. Ensure that `VITE_API_BASE_URL` matches the deployed backend URL. Set up a simple redirect/proxy if your hosting provider requires it (e.g. Netlify’s `_redirects` file). CORS should allow the frontend domain.

## Smoke Tests / Manual QA

After deployment you should be able to:

- **Login** as admin (`admin/admin123`) and driver (`driver/pass123`).
- As **admin**, view current inventory, create an IN draft, verify and commit it. Quantities update accordingly.
- As **driver**, generate a sales invoice with multiple line items and a signature. Inventory decreases and the invoice appears in the admin’s movements list.
- Prices displayed on the driver page match those configured in the backend and reflect edits immediately (price editing is not yet implemented in this MVP but the structure allows it).

## Future Enhancements

- **Real‑time updates** via WebSockets for movements instead of polling.
- **Price management UI** for admins, including historical pricing with effective dates.
- **Override flows** when the driver attempts to sell more stock than available, requiring admin clearance.
- **Reporting & analytics** on sales and inventory turnover.
- **PDF generation** and email receipts using headless Chrome or a PDF library.

## Troubleshooting

- **401 Unauthorized**: ensure you included the `Authorization: Bearer <token>` header. Tokens expire after 24 hours by default.
- **CORS errors**: set `CORS_ALLOWED_ORIGINS` (server) and `VITE_API_BASE_URL` (web) to the correct domains. Use `http` vs `https` consistently.
- **Database locked** (SQLite): avoid concurrent writes or switch to Postgres in production.

## Self‑QA Report

The automated tests (`make test`) exercise the key user flows:

- Seeding creates the expected users, classifications and prices.
- Authentication returns JWTs and allows access to protected endpoints.
- Inventory IN workflow transitions through Draft → Verified → Committed and updates stock accordingly.
- Driver invoice creation decrements inventory and prevents negative stock. Totals are calculated based on the latest price per unit.

The tests were run repeatedly while implementing the API, revealing and fixing bugs such as incorrect stock calculations and missing authorization guards. Basic error handling was added to surface user‑friendly messages when operations fail (e.g. insufficient stock or missing price). Further manual testing confirmed the UI flows end‑to‑end.