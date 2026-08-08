// BrickManager - Main Application Logic
let currentPIN = '';
let pinMode = 'enter';
let enteredWorkers = [];
let currentAttendance = {};

document.addEventListener('DOMContentLoaded', async () => {
    try { await initDB(); } catch (e) { console.log('DB init error:', e); }
    await checkPINSetup();
    setupTodayDate();
    checkAndResetAttendance();
});

async function checkPINSetup() {
    const existingPIN = await getSetting('pin');
    if (!existingPIN || existingPIN === 'null' || existingPIN === '') {
        pinMode = 'setup';
        document.getElementById('pin-message').textContent = 'Create a 4-digit PIN';
    } else if (localStorage.getItem('brick_logged_in') === 'true') {
        showScreen('dashboard-screen');
        initDashboard();
    }
}

function handlePINKey(key) {
    if (key === 'clear') { currentPIN = ''; updatePINDots(); return; }
    if (key === 'enter') { validatePIN(); return; }
    if (currentPIN.length < 4) { currentPIN += key; updatePINDots(); }
}

function updatePINDots() {
    const dots = document.querySelectorAll('.pin-dots .dot');
    dots.forEach((dot, i) => { dot.classList.toggle('filled', i < currentPIN.length); });
}

async function validatePIN() {
    if (pinMode === 'setup') {
        if (currentPIN.length === 4) {
            await setSetting('pin', currentPIN);
            localStorage.setItem('brick_logged_in', 'true');
            pinMode = 'enter';
            currentPIN = '';
            updatePINDots();
            showScreen('dashboard-screen');
            initDashboard();
        } else { alert('PIN must be 4 digits'); }
    } else {
        const storedPIN = await getSetting('pin');
        if (currentPIN === storedPIN) {
            localStorage.setItem('brick_logged_in', 'true');
            currentPIN = '';
            updatePINDots();
            showScreen('dashboard-screen');
            initDashboard();
        } else { alert('Incorrect PIN'); currentPIN = ''; updatePINDots(); }
    }
}

function showScreen(screenId) {
    const screen = document.getElementById(screenId);
    if (!screen) { alert('Screen not found'); return; }
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
    const dd = document.getElementById('menu-dropdown');
    if (dd) dd.classList.remove('show');
}

function toggleMenu() { document.getElementById('menu-dropdown').classList.toggle('show'); }

async function initDashboard() {
    await loadDashboardStats();
    const payDate = await getSetting('pay_date') || '25';
    document.getElementById('pay-date').value = payDate;
}

async function loadDashboardStats() {
    const workers = await getWorkers();
    const attendance = await getAllAttendance();
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.filter(a => a.date === today);
    document.getElementById('workers-present').textContent = todayAttendance.filter(a => a.status === 'present').length;

    const customers = await getCustomers();
    const pendingDeliveries = customers.filter(c => c.needs_delivery && c.delivery_status === 'pending');
    document.getElementById('pending-deliveries').textContent = pendingDeliveries.length;

    const todayTotal = customers.filter(c => c.date === today).reduce((sum, c) => sum + Number(c.amount), 0);
    document.getElementById('cash-received').textContent = 'R' + todayTotal.toLocaleString();

    const expenses = await getExpenses();
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    document.getElementById('petty-cash').textContent = 'R' + totalExpenses.toLocaleString();

    const totalSales = customers.reduce((sum, c) => sum + Number(c.amount), 0);
    const bankBalance = totalSales - totalExpenses;
    document.getElementById('cash-in-bank').textContent = 'R' + bankBalance.toLocaleString();
}

function showDashboard() { showScreen('dashboard-screen'); loadDashboardStats(); }

// Workers
async function showAddWorker() {
    const name = prompt('Worker Name:');
    if (!name) return;
    const role = prompt('Role (e.g., Mason, Driver):');
    if (!role) return;
    await addWorker({ name, role });
    alert('Worker added!');
    showWorkers();
}

async function showWorkers() {
    showScreen('workers-screen');
    const workers = await getWorkers();
    const payDay = parseInt(await getSetting('pay_date') || '25');
    
    const list = document.getElementById('workers-list');
    if (!list) return;
    
    if (workers.length === 0) {
        list.innerHTML = '<p style="text-align:center;color:gray;">No workers added</p>';
        return;
    }
    
    // Get attendance for current period
    const attendance = await getAttendanceForPayPeriod(payDay);
    const payments = await getWorkerPayments();
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7);
    
    list.innerHTML = `<table style="width:100%;border-collapse:collapse">
        <tr style="background:#2c3e50;color:white">
            <th style="padding:10px;text-align:left">Worker</th>
            <th style="padding:10px">Days Worked</th>
            <th style="padding:10px">This Month</th>
            <th style="padding:10px">Action</th>
        </tr>
        ${workers.map(w => {
            const daysWorked = attendance.filter(a => a.worker_id === w.id).length;
            const payment = payments.find(p => p.worker_id === w.id && p.month === currentMonth);
            return `<tr style="border-bottom:1px solid #eee">
                <td style="padding:10px">${w.name}<br><small>${w.role}</small></td>
                <td style="padding:10px;text-align:center">${daysWorked}</td>
                <td style="padding:10px;text-align:center">${payment ? 'R'+payment.amount : '-'}</td>
                <td style="padding:10px;text-align:center">
                    <button onclick="payWorker(${w.id})" style="background:#27ae60;color:white;border:none;padding:5px 10px;border-radius:4px">Pay</button>
                </td>
            </tr>`;
        }).join('')}
    </table>`;
}

async function payWorker(workerId) {
    const worker = await getWorker(workerId);
    const amount = prompt(`Enter payment amount for ${worker.name}:`);
    if (!amount || isNaN(amount)) { alert('Invalid amount'); return; }
    
    const today = new Date();
    const month = today.toISOString().slice(0, 7);
    
    await addWorkerPayment({ worker_id: workerId, amount: Number(amount), month, date: today.toISOString().split('T')[0] });
    
    // Deduct from cash in bank
    const customers = await getCustomers();
    const expenses = await getExpenses();
    const totalSales = customers.reduce((sum, c) => sum + Number(c.amount), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const currentBank = totalSales - totalExpenses;
    
    if (currentBank >= Number(amount)) {
        await addExpense({ description: `Payment to ${worker.name}`, amount: Number(amount), date: today.toISOString().split('T')[0] });
    }
    
    alert(`Paid R${amount} to ${worker.name}`);
    showWorkers();
    loadDashboardStats();
}

async function editWorker(id) {
    const worker = await getWorker(id);
    const name = prompt('Worker Name:', worker?.name || '');
    const role = prompt('Role:', worker?.role || '');
    if (name) { await updateWorker({ ...worker, name, role }); showWorkers(); }
}

async function deleteWorkerRecord(id) {
    if (confirm('Delete this worker?')) { await deleteWorker(id); showWorkers(); }
}

// Attendance
async function showAttendance() {
    showScreen('attendance-screen');
    const payDay = parseInt(await getSetting('pay_date') || '25');
    document.getElementById('pay-date').value = payDay;
    await loadWorkersForAttendance();
    loadAttendance();
}

async function loadWorkersForAttendance() {
    enteredWorkers = await getWorkers();
}

async function loadAttendance() {
    const date = document.getElementById('attendance-date').value || new Date().toISOString().split('T')[0];
    const attendance = await getAttendanceByDate(date);
    const list = document.getElementById('attendance-list');
    if (!list) return;
    if (enteredWorkers.length === 0) { list.innerHTML = '<p style="text-align:center;color:gray;">No workers</p>'; return; }
    list.innerHTML = enteredWorkers.map(w => {
        const record = attendance.find(a => a.worker_id === w.id);
        const isPresent = record && record.status === 'present';
        return `<div class="list-item">
            <div class="list-item-info"><h4>${w.name}</h4><p>${w.role}</p></div>
            <div class="list-item-actions">
                <button class="present-btn ${isPresent ? 'active' : ''}" onclick="markAttendance(${w.id}, 'present')">Present</button>
                <button class="absent-btn ${!isPresent && record ? 'active' : ''}" onclick="markAttendance(${w.id}, 'absent')">Absent</button>
            </div>
        </div>`;
    }).join('');
}

async function markAttendance(workerId, status) {
    const date = document.getElementById('attendance-date').value || new Date().toISOString().split('T')[0];
    await saveAttendance(workerId, date, status);
    loadAttendance();
    loadDashboardStats();
    alert(status === 'present' ? 'Marked Present' : 'Marked Absent');
}

// Cash Received
async function showCustomers() {
    showScreen('customers-screen');
    document.getElementById('customer-search').value = '';
    document.getElementById('customer-filter').value = 'all';
    loadCustomers();
}

function showCashReceived() { showCustomers(); }

async function loadCustomers() {
    const customers = await getCustomers();
    const searchTerm = document.getElementById('customer-search')?.value.toLowerCase() || '';
    const filter = document.getElementById('customer-filter')?.value || 'all';
    let filtered = customers;
    if (searchTerm) {
        filtered = filtered.filter(c => c.name.toLowerCase().includes(searchTerm) || c.date.includes(searchTerm) || (c.address && c.address.toLowerCase().includes(searchTerm)));
    }
    if (filter === 'delivery') filtered = filtered.filter(c => c.needs_delivery && c.delivery_status === 'pending');
    else if (filter === 'delivered') filtered = filtered.filter(c => c.delivery_status === 'delivered');
    const list = document.getElementById('customers-list');
    if (!list) return;
    list.innerHTML = filtered.map(c => {
        const pc = 'product-' + (c.product_type || '').toLowerCase().replace(/\s+/g, '-');
        const badge = c.needs_delivery ? `<span class="delivery-badge delivery-${c.delivery_status}">${c.delivery_status}</span>` : '';
        return `<div class="list-item">
            <div class="list-item-info">
                <h4>${c.name} <span class="customer-product ${pc}">${c.product_type || 'Cash'}</span></h4>
                <p>R${Number(c.amount).toLocaleString()} - ${c.date}</p>
                ${badge}
            </div>
            <div class="list-item-actions">
                ${c.needs_delivery ? `<button class="deliver-btn" onclick="toggleDelivery(${c.id})">${c.delivery_status === 'delivered' ? 'Undo' : 'Deliver'}</button>` : ''}
                <button class="delete-btn" onclick="deleteCustomerRecord(${c.id})">Delete</button>
            </div>
        </div>`;
    }).join('');
}

async function showAddCustomer() {
    const name = prompt('Customer Name:');
    if (!name) return;
    const amount = prompt('Amount Received (R):');
    if (!amount || isNaN(amount)) { alert('Invalid amount'); return; }
    const date = new Date().toISOString().split('T')[0];
    await addCustomer({ name, amount: Number(amount), date, product_type: 'Cash Received' });
    await updateDailySales(date, Number(amount));
    loadCustomers();
    loadDashboardStats();
    alert('Cash recorded!');
}

async function toggleDelivery(id) {
    const customer = await getCustomer(id);
    customer.delivery_status = customer.delivery_status === 'delivered' ? 'pending' : 'delivered';
    await updateCustomer(customer);
    loadCustomers();
    loadDashboardStats();
}

async function deleteCustomerRecord(id) {
    if (confirm('Delete this record?')) { await deleteCustomer(id); loadCustomers(); loadDashboardStats(); }
}

function showCustomersDelivery() {
    showScreen('customers-screen');
    document.getElementById('customer-filter').value = 'delivery';
    loadCustomers();
}

// Expenses
async function showExpenses() {
    showScreen('expenses-screen');
    loadExpenses();
}

async function loadExpenses() {
    const expenses = await getExpenses();
    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const balanceEl = document.getElementById('expense-balance');
    if (balanceEl) balanceEl.textContent = 'R' + total.toLocaleString();
    const list = document.getElementById('expenses-list');
    if (!list) return;
    list.innerHTML = expenses.sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => `<div class="list-item">
        <div class="list-item-info"><h4>${e.description}</h4><p>${e.date}</p></div>
        <div class="list-item-actions">
            <span style="font-weight:bold;color:var(--danger)">-R${Number(e.amount).toLocaleString()}</span>
            <button class="delete-btn" onclick="deleteExpenseRecord(${e.id})">Delete</button>
        </div>
    </div>`).join('');
}

async function showAddExpense() {
    const desc = prompt('Description:');
    if (!desc) return;
    const amount = prompt('Amount (R):');
    if (!amount || isNaN(amount)) { alert('Invalid amount'); return; }
    const date = new Date().toISOString().split('T')[0];
    await addExpense({ description: desc, amount: Number(amount), date });
    loadExpenses();
    loadDashboardStats();
    alert('Expense recorded!');
}

async function deleteExpenseRecord(id) {
    if (confirm('Delete this expense?')) { await deleteExpense(id); loadExpenses(); loadDashboardStats(); }
}

// Reports
async function showReports() {
    showScreen('reports-screen');
    generateReports();
}

async function generateReports() {
    const today = new Date();
    const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const weekStart = startOfWeek.toISOString().split('T')[0];
    const monthStart = startOfMonth.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    const customers = await getCustomers();
    const expenses = await getExpenses();
    const workerPayments = await getWorkerPayments();

    const todayCash = customers.filter(c => c.date === todayStr).reduce((sum, c) => sum + Number(c.amount), 0);
    document.getElementById('today-sales').textContent = 'R' + todayCash.toLocaleString();

    const weeklySales = customers.filter(c => c.date >= weekStart && c.date <= todayStr).reduce((sum, c) => sum + Number(c.amount), 0);
    document.getElementById('weekly-sales').textContent = 'R' + weeklySales.toLocaleString();

    const monthlySales = customers.filter(c => c.date >= monthStart && c.date <= todayStr).reduce((sum, c) => sum + Number(c.amount), 0);
    document.getElementById('monthly-sales').textContent = 'R' + monthlySales.toLocaleString();

    const weeklyExp = expenses.filter(e => e.date >= weekStart && e.date <= todayStr).reduce((sum, e) => sum + Number(e.amount), 0);
    document.getElementById('weekly-expenses').textContent = 'R' + weeklyExp.toLocaleString();

    const monthlyExp = expenses.filter(e => e.date >= monthStart && e.date <= todayStr).reduce((sum, e) => sum + Number(e.amount), 0);
    document.getElementById('monthly-expenses').textContent = 'R' + monthlyExp.toLocaleString();

    // Cash in bank after worker payments
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalWorkerPay = workerPayments.filter(p => p.month === today.toISOString().slice(0,7)).reduce((sum, p) => sum + Number(p.amount), 0);
    const bankBalance = monthlySales - monthlyExp - totalWorkerPay;
    document.getElementById('bank-balance').textContent = 'R' + bankBalance.toLocaleString();

    const profit = monthlySales - monthlyExp - totalWorkerPay;
    const profitEl = document.getElementById('monthly-profit');
    profitEl.textContent = (profit >= 0 ? '+' : '') + 'R' + profit.toLocaleString();
    profitEl.style.color = profit >= 0 ? '#27ae60' : '#e74c3c';
}

function showBankBalance() { showReports(); }

function showSettings() { showScreen('settings-screen'); }

async function changePIN() {
    const current = prompt('Enter current PIN:');
    const stored = await getSetting('pin');
    if (current !== stored) { alert('Incorrect PIN'); return; }
    const newPIN = prompt('Enter new 4-digit PIN:');
    if (newPIN && newPIN.length === 4) { await setSetting('pin', newPIN); alert('PIN changed!'); }
    else { alert('PIN must be 4 digits'); }
}

async function exportData() {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'brickmanager-backup.json'; a.click();
    URL.revokeObjectURL(url);
    alert('Data exported!');
}

async function resetApp() {
    if (confirm('Delete ALL data? This cannot be undone.')) {
        await clearAllData();
        alert('App reset!'); location.reload();
    }
}

function logout() { location.reload(); }

async function updatePayDate() {
    const payDate = document.getElementById('pay-date').value;
    await setSetting('pay_date', payDate);
    alert('Pay day updated to ' + payDate + 'th!');
    showWorkers();
}

function setupTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => { if (!input.value) input.value = today; });
    const ad = document.getElementById('attendance-date');
    if (ad) ad.value = today;
}

console.log('App loaded');