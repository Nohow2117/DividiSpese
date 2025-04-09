const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg'); // Import the Pool class from pg
const crypto = require('crypto'); // For generating unique IDs

// --- Helper Function to Generate Unique ID ---
function generateUniqueId(length = 8) {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex') // convert to hexadecimal format
    .slice(0, length); // return required number of characters
}

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
    // Create groups table
    await client.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        group_uuid VARCHAR(12) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "groups" checked/created successfully.');

    // Create participants table if it doesn't exist
    // Add group_id and update UNIQUE constraint
    await client.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        UNIQUE (group_id, name) -- Name must be unique within a group
      );
    `);
    console.log('Table "participants" checked/created successfully.');

    // Create expenses table if it doesn't exist
    // Add group_id
    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        description TEXT,
        amount NUMERIC(10, 2) NOT NULL,
        paid_by_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE RESTRICT, -- Prevent deleting participant if they paid expenses
        participants INTEGER[] NOT NULL -- Array of participant IDs involved
      );
    `);
    // Change ON DELETE CASCADE to ON DELETE RESTRICT for paid_by_id
    // to prevent accidental data loss if a participant is deleted.
    // We'll handle participant deletion more carefully in the API.
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

// Serve frontend files conditionally (see catch-all route)
// app.use(express.static(path.join(__dirname, '../frontend')));
app.use(cors());
app.use(express.json());

// --- Middleware to get group_id from group_uuid ---
// This avoids repeating the lookup in every route
async function getGroupId(req, res, next) {
    const { group_uuid } = req.params;
    if (!group_uuid) {
        return res.status(400).json({ error: 'Group UUID mancante nella richiesta.' });
    }
    try {
        const result = await pool.query('SELECT id FROM groups WHERE group_uuid = $1', [group_uuid]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Gruppo non trovato.' });
        }
        req.group_id = result.rows[0].id; // Attach group_id to request object
        next(); // Proceed to the next handler
    } catch (err) {
        console.error('Error fetching group ID:', err);
        res.status(500).json({ error: 'Errore nel recupero del gruppo.' });
    }
}

// --- API Endpoints (Scoped by Group) ---

/**
 * Endpoint per creare un nuovo gruppo/sessione.
 * POST /api/groups
 * @returns {object} { group_uuid: string }
 */
app.post('/api/groups', async (req, res) => {
    let group_uuid;
    let attempts = 0;
    const maxAttempts = 5; // Prevent infinite loop in case of unlikely collision storm

    try {
        while (attempts < maxAttempts) {
            group_uuid = generateUniqueId(8); // Generate an 8-char ID
            const insertResult = await pool.query(
                'INSERT INTO groups (group_uuid) VALUES ($1) ON CONFLICT (group_uuid) DO NOTHING RETURNING group_uuid',
                [group_uuid]
            );
            if (insertResult.rows.length > 0) {
                console.log('Nuovo gruppo creato:', group_uuid);
                return res.status(201).json({ group_uuid: insertResult.rows[0].group_uuid });
            }
            attempts++;
        }
        // If loop finished without success
        console.error('Failed to generate a unique group UUID after multiple attempts.');
        res.status(500).json({ error: 'Impossibile generare un ID gruppo univoco.' });

    } catch (err) {
        console.error('Error creating group:', err);
        res.status(500).json({ error: 'Errore nella creazione del gruppo.' });
    }
});

// Use group_uuid in the path for all data-related endpoints
const groupRouter = express.Router({ mergeParams: true }); // Allows access to parent router params (group_uuid)
app.use('/api/groups/:group_uuid', getGroupId, groupRouter); // Apply middleware to all routes under this path

/**
 * Endpoint per recuperare tutti i partecipanti e le spese di un gruppo specifico.
 * GET /api/groups/:group_uuid/data
 * @returns {object} JSON con partecipanti e spese del gruppo.
 */
groupRouter.get('/data', async (req, res) => {
  try {
    // req.group_id is available from the middleware
    const participantsResult = await pool.query('SELECT * FROM participants WHERE group_id = $1 ORDER BY name', [req.group_id]);
    const expensesResult = await pool.query('SELECT * FROM expenses WHERE group_id = $1 ORDER BY id DESC', [req.group_id]);
    res.json({ participants: participantsResult.rows, expenses: expensesResult.rows });
  } catch (err) {
    console.error('Error fetching group data:', err);
    res.status(500).json({ error: 'Errore nel recupero dati del gruppo.' });
  }
});

/**
 * Endpoint per aggiungere un nuovo partecipante a un gruppo specifico.
 * POST /api/groups/:group_uuid/participants
 * Body: { name: string }
 * @returns {object} Il partecipante aggiunto.
 */
groupRouter.post('/participants', async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Il nome del partecipante è obbligatorio.' });
  }
  const trimmedName = name.trim();

  try {
    // Add group_id to the query
    const result = await pool.query(
      `INSERT INTO participants (group_id, name)
       VALUES ($1, $2)
       ON CONFLICT (group_id, name) DO NOTHING
       RETURNING *`,
      [req.group_id, trimmedName]
    );

    if (result.rows.length > 0) {
        console.log(`Partecipante aggiunto al gruppo ${req.params.group_uuid}:`, result.rows[0]);
        res.status(201).json(result.rows[0]);
    } else {
        // Fetch the existing participant to return it
        const existing = await pool.query(
            'SELECT * FROM participants WHERE name = $1 AND group_id = $2',
            [trimmedName, req.group_id]
        );
        if(existing.rows.length > 0) {
             console.log(`Partecipante '${trimmedName}' already exists in group ${req.params.group_uuid}, returning existing.`);
            res.status(200).json(existing.rows[0]); // Return existing participant data
        } else {
            // Should not happen if constraint exists, but handle defensively
             console.error('Error: ON CONFLICT triggered but could not find existing participant');
             res.status(500).json({ error: 'Error adding participant after conflict' });
        }
    }

  } catch (err) {
    console.error('Error adding participant to group:', err);
    res.status(500).json({ error: 'Errore nell\'aggiunta del partecipante al gruppo.' });
  }
});

/**
 * Endpoint per rimuovere un partecipante da un gruppo.
 * DELETE /api/groups/:group_uuid/participants/:participantId
 * @returns {object} Messaggio di successo o errore.
 */
groupRouter.delete('/participants/:participantId', async (req, res) => {
    const participantId = parseInt(req.params.participantId, 10);
    if (isNaN(participantId)) {
        return res.status(400).json({ error: 'ID partecipante non valido.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        // 1. Check if participant exists IN THIS GROUP and if they paid any expenses
        const participantCheck = await client.query(
            'SELECT p.id, EXISTS(SELECT 1 FROM expenses e WHERE e.paid_by_id = p.id AND e.group_id = $1) as has_paid_expenses ' +
            'FROM participants p WHERE p.id = $2 AND p.group_id = $1',
            [req.group_id, participantId]
        );

        if (participantCheck.rowCount === 0) {
             await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Partecipante non trovato in questo gruppo.' });
        }
        if (participantCheck.rows[0].has_paid_expenses) {
             await client.query('ROLLBACK');
             return res.status(400).json({ error: 'Impossibile rimuovere il partecipante perchè ha pagato delle spese. Rimuovere prima le spese associate.' });
        }

        // 2. Remove participant ID from involved arrays in expenses table for this group
        await client.query(
            `UPDATE expenses
             SET participants = array_remove(participants, $1)
             WHERE group_id = $2 AND $1 = ANY(participants);`,
            [participantId, req.group_id]
        );

        // 3. Now delete the participant (should only succeed if no expenses were paid due to RESTRICT constraint)
        const deleteResult = await client.query('DELETE FROM participants WHERE id = $1 AND group_id = $2', [participantId, req.group_id]);

        if (deleteResult.rowCount > 0) {
             await client.query('COMMIT'); // Commit transaction
            console.log(`Partecipante rimosso ${participantId} dal gruppo ${req.params.group_uuid}`);
            res.json({ message: 'Partecipante e riferimenti spese rimossi con successo.' });
        } else {
             // Should not happen if check above passed, but good practice
             await client.query('ROLLBACK');
            res.status(404).json({ error: 'Partecipante non trovato (durante eliminazione).' });
        }
    } catch (err) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error('Error removing participant from group:', err);
        // Check for foreign key violation (paid expenses)
        if (err.code === '23503') { // PostgreSQL foreign key violation code
             res.status(400).json({ error: 'Impossibile rimuovere: il partecipante ha pagato una o più spese.' });
        } else {
             res.status(500).json({ error: 'Errore nella rimozione del partecipante.' });
        }
    } finally {
        client.release();
    }
});

/**
 * Endpoint per aggiungere una nuova spesa a un gruppo specifico.
 * POST /api/groups/:group_uuid/expenses
 * Body: { paidBy: number, amount: number, description: string, participants: number[] }
 * @returns {object} La spesa aggiunta.
 */
groupRouter.post('/expenses', async (req, res) => {
  const { paidBy, amount, description, participants: involvedParticipantIds } = req.body;

  // Basic Validation
   if (!paidBy || typeof paidBy !== 'number') {
    return res.status(400).json({ error: 'ID pagante mancante o non valido.' });
  }
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Importo non valido.' });
  }
  const trimmedDescription = description?.trim() || 'Spesa';
  if (!Array.isArray(involvedParticipantIds) || involvedParticipantIds.length === 0 || !involvedParticipantIds.every(id => typeof id === 'number')) {
      return res.status(400).json({ error: 'Lista partecipanti coinvolti non valida.' });
  }

  const client = await pool.connect();
  try {
      await client.query('BEGIN');

      // Validate that the payer exists IN THIS GROUP
      const payerExists = await client.query('SELECT id FROM participants WHERE id = $1 AND group_id = $2', [paidBy, req.group_id]);
      if (payerExists.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Il partecipante pagante specificato non esiste in questo gruppo.' });
      }

      // Validate that all involved participants exist IN THIS GROUP
      const involvedCheck = await client.query(
          'SELECT COUNT(id) AS count FROM participants WHERE group_id = $1 AND id = ANY($2::int[])',
          [req.group_id, involvedParticipantIds]
      );
      if (parseInt(involvedCheck.rows[0].count, 10) !== involvedParticipantIds.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Uno o più partecipanti coinvolti specificati non esistono in questo gruppo.' });
      }

      // Insert the expense with group_id
      const result = await client.query(
          `INSERT INTO expenses (group_id, description, amount, paid_by_id, participants)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [req.group_id, trimmedDescription, amount, paidBy, involvedParticipantIds]
      );

      await client.query('COMMIT');
      console.log(`Spesa aggiunta al gruppo ${req.params.group_uuid}:`, result.rows[0]);
      res.status(201).json(result.rows[0]);

  } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error adding expense to group:', err);
      res.status(500).json({ error: 'Errore nell\'aggiunta della spesa al gruppo.' });
  } finally {
      client.release();
  }
});

/**
 * Endpoint per rimuovere una spesa da un gruppo specifico.
 * DELETE /api/groups/:group_uuid/expenses/:expenseId
 * @returns {object} Messaggio di successo o errore.
 */
groupRouter.delete('/expenses/:expenseId', async (req, res) => {
    const expenseId = parseInt(req.params.expenseId, 10);
     if (isNaN(expenseId)) {
        return res.status(400).json({ error: 'ID spesa non valido.' });
    }

    try {
        // Ensure deletion is scoped to the group
        const result = await pool.query('DELETE FROM expenses WHERE id = $1 AND group_id = $2 RETURNING id', [expenseId, req.group_id]);
        if (result.rowCount > 0) {
            console.log(`Spesa rimossa ${expenseId} dal gruppo ${req.params.group_uuid}`);
            res.json({ message: 'Spesa rimossa con successo.' });
        } else {
            res.status(404).json({ error: 'Spesa non trovata in questo gruppo.' });
        }
    } catch (err) {
        console.error('Error removing expense from group:', err);
        res.status(500).json({ error: 'Errore nella rimozione della spesa.' });
    }
});

// --- Frontend Serving ---
// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// Catch-all to serve index.html for any other GET request.
// This allows direct navigation to /app/some-uuid and lets the frontend router handle it.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Avvio del server
app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
