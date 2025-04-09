# Dividi Spese - Il Calcolatore Intelligente

Una semplice applicazione web per dividere le spese tra un gruppo di amici.

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
