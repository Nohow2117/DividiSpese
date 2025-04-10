# DividiSpese Architecture

## High-Level Overview
The application follows a client-server architecture.
- **Frontend:** A web-based user interface built with HTML, CSS, and vanilla JavaScript. It interacts with the backend via a RESTful API.
- **Backend:** A RESTful API built with Flask (Python). It handles business logic, data persistence, and serves API endpoints.
- **Database:** A PostgreSQL database stores all application data (groups, participants, expenses).

## Components

1.  **Frontend (`frontend/`)**
    *   **Responsibility:** User interaction, displaying group information, capturing user input (new expenses, participants), making API calls to the backend.
    *   **Key Files:** `index.html`, `styles.css`, `main.js`.
    *   **Interaction:** Communicates with the Backend API via asynchronous HTTP requests (Fetch API). Renders data received from the API.

2.  **Backend API (`backend/`)**
    *   **Responsibility:** Expose RESTful endpoints for managing groups, participants, and expenses. Handle business logic (e.g., calculating balances), validate data, interact with the database.
    *   **Framework:** Flask
    *   **Key Modules/Patterns:**
        *   **Blueprints:** Organize routes by feature (e.g., groups, expenses).
        *   **SQLAlchemy ORM:** Interact with the PostgreSQL database.
        *   **Flask-Migrate:** Manage database schema changes.
        *   **RESTful Principles:** Standard HTTP methods (GET, POST, PUT, DELETE) and JSON for data exchange.
    *   **Interaction:** Receives requests from the Frontend, processes them, interacts with the Database, and returns JSON responses.

3.  **Database (PostgreSQL)**
    *   **Responsibility:** Persistently store application data.
    *   **Schema:** Includes tables for `groups`, `participants`, `expenses`, and potentially linking tables (e.g., for expense sharing). Managed by Flask-Migrate.
    *   **Interaction:** Accessed exclusively by the Backend API via SQLAlchemy.

## Design Patterns
- **RESTful API:** Standardized way for frontend and backend communication.
- **Model-View-Controller (MVC) like structure (loosely applied):**
    - **Models:** SQLAlchemy models define data structure (in `backend/models.py`).
    - **Views:** Flask routes/endpoints handle requests and generate responses (in `backend/routes/`).
    - **Controller:** Business logic is primarily within the Flask route handlers and potentially service/utility functions.
- **Repository Pattern (Implicit):** SQLAlchemy acts as an abstraction layer for database operations.

## Data Flow Example (Adding an Expense)
1.  User fills out the expense form in the Frontend (`main.js`).
2.  Frontend sends a `POST` request with expense details (JSON) to `/api/groups/<uuid>/expenses`.
3.  Backend API (Flask route) receives the request.
4.  Route handler validates the input data.
5.  Handler uses SQLAlchemy models to create a new expense record in the Database.
6.  Backend API returns a success response (JSON) to the Frontend.
7.  Frontend updates the UI to display the new expense.
