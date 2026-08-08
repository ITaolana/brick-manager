// IndexedDB Database for BrickManager
// Local-only storage (no Firebase)

const DB_NAME = 'BrickManagerDB';
const DB_VERSION = 1;
let db = null;

// Initialize Database
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            if (!database.objectStoreNames.contains('workers')) {
                const workerStore = database.createObjectStore('workers', { keyPath: 'id', autoIncrement: true });
                workerStore.createIndex('name', 'name', { unique: false });
            }

            if (!database.objectStoreNames.contains('attendance')) {
                const attendStore = database.createObjectStore('attendance', { keyPath: 'id', autoIncrement: true });
                attendStore.createIndex('worker_id', 'worker_id', { unique: false });
                attendStore.createIndex('date', 'date', { unique: false });
            }

            if (!database.objectStoreNames.contains('customers')) {
                const custStore = database.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
                custStore.createIndex('name', 'name', { unique: false });
                custStore.createIndex('payment_date', 'payment_date', { unique: false });
            }

            if (!database.objectStoreNames.contains('expenses')) {
                const expStore = database.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
                expStore.createIndex('date', 'date', { unique: false });
            }

            if (!database.objectStoreNames.contains('settings')) {
                database.createObjectStore('settings', { keyPath: 'key' });
            }
        };
    });
}

// Generic CRUD
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

async function getAttendanceByWorkerAndDate(workerId, date) {
    const all = await getAll('attendance');
    return all.find(a => a.worker_id === Number(workerId) && a.date === date);
}

async function saveAttendance(workerId, date, status) {
    const existing = await getAttendanceByWorkerAndDate(workerId, date);
    if (existing) {
        return update('attendance', { ...existing, status });
    } else {
        return add('attendance', { worker_id: workerId, date, status });
    }
}

async function getAllAttendance() { return getAll('attendance'); }

async function deleteAllAttendance() {
    const all = await getAll('attendance');
    for (const item of all) {
        await remove('attendance', item.id);
    }
}

// Customers
async function getCustomers() { return getAll('customers'); }
async function getCustomer(id) { return getById('customers', id); }
async function addCustomer(data) { return add('customers', data); }
async function updateCustomer(data) { return update('customers', data); }
async function deleteCustomer(id) { return remove('customers', id); }

// Expenses
async function getExpenses() { return getAll('expenses'); }
async function addExpense(data) { return add('expenses', data); }
async function deleteExpense(id) { return remove('expenses', id); }

// Settings - use localStorage for simplicity
async function getSetting(key) {
    return localStorage.getItem('brick_' + key);
}

async function setSetting(key, value) {
    localStorage.setItem('brick_' + key, value);
}

// Clear all
async function clearAllData() {
    // Clear localStorage settings
    localStorage.removeItem('brick_pin');
    // Clear IndexedDB
    const req = indexedDB.deleteDatabase('BrickManagerDB');
    req.onsuccess = () => console.log('DB deleted');
}

// Export
async function exportAllData() {
    const workers = await getWorkers();
    const attendance = await getAllAttendance();
    const customers = await getCustomers();
    const expenses = await getExpenses();
    const payDate = await getSetting('pay_date');

    return {
        exportDate: new Date().toISOString(),
        workers,
        attendance,
        customers,
        expenses,
        settings: { pay_date: payDate }
    };
}

async function checkAndResetAttendance() {
    const payDate = await getSetting('pay_date') || '25';
    const today = new Date();
    const currentDay = today.getDate();
    
    if (Number(currentDay) >= Number(payDate)) {
        await deleteAllAttendance();
    }
}

console.log('Database module loaded');