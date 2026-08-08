// IndexedDB + Firebase Sync for BrickManager
// Offline-first with real-time sync

const DB_NAME = 'BrickManagerDB';
const DB_VERSION = 1;
let db = null;
let firestore = null;
let firebaseSyncing = false;

// Firebase config - load from server or environment
// For production, use a backend to proxy requests
let firebaseConfig = null;

async function loadFirebaseConfig() {
    // Try to load from localStorage (set after admin configures)
    const stored = localStorage.getItem('firebaseConfig');
    if (stored) {
        return JSON.parse(stored);
    }
    return null;
}

async function configureFirebase(config) {
    firebaseConfig = config;
    localStorage.setItem('firebaseConfig', JSON.stringify(config));
    await initFirebase();
}

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

// Initialize Firebase
async function initFirebase() {
    if (!firebaseConfig) {
        const config = await loadFirebaseConfig();
        if (!config) {
            console.log('Firebase not configured - running in offline mode');
            return;
        }
        firebaseConfig = config;
    }
    
    try {
        firebase.initializeApp(firebaseConfig);
        firestore = firebase.firestore();
        
        // Enable offline persistence
        await firestore.enablePersistence({ synchronizeTabs: true });
        
        console.log('Firebase initialized with offline persistence');
        startFirebaseSync();
    } catch (e) {
        console.log('Firebase init failed (may be offline):', e.message);
    }
}

// Generic CRUD - Local IndexedDB
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
        request.onsuccess = () => {
            resolve(request.result);
            syncToFirebase(storeName);
        };
        request.onerror = () => reject(request.error);
    });
}

function update(storeName, data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => {
            resolve(request.result);
            syncToFirebase(storeName);
        };
        request.onerror = () => reject(request.error);
    });
}

function remove(storeName, id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(Number(id));
        request.onsuccess = () => {
            resolve();
            syncToFirebase(storeName);
        };
        request.onerror = () => reject(request.error);
    });
}

// Firebase Sync
async function syncToFirebase(storeName) {
    if (!firestore || firebaseSyncing) return;
    
    try {
        const items = await getAll(storeName);
        const docRef = firestore.collection(storeName).doc('data');
        await docRef.set({ items, lastSync: new Date().toISOString() });
    } catch (e) {
        console.log('Sync failed:', e.message);
    }
}

async function syncFromFirebase(storeName) {
    if (!firestore || firebaseSyncing) return;
    
    try {
        const doc = await firestore.collection(storeName).doc('data').get();
        if (doc.exists) {
            const data = doc.data();
            if (data.items) {
                // Merge with local
                const localItems = await getAll(storeName);
                const localIds = new Set(localItems.map(i => i.id));
                
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                
                for (const item of data.items) {
                    if (!localIds.has(item.id)) {
                        store.put(item);
                    }
                }
                console.log(`Synced ${storeName} from Firebase`);
            }
        }
    } catch (e) {
        console.log('Sync from Firebase failed:', e.message);
    }
}

function startFirebaseSync() {
    if (!firestore) return;
    
    // Sync all stores on load
    ['workers', 'customers', 'expenses', 'settings'].forEach(store => {
        syncFromFirebase(store);
        
        // Listen for real-time changes
        firestore.collection(store).doc('data').onSnapshot((doc) => {
            if (doc.exists && !firebaseSyncing) {
                firebaseSyncing = true;
                const data = doc.data();
                if (data.items) {
                    mergeFromFirebase(store, data.items);
                }
                setTimeout(() => firebaseSyncing = false, 1000);
            }
        });
    });
}

async function mergeFromFirebase(storeName, firebaseItems) {
    const localItems = await getAll(storeName);
    const localMap = new Map(localItems.map(i => [i.id, i]));
    
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    for (const item of firebaseItems) {
        const local = localMap.get(item.id);
        if (!local || new Date(item.updated_at || 0) > new Date(local.updated_at || 0)) {
            store.put(item);
        }
    }
}

// Workers
async function getWorkers() {
    return getAll('workers');
}

async function getWorker(id) {
    return getById('workers', id);
}

async function addWorker(data) {
    data.updated_at = new Date().toISOString();
    return add('workers', data);
}

async function updateWorker(data) {
    data.updated_at = new Date().toISOString();
    return update('workers', data);
}

async function deleteWorker(id) {
    return remove('workers', id);
}

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
        return update('attendance', { ...existing, status, updated_at: new Date().toISOString() });
    } else {
        return add('attendance', { worker_id: workerId, date, status, updated_at: new Date().toISOString() });
    }
}

async function getAllAttendance() {
    return getAll('attendance');
}

async function deleteAllAttendance() {
    const all = await getAll('attendance');
    for (const item of all) {
        await remove('attendance', item.id);
    }
    syncToFirebase('attendance');
}

// Customers
async function getCustomers() {
    return getAll('customers');
}

async function getCustomer(id) {
    return getById('customers', id);
}

async function addCustomer(data) {
    data.updated_at = new Date().toISOString();
    return add('customers', data);
}

async function updateCustomer(data) {
    data.updated_at = new Date().toISOString();
    return update('customers', data);
}

async function deleteCustomer(id) {
    return remove('customers', id);
}

// Expenses
async function getExpenses() {
    return getAll('expenses');
}

async function addExpense(data) {
    data.updated_at = new Date().toISOString();
    return add('expenses', data);
}

async function deleteExpense(id) {
    return remove('expenses', id);
}

// Settings
async function getSetting(key) {
    const item = await getById('settings', key);
    return item ? item.value : null;
}

async function setSetting(key, value) {
    return update('settings', { key, value, updated_at: new Date().toISOString() });
}

// Clear all
async function clearAllData() {
    const stores = ['workers', 'attendance', 'customers', 'expenses', 'settings'];
    for (const store of stores) {
        const items = await getAll(store);
        for (const item of items) {
            await remove(store, item.id);
        }
    }
    if (firestore) {
        for (const store of stores) {
            await firestore.collection(store).doc('data').delete();
        }
    }
}

// Export
async function exportAllData() {
    const workers = await getWorkers();
    const attendance = await getAllAttendance();
    const customers = await getCustomers();
    const expenses = await getExpenses();
    const payDate = await getSetting('pay_date');
    const pin = await getSetting('pin');

    return {
        exportDate: new Date().toISOString(),
        workers,
        attendance,
        customers,
        expenses,
        settings: { pay_date: payDate, pin_hash: pin ? '***' : null }
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

console.log('Database module loaded with Firebase sync');