# Peer Fitness Buddy App

## 1. Tech Stack

### Frontend
- **React** — builds the browser-based user interface for students and admins.
- **TypeScript** — adds static typing to the frontend code so the team can develop more safely and consistently.
- **Vite** — provides fast local development and production builds for the frontend.
- **React Router** — handles client-side navigation between pages such as Home, Events, My Events, and Admin views.
- **TanStack Query** — manages API data fetching, caching, and refresh behavior in the frontend.
- **React Hook Form** — manages form state for user input flows such as login, registration, event creation, and badge forms.
- **Zod** — validates frontend form data before it is sent to the backend.
- **Tailwind CSS** — provides utility-first styling for a clean and consistent UI.

### Backend
- **Python 3.14** — powers the backend application logic and API implementation.
- **Framework-free Python backend** — keeps the server implementation lightweight while matching the project’s Python-only backend direction.
- **uv** — manages the Python environment, dependencies, and lockfile for the backend.
- **Gunicorn** — serves the backend application in production as a WSGI process manager.
- **SQLAlchemy** — defines the backend data models and database access layer.
- **Alembic** — manages database schema migrations for the PostgreSQL database.
- **Psycopg 3** — connects the Python backend to PostgreSQL.
- **argon2-cffi** — hashes passwords securely for authentication.

### Database
- **PostgreSQL** — stores persistent application data such as users, facilities, events, attendance, likes, and badge applications.

### Development and Collaboration
- **Node.js + npm** — provide the JavaScript runtime and package manager required for the frontend toolchain.
- **nvm** — pins and switches the local Node.js version for consistent team development.
- **Git** — tracks source code changes across the project.
- **GitHub** — hosts the shared remote repository and team collaboration workflow.

### Deployment
- **Vercel** — hosts the frontend as a fast static web application.
- **Render Web Service** — hosts the Python backend in production.
- **Render Postgres** — provides the managed PostgreSQL database for deployment.

## 2. Current Repo Structure

### Root
- **`.gitignore`** — defines which local, generated, and secret files should not be committed.
- **`.nvmrc`** — pins the Node.js version expected for frontend development.
- **`.python-version`** — pins the Python version expected for backend development.
- **`README.md`** — documents the project’s current stack and repository layout.
- **`api/`** — contains the backend application, database migration setup, and backend tooling files.
- **`web/`** — contains the frontend application and frontend tooling files.

### Backend (`api/`)
- **`api/.env.example`** — shows the backend environment variables required for local setup.
- **`api/alembic/`** — contains the migration environment and versioned schema changes for the database.
- **`api/alembic/versions/`** — stores individual migration files for database schema revisions.
- **`api/alembic.ini`** — configures Alembic for running backend migrations.
- **`api/pyproject.toml`** — defines the backend project metadata, dependencies, and Python tooling configuration.
- **`api/uv.lock`** — locks backend dependency versions for reproducible installs.
- **`api/scripts/`** — stores backend utility scripts used during development.
- **`api/scripts/seed.py`** — inserts initial sample data for local testing.
- **`api/src/pfb_api/`** — contains the main backend source code package.
- **`api/src/pfb_api/app.py`** — creates and wires the backend application.
- **`api/src/pfb_api/config.py`** — loads backend settings and environment-based configuration.
- **`api/src/pfb_api/db.py`** — sets up database connections and shared database helpers.
- **`api/src/pfb_api/http.py`** — provides backend HTTP-related helpers and response utilities.
- **`api/src/pfb_api/models.py`** — defines the core database models used by the application.
- **`api/src/pfb_api/security.py`** — contains password hashing and authentication-related helpers.
- **`api/src/pfb_api/server.py`** — starts the backend server for development or runtime execution.
- **`api/src/pfb_api/wsgi.py`** — exposes the backend entry point for production WSGI servers such as Gunicorn.
- **`api/src/pfb_api/routes/`** — groups the backend route modules by feature area.
- **`api/src/pfb_api/routes/auth.py`** — defines user authentication routes.
- **`api/src/pfb_api/routes/admin_auth.py`** — defines admin authentication routes.
- **`api/src/pfb_api/routes/events.py`** — defines event-related routes and workflows.
- **`api/src/pfb_api/routes/facilities.py`** — defines facility management routes.
- **`api/src/pfb_api/routes/badges.py`** — defines trust badge application and review routes.

### Frontend (`web/`)
- **`web/.env.example`** — shows the frontend environment variables required for local setup.
- **`web/package.json`** — defines the frontend project metadata, scripts, and dependencies.
- **`web/package-lock.json`** — locks frontend dependency versions for reproducible installs.
- **`web/index.html`** — provides the base HTML entry point used by Vite.
- **`web/eslint.config.js`** — configures linting rules for the frontend codebase.
- **`web/tsconfig.json`** — defines the main TypeScript configuration for the frontend.
- **`web/tsconfig.app.json`** — defines TypeScript settings for browser-side application code.
- **`web/tsconfig.node.json`** — defines TypeScript settings for Node-based tooling files.
- **`web/vite.config.ts`** — configures the Vite development server and build process.
- **`web/src/`** — contains the main frontend source code.
- **`web/src/main.tsx`** — boots the React application in the browser.
- **`web/src/App.tsx`** — defines the top-level frontend app structure and route wiring.
- **`web/src/index.css`** — contains global frontend styles.
- **`web/src/components/`** — stores reusable UI and route-protection components.
- **`web/src/components/AppShell.tsx`** — provides the shared page shell used across the frontend.
- **`web/src/components/ProtectedUserRoute.tsx`** — protects routes that require a signed-in user session.
- **`web/src/components/ProtectedAdminRoute.tsx`** — protects routes that require a signed-in admin session.
- **`web/src/lib/`** — stores shared frontend utilities and integration helpers.
- **`web/src/lib/api.ts`** — defines the frontend API client used to call the backend.
- **`web/src/lib/queryClient.ts`** — configures the shared TanStack Query client.
- **`web/src/pages/`** — stores page-level components for the app’s main views.
- **`web/src/pages/HomePage.tsx`** — renders the landing page for the application.
- **`web/src/pages/LoginPage.tsx`** — renders the user login page.
- **`web/src/pages/RegisterPage.tsx`** — renders the user registration page.
- **`web/src/pages/UserDashboardPage.tsx`** — renders the main signed-in user dashboard.
- **`web/src/pages/EventsPage.tsx`** — renders the event browsing and discovery view.
- **`web/src/pages/MyEventsPage.tsx`** — renders the user’s hosted and joined event view.
- **`web/src/pages/BadgesPage.tsx`** — renders the trust badge application and status view.
- **`web/src/pages/AdminLoginPage.tsx`** — renders the admin login page.
- **`web/src/pages/AdminDashboardPage.tsx`** — renders the admin dashboard.
