// --- Globals ---
let participants = [];
let expenses = [];
let currentGroupUuid = null; // Variable to store the group UUID from the URL
let currentGroupName = null; // Variable to store the group name

// --- DOM Elements ---
const createSplitContainer = document.getElementById('create-split-container');
const createError = document.getElementById('create-error');
const appContainer = document.getElementById('app-container');
const welcomeContainer = document.getElementById('welcome-container'); // Added for hiding/showing
const groupNameInput = document.getElementById('group-name-input'); // Added for create
const createGroupForm = document.getElementById('create-group-form'); // Added for create
const currentGroupNameSpan = document.getElementById('current-group-name'); // Added for display

const participantForm = document.getElementById('add-participant-form');
const participantNameInput = document.getElementById('participant-name');
const participantsList = document.getElementById('participants-list');

const expenseForm = document.getElementById('add-expense-form');
const expenseDescriptionInput = document.getElementById('expense-description');
const expenseAmountInput = document.getElementById('expense-amount');
const paidBySelect = document.getElementById('paid-by');
const selectAllBtn = document.getElementById('select-all-participants');
const deselectAllBtn = document.getElementById('deselect-all-participants');

const calculateBalancesBtn = document.getElementById('calculate-balances');
const individualBalancesList = document.getElementById('individual-balances'); 
const transactionsList = document.getElementById('transactions-list'); 
const expenseParticipantsDiv = document.getElementById('expense-participants'); 

const deleteButton = document.getElementById('delete-group-button');

// --- Backend API URL ---
// Use relative URL since frontend is served by the same backend
const backendUrl = '/api'; // Changed base URL to /api

// --- API Functions ---
async function createNewGroup() {
    // Disable button (optional, get button reference if needed)
    const createGroupButton = document.getElementById('create-group-button');
    if(createGroupButton) createGroupButton.disabled = true;
    createError.textContent = ''; // Clear previous errors
    const groupName = groupNameInput.value.trim();

    if (!groupName) {
        createError.textContent = 'Il nome del gruppo non può essere vuoto.';
        if(createGroupButton) createGroupButton.disabled = false;
        return; // Stop execution
    }

    try {
        const response = await fetch(`${backendUrl}/groups`, { // Corrected URL
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ groupName: groupName }) // Send group name
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Errore HTTP: ${response.status}`);
        }
        const data = await response.json();
        // Redirect to the new group's page
        // Using a simple path structure like /uuid directly
        console.log(`Group created: ${data.group_uuid}, redirecting...`);
        window.location.pathname = `/${data.group_uuid}`; // Use pathname for relative redirect
    } catch (error) {
        console.error('Errore nella creazione del gruppo:', error);
        createError.textContent = `Errore: ${error.message}`;
        if(createGroupButton) createGroupButton.disabled = false; // Re-enable button on error
    }
}

async function loadInitialData() {
    const appContainer = document.getElementById('app-container');
    const welcomeContainer = document.getElementById('welcome-container');

    if (!welcomeContainer || !appContainer) {
        console.error("Welcome or App container not found!");
        return;
    }

    if (!currentGroupUuid) {
        // No group ID in URL, show welcome, hide app
        console.log("No group UUID in URL, showing welcome screen.");
        welcomeContainer.style.display = 'block';
        appContainer.style.display = 'none';
        return; // Stop further execution
    }

    // Group ID is present, attempt to load data
    console.log(`Loading data for group: ${currentGroupUuid}`);
    try {
        // Fetch from the correct endpoint that returns all data including name
        const response = await fetch(`${backendUrl}/groups/${currentGroupUuid}/data`); // Added /data
        if (!response.ok) {
            if (response.status === 404) {
                // Group not found, maybe invalid URL? Redirect to create page.
                console.warn('Group not found, redirecting to create page.');
                window.location.pathname = '/';
                return;
            }
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        const data = await response.json();
        console.log('Dati caricati:', data);
        currentGroupName = data.groupName || ''; // Store group name
        document.getElementById('current-group-name').textContent = currentGroupName || 'Senza Nome';
        document.getElementById('group-share-link').textContent = window.location.href;

        // Successfully loaded data, show app, hide welcome
        welcomeContainer.style.display = 'none';
        appContainer.style.display = 'block';

        // Populate UI
        participants = data.participants;
        expenses = data.expenses || [];
        console.log('Dati caricati:', { groupName: currentGroupName, participants, expenses });

        // Display group name
        if (currentGroupNameSpan) {
            currentGroupNameSpan.textContent = currentGroupName;
        } else {
            console.error('Element #current-group-name not found');
        }

        // Update share link (assuming index.html has the element)
        const shareLinkElement = document.getElementById('group-share-link');
        if (shareLinkElement) {
            // Ensure the link text and href reflect the actual URL
            const fullUrl = window.location.origin + '/' + currentGroupUuid;
            shareLinkElement.textContent = fullUrl;
            shareLinkElement.href = '#'; // Keep href as '#' or use javascript:void(0)
            // The copyLink function will use the textContent
        }

        renderParticipants();
        renderExpenses();
        updateParticipantOptions();
    } catch (error) {
        console.error('Errore caricamento dati iniziali:', error);
        alert('Errore nel caricamento dei dati per questo gruppo. Prova a crearne uno nuovo.');
        // Error loading, show welcome, hide app (or redirect)
        welcomeContainer.style.display = 'block'; // Show welcome screen
        appContainer.style.display = 'none'; // Hide app content
        // Optional: Redirect to home if loading fails for an existing UUID
        // window.history.pushState({}, '', '/');
        // Or clear the currentGroupUuid state if needed
        // currentGroupUuid = null;
    }
}

async function addParticipant(name) {
    if (!currentGroupUuid) return;
    try {
        const response = await fetch(`${backendUrl}/groups/${currentGroupUuid}/participants`, {
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
        const response = await fetch(`${backendUrl}/groups/${currentGroupUuid}/participants/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Errore HTTP: ${response.status}`);
        }
        await response.json(); // Consume the response body

        // Remove participant from local array
        participants = participants.filter(p => p.id !== id);

        // Ensure associated expenses are handled correctly when a participant is removed
        // Backend prevents deletion if participant paid. Frontend needs to update involvement.
        let affectedExpenses = false;
        expenses.forEach(expense => {
            const initialLength = expense.participants.length;
            expense.participants = expense.participants.filter(pId => pId !== id);
            if (expense.participants.length !== initialLength) {
                affectedExpenses = true;
            }
        });
         // Optionally remove expenses that now involve no one AND weren't paid by the deleted person
         // This might be too aggressive; usually, just updating involvement is enough.
         // expenses = expenses.filter(expense => expense.participants.length > 0 || expense.paid_by_id !== id);

        // Re-render lists
        renderParticipants();
        updateParticipantOptions();
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
        const response = await fetch(`${backendUrl}/groups/${currentGroupUuid}/expenses`, {
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
        const response = await fetch(`${backendUrl}/groups/${currentGroupUuid}/expenses/${id}`, {
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

async function handleDeleteGroupClick() {
    if (!currentGroupUuid) {
        return;
    }

    const confirmation = confirm(`Sei sicuro di voler eliminare questo gruppo (${currentGroupName || 'Senza Nome'}) e tutti i suoi dati? L'azione è irreversibile.`);

    if (!confirmation) {
        return;
    }

    console.log(`Attempting to delete group: ${currentGroupUuid}`);
    try {
        const response = await fetch(`${backendUrl}/groups/${currentGroupUuid}`, {
            method: 'DELETE'
        });

        if (response.ok) { // Status 200-299
            alert('Gruppo eliminato con successo!');
            window.location.pathname = '/'; // Redirect to homepage
        } else {
            const errorData = await response.json().catch(() => ({ error: `Errore HTTP: ${response.status}` }));
            throw new Error(errorData.error || `Errore HTTP: ${response.status}`);
        }
    } catch (error) {
        console.error('Errore eliminazione gruppo:', error);
        alert(`Errore durante l'eliminazione del gruppo: ${error.message}`);
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
    const expensesList = document.getElementById('expenses-list'); // Get element here
    if (!expensesList) { // Add null check for safety
        console.error("Element #expenses-list not found during renderExpenses!");
        return;
    }
    expensesList.innerHTML = '';
    expenses.forEach(e => {
        const li = document.createElement('li');
        const paidByParticipant = participants.find(p => p.id === e.paid_by_id);
        const involvedNames = e.participants
            .map(pId => participants.find(p => p.id === pId)?.name || 'Sconosciuto')
            .join(', ');

        li.innerHTML = `
            ${e.description || 'Spesa'}: ${parseFloat(e.amount).toFixed(2)}€
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
    // Ensure elements exist before using
    if (!paidBySelect || !expenseParticipantsDiv) {
        console.error("Could not find paidBySelect or expenseParticipantsDiv in updateParticipantOptions");
        return;
    }

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
    // Ensure element exists
    if (!expenseParticipantsDiv) {
        console.error("Element #expense-participants not found during updateParticipantCheckboxes!");
        return;
    }
    // Ensure participants array is valid
    if (!participants || !Array.isArray(participants)) {
         console.error("Participants array is invalid during updateParticipantCheckboxes!");
         expenseParticipantsDiv.innerHTML = '<li>Errore: lista partecipanti non valida</li>';
         return;
    }

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
    console.log(`Calculating balances with ${expenses.length} expenses:`, expenses);
    if (participants.length === 0) {
        alert("Aggiungi almeno un partecipante.");
        return;
    }

    const balances = new Map(); // Map<participantId, balance>
    participants.forEach(p => balances.set(p.id, 0));

    expenses.forEach(expense => {
        const payerId = expense.paid_by_id;
        const amount = parseFloat(expense.amount); // Convert to number
        const involvedIds = expense.participants;

        // Check if amount is a valid number and involvedIds is not empty
        if (isNaN(amount) || involvedIds.length === 0) {
            console.error('Invalid expense data encountered:', expense);
            return; // Skip this expense
        }

        const share = amount / involvedIds.length;

        // Add to payer's balance (ensure current balance is also a number)
        const currentPayerBalance = balances.get(payerId) || 0;
        balances.set(payerId, currentPayerBalance + amount);

        // Subtract share from each involved participant's balance
        involvedIds.forEach(involvedId => {
            const currentInvolvedBalance = balances.get(involvedId) || 0;
            balances.set(involvedId, currentInvolvedBalance - share);
        });
    });

    renderIndividualBalances(balances);
    calculateTransactions(balances);
}

function renderIndividualBalances(balances) {
    // Ensure element exists
    if (!individualBalancesList) {
        console.error("Element #individual-balances not found during renderIndividualBalances");
        return;
    }
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
    // Ensure element exists
    if (!transactionsList) {
        console.error("Element #transactions-list not found during calculateTransactions");
        return;
    }
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
    // Ensure elements exist
    if (individualBalancesList) {
        individualBalancesList.innerHTML = '';
    } else {
        console.warn("Element #individual-balances not found during clearBalances");
    }
    if (transactionsList) {
        transactionsList.innerHTML = '';
    } else {
        console.warn("Element #transactions-list not found during clearBalances");
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // Listener for creating a new group
    const groupForm = document.getElementById('create-group-form');
    if (groupForm) {
        groupForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Prevent default form submission
            createNewGroup();
        });
    }

    const participantForm = document.getElementById('add-participant-form');
    if (participantForm) {
        participantForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const name = participantNameInput.value.trim();
            if (name) {
                addParticipant(name);
            } else {
                alert("Inserisci un nome valido.");
            }
        });
    }

    const expenseForm = document.getElementById('add-expense-form');
    if (expenseForm) {
        expenseForm.addEventListener('submit', (event) => {
            event.preventDefault();
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
    }

    const selectAllBtn = document.getElementById('select-all-participants');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            expenseParticipantsDiv.querySelectorAll('input[type="checkbox"]')
                .forEach(cb => cb.checked = true);
        });
    }

    const deselectAllBtn = document.getElementById('deselect-all-participants');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            expenseParticipantsDiv.querySelectorAll('input[type="checkbox"]')
                .forEach(cb => cb.checked = false);
        });
    }

    const calculateBalancesBtn = document.getElementById('calculate-balances');
    if (calculateBalancesBtn) {
        calculateBalancesBtn.addEventListener('click', calculateBalances);
    }

    // Add listener for the new delete button
    const deleteButton = document.getElementById('delete-group-button');
    if (deleteButton) {
        deleteButton.addEventListener('click', handleDeleteGroupClick);
    }
}

// --- Initialization ---
function initApp() {
    console.log('Initializing app...');
    const path = window.location.pathname;
    const pathSegments = path.split('/').filter(segment => segment !== ''); // Filter out empty segments

    console.log('Path segments:', pathSegments);

    // Simple check: path looks like /<8_chars>
    if (pathSegments.length === 1 && /^[a-zA-Z0-9]{8}$/.test(pathSegments[0])) {
        // We are on a group page (e.g., /abcdefgh)
        currentGroupUuid = pathSegments[0];
        console.log('Detected Group UUID:', currentGroupUuid);
        if (welcomeContainer) welcomeContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';
        loadInitialData();
    } else {
        // We are on the welcome/create page (e.g., / or /index.html or /somethingElse)
        console.log('On welcome page or unrecognized path');
        currentGroupUuid = null;
        if (welcomeContainer) welcomeContainer.style.display = 'block'; // Show welcome
        if (appContainer) appContainer.style.display = 'none'; // Hide app
        // No initial data to load for the welcome page
    }

    setupEventListeners();
    // Optionally clear local storage if not needed
    // localStorage.removeItem(LOCAL_STORAGE_KEY);
}

document.addEventListener('DOMContentLoaded', initApp);

// --- Utility Functions ---
function copyLink() {
    const linkElement = document.getElementById('group-share-link');
    const linkToCopy = linkElement ? linkElement.textContent : null;

    if (linkToCopy && navigator.clipboard) {
        navigator.clipboard.writeText(linkToCopy)
            .then(() => {
                alert('Link copiato negli appunti!');
            })
            .catch(err => {
                console.error('Errore nel copiare il link:', err);
                alert('Errore nel copiare il link.');
            });
    } else {
        alert('Impossibile copiare il link.');
    }
}
