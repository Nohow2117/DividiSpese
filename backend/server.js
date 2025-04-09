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
        group_id VARCHAR(12) REFERENCES groups(group_uuid) ON DELETE CASCADE NOT NULL, -- Added FK and NOT NULL
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (group_id, name) -- Ensure participant names are unique within a group
      );
    `);
    console.log('Table "participants" checked/created successfully.');

    // Create expenses table if it doesn't exist
    // Add group_id
    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        group_id VARCHAR(12) REFERENCES groups(group_uuid) ON DELETE CASCADE NOT NULL, -- Added FK and NOT NULL
        description TEXT NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        paid_by_id INTEGER REFERENCES participants(id) ON DELETE RESTRICT NOT NULL, -- Prevent deleting payer if they have expenses
        participants INTEGER[] NOT NULL, -- Array of participant IDs involved
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "expenses" checked/created successfully.');

  } catch (err) {
    console.error('Database initialization error:', err);
    process.exit(1); // Exit if DB setup fails
  } finally {
    client.release();
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

/**
 * Endpoint per recuperare tutti i partecipanti e le spese di un gruppo specifico.
 * GET /api/groups/:groupUuid/data
 * @returns {object} JSON con partecipanti e spese del gruppo.
 */
app.get('/api/groups/:groupUuid/data', async (req, res) => {
    const { groupUuid } = req.params;
    console.log(`Fetching data for group UUID: ${groupUuid}`);
    try {
        // Use groupUuid directly
        const participantsResult = await pool.query('SELECT * FROM participants WHERE group_id = $1 ORDER BY name', [groupUuid]);
        const expensesResult = await pool.query('SELECT * FROM expenses WHERE group_id = $1 ORDER BY id DESC', [groupUuid]);
        res.json({ participants: participantsResult.rows, expenses: expensesResult.rows });
    } catch (err) {
        // Check if the error is because the group_uuid doesn't exist
        // (This might happen if someone manually types a wrong UUID)
        // A better approach might involve a quick SELECT 1 FROM groups first
        console.error(`Error fetching data for group ${groupUuid}:`, err);
        res.status(500).json({ error: 'Errore nel recupero dati del gruppo.' });
    }
});

/**
 * Endpoint per aggiungere un nuovo partecipante a un gruppo specifico.
 * POST /api/groups/:groupUuid/participants
 * Body: { name: string }
 * @returns {object} Il partecipante aggiunto.
 */
app.post('/api/groups/:groupUuid/participants', async (req, res) => {
    const { groupUuid } = req.params;
    const { name } = req.body;

    console.log(`Attempting to add participant '${name}' to group UUID: ${groupUuid}`);
    console.log(`Type of groupUuid from req.params: ${typeof groupUuid}`);
    // --- End logging ---

    if (!name) {
        return res.status(400).json({ error: 'Participant name is required' });
    }
    // Trim the name
    const trimmedName = name.trim();
    if (!trimmedName) {
        return res.status(400).json({ error: 'Participant name cannot be empty' });
    }

    try {
        // Check if group exists (optional, but good practice - already done by FK constraint now)
        /* const groupCheck = await pool.query('SELECT id FROM groups WHERE group_uuid = $1', [groupUuid]);
        if (groupCheck.rows.length === 0) {
            // client.release(); NO!
            return res.status(404).json({ error: 'Group not found' });
        } */

        // Log values going into the query
        console.log(`Executing INSERT with name: '${trimmedName}', group_id: '${groupUuid}'`);

        // Insert participant, handling potential duplicates within the same group
        const result = await pool.query(
            `INSERT INTO participants (name, group_id)
             VALUES ($1, $2)
             ON CONFLICT (name, group_id) DO NOTHING -- Specify the columns for conflict
             RETURNING id, name, group_id`, // Return the inserted (or existing ignored) row data
            [trimmedName, groupUuid] // Use trimmedName here
        );

        if (result.rows.length > 0) {
            console.log(`Participant '${trimmedName}' added to group ${groupUuid}:`, result.rows[0]);
            res.status(201).json(result.rows[0]); // Return the added participant
        } else {
            // This happens if ON CONFLICT DO NOTHING was triggered
            console.log(`Participant '${trimmedName}' already exists in group ${groupUuid}. Fetching existing.`);
            // Fetch the existing participant to return it
            const existing = await pool.query(
                'SELECT id, name, group_id FROM participants WHERE name = $1 AND group_id = $2',
                [trimmedName, groupUuid]
            );
            if(existing.rows.length > 0) {
                 console.log(`Returning existing participant:`, existing.rows[0]);
                res.status(200).json(existing.rows[0]); // Return existing participant data
            } else {
                // Should not happen if constraint exists, but handle defensively
                 console.error(`Error: ON CONFLICT triggered for name='${trimmedName}', group='${groupUuid}' but could not find existing participant`);
                 res.status(500).json({ error: 'Error adding participant after conflict' });
            }
        }

    } catch (err) {
        console.error('Error adding participant to group:', err);
        // More specific error for FK violation?
        if (err.code === '23503') { // Foreign key violation
             res.status(400).json({ error: `Invalid group specified. Group UUID '${groupUuid}' not found.` });
        } else {
            res.status(500).json({ error: 'Database error adding participant' });
        }
    } /* finally {
        // client.release(); NO! Pool manages connections
    } */
});

/**
 * Endpoint per rimuovere un partecipante da un gruppo.
 * DELETE /api/groups/:groupUuid/participants/:participantId
 * @returns {object} Messaggio di successo o errore.
 */
app.delete('/api/groups/:groupUuid/participants/:participantId', async (req, res) => {
    const { groupUuid, participantId: participantIdStr } = req.params;
    const participantId = parseInt(participantIdStr, 10);

    console.log(`Attempting to delete participant ID ${participantId} from group ${groupUuid}`);

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
            [groupUuid, participantId] // Use groupUuid directly
        );

        if (participantCheck.rowCount === 0) {
             await client.query('ROLLBACK');
            console.log(`Participant ${participantId} not found in group ${groupUuid}.`);
            return res.status(404).json({ error: 'Partecipante non trovato in questo gruppo.' });
        }
        if (participantCheck.rows[0].has_paid_expenses) {
             await client.query('ROLLBACK');
             console.log(`Attempt failed: Participant ${participantId} (group ${groupUuid}) paid expenses.`);
             return res.status(400).json({ error: 'Impossibile rimuovere il partecipante perchè ha pagato delle spese. Rimuovere prima le spese associate.' });
        }

        // 2. Remove participant ID from involved arrays in expenses table for this group
        console.log(`Updating expenses arrays, removing participant ${participantId} from group ${groupUuid}.`);
        await client.query(
            `UPDATE expenses
             SET participants = array_remove(participants, $1)
             WHERE group_id = $2 AND $1 = ANY(participants);`,
            [participantId, groupUuid] // Use groupUuid directly
        );

        // 3. Now delete the participant
        console.log(`Deleting participant ${participantId} from group ${groupUuid}.`);
        const deleteResult = await client.query('DELETE FROM participants WHERE id = $1 AND group_id = $2', [participantId, groupUuid]);

        if (deleteResult.rowCount > 0) {
             await client.query('COMMIT'); // Commit transaction
            console.log(`Participant ${participantId} removed successfully from group ${groupUuid}.`);
            res.json({ message: 'Partecipante e riferimenti spese rimossi con successo.' });
        } else {
             // Should not happen if check above passed, but good practice
             await client.query('ROLLBACK');
            console.error(`Participant ${participantId} not found during deletion step (group ${groupUuid}).`);
            res.status(404).json({ error: 'Partecipante non trovato (durante eliminazione).' });
        }
    } catch (err) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error(`Error removing participant ${participantId} from group ${groupUuid}:`, err);
        res.status(500).json({ error: 'Errore nella rimozione del partecipante.' });

    } finally {
        client.release();
    }
});

/**
 * Endpoint per aggiungere una nuova spesa a un gruppo specifico.
 * POST /api/groups/:groupUuid/expenses
 * Body: { paidBy: number, amount: number, description: string, participants: number[] }
 * @returns {object} La spesa aggiunta.
 */
app.post('/api/groups/:groupUuid/expenses', async (req, res) => {
    const { groupUuid } = req.params;
    const { paidBy, amount, description, participants: involvedParticipantIds } = req.body;

    console.log(`Attempting to add expense to group ${groupUuid}`);

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
        const payerExists = await client.query('SELECT id FROM participants WHERE id = $1 AND group_id = $2', [paidBy, groupUuid]); // Use groupUuid
        if (payerExists.rowCount === 0) {
             await client.query('ROLLBACK');
            console.log(`Payer ID ${paidBy} not found in group ${groupUuid}.`);
            return res.status(400).json({ error: `Il pagante selezionato (ID: ${paidBy}) non appartiene a questo gruppo.` });
        }

        // Validate that all involved participants exist IN THIS GROUP
        const placeholders = involvedParticipantIds.map((_, i) => `$${i + 2}`).join(','); // $2, $3, ...
        const involvedCheckQuery = `SELECT id FROM participants WHERE group_id = $1 AND id IN (${placeholders})`;
        const involvedCheckResult = await client.query(involvedCheckQuery, [groupUuid, ...involvedParticipantIds]); // Use groupUuid

        if (involvedCheckResult.rowCount !== involvedParticipantIds.length) {
             await client.query('ROLLBACK');
            const foundIds = involvedCheckResult.rows.map(r => r.id);
            const missingIds = involvedParticipantIds.filter(id => !foundIds.includes(id));
            console.log(`Missing participant IDs in group ${groupUuid}: ${missingIds.join(', ')}`);
            return res.status(400).json({ error: `Uno o più partecipanti coinvolti (ID: ${missingIds.join(', ')}) non appartengono a questo gruppo.` });
        }

        // Insert the expense with group_id
        console.log(`Inserting expense for group ${groupUuid}:`, { description: trimmedDescription, amount, paidBy, involvedParticipantIds });
        const result = await pool.query(
            `INSERT INTO expenses (group_id, description, amount, paid_by_id, participants)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [groupUuid, trimmedDescription, amount, paidBy, involvedParticipantIds] // Use groupUuid
        );

        await client.query('COMMIT');
        console.log(`Expense added successfully to group ${groupUuid}:`, result.rows[0]);
        res.status(201).json(result.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error adding expense to group ${groupUuid}:`, err);
        res.status(500).json({ error: 'Errore nell\'aggiunta della spesa.' });
    } finally {
        client.release();
    }
});

/**
 * Endpoint per rimuovere una spesa da un gruppo specifico.
 * DELETE /api/groups/:groupUuid/expenses/:expenseId
 * @returns {object} Messaggio di successo o errore.
 */
app.delete('/api/groups/:groupUuid/expenses/:expenseId', async (req, res) => {
    const { groupUuid, expenseId: expenseIdStr } = req.params;
    const expenseId = parseInt(expenseIdStr, 10);

    console.log(`Attempting to delete expense ${expenseId} from group ${groupUuid}`);

    if (isNaN(expenseId)) {
        return res.status(400).json({ error: 'ID spesa non valido.' });
    }

    try {
        // Ensure deletion is scoped to the group
        const result = await pool.query('DELETE FROM expenses WHERE id = $1 AND group_id = $2 RETURNING id', [expenseId, groupUuid]);
        if (result.rowCount > 0) {
            console.log(`Expense ${expenseId} removed successfully from group ${groupUuid}.`);
            res.json({ message: 'Spesa rimossa con successo.' });
        } else {
            console.log(`Expense ${expenseId} not found in group ${groupUuid}.`);
            res.status(404).json({ error: 'Spesa non trovata in questo gruppo.' });
        }
    } catch (err) {
        console.error(`Error removing expense ${expenseId} from group ${groupUuid}:`, err);
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
