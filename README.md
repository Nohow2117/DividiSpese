# DividiSpese

## Overview
DividiSpese is a web application designed to simplify expense splitting among groups of people (e.g., friends, roommates, colleagues). It allows users to create groups, add participants, record shared expenses, and automatically calculate who owes whom, minimizing confusion and manual calculations.

## Goals
- Provide a simple, intuitive interface for managing shared expenses.
- Offer quick group creation without mandatory user registration.
- Calculate balances and necessary transactions accurately.
- Allow easy sharing of group information via a unique link.

## Key Features (Current & Planned)
- Group Creation (No registration required)
- Add/Remove Participants
- Add/Edit/Delete Expenses (Description, Amount, Payer, Shared between)
- Automatic Balance Calculation (Who owes whom)
- Shareable Group Link
- (Planned) Expense categorization
- (Planned) Currency support
- (Planned) User accounts for persistent groups (Optional)

## Basic Setup (Development)
1.  Clone the repository.
2.  Backend:
    - Navigate to the `backend` directory.
    - Install dependencies: `pip install -r requirements.txt`
    - Set up the database (e.g., PostgreSQL). Configure connection details.
    - Run migrations: `flask db upgrade`
    - Start the Flask server: `flask run`
3.  Frontend:
    - The frontend is currently basic HTML/CSS/JS served directly or intended to be hosted separately. Open `frontend/index.html` in a browser or serve it statically.

## Struttura del Progetto

- `frontend/`: Contiene i file per l'interfaccia utente (HTML, CSS, JavaScript).
- `backend/`: Contiene il server Node.js/Express per la gestione dei dati.

## Come Avviare

1.  **Clona il repository (se non l'hai già fatto):**
    ```bash
    git clone <URL_DEL_REPOSITORY>
    cd DividiSpese
    ```

2.  **Installa le dipendenze del backend:**
    ```bash
    cd backend
    npm install
    ```

3.  **Avvia il server backend:**
    ```bash
    npm start
    ```
    Il server sarà in ascolto su `http://localhost:3000`.

4.  **Apri il frontend:**
    Apri il file `frontend/index.html` direttamente nel tuo browser web.

## Funzionalità

- Aggiungi e rimuovi partecipanti.
- Aggiungi e rimuovi spese, specificando chi ha pagato e chi è coinvolto.
- Calcola automaticamente i saldi individuali.
- Mostra le transazioni necessarie per pareggiare i conti ("chi deve cosa a chi").
- I dati vengono salvati temporaneamente in memoria sul backend.

## Tecnologie Utilizzate

- **Frontend:** HTML5, CSS3, JavaScript (Fetch API)
- **Backend:** Node.js, Express, Cors
