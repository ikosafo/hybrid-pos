// ═══════════════════════════════════════════
//  HybridPOS — Offline Storage (IndexedDB)
// ═══════════════════════════════════════════

const OfflineDB = {
    db: null,
    DB_NAME:    'hybridpos_offline',
    DB_VERSION: 1,

    async init() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            req.onupgradeneeded = e => {
                const db = e.target.result;

                // Offline orders queue
                if (!db.objectStoreNames.contains('pending_orders')) {
                    const store = db.createObjectStore('pending_orders', {
                        keyPath: 'local_id', autoIncrement: true
                    });
                    store.createIndex('status', 'status', { unique: false });
                }

                // Cached products
                if (!db.objectStoreNames.contains('products_cache')) {
                    db.createObjectStore('products_cache', { keyPath: 'id' });
                }

                // Cached categories
                if (!db.objectStoreNames.contains('categories_cache')) {
                    db.createObjectStore('categories_cache', { keyPath: 'id' });
                }

                // Cached customers
                if (!db.objectStoreNames.contains('customers_cache')) {
                    db.createObjectStore('customers_cache', { keyPath: 'id' });
                }
            };

            req.onsuccess = e => {
                this.db = e.target.result;
                console.log('[OfflineDB] Initialized');
                resolve(this.db);
            };

            req.onerror = () => reject(req.error);
        });
    },

    // ── Generic helpers ──────────────────
    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const tx    = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req   = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror   = () => reject(req.error);
        });
    },

    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const tx    = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req   = store.put(data);
            req.onsuccess = () => resolve(req.result);
            req.onerror   = () => reject(req.error);
        });
    },

    async delete(storeName, key) {
        return new Promise((resolve, reject) => {
            const tx    = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req   = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror   = () => reject(req.error);
        });
    },

    async clear(storeName) {
        return new Promise((resolve, reject) => {
            const tx    = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req   = store.clear();
            req.onsuccess = () => resolve();
            req.onerror   = () => reject(req.error);
        });
    },

    // ── Cache products/categories/customers ──
    async cacheProducts(products) {
        await this.clear('products_cache');
        for (const p of products) await this.put('products_cache', p);
        console.log(`[OfflineDB] Cached ${products.length} products`);
    },

    async cacheCategories(categories) {
        await this.clear('categories_cache');
        for (const c of categories) await this.put('categories_cache', c);
        console.log(`[OfflineDB] Cached ${categories.length} categories`);
    },

    async cacheCustomers(customers) {
        await this.clear('customers_cache');
        for (const c of customers) await this.put('customers_cache', c);
        console.log(`[OfflineDB] Cached ${customers.length} customers`);
    },

    async getCachedProducts()   { return this.getAll('products_cache'); },
    async getCachedCategories() { return this.getAll('categories_cache'); },
    async getCachedCustomers()  { return this.getAll('customers_cache'); },

    // ── Pending Orders ───────────────────
    async queueOrder(orderData) {
        const entry = {
            ...orderData,
            status:     'pending',
            created_at: new Date().toISOString(),
            order_number: 'OFF-' + Date.now(),
        };
        const id = await this.put('pending_orders', entry);
        console.log('[OfflineDB] Order queued:', id);
        return entry;
    },

    async getPendingOrders() {
        const all = await this.getAll('pending_orders');
        return all.filter(o => o.status === 'pending');
    },

    async markOrderSynced(localId) {
        const all   = await this.getAll('pending_orders');
        const order = all.find(o => o.local_id === localId);
        if (order) {
            order.status = 'synced';
            await this.put('pending_orders', order);
        }
    },

    async getPendingCount() {
        const pending = await this.getPendingOrders();
        return pending.length;
    }
};

// ── Sync Manager ─────────────────────────
const SyncManager = {
    isSyncing: false,

    async init() {
        await OfflineDB.init();
        await this.cacheAllData();
        window.addEventListener('online', () => this.syncPendingOrders());
        this.updatePendingBadge();
    },

    async cacheAllData() {
        if (!navigator.onLine) return;
        try {
            const [prodRes, catRes, custRes] = await Promise.all([
                API.get('/products'),
                API.get('/categories'),
                API.get('/customers'),
            ]);
            if (prodRes?.success) await OfflineDB.cacheProducts(prodRes.data);
            if (catRes?.success)  await OfflineDB.cacheCategories(catRes.data);
            if (custRes?.success) await OfflineDB.cacheCustomers(custRes.data);
        } catch (e) {
            console.warn('[SyncManager] Cache failed:', e);
        }
    },

    async syncPendingOrders() {
        if (this.isSyncing || !navigator.onLine) return;
        const pending = await OfflineDB.getPendingOrders();
        if (!pending.length) return;

        this.isSyncing = true;
        this.updateSyncStatus('syncing');
        Toast.show(`Syncing ${pending.length} offline order(s)...`, 'info');

        let synced = 0;
        for (const order of pending) {
            try {
                const res = await API.post('/orders', order);
                if (res?.success) {
                    await OfflineDB.markOrderSynced(order.local_id);
                    synced++;
                }
            } catch (e) {
                console.error('[SyncManager] Failed to sync order:', e);
            }
        }

        this.isSyncing = false;
        this.updateSyncStatus('online');
        this.updatePendingBadge();

        if (synced > 0) {
            Toast.show(`${synced} offline order(s) synced successfully!`, 'success');
        }
    },

    updateSyncStatus(state) {
        const el = document.getElementById('sync-status');
        if (!el) return;
        const states = {
            online:  { class: 'sync-status',         icon: 'check-circle',        text: 'Synced' },
            offline: { class: 'sync-status offline',  icon: 'exclamation-circle',  text: 'Offline' },
            syncing: { class: 'sync-status syncing',  icon: 'spinner fa-spin',     text: 'Syncing...' },
        };
        const s     = states[state] || states.online;
        el.className = s.class;
        el.innerHTML = `<i class="fas fa-${s.icon}"></i><span>${s.text}</span>`;
    },

    async updatePendingBadge() {
        const count = await OfflineDB.getPendingCount();
        const badge = document.getElementById('pending-badge');
        if (!badge) return;
        if (count > 0) {
            badge.textContent    = count;
            badge.style.display  = 'inline-block';
        } else {
            badge.style.display  = 'none';
        }
    }
};