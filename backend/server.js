const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg'); // Import the Pool class from pg

// --- Database Connection ---
// Use the DATABASE_URL environment variable provided by Render
// Enable SSL connection for Render databases
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render DB connections
  }
});

// --- Database Initialization ---
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create participants table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE -- Ensure names are unique
      );
    `);
    console.log('Table "participants" checked/created successfully.');

    // Create expenses table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        description TEXT,
        amount NUMERIC(10, 2) NOT NULL,
        paid_by_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, -- Cascade delete if participant is removed
        participants INTEGER[] NOT NULL -- Array of participant IDs involved
      );
    `);
    console.log('Table "expenses" checked/created successfully.');

  } catch (err) {
    console.error('Error initializing database tables:', err);
    process.exit(1); // Exit if DB initialization fails
  } finally {
    client.release(); // Release the client back to the pool
  }
}

// Initialize DB on server start
initializeDatabase();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../frontend')));
app.use(cors());
app.use(express.json());

// --- API Endpoints (Using Database) ---

/**
 * Endpoint per recuperare tutti i partecipanti e le spese dal DB.
 * GET /api/data
 * @returns {object} JSON con partecipanti e spese.
 */
app.get('/api/data', async (req, res) => {
  try {
    const participantsResult = await pool.query('SELECT * FROM participants ORDER BY name');
    const expensesResult = await pool.query('SELECT * FROM expenses ORDER BY id DESC'); // Show newest expenses first
    res.json({ participants: participantsResult.rows, expenses: expensesResult.rows });
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ error: 'Errore nel recupero dati dal database.' });
  }
});

/**
 * Endpoint per aggiungere un nuovo partecipante al DB.
 * POST /api/participants
 * Body: { name: string }
 * @returns {object} Il partecipante aggiunto.
 */
app.post('/api/participants', async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Il nome del partecipante è obbligatorio.' });
  }
  const trimmedName = name.trim();

  try {
    // Use INSERT ... ON CONFLICT DO NOTHING to handle unique constraint gracefully
    const result = await pool.query(
      'INSERT INTO participants (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *',
      [trimmedName]
    );

    if (result.rows.length > 0) {
        console.log('Partecipante aggiunto:', result.rows[0]);
        res.status(201).json(result.rows[0]);
    } else {
        // If no rows returned, it means the name already existed
        res.status(409).json({ error: 'Un partecipante con questo nome esiste già.' });
    }

  } catch (err) {
    console.error('Error adding participant:', err);
    res.status(500).json({ error: 'Errore nell\'aggiunta del partecipante al database.' });
  }
});

/**
 * Endpoint per rimuovere un partecipante dal DB (e le spese associate tramite CASCADE).
 * DELETE /api/participants/:id
 * @returns {object} Messaggio di successo o errore.
 */
app.delete('/api/participants/:id', async (req, res) => {
    const participantId = parseInt(req.params.id, 10);
    if (isNaN(participantId)) {
        return res.status(400).json({ error: 'ID partecipante non valido.' });
    }

    // NOTE: We also need to remove the participant ID from the `participants` array
    // within any existing expenses where they might be involved but didn't pay.
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        // Remove participant ID from involved arrays in expenses table
        await client.query(
            `UPDATE expenses
             SET participants = array_remove(participants, $1)
             WHERE $1 = ANY(participants);`,
            [participantId]
        );

        // Now delete the participant (ON DELETE CASCADE handles expenses paid by them)
        const result = await client.query('DELETE FROM participants WHERE id = $1 RETURNING id', [participantId]);

        if (result.rowCount > 0) {
             await client.query('COMMIT'); // Commit transaction
            console.log('Partecipante rimosso:', participantId);
            res.json({ message: 'Partecipante e riferimenti spese rimossi con successo.' });
        } else {
             await client.query('ROLLBACK'); // Rollback if participant not found
            res.status(404).json({ error: 'Partecipante non trovato.' });
        }
    } catch (err) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error('Error removing participant:', err);
        res.status(500).json({ error: 'Errore nella rimozione del partecipante dal database.' });
    } finally {
        client.release();
    }
});

/**
 * Endpoint per aggiungere una nuova spesa al DB.
 * POST /api/expenses
 * Body: { paidBy: number, amount: number, description: string, participants: number[] }
 * @returns {object} La spesa aggiunta.
 */
app.post('/api/expenses', async (req, res) => {
  const { paidBy, amount, description, participants: involvedParticipantIds } = req.body;

  // --- Basic Validation ---
   if (!paidBy || typeof paidBy !== 'number') {
    return res.status(400).json({ error: 'ID pagante mancante o non valido.' });
  }
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Importo non valido.' });
  }
  const trimmedDescription = description?.trim() || 'Spesa'; // Default description
  if (!Array.isArray(involvedParticipantIds) || involvedParticipantIds.length === 0 || !involvedParticipantIds.every(id => typeof id === 'number')) {
      return res.status(400).json({ error: 'Lista partecipanti coinvolti non valida.' });
  }
  // --- End Basic Validation ---

  const client = await pool.connect();
  try {
      await client.query('BEGIN'); // Start transaction

      // Validate that the payer exists
      const payerExists = await client.query('SELECT id FROM participants WHERE id = $1', [paidBy]);
      if (payerExists.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Il partecipante pagante specificato non esiste.' });
      }

      // Validate that all involved participants exist
      // Use ANY operator for efficiency
      const involvedCheck = await client.query(
          'SELECT COUNT(id) AS count FROM participants WHERE id = ANY($1::int[])',
          [involvedParticipantIds]
      );
      if (parseInt(involvedCheck.rows[0].count, 10) !== involvedParticipantIds.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Uno o più partecipanti coinvolti specificati non esistono.' });
      }

      // Insert the expense
      const result = await client.query(
          `INSERT INTO expenses (description, amount, paid_by_id, participants)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [trimmedDescription, amount, paidBy, involvedParticipantIds]
      );

      await client.query('COMMIT'); // Commit transaction
      console.log('Spesa aggiunta:', result.rows[0]);
      res.status(201).json(result.rows[0]);

  } catch (err) {
      await client.query('ROLLBACK'); // Rollback on any error
      console.error('Error adding expense:', err);
      res.status(500).json({ error: 'Errore nell\'aggiunta della spesa al database.' });
  } finally {
      client.release();
  }
});

/**
 * Endpoint per rimuovere una spesa dal DB.
 * DELETE /api/expenses/:id
 * @returns {object} Messaggio di successo o errore.
 */
app.delete('/api/expenses/:id', async (req, res) => {
    const expenseId = parseInt(req.params.id, 10);
     if (isNaN(expenseId)) {
        return res.status(400).json({ error: 'ID spesa non valido.' });
    }

    try {
        const result = await pool.query('DELETE FROM expenses WHERE id = $1 RETURNING id', [expenseId]);
        if (result.rowCount > 0) {
            console.log('Spesa rimossa:', expenseId);
            res.json({ message: 'Spesa rimossa con successo.' });
        } else {
            res.status(404).json({ error: 'Spesa non trovata.' });
        }
    } catch (err) {
        console.error('Error removing expense:', err);
        res.status(500).json({ error: 'Errore nella rimozione della spesa dal database.' });
    }
});

// Catch-all to serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Avvio del server
app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`); // Updated log message
});
