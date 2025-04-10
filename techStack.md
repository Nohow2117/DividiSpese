# DividiSpese Technology Stack

This document outlines the core technologies used in the DividiSpese project.

## Frontend
- **HTML5:** Structure and content.
- **CSS3:** Styling and layout.
- **JavaScript (ES6+):** Client-side logic, DOM manipulation, API interaction (using Fetch API). Vanilla JS currently used.
- **Font Awesome:** For icons.

## Backend
- **Language:** Python (Version 3.9+)
- **Framework:** Flask (Version 2.x)
- **Database ORM:** SQLAlchemy / Flask-SQLAlchemy
- **Database Migrations:** Flask-Migrate (using Alembic)
- **API Specification:** RESTful principles (using JSON).
- **WSGI Server (Production):** Gunicorn (or similar)

## Database
- **Type:** PostgreSQL (Version 17)

## Development & Operations
- **Version Control:** Git / GitHub
- **Hosting (Backend API):** Render (current)
- **Hosting (Frontend):** Render (current, served by Flask), potentially separate static hosting (e.g., GitHub Pages, Netlify, WordPress).
- **Dependency Management (Python):** pip / `requirements.txt`

## Potential Future Additions
- **Frontend Framework:** Consider migrating to Vue.js, React, or Svelte for more complex UI needs.
- **Testing Framework (Python):** Pytest
- **Containerization:** Docker
