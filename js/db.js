// IndexedDB Database for BrickManager

const DB_NAME = 'BrickManagerDB';
const DB_VERSION = 1;
let db = null;

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { db = request.result; resolve(db); };
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains('workers')) {
                const ws = database.createObjectStore('workers', { keyPath: 'id', autoIncrement: true });
                ws.createIndex('name', 'name', { unique: false });
            }
            if (!database.objectStoreNames.contains('attendance')) {
                const as = database.createObjectStore('attendance', { keyPath: 'id', autoIncrement: true });
                as.createIndex('worker_id', 'worker_id', { unique: false });
                as.createIndex('date', 'date', { unique: false });
            }
            if (!database.objectStoreNames.contains('customers')) {
                const cs = database.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
                cs.createIndex('name', 'name', { unique: false });
                cs.createIndex('date', 'date', { unique: false });
            }
            if (!database.objectStoreNames.contains('expenses')) {
                const es = database.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
                es.createIndex('date', 'date', { unique: false });
            }
            if (!database.objectStoreNames.contains('daily_sales')) {
                const ds = database.createObjectStore('daily_sales', { keyPath: 'id', autoIncrement: true });
                ds.createIndex('date', 'date', { unique: false });
            }
            if (!database.objectStoreNames.contains('settings')) {
                database.createObjectStore('settings', { keyPath: 'key' });
            }
        };
    });
}

function getAll(storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getById(storeName, id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(Number(id));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function add(storeName, data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        data.created_at = new Date().toISOString();
        const request = store.add(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function update(storeName, data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function remove(storeName, id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(Number(id));
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Workers
async function getWorkers() { return getAll('workers'); }
async function getWorker(id) { return getById('workers', id); }
async function addWorker(data) { return add('workers', data); }
async function updateWorker(data) { return update('workers', data); }
async function deleteWorker(id) { return remove('workers', id); }

// Attendance
async function getAttendanceByDate(date) {
    const all = await getAll('attendance');
    return all.filter(a => a.date === date);
}
async function getAllAttendance() { return getAll('attendance'); }
async function getAttendanceByWorkerAndDate(workerId, date) {
    const all = await getAll('attendance');
    return all.find(a => a.worker_id === Number(workerId) && a.date === date);
}
async function saveAttendance(workerId, date, status) {
    const existing = await getAttendanceByWorkerAndDate(workerId, date);
    if (existing) return update('attendance', { ...existing, status });
    return add('attendance', { worker_id: workerId, date, status });
}
async function deleteAllAttendance() {
    const all = await getAll('attendance');
    for (const item of all) await remove('attendance', item.id);
}

// Customers (Cash Received)
async function getCustomers() { return getAll('customers'); }
async function getCustomer(id) { return getById('customers', id); }
async function addCustomer(data) { return add('customers', data); }
async function updateCustomer(data) { return update('customers', data); }
async function deleteCustomer(id) { return remove('customers', id); }

// Expenses (Petty Cash)
async function getExpenses() { return getAll('expenses'); }
async function addExpense(data) { return add('expenses', data); }
async function deleteExpense(id) { return remove('expenses', id); }

// Daily Sales
async function getDailySales() { return getAll('daily_sales'); }
async function getDailySalesByDate(date) {
    const all = await getDailySales();
    return all.find(s => s.date === date);
}
async function updateDailySales(date, amount) {
    const existing = await getDailySalesByDate(date);
    if (existing) {
        return update('daily_sales', { ...existing, amount: existing.amount + amount });
    }
    return add('daily_sales', { date, amount });
}

// Settings
async function getSetting(key) { return localStorage.getItem('brick_' + key); }
async function setSetting(key, value) { localStorage.setItem('brick_' + key, value); }

// Clear all
async function clearAllData() {
    localStorage.removeItem('brick_pin');
    localStorage.removeItem('brick_logged_in');
    const req = indexedDB.deleteDatabase('BrickManagerDB');
    req.onsuccess = () => console.log('DB deleted');
}

// Export
async function exportAllData() {
    const workers = await getWorkers();
    const attendance = await getAllAttendance();
    const customers = await getCustomers();
    const expenses = await getExpenses();
    const dailySales = await getDailySales();
    return { exportDate: new Date().toISOString(), workers, attendance, customers, expenses, dailySales };
}

async function checkAndResetAttendance() {
    const payDate = await getSetting('pay_date') || '25';
    const today = new Date();
    if (Number(today.getDate()) >= Number(payDate)) {
        await deleteAllAttendance();
    }
}

console.log('Database module loaded');