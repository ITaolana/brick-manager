// BrickManager - Main Application Logic
let currentPIN = '';
let pinMode = 'enter'; // 'enter', 'setup'
let enteredWorkers = [];

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
    } catch (e) {
        console.log('DB init error:', e);
    }
    await checkPINSetup();
    setupTodayDate();
    checkAndResetAttendance();
});

async function checkPINSetup() {
    const existingPIN = await getSetting('pin');
    console.log('Existing PIN:', existingPIN);
    if (!existingPIN || existingPIN === 'null' || existingPIN === '') {
        pinMode = 'setup';
        document.getElementById('pin-message').textContent = 'Create a 4-digit PIN';
    } else {
        // Check if already logged in
        const isLoggedIn = localStorage.getItem('brick_logged_in');
        if (isLoggedIn === 'true') {
            showScreen('dashboard-screen');
            initDashboard();
        }
    }
}

function setupPINKeypad() {
    // Keypad is set up via onclick in HTML
}

function handlePINKey(key) {
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
    console.log('Validating PIN, mode:', pinMode, 'currentPIN:', currentPIN);
    if (pinMode === 'setup') {
        if (currentPIN.length === 4) {
            await setSetting('pin', currentPIN);
            localStorage.setItem('brick_logged_in', 'true');
            console.log('PIN saved');
            pinMode = 'enter';
            currentPIN = '';
            updatePINDots();
            showScreen('dashboard-screen');
            initDashboard();
        } else {
            alert('PIN must be 4 digits');
        }
    } else {
        const storedPIN = await getSetting('pin');
        console.log('Stored PIN:', storedPIN);
        if (currentPIN === storedPIN) {
            localStorage.setItem('brick_logged_in', 'true');
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
    const screen = document.getElementById(screenId);
    if (!screen) {
        alert('Screen not found: ' + screenId);
        return;
    }
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
    var dropdown = document.getElementById('menu-dropdown');
    if (dropdown) dropdown.classList.remove('show');
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
async function showAddWorker() {
    const name = prompt('Worker Name:');
    if (!name) return;
    
    const role = prompt('Role (e.g., Mason, Driver):');
    if (!role) return;
    
    await addWorker({ name, role });
    alert('Worker added!');
    loadWorkers();
}

async function loadWorkers() {
    const workers = await getWorkers();
    const list = document.getElementById('workers-list');
    if (!list) return;
    
    list.innerHTML = workers.length === 0 ? '<p style="text-align:center;color:gray;">No workers added yet</p>' : 
        workers.map(w => `
            <div class="list-item">
                <div class="list-item-info">
                    <h4>${w.name}</h4>
                    <p>${w.role}</p>
                </div>
                <div class="list-item-actions">
                    <button class="edit-btn" onclick="editWorker(${w.id})">Edit</button>
                    <button class="delete-btn" onclick="deleteWorkerRecord(${w.id})">Delete</button>
                </div>
            </div>
        `).join('');
}

async function editWorker(id) {
    const worker = await getWorker(id);
    const name = prompt('Worker Name:', worker?.name || '');
    const role = prompt('Role:', worker?.role || '');
    
    if (name) {
        if (worker) {
            await updateWorker({ ...worker, name, role });
        } else {
            await addWorker({ name, role });
        }
        loadWorkers();
    }
}

async function deleteWorkerRecord(id) {
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
    if (confirm('Reset all attendance records?')) {
        await deleteAllAttendance();
        alert('Attendance records cleared');
    }
}

// Attendance
async function showAttendance() {
    showScreen('attendance-screen');
    const payDate = await getSetting('pay_date') || '25';
    document.getElementById('pay-date').value = payDate;
    await loadWorkersForAttendance();
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
    if (!list) return;
    
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
    loadDashboardStats();
}

// Customers
async function showCustomers() {
    showScreen('customers-screen');
    loadCustomers();
}

async function loadCustomers() {
    const customers = await getCustomers();
    const searchTerm = document.getElementById('customer-search')?.value.toLowerCase() || '';
    const filter = document.getElementById('customer-filter')?.value || 'all';

    let filtered = customers;

    if (searchTerm) {
        filtered = filtered.filter(c => 
            c.name.toLowerCase().includes(searchTerm) ||
            c.payment_date.includes(searchTerm) ||
            (c.delivery_address && c.delivery_address.toLowerCase().includes(searchTerm))
        );
    }

    if (filter === 'delivery') {
        filtered = filtered.filter(c => c.needs_delivery && c.delivery_status === 'pending');
    } else if (filter === 'delivered') {
        filtered = filtered.filter(c => c.delivery_status === 'delivered');
    }

    const list = document.getElementById('customers-list');
    if (!list) return;
    
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
                    <button class="edit-btn" onclick="editCustomer(${c.id})">Edit</button>
                    <button class="delete-btn" onclick="deleteCustomerRecord(${c.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

async function editCustomer(id) {
    const customer = await getCustomer(id);
    
    const name = prompt('Customer Name:', customer?.name || '');
    const products = ['Bricks', 'Fine Sand', 'Rough Sand', 'Quarry', 'TLB for Hire'];
    const productType = prompt('Product (' + products.join(', ') + '):', customer?.product_type || '');
    const paymentDate = prompt('Payment Date (YYYY-MM-DD):', customer?.payment_date || '');
    const amount = prompt('Amount:', customer?.amount || '');
    const needsDelivery = confirm('Needs delivery?');
    const address = needsDelivery ? prompt('Delivery Address:', customer?.delivery_address || '') : '';
    
    if (name && productType && paymentDate && amount) {
        await updateCustomer({
            id: Number(id),
            name,
            product_type: productType,
            payment_date: paymentDate,
            amount: Number(amount),
            needs_delivery: needsDelivery ? 1 : 0,
            delivery_address: address,
            delivery_status: needsDelivery ? 'pending' : 'none'
        });
        loadCustomers();
        loadDashboardStats();
    }
}

async function toggleDelivery(id) {
    const customer = await getCustomer(id);
    customer.delivery_status = customer.delivery_status === 'delivered' ? 'pending' : 'delivered';
    await updateCustomer(customer);
    loadCustomers();
    loadDashboardStats();
}

async function deleteCustomerRecord(id) {
    if (confirm('Delete this customer?')) {
        await deleteCustomer(id);
        loadCustomers();
        loadDashboardStats();
    }
}

// Add Customer
async function showAddCustomer() {
    const name = prompt('Customer Name:');
    if (!name) return;
    
    const products = ['Bricks', 'Fine Sand', 'Rough Sand', 'Quarry', 'TLB for Hire'];
    let productType = prompt('Product (' + products.join(', ') + '):');
    if (!productType) return;
    
    // Validate product
    productType = products.find(p => p.toLowerCase() === productType.toLowerCase()) || productType;
    
    let paymentDate = prompt('Payment Date (YYYY-MM-DD) or press Enter for today:');
    if (!paymentDate) {
        paymentDate = new Date().toISOString().split('T')[0];
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(paymentDate)) {
        alert('Date must be in format YYYY-MM-DD');
        return;
    }
    
    const amount = prompt('Amount:');
    if (!amount || isNaN(amount)) {
        alert('Please enter a valid amount');
        return;
    }
    
    const needsDelivery = confirm('Needs delivery? Click OK for Yes, Cancel for No');
    const address = needsDelivery ? prompt('Delivery Address:') : '';
    
    await addCustomer({
        name,
        product_type: productType,
        payment_date: paymentDate,
        amount: Number(amount),
        needs_delivery: needsDelivery ? 1 : 0,
        delivery_address: address || '',
        delivery_status: needsDelivery ? 'pending' : 'none'
    });
    
    loadCustomers();
    loadDashboardStats();
    alert('Customer added!');
}

// Expenses
async function showExpenses() {
    showScreen('expenses-screen');
    loadExpenses();
}

async function showAddExpense() {
    const desc = prompt('Description:');
    if (!desc) return;
    
    const amount = prompt('Amount:');
    if (!amount || isNaN(amount)) {
        alert('Please enter a valid amount');
        return;
    }
    
    const date = new Date().toISOString().split('T')[0];
    
    await addExpense({ description: desc, amount: Number(amount), date });
    loadExpenses();
    loadDashboardStats();
    alert('Expense recorded!');
}

async function loadExpenses() {
    const expenses = await getExpenses();
    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    
    const balanceEl = document.getElementById('expense-balance');
    if (balanceEl) balanceEl.textContent = '$' + total.toLocaleString();

    const list = document.getElementById('expenses-list');
    if (!list) return;
    
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
                    <button class="delete-btn" onclick="deleteExpenseRecord(${e.id})">Delete</button>
                </div>
            </div>
        `).join('');
}

async function deleteExpenseRecord(id) {
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

    const el = id => document.getElementById(id);
    if (el('weekly-sales')) el('weekly-sales').textContent = '$' + weeklySales.toLocaleString();
    if (el('monthly-sales')) el('monthly-sales').textContent = '$' + monthlySales.toLocaleString();
    if (el('weekly-expenses')) el('weekly-expenses').textContent = '$' + weeklyExp.toLocaleString();
    if (el('monthly-expenses')) el('monthly-expenses').textContent = '$' + monthlyExp.toLocaleString();

    const profit = monthlySales - monthlyExp;
    const profitEl = document.getElementById('monthly-profit');
    if (profitEl) {
        profitEl.textContent = (profit >= 0 ? '+' : '') + '$' + profit.toLocaleString();
        profitEl.style.color = profit >= 0 ? '#27ae60' : '#e74c3c';
    }
}

// Settings
function showSettings() {
    showScreen('settings-screen');
}

async function changePIN() {
    const currentPIN = prompt('Enter current PIN:');
    const stored = await getSetting('pin');
    
    if (currentPIN !== stored) {
        alert('Incorrect PIN');
        return;
    }
    
    const newPIN = prompt('Enter new 4-digit PIN:');
    if (newPIN && newPIN.length === 4) {
        await setSetting('pin', newPIN);
        alert('PIN changed!');
    } else {
        alert('PIN must be 4 digits');
    }
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

async function resetApp() {
    if (confirm('This will delete ALL data. Continue?')) {
        if (confirm('Really delete everything? This cannot be undone.')) {
            await clearAllData();
            alert('All data cleared. Refreshing...');
            location.reload();
        }
    }
}

function logout() {
    location.reload();
}

function resetPIN() {
    if (confirm('This will clear your PIN and ALL data. Are you sure?')) {
        clearAllData();
        localStorage.clear();
        alert('App reset! Refresh to set new PIN.');
        location.reload();
    }
}

function setupTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        if (!input.value) input.value = today;
    });
    const attDate = document.getElementById('attendance-date');
    if (attDate) attDate.value = today;
}

// Close modals on outside click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
});

console.log('App module loaded');