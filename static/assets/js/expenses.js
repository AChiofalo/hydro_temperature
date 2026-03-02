// AgGrid Configurations
let itemsGridApi;
let historyGridApi;

const itemsGridOptions = {
    columnDefs: [
        { field: "product_name", headerName: "Prodotto", editable: true, flex: 2 },
        { field: "price", headerName: "Prezzo Unit.", editable: true, valueParser: numberParser, type: 'numericColumn', width: 120 },
        { field: "unit", headerName: "Unità", editable: true, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['pz', 'kg', 'l', 'g'] }, width: 100 },
        { field: "quantity", headerName: "Qta", editable: true, valueParser: numberParser, type: 'numericColumn', width: 100 },
        {
            headerName: "",
            width: 70,
            cellRenderer: (params) => {
                return '<button class="action-btn btn-delete" style="width: 100%; height: 30px; display: flex; align-items: center; justify-content: center;"><i class="fas fa-trash"></i></button>';
            },
            onCellClicked: (params) => {
                const rowData = params.data;
                params.api.applyTransaction({ remove: [rowData] });
            }
        }
    ],
    defaultColDef: {
        resizable: true,
        sortable: false
    },
    rowData: [],
    onGridReady: (params) => {
        itemsGridApi = params.api;
        params.api.sizeColumnsToFit();
    }
};

const historyGridOptions = {
    columnDefs: [
        { field: "purchase_date", headerName: "Data", sortable: true, filter: true },
        { field: "store_name", headerName: "Negozio", sortable: true, filter: true, flex: 1 },
        { field: "location", headerName: "Località", sortable: true, filter: true },
        {
            field: "total_amount",
            headerName: "Totale",
            valueFormatter: params => '€ ' + params.value.toFixed(2),
            sortable: true
        },
        {
            headerName: "Dettagli",
            width: 100,
            cellRenderer: (params) => {
                return '<button class="glass-btn" style="padding: 4px 8px;"><i class="fas fa-eye"></i></button>';
            },
            onCellClicked: (params) => {
                viewDetails(params.data.id);
            }
        }
    ],
    rowData: [],
    onGridReady: (params) => {
        historyGridApi = params.api;
        params.api.sizeColumnsToFit();
    }
};

function numberParser(params) {
    return Number(params.newValue);
}

// Initialize Grids
document.addEventListener('DOMContentLoaded', () => {
    const itemsGridDiv = document.querySelector('#items-grid');
    new agGrid.Grid(itemsGridDiv, itemsGridOptions);

    const historyGridDiv = document.querySelector('#history-grid');
    new agGrid.Grid(historyGridDiv, historyGridOptions);
});


function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.expense-container, #section-list').forEach(el => el.style.display = 'none');

    if (tab === 'new') {
        document.querySelector('button[onclick="switchTab(\'new\')"]').classList.add('active');
        document.getElementById('section-new').style.display = 'grid';
    } else {
        document.querySelector('button[onclick="switchTab(\'list\')"]').classList.add('active');
        document.getElementById('section-list').style.display = 'block';
        loadExpenses();
    }
}

// Drag and Drop
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--accent-primary)';
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--glass-border)';
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--glass-border)';
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

function handleFileSelect(input) {
    if (input.files.length > 0) {
        handleFile(input.files[0]);
    }
}

async function handleFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    document.getElementById('loading').classList.remove('hidden');

    try {
        const response = await fetch('/api/expenses/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        // Populate Form
        populateForm(data);
        document.getElementById('expense-form-container').classList.remove('hidden');

    } catch (error) {
        console.error('Error uploading file:', error);
        alert('Errore durante l\'analisi dello scontrino.');
    } finally {
        document.getElementById('loading').classList.add('hidden');
    }
}

function populateForm(data) {
    document.getElementById('store-name').value = data.store_name || '';
    document.getElementById('location').value = data.location || '';
    document.getElementById('purchase-date').value = data.purchase_date || '';
    document.getElementById('total-amount').value = data.total_amount || '';

    // Set data to AgGrid
    if (itemsGridApi) {
        const rowData = data.items || [];
        itemsGridApi.setRowData(rowData);
    }
}

function addNewRow() {
    if (itemsGridApi) {
        itemsGridApi.applyTransaction({
            add: [{ product_name: '', price: 0, unit: 'pz', quantity: 1 }]
        });
    }
}

async function saveExpense() {
    const storeName = document.getElementById('store-name').value;
    const location = document.getElementById('location').value;
    const date = document.getElementById('purchase-date').value;
    const total = parseFloat(document.getElementById('total-amount').value);

    // Get Items from Grid
    const items = [];
    if (itemsGridApi) {
        itemsGridApi.forEachNode(node => {
            items.push(node.data);
        });
    }

    const payload = {
        store_name: storeName,
        location: location,
        purchase_date: date,
        total_amount: total,
        items: items
    };

    try {
        const response = await fetch('/api/expenses/confirm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === 'success') {
            alert('Spesa salvata con successo!');
            location.reload();
        } else {
            alert('Errore nel salvataggio.');
        }
    } catch (error) {
        console.error('Error saving expense:', error);
        alert('Errore di connessione.');
    }
}

async function loadExpenses() {
    try {
        const response = await fetch('/api/expenses/all');
        const data = await response.json();

        if (historyGridApi) {
            historyGridApi.setRowData(data);
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

function viewDetails(id) {
    alert('Dettaglio spesa ID: ' + id + ' (Funzionalità dettaglio da implementare in una modale)');
}
