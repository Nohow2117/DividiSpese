const express = require('express');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors()); // Abilita CORS per permettere richieste dal frontend
app.use(express.json()); // Permette al server di leggere JSON dal body delle richieste

// --- Dati in memoria (sostituire con database in futuro) ---
let participants = []; // Array di oggetti { id: number, name: string }
let expenses = []; // Array di oggetti { id: number, paidBy: number, amount: number, description: string, participants: number[] }
let nextParticipantId = 1;
let nextExpenseId = 1;
// -----------------------------------------------------------

/**
 * Endpoint per recuperare tutti i partecipanti e le spese.
 * GET /api/data
 * @returns {object} JSON con partecipanti e spese.
 */
app.get('/api/data', (req, res) => {
  // In una vera applicazione, qui leggeresti i dati da un database.
  res.json({ participants, expenses });
});

/**
 * Endpoint per aggiungere un nuovo partecipante.
 * POST /api/participants
 * Body: { name: string }
 * @returns {object} Il partecipante aggiunto.
 */
app.post('/api/participants', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Il nome del partecipante è obbligatorio.' });
  }

  const newParticipant = {
    id: nextParticipantId++,
    name: name.trim(),
  };

  // In una vera applicazione, qui inseriresti il partecipante nel database.
  participants.push(newParticipant);

  console.log('Partecipante aggiunto:', newParticipant);
  res.status(201).json(newParticipant);
});

/**
 * Endpoint per rimuovere un partecipante.
 * DELETE /api/participants/:id
 * @returns {object} Messaggio di successo o errore.
 */
app.delete('/api/participants/:id', (req, res) => {
    const participantId = parseInt(req.params.id, 10);

    // In una vera applicazione, qui elimineresti il partecipante dal database.
    const initialLength = participants.length;
    participants = participants.filter(p => p.id !== participantId);

    if (participants.length < initialLength) {
        // Rimuovi anche le spese pagate dal partecipante e la sua partecipazione alle spese
        expenses = expenses.filter(e => e.paidBy !== participantId);
        expenses.forEach(e => {
            e.participants = e.participants.filter(pId => pId !== participantId);
        });
        // Potrebbe essere necessario ricalcolare i saldi dopo la rimozione

        console.log('Partecipante rimosso:', participantId);
        res.json({ message: 'Partecipante rimosso con successo.' });
    } else {
        res.status(404).json({ error: 'Partecipante non trovato.' });
    }
});


/**
 * Endpoint per aggiungere una nuova spesa.
 * POST /api/expenses
 * Body: { paidBy: number, amount: number, description: string, participants: number[] }
 * @returns {object} La spesa aggiunta.
 */
app.post('/api/expenses', (req, res) => {
  const { paidBy, amount, description, participants: involvedParticipantIds } = req.body;

  // Validazione input
  if (!paidBy || typeof paidBy !== 'number' || !participants.find(p => p.id === paidBy)) {
    return res.status(400).json({ error: 'ID pagante non valido.' });
  }
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Importo non valido.' });
  }
  if (!description || typeof description !== 'string' || description.trim() === '') {
    return res.status(400).json({ error: 'Descrizione obbligatoria.' });
  }
  if (!Array.isArray(involvedParticipantIds) || involvedParticipantIds.length === 0 || !involvedParticipantIds.every(id => typeof id === 'number' && participants.find(p => p.id === id))) {
      return res.status(400).json({ error: 'Lista partecipanti coinvolti non valida.' });
  }


  const newExpense = {
    id: nextExpenseId++,
    paidBy: paidBy,
    amount: amount,
    description: description.trim(),
    participants: involvedParticipantIds // Array di ID dei partecipanti coinvolti
  };

  // In una vera applicazione, qui inseriresti la spesa nel database.
  expenses.push(newExpense);

  console.log('Spesa aggiunta:', newExpense);
  res.status(201).json(newExpense);
});

/**
 * Endpoint per rimuovere una spesa.
 * DELETE /api/expenses/:id
 * @returns {object} Messaggio di successo o errore.
 */
app.delete('/api/expenses/:id', (req, res) => {
    const expenseId = parseInt(req.params.id, 10);

    // In una vera applicazione, qui elimineresti la spesa dal database.
    const initialLength = expenses.length;
    expenses = expenses.filter(e => e.id !== expenseId);

    if (expenses.length < initialLength) {
        console.log('Spesa rimossa:', expenseId);
        res.json({ message: 'Spesa rimossa con successo.' });
    } else {
        res.status(404).json({ error: 'Spesa non trovata.' });
    }
});


// Avvio del server
app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
