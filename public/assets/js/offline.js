// ═══════════════════════════════════════════
//  HybridPOS — Cache Manager (Fast Loading)
// ═══════════════════════════════════════════

const OfflineDB = {
    db:       null,
    ready:    false,
    DB_NAME:  'hybridpos_cache',
    DB_VERSION: 1,

    async init() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            req.onupgradeneeded = e => {
                const db = e.target.result;

                if (!db.objectStoreNames.contains('products_cache')) {
                    db.createObjectStore('products_cache', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('categories_cache')) {
                    db.createObjectStore('categories_cache', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('customers_cache')) {
                    db.createObjectStore('customers_cache', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('settings_cache')) {
                    db.createObjectStore('settings_cache', { keyPath: 'key' });
                }
            };

            req.onsuccess = e => {
                this.db    = e.target.result;
                this.ready = true;
                console.log('[OfflineDB] Initialized');
                resolve(this.db);
            };

            req.onerror = () => reject(req.error);
        });
    },

    // ── Generic helpers ──────────────────
    async getAll(storeName) {
        return new Promise((resolve) => {
            try {
                const tx    = this.db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const req   = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror   = () => resolve([]);
            } catch (e) {
                resolve([]);
            }
        });
    },

    async get(storeName, key) {
        return new Promise((resolve) => {
            try {
                const tx    = this.db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const req   = store.get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror   = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    },

    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            try {
                const tx    = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const req   = store.put(data);
                req.onsuccess = () => resolve(req.result);
                req.onerror   = () => reject(req.error);
            } catch (e) {
                reject(e);
            }
        });
    },

    async clear(storeName) {
        return new Promise((resolve) => {
            try {
                const tx    = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const req   = store.clear();
                req.onsuccess = () => resolve();
                req.onerror   = () => resolve();
            } catch (e) {
                resolve();
            }
        });
    },

    // ── Products ─────────────────────────
    async cacheProducts(products) {
        await this.clear('products_cache');
        for (const p of products) await this.put('products_cache', p);
        console.log(`[OfflineDB] Cached ${products.length} products`);
    },

    async getCachedProducts() {
        return this.getAll('products_cache');
    },

    // ── Categories ───────────────────────
    async cacheCategories(categories) {
        await this.clear('categories_cache');
        for (const c of categories) await this.put('categories_cache', c);
        console.log(`[OfflineDB] Cached ${categories.length} categories`);
    },

    async getCachedCategories() {
        return this.getAll('categories_cache');
    },

    // ── Customers ────────────────────────
    async cacheCustomers(customers) {
        await this.clear('customers_cache');
        for (const c of customers) await this.put('customers_cache', c);
        console.log(`[OfflineDB] Cached ${customers.length} customers`);
    },

    async getCachedCustomers() {
        return this.getAll('customers_cache');
    },

    // ── Settings ─────────────────────────
    async saveSettings(settings) {
        await this.put('settings_cache', { key: 'store_settings', ...settings });
    },

    async getSettings() {
        return this.get('settings_cache', 'store_settings');
    },
};

// ═══════════════════════════════════════════
//  Cache Manager — Populates IndexedDB
// ═══════════════════════════════════════════
const SyncManager = {

    async init() {
        try {
            await OfflineDB.init();
            console.log('[SyncManager] Ready');
        } catch (e) {
            console.warn('[SyncManager] Init failed:', e);
        }
    },

    async cacheAllData() {
        if (!navigator.onLine) return;
        if (!localStorage.getItem('pos_token')) return;

        try {
            const [prodRes, catRes, custRes, settingsRes] = await Promise.all([
                API.get('/products'),
                API.get('/categories'),
                API.get('/customers'),
                API.get('/settings'),
            ]);

            if (prodRes?.success)     await OfflineDB.cacheProducts(prodRes.data);
            if (catRes?.success)      await OfflineDB.cacheCategories(catRes.data);
            if (custRes?.success)     await OfflineDB.cacheCustomers(custRes.data);
            if (settingsRes?.success) await OfflineDB.saveSettings(settingsRes.data);

            console.log('[SyncManager] All data cached for fast loading');
        } catch (e) {
            console.warn('[SyncManager] Cache failed:', e);
        }
    },

    updateSyncStatus(state) {
        const el = document.getElementById('sync-status');
        if (!el) return;
        const states = {
            online:  { class: 'sync-status',        icon: 'check-circle',       text: 'Synced'  },
            offline: { class: 'sync-status offline', icon: 'exclamation-circle', text: 'Offline' },
        };
        const s      = states[state] || states.online;
        el.className = s.class;
        el.innerHTML = `<i class="fas fa-${s.icon}"></i><span>${s.text}</span>`;
    },
};