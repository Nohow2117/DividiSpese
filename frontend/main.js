// --- Globals ---
let participants = [];
let expenses = [];
let currentGroupUuid = null; // Variable to store the group UUID from the URL

// --- DOM Elements ---
const createSplitContainer = document.getElementById('create-split-container');
const createSplitButton = document.getElementById('create-split-button');
const createError = document.getElementById('create-error');
const appContainer = document.getElementById('app-container');

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

// --- Backend API URL ---
// Use relative URL since frontend is served by the same backend
const backendUrl = ''; // process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '';

// --- API Functions ---
async function createNewSplit() {
    createSplitButton.disabled = true;
    createError.textContent = ''; // Clear previous errors
    try {
        const response = await fetch(`${backendUrl}/api/groups`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
            // No body needed for group creation in this setup
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Errore HTTP: ${response.status}`);
        }
        const data = await response.json();
        // Redirect to the new group's page
        // Using a simple path structure like /uuid directly
        window.location.href = `/${data.group_uuid}`; // Redirect to the root path + uuid
    } catch (error) {
        console.error('Errore nella creazione del gruppo:', error);
        createError.textContent = `Errore: ${error.message}`;
        createSplitButton.disabled = false; // Re-enable button on error
    }
}

async function loadInitialData() {
    if (!currentGroupUuid) return; // Don't load if no group context
    try {
        const response = await fetch(`${backendUrl}/api/groups/${currentGroupUuid}/data`);
        if (!response.ok) {
            if (response.status === 404) {
                // Group not found, maybe invalid URL? Redirect to create page.
                console.warn('Group not found, redirecting to create page.');
                window.location.href = '/';
                return;
            }
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        const data = await response.json();
        participants = data.participants || [];
        expenses = data.expenses || [];
        console.log('Dati caricati:', { participants, expenses });
        renderParticipants();
        renderExpenses();
        updateParticipantOptions();
    } catch (error) {
        console.error('Errore nel caricamento dati:', error);
        // Optionally show an error message to the user in the app container
        appContainer.innerHTML = `<p class="error-message">Errore nel caricamento dei dati per questo gruppo. Prova a <a href="/">crearne uno nuovo</a>.</p>`;
        appContainer.style.display = 'block';
        createSplitContainer.style.display = 'none';
    }
}

async function addParticipant(name) {
    if (!currentGroupUuid) return;
    try {
        const response = await fetch(`${backendUrl}/api/groups/${currentGroupUuid}/participants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Errore HTTP: ${response.status}`);
        }
        const newParticipant = await response.json();
        participants.push(newParticipant);
        renderParticipants();
        updateParticipantOptions();
        participantNameInput.value = ''; // Clear input
    } catch (error) {
        console.error('Errore aggiunta partecipante:', error);
        alert(`Errore: ${error.message}`); // Simple alert for now
    }
}

async function removeParticipant(id) {
    if (!currentGroupUuid) return;
    // Confirmation dialog
    const participant = participants.find(p => p.id === id);
    if (!participant) return;

    const confirmation = confirm(`Sei sicuro di voler rimuovere ${participant.name}? ATTENZIONE: Questo non è possibile se ${participant.name} ha pagato delle spese.`);
    if (!confirmation) {
        return;
    }

    try {
        // Note the changed URL structure: includes participantId
        const response = await fetch(`${backendUrl}/api/groups/${currentGroupUuid}/participants/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Errore HTTP: ${response.status}`);
        }
        await response.json(); // Consume the response body

        // Remove participant from local array
        participants = participants.filter(p => p.id !== id);

        // Re-render lists
        renderParticipants();
        updateParticipantOptions();
        // We might need to re-render expenses if the deleted participant was involved
        // but didn't pay - the backend handles removing them from the array, but frontend
        // might need to update the display. Simplest is to reload all data, or just re-render expenses.
        renderExpenses(); // Re-render expenses to potentially update involved lists
        // Clear balances as they are now invalid
        clearBalances();

    } catch (error) {
        console.error('Errore rimozione partecipante:', error);
        alert(`Errore: ${error.message}`);
    }
}

async function addExpense(description, amount, paidById, participantIds) {
    if (!currentGroupUuid) return;
    try {
        const response = await fetch(`${backendUrl}/api/groups/${currentGroupUuid}/expenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description, amount, paidBy: paidById, participants: participantIds })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Errore HTTP: ${response.status}`);
        }
        const newExpense = await response.json();
        expenses.push(newExpense);
        renderExpenses();
        expenseForm.reset(); // Reset form fields
        updateParticipantCheckboxes(); // Ensure checkboxes are reset correctly
         clearBalances(); // Clear balances as they need recalculation
    } catch (error) {
        console.error('Errore aggiunta spesa:', error);
        alert(`Errore: ${error.message}`);
    }
}

async function removeExpense(id) {
    if (!currentGroupUuid) return;
    // Optional: Add confirmation dialog
    // const confirmation = confirm("Sei sicuro di voler rimuovere questa spesa?");
    // if (!confirmation) return;

    try {
        const response = await fetch(`${backendUrl}/api/groups/${currentGroupUuid}/expenses/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Errore HTTP: ${response.status}`);
        }
        await response.json(); // Consume the response body
        expenses = expenses.filter(e => e.id !== id);
        renderExpenses();
         clearBalances(); // Clear balances as they need recalculation
    } catch (error) {
        console.error('Errore rimozione spesa:', error);
        alert(`Errore: ${error.message}`);
    }
}

// --- Rendering Functions ---
function renderParticipants() {
    participantsList.innerHTML = '';
    participants.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.name;
        li.dataset.id = p.id;

        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Rimuovi';
        removeBtn.classList.add('remove-btn');
        removeBtn.onclick = () => removeParticipant(p.id);

        li.appendChild(removeBtn);
        participantsList.appendChild(li);
    });
}

function renderExpenses() {
    expensesList.innerHTML = '';
    expenses.forEach(e => {
        const li = document.createElement('li');
        const paidByParticipant = participants.find(p => p.id === e.paid_by_id);
        const involvedNames = e.participants
            .map(pId => participants.find(p => p.id === pId)?.name || 'Sconosciuto')
            .join(', ');

        li.innerHTML = `
            ${e.description || 'Spesa'}: ${e.amount.toFixed(2)}€
            (Pagato da: ${paidByParticipant ? paidByParticipant.name : 'Sconosciuto'})
            [Diviso tra: ${involvedNames || 'Nessuno'}]
        `;
        li.dataset.id = e.id;

        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Rimuovi';
        removeBtn.classList.add('remove-btn');
        removeBtn.onclick = () => removeExpense(e.id);

        li.appendChild(removeBtn);
        expensesList.appendChild(li);
    });
}

// Update dropdown and checkboxes when participants change
function updateParticipantOptions() {
    // Update "Paid by" dropdown
    paidBySelect.innerHTML = '<option value="" disabled selected>-- Seleziona chi ha pagato --</option>';
    participants.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        paidBySelect.appendChild(option);
    });

    updateParticipantCheckboxes();
}

function updateParticipantCheckboxes() {
     // Update "Split among" checkboxes
    expenseParticipantsDiv.innerHTML = '';
    participants.forEach(p => {
        const div = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `participant-${p.id}`;
        checkbox.value = p.id;
        checkbox.checked = true; // Default to checked
        const label = document.createElement('label');
        label.htmlFor = `participant-${p.id}`;
        label.textContent = p.name;
        div.appendChild(checkbox);
        div.appendChild(label);
        expenseParticipantsDiv.appendChild(div);
    });
}

// --- Balance Calculation ---
function calculateBalances() {
    if (participants.length === 0) {
        alert("Aggiungi almeno un partecipante.");
        return;
    }

    const balances = new Map(); // Map<participantId, balance>
    participants.forEach(p => balances.set(p.id, 0));

    expenses.forEach(expense => {
        const payerId = expense.paid_by_id;
        const amount = expense.amount;
        const involvedIds = expense.participants;
        const share = amount / involvedIds.length;

        // Add to payer's balance
        balances.set(payerId, balances.get(payerId) + amount);

        // Subtract share from each involved participant's balance
        involvedIds.forEach(involvedId => {
            balances.set(involvedId, balances.get(involvedId) - share);
        });
    });

    renderIndividualBalances(balances);
    calculateTransactions(balances);
}

function renderIndividualBalances(balances) {
    individualBalancesList.innerHTML = '';
    balances.forEach((balance, participantId) => {
        const participant = participants.find(p => p.id === participantId);
        if (participant) {
            const li = document.createElement('li');
            const balanceFormatted = balance.toFixed(2);
            li.textContent = `${participant.name}: ${balanceFormatted}€ `;
            li.style.color = balance >= 0 ? 'green' : 'red';
            if (Math.abs(balance) < 0.01) { // Consider near-zero balances as settled
                 li.textContent += " (Saldo pari)";
                 li.style.color = 'grey';
            }
            individualBalancesList.appendChild(li);
        }
    });
}

function calculateTransactions(balances) {
    transactionsList.innerHTML = '';
    const transactions = [];
    const creditors = []; // { id: participantId, amount: amountOwed }
    const debtors = [];   // { id: participantId, amount: amountToPay }

    balances.forEach((balance, participantId) => {
        if (balance > 0.01) { // Allow for small floating point inaccuracies
            creditors.push({ id: participantId, amount: balance });
        } else if (balance < -0.01) {
            debtors.push({ id: participantId, amount: -balance }); // Store positive amount
        }
    });

    // Sort for potentially more optimal transactions (largest first)
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    let i = 0; // creditor index
    let j = 0; // debtor index

    while (i < creditors.length && j < debtors.length) {
        const creditor = creditors[i];
        const debtor = debtors[j];
        const amountToTransfer = Math.min(creditor.amount, debtor.amount);

        if (amountToTransfer > 0.01) { // Only record meaningful transactions
            transactions.push({
                from: debtor.id,
                to: creditor.id,
                amount: amountToTransfer
            });

            creditor.amount -= amountToTransfer;
            debtor.amount -= amountToTransfer;
        }

        if (creditor.amount < 0.01) {
            i++;
        }
        if (debtor.amount < 0.01) {
            j++;
        }
    }

    // Render transactions
    if (transactions.length === 0 && creditors.length === 0 && debtors.length === 0 && participants.length > 0) {
        transactionsList.innerHTML = '<li>Tutti i conti sono a posto!</li>';
    } else {
        transactions.forEach(t => {
            const fromParticipant = participants.find(p => p.id === t.from);
            const toParticipant = participants.find(p => p.id === t.to);
            if (fromParticipant && toParticipant) {
                const li = document.createElement('li');
                li.textContent = `${fromParticipant.name} deve dare ${t.amount.toFixed(2)}€ a ${toParticipant.name}`;
                transactionsList.appendChild(li);
            }
        });
    }
}

function clearBalances() {
    individualBalancesList.innerHTML = '';
    transactionsList.innerHTML = '';
}

// --- Event Listeners ---
function setupEventListeners() {
    // Event listener for creating a new split (only if on the create page)
    if (createSplitButton) {
        createSplitButton.addEventListener('click', createNewSplit);
    }

    // Event listeners for the main app (only if on an app page)
    if (appContainer.style.display !== 'none') {
        participantForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = participantNameInput.value.trim();
            if (name) {
                addParticipant(name);
            } else {
                alert("Inserisci un nome valido.");
            }
        });

        expenseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const description = expenseDescriptionInput.value.trim();
            const amount = parseFloat(expenseAmountInput.value);
            const paidById = parseInt(paidBySelect.value, 10);
            const involvedCheckboxes = expenseParticipantsDiv.querySelectorAll('input[type="checkbox"]:checked');
            const participantIds = Array.from(involvedCheckboxes).map(cb => parseInt(cb.value, 10));

            if (isNaN(amount) || amount <= 0) {
                alert("Inserisci un importo valido.");
                return;
            }
            if (isNaN(paidById)) {
                alert("Seleziona chi ha pagato.");
                return;
            }
            if (participantIds.length === 0) {
                alert("Seleziona almeno un partecipante coinvolto nella spesa.");
                return;
            }

            addExpense(description || 'Spesa', amount, paidById, participantIds);
        });

        selectAllBtn.addEventListener('click', () => {
            expenseParticipantsDiv.querySelectorAll('input[type="checkbox"]')
                .forEach(cb => cb.checked = true);
        });

        deselectAllBtn.addEventListener('click', () => {
            expenseParticipantsDiv.querySelectorAll('input[type="checkbox"]')
                .forEach(cb => cb.checked = false);
        });

        calculateBalancesBtn.addEventListener('click', calculateBalances);
    }
}


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Extract group UUID from path (e.g., /abcdef12 -> abcdef12)
    const pathSegments = window.location.pathname.split('/').filter(segment => segment);
    const potentialUuid = pathSegments[0]; // Assuming UUID is the first segment

    if (potentialUuid && potentialUuid.length > 4) { // Basic check for a potential UUID
        currentGroupUuid = potentialUuid;
        console.log(`Group UUID detected: ${currentGroupUuid}`);
        // Show app, hide create form
        appContainer.style.display = 'block';
        createSplitContainer.style.display = 'none';
        loadInitialData(); // Load data for this specific group
    } else {
        console.log('No Group UUID detected, showing create page.');
        // Show create form, hide app
        appContainer.style.display = 'none';
        createSplitContainer.style.display = 'block';
    }

    // Setup listeners based on which container is visible
    setupEventListeners();
});
