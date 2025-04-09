const backendUrl = 'http://localhost:3000/api';

// --- Elementi del DOM ---
const participantForm = document.getElementById('add-participant-form');
const participantNameInput = document.getElementById('participant-name');
const participantsList = document.getElementById('participants-list');

const expenseForm = document.getElementById('add-expense-form');
const expenseDescriptionInput = document.getElementById('expense-description');
const expenseAmountInput = document.getElementById('expense-amount');
const paidBySelect = document.getElementById('paid-by');
const expenseParticipantsDiv = document.getElementById('expense-participants');
const expensesList = document.getElementById('expenses-list');
const selectAllBtn = document.getElementById('select-all-participants');
const deselectAllBtn = document.getElementById('deselect-all-participants');

const calculateBalancesBtn = document.getElementById('calculate-balances');
const individualBalancesList = document.getElementById('individual-balances');
const transactionsList = document.getElementById('transactions-list');

// --- Stato dell'applicazione --- (i dati principali sono sul backend)
let participants = [];
let expenses = [];

// --- Funzioni API ---

/** Recupera dati iniziali dal backend */
async function fetchData() {
    try {
        const response = await fetch(`${backendUrl}/data`);
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        const data = await response.json();
        participants = data.participants || [];
        expenses = data.expenses || [];
        console.log('Dati caricati:', { participants, expenses });
        updateUI(); // Aggiorna l'interfaccia con i dati caricati
    } catch (error) {
        console.error('Errore nel caricamento dati:', error);
        alert('Impossibile caricare i dati dal backend. Assicurati che il server sia avviato.');
    }
}

/** Aggiunge un partecipante tramite API */
async function addParticipant(name) {
    try {
        const response = await fetch(`${backendUrl}/participants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Errore HTTP: ${response.status}`);
        }
        const newParticipant = await response.json();
        participants.push(newParticipant);
        updateUI();
    } catch (error) {
        console.error('Errore aggiunta partecipante:', error);
        alert(`Errore: ${error.message}`);
    }
}

/** Rimuove un partecipante tramite API */
async function removeParticipant(id) {
    if (!confirm('Sei sicuro di voler rimuovere questo partecipante? Verranno rimosse anche le spese associate.')) {
        return;
    }
    try {
        const response = await fetch(`${backendUrl}/participants/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Errore HTTP: ${response.status}`);
        }
        // Ricarica i dati per riflettere le modifiche (partecipante e spese)
        await fetchData();
    } catch (error) {
        console.error('Errore rimozione partecipante:', error);
        alert(`Errore: ${error.message}`);
    }
}

/** Aggiunge una spesa tramite API */
async function addExpense(description, amount, paidById, involvedParticipantIds) {
    try {
        const response = await fetch(`${backendUrl}/expenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description,
                amount,
                paidBy: paidById,
                participants: involvedParticipantIds,
            }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Errore HTTP: ${response.status}`);
        }
        const newExpense = await response.json();
        expenses.push(newExpense);
        updateUIExpensesList(); // Aggiorna solo la lista spese
        clearExpenseForm();
    } catch (error) {
        console.error('Errore aggiunta spesa:', error);
        alert(`Errore: ${error.message}`);
    }
}

/** Rimuove una spesa tramite API */
async function removeExpense(id) {
    if (!confirm('Sei sicuro di voler rimuovere questa spesa?')) {
        return;
    }
    try {
        const response = await fetch(`${backendUrl}/expenses/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Errore HTTP: ${response.status}`);
        }
        // Rimuovi localmente e aggiorna UI
        expenses = expenses.filter(e => e.id !== id);
        updateUIExpensesList();
        // Se si rimuove una spesa, è bene ricalcolare i saldi
        clearBalances();
    } catch (error) {
        console.error('Errore rimozione spesa:', error);
        alert(`Errore: ${error.message}`);
    }
}

// --- Funzioni UI ---

/** Aggiorna tutta l'interfaccia utente */
function updateUI() {
    updateParticipantsList();
    updateExpenseFormParticipants();
    updateUIExpensesList();
    clearBalances(); // Pulisce i saldi quando cambiano partecipanti o spese
}

/** Aggiorna l'elenco dei partecipanti nell'HTML */
function updateParticipantsList() {
    participantsList.innerHTML = ''; // Pulisce la lista
    participants.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.name;
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Rimuovi';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.onclick = () => removeParticipant(p.id);
        li.appendChild(deleteBtn);
        participantsList.appendChild(li);
    });
}

/** Aggiorna le opzioni del select 'Pagato da' e le checkbox 'Divisa tra' nel form spese */
function updateExpenseFormParticipants() {
    paidBySelect.innerHTML = '<option value="" disabled selected>-- Seleziona chi ha pagato --</option>';
    expenseParticipantsDiv.innerHTML = ''; // Pulisce le checkbox

    participants.forEach(p => {
        // Opzione per il select
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        paidBySelect.appendChild(option);

        // Checkbox per la divisione
        const div = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `participant-${p.id}`;
        checkbox.value = p.id;
        checkbox.checked = true; // Seleziona tutti di default
        const label = document.createElement('label');
        label.htmlFor = `participant-${p.id}`;
        label.textContent = p.name;
        div.appendChild(checkbox);
        div.appendChild(label);
        expenseParticipantsDiv.appendChild(div);
    });
}

/** Aggiorna l'elenco delle spese nell'HTML */
function updateUIExpensesList() {
    expensesList.innerHTML = '';
    expenses.forEach(expense => {
        const li = document.createElement('li');
        const payer = participants.find(p => p.id === expense.paidBy);
        const involvedNames = expense.participants
            .map(id => participants.find(p => p.id === id)?.name || 'Sconosciuto')
            .join(', ');

        li.innerHTML = `
            <span>${expense.description}: ${expense.amount.toFixed(2)}€ (Pagato da: ${payer ? payer.name : 'Sconosciuto'}) - Diviso tra: ${involvedNames}</span>
        `;
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Rimuovi';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.onclick = () => removeExpense(expense.id);
        li.appendChild(deleteBtn);
        expensesList.appendChild(li);
    });
}

/** Pulisce il form delle spese */
function clearExpenseForm() {
    expenseForm.reset();
    // Reseleziona tutti i partecipanti nelle checkbox dopo il reset
    const checkboxes = expenseParticipantsDiv.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
    paidBySelect.value = ''; // Deseleziona il pagante
}

/** Pulisce le sezioni dei saldi */
function clearBalances() {
    individualBalancesList.innerHTML = '';
    transactionsList.innerHTML = '';
}

// --- Funzioni di Calcolo Saldi ---

/**
 * Calcola i saldi finali di ogni partecipante.
 * @returns {Map<number, number>} Mappa ID partecipante -> saldo (positivo = credito, negativo = debito)
 */
function calculateIndividualBalances() {
    const balances = new Map(); // { participantId: balance }
    participants.forEach(p => balances.set(p.id, 0));

    expenses.forEach(expense => {
        const amount = expense.amount;
        const paidById = expense.paidBy;
        const involvedParticipantIds = expense.participants;
        const numInvolved = involvedParticipantIds.length;

        if (numInvolved === 0) return; // Ignora spese senza partecipanti coinvolti

        const share = amount / numInvolved; // Quota per partecipante coinvolto

        // Aggiungi l'intero importo pagato al saldo del pagante
        balances.set(paidById, (balances.get(paidById) || 0) + amount);

        // Sottrai la quota di ogni partecipante coinvolto dal suo saldo
        involvedParticipantIds.forEach(participantId => {
            balances.set(participantId, (balances.get(participantId) || 0) - share);
        });
    });

    return balances;
}

/**
 * Calcola le transazioni minime necessarie per pareggiare i conti.
 * Algoritmo: Trova chi ha il debito maggiore e chi il credito maggiore,
 * trasferisci il minimo tra i due importi, ripeti finché tutti i saldi sono (quasi) zero.
 * @param {Map<number, number>} balances - Mappa ID partecipante -> saldo.
 * @returns {Array<{from: number, to: number, amount: number}>} Array di transazioni.
 */
function calculateTransactions(balances) {
    const transactions = [];
    const balancesCopy = new Map(balances);

    // Converti la mappa in un array di {id, balance} per facilitare l'ordinamento
    let balancesArray = Array.from(balancesCopy.entries())
                            .map(([id, balance]) => ({ id, balance }));

    // Continua finché ci sono saldi significativamente diversi da zero
    while (balancesArray.some(b => Math.abs(b.balance) > 0.001)) { // Tolleranza per errori floating point
        // Ordina per saldo (debitori prima, creditori dopo)
        balancesArray.sort((a, b) => a.balance - b.balance);

        const debtor = balancesArray[0];         // Chi ha il debito maggiore (saldo più negativo)
        const creditor = balancesArray[balancesArray.length - 1]; // Chi ha il credito maggiore (saldo più positivo)

        // Se i saldi sono troppo piccoli, fermati
        if (Math.abs(debtor.balance) < 0.001 || Math.abs(creditor.balance) < 0.001) {
            break;
        }

        const amountToTransfer = Math.min(-debtor.balance, creditor.balance);

        // Registra la transazione
        transactions.push({
            from: debtor.id,
            to: creditor.id,
            amount: amountToTransfer,
        });

        // Aggiorna i saldi nell'array
        debtor.balance += amountToTransfer;
        creditor.balance -= amountToTransfer;

         // Rimuovi partecipanti con saldo zero (o quasi zero) per efficienza
        balancesArray = balancesArray.filter(b => Math.abs(b.balance) > 0.001);

        // Controllo di sicurezza per evitare loop infiniti
        if (balancesArray.length < 2 && balancesArray.some(b => Math.abs(b.balance) > 0.001)) {
             console.warn("Potenziale errore nel calcolo delle transazioni, i saldi non si azzerano.", balancesArray);
             break;
        }
    }

    return transactions;
}

/** Mostra i saldi e le transazioni calcolate nell'UI */
function displayBalancesAndTransactions() {
    clearBalances(); // Pulisce prima di mostrare i nuovi risultati

    if (participants.length === 0) {
        individualBalancesList.innerHTML = '<li>Aggiungi partecipanti per calcolare i saldi.</li>';
        return;
    }
     if (expenses.length === 0) {
        individualBalancesList.innerHTML = '<li>Nessuna spesa inserita.</li>';
        return;
    }

    const individualBalances = calculateIndividualBalances();
    const transactions = calculateTransactions(individualBalances);

    // Mostra saldi individuali
    individualBalances.forEach((balance, participantId) => {
        const participant = participants.find(p => p.id === participantId);
        const li = document.createElement('li');
        const balanceStatus = balance > 0.001 ? 'Credito' : (balance < -0.001 ? 'Debito' : 'In pari');
        li.textContent = `${participant ? participant.name : 'Sconosciuto'}: ${balance.toFixed(2)}€ (${balanceStatus})`;
        individualBalancesList.appendChild(li);
    });

    // Mostra transazioni necessarie
    if (transactions.length === 0 && expenses.length > 0) {
        transactionsList.innerHTML = '<li>Tutti i conti sono in pari!</li>';
    } else {
        transactions.forEach(t => {
            const fromParticipant = participants.find(p => p.id === t.from);
            const toParticipant = participants.find(p => p.id === t.to);
            const li = document.createElement('li');
            li.textContent = `${fromParticipant ? fromParticipant.name : 'Sconosciuto'} deve dare ${t.amount.toFixed(2)}€ a ${toParticipant ? toParticipant.name : 'Sconosciuto'}`;
            transactionsList.appendChild(li);
        });
    }
}

// --- Event Listeners ---

/** Gestisce l'invio del form per aggiungere partecipanti */
participantForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = participantNameInput.value.trim();
    if (name) {
        addParticipant(name);
        participantNameInput.value = ''; // Pulisce l'input
    }
});

/** Gestisce l'invio del form per aggiungere spese */
expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const description = expenseDescriptionInput.value.trim();
    const amount = parseFloat(expenseAmountInput.value);
    const paidById = parseInt(paidBySelect.value, 10);
    const involvedCheckboxes = expenseParticipantsDiv.querySelectorAll('input[type="checkbox"]:checked');
    const involvedParticipantIds = Array.from(involvedCheckboxes).map(cb => parseInt(cb.value, 10));

    if (!description || !amount || !paidById || involvedParticipantIds.length === 0) {
        alert('Per favore, compila tutti i campi della spesa e seleziona almeno un partecipante coinvolto.');
        return;
    }

    addExpense(description, amount, paidById, involvedParticipantIds);
});

/** Gestisce il click sul pulsante "Calcola Saldi" */
calculateBalancesBtn.addEventListener('click', displayBalancesAndTransactions);

/** Gestisce il click sul pulsante "Seleziona Tutti" per le checkbox dei partecipanti alla spesa */
selectAllBtn.addEventListener('click', () => {
    const checkboxes = expenseParticipantsDiv.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
});

/** Gestisce il click sul pulsante "Deseleziona Tutti" per le checkbox dei partecipanti alla spesa */
deselectAllBtn.addEventListener('click', () => {
    const checkboxes = expenseParticipantsDiv.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
});

// --- Inizializzazione ---

// Carica i dati iniziali quando la pagina è pronta
document.addEventListener('DOMContentLoaded', fetchData);
