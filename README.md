# Peer Fitness Buddy App

## 1. Tech Stack

### Frontend
- **React**: Builds the interactive, component-based user interface for the browser.
- **TypeScript**: Adds static typing to catch errors early and improve the developer experience.
- **Vite**: Provides fast local development servers and highly optimized production builds.
- **React Router**: Handles client-side navigation between different application views.
- **TanStack Query**: Manages API data fetching, caching, and state synchronization.
- **React Hook Form**: Manages complex form states and user inputs efficiently.
- **Zod**: Validates frontend data schemas securely before submission.
- **Tailwind CSS**: Provides utility-first classes for rapid and consistent styling.
- **Leaflet & React-Leaflet**: Renders interactive maps for selecting outdoor run locations.
- **Lucide React**: Supplies modern, consistent SVG icons for the user interface.

### Backend
- **Python (3.14)**: Powers the core backend logic without relying on heavy web frameworks.
- **WSGI (wsgiref / Gunicorn)**: Serves the raw Python application natively for local and production environments.
- **uv**: Manages Python dependencies and virtual environments exceptionally fast.
- **SQLAlchemy**: Acts as the Object-Relational Mapper (ORM) for structured database interactions.
- **Alembic**: Handles database schema migrations and version control.
- **Psycopg 3**: Connects the Python application securely to the PostgreSQL database.
- **Argon2-cffi**: Hashes user and admin passwords securely using modern cryptographic standards.

### Database
- **PostgreSQL**: Stores all persistent relational data for users, events, facilities, and settings.

### Deployment & Tooling
- **Vercel**: Hosts the frontend React application globally on a fast edge network.
- **Render Web Service**: Hosts the Python backend API in a reliable production environment.
- **Render Postgres**: Provides a managed PostgreSQL database for secure data persistence.
- **Git & GitHub**: Tracks source code versions and facilitates team collaboration.
- **Node.js & npm**: Runs the JavaScript tooling and frontend package management.

---

## 2. Repository Structure

### Root Files
- **`.gitignore`**: Specifies intentionally untracked local, generated, and secret files to ignore in Git.
- **`.nvmrc`**: Pins the exact Node.js version required for frontend development.
- **`.python-version`**: Pins the exact Python version required for backend development.
- **`README.md`**: Documents the project stack, structure, and general overview.

### Backend (`api/`)
- **`api/`**: Contains the pure-Python backend application, migrations, and scripts.
- **`api/.env.example`**: Provides a safe template for required backend environment variables.
- **`api/alembic.ini`**: Configures the Alembic database migration tool.
- **`api/pyproject.toml`**: Defines backend dependencies and Python tooling metadata.
- **`api/uv.lock`**: Locks backend dependency versions to guarantee reproducible installations.
- **`api/alembic/`**: Holds the database migration environment and sequential version scripts.
- **`api/scripts/seed.py`**: Populates the database with initial test data and admin configurations.
- **`api/src/pfb_api/`**: Contains the main backend Python source code package.
- **`api/src/pfb_api/app.py`**: Acts as the main WSGI router mapping URLs to request handlers.
- **`api/src/pfb_api/config.py`**: Loads and manages environment-based backend settings.
- **`api/src/pfb_api/db.py`**: Establishes the SQLAlchemy database engine and session factory.
- **`api/src/pfb_api/http.py`**: Provides lightweight HTTP request parsing and JSON response utilities.
- **`api/src/pfb_api/models.py`**: Defines the SQLAlchemy ORM models matching the database schema.
- **`api/src/pfb_api/security.py`**: Handles password hashing, token generation, and session validation.
- **`api/src/pfb_api/server.py`**: Runs the local WSGI development server for testing.
- **`api/src/pfb_api/wsgi.py`**: Exposes the WSGI application entry point for production servers.
- **`api/src/pfb_api/routes/`**: Groups the backend API route handlers by feature area.

### Frontend (`web/`)
- **`web/`**: Contains the React frontend application, source code, and build configurations.
- **`web/.env.example`**: Provides a safe template for frontend environment variables.
- **`web/package.json`**: Defines frontend dependencies, metadata, and NPM execution scripts.
- **`web/package-lock.json`**: Locks frontend dependency versions for consistent CI/CD builds.
- **`web/index.html`**: Serves as the main HTML entry point for the Vite application.
- **`web/eslint.config.js`**: Configures the linting rules to maintain frontend code quality.
- **`web/tsconfig.json`**: Acts as the primary TypeScript configuration mapping for the frontend.
- **`web/vite.config.ts`**: Configures the Vite bundler, plugins, and local API proxy.
- **`web/src/`**: Contains all the React source code, routing, and styling assets.
- **`web/src/main.tsx`**: Mounts the React application context providers to the DOM.
- **`web/src/App.tsx`**: Defines the client-side routing hierarchy and page mapping.
- **`web/src/index.css`**: Contains global CSS resets and Tailwind directive imports.
- **`web/src/lib/api.ts`**: Defines the typed API client for communicating with the backend.
- **`web/src/lib/queryClient.ts`**: Configures the shared TanStack Query client for data fetching.
- **`web/src/components/AppShell.tsx`**: Provides the shared layout, navigation, and shell used across the frontend.
- **`web/src/components/LocationSelector.tsx`**: Renders the interactive Leaflet map for outdoor run selections.
- **`web/src/components/ProtectedAdminRoute.tsx`**: Protects routes ensuring only authenticated admins can access them.
- **`web/src/components/ProtectedUserRoute.tsx`**: Protects routes ensuring only authenticated users can access them.
- **`web/src/pages/`**: Contains the primary React view components for each distinct route.
