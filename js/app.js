// BrickManager - Main Application Logic
let currentPIN = '';
let pinMode = 'enter'; // 'enter', 'setup', 'change'
let enteredWorkers = [];

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    await checkPINSetup();
    setupPINKeypad();
    setupTodayDate();
    checkAndResetAttendance();
});

async function checkPINSetup() {
    const existingPIN = await getSetting('pin');
    if (!existingPIN) {
        pinMode = 'setup';
        document.getElementById('pin-message').textContent = 'Create a 4-digit PIN';
    }
}

function setupPINKeypad() {
    document.querySelectorAll('.key').forEach(key => {
        key.addEventListener('click', handlePINKey);
    });
}

function handlePINKey(e) {
    const key = e.target.dataset.key;
    
    if (key === 'clear') {
        currentPIN = '';
        updatePINDots();
        return;
    }
    
    if (key === 'enter') {
        validatePIN();
        return;
    }
    
    if (currentPIN.length < 4) {
        currentPIN += key;
        updatePINDots();
    }
}

function updatePINDots() {
    const dots = document.querySelectorAll('.pin-dots .dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('filled', i < currentPIN.length);
    });
}

async function validatePIN() {
    if (pinMode === 'setup') {
        if (currentPIN.length === 4) {
            await setSetting('pin', currentPIN);
            pinMode = 'enter';
            currentPIN = '';
            updatePINDots();
            showScreen('dashboard-screen');
            initDashboard();
        }
    } else if (pinMode === 'change') {
        const pin1 = document.getElementById('new-pin-1').value;
        const pin2 = document.getElementById('new-pin-2').value;
        
        if (pin1 === pin2 && pin1.length === 4) {
            await setSetting('pin', pin1);
            closeModal('pin-change-modal');
            alert('PIN changed successfully!');
            pinMode = 'enter';
            currentPIN = '';
            updatePINDots();
        } else {
            alert('PINs do not match or invalid!');
        }
    } else {
        const storedPIN = await getSetting('pin');
        if (currentPIN === storedPIN) {
            currentPIN = '';
            updatePINDots();
            showScreen('dashboard-screen');
            initDashboard();
        } else {
            alert('Incorrect PIN');
            currentPIN = '';
            updatePINDots();
        }
    }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    document.getElementById('menu-dropdown').classList.remove('show');
}

function toggleMenu() {
    document.getElementById('menu-dropdown').classList.toggle('show');
}

// Dashboard
async function initDashboard() {
    await loadDashboardStats();
}

async function loadDashboardStats() {
    const workers = await getWorkers();
    const attendance = await getAllAttendance();
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.filter(a => a.date === today);
    
    document.getElementById('workers-present').textContent = 
        todayAttendance.filter(a => a.status === 'present').length;

    const customers = await getCustomers();
    const pendingDeliveries = customers.filter(c => c.needs_delivery && c.delivery_status === 'pending');
    document.getElementById('pending-deliveries').textContent = pendingDeliveries.length;

    const outstanding = customers.filter(c => new Date(c.payment_date) <= new Date(today));
    document.getElementById('outstanding').textContent = outstanding.length;

    const expenses = await getExpenses();
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    document.getElementById('petty-cash').textContent = '$' + totalExpenses.toLocaleString();
}

function showDashboard() {
    showScreen('dashboard-screen');
    loadDashboardStats();
}

// Workers
async function showAddWorker(editId = null) {
    if (editId) {
        const worker = await getWorker(editId);
        document.getElementById('worker-modal-title').textContent = 'Edit Worker';
        document.getElementById('worker-id').value = worker.id;
        document.getElementById('worker-name').value = worker.name;
        document.getElementById('worker-role').value = worker.role;
    } else {
        document.getElementById('worker-modal-title').textContent = 'Add Worker';
        document.getElementById('worker-id').value = '';
        document.getElementById('worker-name').value = '';
        document.getElementById('worker-role').value = '';
    }
    showModal('worker-modal');
}

async function saveWorker() {
    const id = document.getElementById('worker-id').value;
    const name = document.getElementById('worker-name').value;
    const role = document.getElementById('worker-role').value;

    if (!name) {
        alert('Please enter worker name');
        return;
    }

    if (id) {
        await updateWorker({ id: Number(id), name, role });
    } else {
        await addWorker({ name, role });
    }

    closeModal('worker-modal');
    loadWorkers();
}

async function loadWorkers() {
    const workers = await getWorkers();
    const list = document.getElementById('workers-list');
    list.innerHTML = workers.map(w => `
        <div class="list-item">
            <div class="list-item-info">
                <h4>${w.name}</h4>
                <p>${w.role}</p>
            </div>
            <div class="list-item-actions">
                <button class="edit-btn" onclick="showAddWorker(${w.id})">Edit</button>
                <button class="delete-btn" onclick="deleteWorker(${w.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

async function deleteWorker(id) {
    if (confirm('Delete this worker?')) {
        await deleteWorker(id);
        loadWorkers();
    }
}

async function updatePayDate() {
    const payDate = document.getElementById('pay-date').value;
    await setSetting('pay_date', payDate);
}

async function checkAttendanceReset() {
    if (confirm('Reset all attendance records? This happens automatically on pay date.')) {
        await deleteAllAttendance();
        alert('Attendance records cleared');
    }
}

// Attendance
async function showAttendance() {
    showScreen('attendance-screen');
    const payDate = await getSetting('pay_date') || '25';
    document.getElementById('pay-date').value = payDate;
    loadWorkersForAttendance();
    loadAttendance();
}

async function loadWorkersForAttendance() {
    const workers = await getWorkers();
    enteredWorkers = workers;
}

async function loadAttendance() {
    const date = document.getElementById('attendance-date').value || new Date().toISOString().split('T')[0];
    const attendance = await getAttendanceByDate(date);
    
    const list = document.getElementById('attendance-list');
    
    if (enteredWorkers.length === 0) {
        list.innerHTML = '<p style="text-align:center;color:gray;">No workers added yet</p>';
        return;
    }

    list.innerHTML = enteredWorkers.map(w => {
        const record = attendance.find(a => a.worker_id === w.id);
        const isPresent = record && record.status === 'present';
        return `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>${w.name}</h4>
                    <p>${w.role}</p>
                </div>
                <div class="list-item-actions">
                    <button class="present-btn ${isPresent ? 'active' : ''}" 
                        onclick="markAttendance(${w.id}, 'present')">Present</button>
                    <button class="absent-btn ${!isPresent && record ? 'active' : ''}" 
                        onclick="markAttendance(${w.id}, 'absent')">Absent</button>
                </div>
            </div>
        `;
    }).join('');
}

let currentAttendance = {};

async function markAttendance(workerId, status) {
    currentAttendance[workerId] = status;
    loadAttendance();
}

async function saveAttendance() {
    const date = document.getElementById('attendance-date').value || new Date().toISOString().split('T')[0];
    
    for (const [workerId, status] of Object.entries(currentAttendance)) {
        await saveAttendance(workerId, date, status);
    }
    
    alert('Attendance saved!');
    loadAttendance();
}

function setupTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        if (!input.value) input.value = today;
    });
    document.getElementById('attendance-date').value = today;
}

// Customers
async function showCustomers() {
    showScreen('customers-screen');
    loadCustomers();
}

async function showAddCustomer(editId = null) {
    if (editId) {
        const customer = await getCustomer(editId);
        document.getElementById('customer-modal-title').textContent = 'Edit Customer';
        document.getElementById('customer-id').value = customer.id;
        document.getElementById('customer-name').value = customer.name;
        document.getElementById('customer-product').value = customer.product_type;
        document.getElementById('customer-payment-date').value = customer.payment_date;
        document.getElementById('customer-amount').value = customer.amount;
        document.getElementById('customer-delivery').checked = customer.needs_delivery;
        document.getElementById('customer-address').value = customer.delivery_address || '';
        toggleDeliveryAddress();
    } else {
        document.getElementById('customer-modal-title').textContent = 'Add Customer';
        document.getElementById('customer-id').value = '';
        document.getElementById('customer-name').value = '';
        document.getElementById('customer-product').value = '';
        document.getElementById('customer-payment-date').value = '';
        document.getElementById('customer-amount').value = '';
        document.getElementById('customer-delivery').checked = false;
        document.getElementById('customer-address').value = '';
    }
    showModal('customer-modal');
}

function toggleDeliveryAddress() {
    const needsDelivery = document.getElementById('customer-delivery').checked;
    document.getElementById('customer-address').style.display = needsDelivery ? 'block' : 'none';
}

async function saveCustomer() {
    const id = document.getElementById('customer-id').value;
    const name = document.getElementById('customer-name').value;
    const productType = document.getElementById('customer-product').value;
    const paymentDate = document.getElementById('customer-payment-date').value;
    const amount = document.getElementById('customer-amount').value;
    const needsDelivery = document.getElementById('customer-delivery').checked;
    const deliveryAddress = document.getElementById('customer-address').value;

    if (!name || !productType || !paymentDate || !amount) {
        alert('Please fill all required fields');
        return;
    }

    const data = {
        name,
        product_type: productType,
        payment_date: paymentDate,
        amount: Number(amount),
        needs_delivery: needsDelivery ? 1 : 0,
        delivery_address: deliveryAddress,
        delivery_status: needsDelivery ? 'pending' : 'none'
    };

    if (id) {
        const existing = await getCustomer(id);
        data.id = Number(id);
        data.delivery_status = existing.delivery_status;
        await updateCustomer(data);
    } else {
        await addCustomer(data);
    }

    closeModal('customer-modal');
    loadCustomers();
    loadDashboardStats();
}

async function loadCustomers() {
    const customers = await getCustomers();
    const searchTerm = document.getElementById('customer-search').value.toLowerCase();
    const filter = document.getElementById('customer-filter').value;

    let filtered = customers;

    // Search
    if (searchTerm) {
        filtered = filtered.filter(c => 
            c.name.toLowerCase().includes(searchTerm) ||
            c.payment_date.includes(searchTerm) ||
            (c.delivery_address && c.delivery_address.toLowerCase().includes(searchTerm))
        );
    }

    // Filter
    if (filter === 'delivery') {
        filtered = filtered.filter(c => c.needs_delivery && c.delivery_status === 'pending');
    } else if (filter === 'delivered') {
        filtered = filtered.filter(c => c.delivery_status === 'delivered');
    }

    const list = document.getElementById('customers-list');
    list.innerHTML = filtered.map(c => {
        const productClass = 'product-' + c.product_type.toLowerCase().replace(/\s+/g, '-');
        const deliveryBadge = c.needs_delivery 
            ? `<span class="delivery-badge delivery-${c.delivery_status}">${c.delivery_status}</span>`
            : '';
        
        return `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>${c.name} <span class="customer-product ${productClass}">${c.product_type}</span></h4>
                    <p>$${Number(c.amount).toLocaleString()} - ${c.payment_date}</p>
                    ${c.delivery_address ? `<p>📍 ${c.delivery_address}</p>` : ''}
                    ${deliveryBadge}
                </div>
                <div class="list-item-actions">
                    ${c.needs_delivery ? `<button class="deliver-btn" onclick="toggleDelivery(${c.id})">${c.delivery_status === 'delivered' ? 'Undo' : 'Deliver'}</button>` : ''}
                    <button class="edit-btn" onclick="showAddCustomer(${c.id})">Edit</button>
                    <button class="delete-btn" onclick="deleteCustomer(${c.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

async function toggleDelivery(id) {
    const customer = await getCustomer(id);
    customer.delivery_status = customer.delivery_status === 'delivered' ? 'pending' : 'delivered';
    await updateCustomer(customer);
    loadCustomers();
    loadDashboardStats();
}

async function deleteCustomer(id) {
    if (confirm('Delete this customer?')) {
        await deleteCustomer(id);
        loadCustomers();
        loadDashboardStats();
    }
}

function searchCustomers() {
    loadCustomers();
}

function filterCustomers() {
    loadCustomers();
}

// Expenses
async function showExpenses() {
    showScreen('expenses-screen');
    loadExpenses();
}

async function showAddExpense() {
    document.getElementById('expense-desc').value = '';
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
    showModal('expense-modal');
}

async function saveExpense() {
    const desc = document.getElementById('expense-desc').value;
    const amount = document.getElementById('expense-amount').value;
    const date = document.getElementById('expense-date').value;

    if (!desc || !amount || !date) {
        alert('Please fill all fields');
        return;
    }

    await addExpense({ description: desc, amount: Number(amount), date });
    closeModal('expense-modal');
    loadExpenses();
    loadDashboardStats();
}

async function loadExpenses() {
    const expenses = await getExpenses();
    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    
    document.getElementById('expense-balance').textContent = '$' + total.toLocaleString();

    const list = document.getElementById('expenses-list');
    list.innerHTML = expenses
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(e => `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>${e.description}</h4>
                    <p>${e.date}</p>
                </div>
                <div class="list-item-actions">
                    <span style="font-weight:bold;color:var(--danger)">-$${Number(e.amount).toLocaleString()}</span>
                    <button class="delete-btn" onclick="deleteExpense(${e.id})">Delete</button>
                </div>
            </div>
        `).join('');
}

async function deleteExpense(id) {
    if (confirm('Delete this expense?')) {
        await deleteExpense(id);
        loadExpenses();
        loadDashboardStats();
    }
}

// Reports
async function showReports() {
    showScreen('reports-screen');
    generateReports();
}

async function generateReports() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const weekStartStr = startOfWeek.toISOString().split('T')[0];
    const monthStartStr = startOfMonth.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    const customers = await getCustomers();
    const expenses = await getExpenses();

    const weeklySales = customers
        .filter(c => c.payment_date >= weekStartStr && c.payment_date <= todayStr)
        .reduce((sum, c) => sum + Number(c.amount), 0);

    const monthlySales = customers
        .filter(c => c.payment_date >= monthStartStr && c.payment_date <= todayStr)
        .reduce((sum, c) => sum + Number(c.amount), 0);

    const weeklyExp = expenses
        .filter(e => e.date >= weekStartStr && e.date <= todayStr)
        .reduce((sum, e) => sum + Number(e.amount), 0);

    const monthlyExp = expenses
        .filter(e => e.date >= monthStartStr && e.date <= todayStr)
        .reduce((sum, e) => sum + Number(e.amount), 0);

    document.getElementById('weekly-sales').textContent = '$' + weeklySales.toLocaleString();
    document.getElementById('monthly-sales').textContent = '$' + monthlySales.toLocaleString();
    document.getElementById('weekly-expenses').textContent = '$' + weeklyExp.toLocaleString();
    document.getElementById('monthly-expenses').textContent = '$' + monthlyExp.toLocaleString();

    const profit = monthlySales - monthlyExp;
    const profitEl = document.getElementById('monthly-profit');
    profitEl.textContent = (profit >= 0 ? '+' : '') + '$' + profit.toLocaleString();
    profitEl.style.color = profit >= 0 ? '#27ae60' : '#e74c3c';
}

// Settings
function showSettings() {
    showScreen('settings-screen');
}

function changePIN() {
    document.getElementById('new-pin-1').value = '';
    document.getElementById('new-pin-2').value = '';
    showModal('pin-change-modal');
    pinMode = 'change';
}

function saveNewPIN() {
    validatePIN();
}

async function exportData() {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'brickmanager-backup-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    alert('Data exported!');
}

async function clearAllData() {
    if (confirm('WARNING: This will delete ALL data. Are you sure?')) {
        if (confirm('This cannot be undone. Really delete everything?')) {
            await clearAllData();
            alert('All data cleared');
            location.reload();
        }
    }
}

function logout() {
    location.reload();
}

// Modal helpers
function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// Close modals on outside click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
});

// Initialize workers screen properly
document.getElementById('workers-screen').addEventListener('click', function() {
    loadWorkers();
});

console.log('App module loaded');