// ═══════════════════════════════════════════
//  HybridPOS — Full Offline Engine
// ═══════════════════════════════════════════

const OfflineDB = {
    db:         null,
    ready:      false,
    DB_NAME:    'hybridpos_offline',
    DB_VERSION: 2,

    async init() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            req.onupgradeneeded = e => {
                const db = e.target.result;

                if (!db.objectStoreNames.contains('pending_orders')) {
                    const store = db.createObjectStore('pending_orders', {
                        keyPath: 'local_id', autoIncrement: true
                    });
                    store.createIndex('status', 'status', { unique: false });
                }

                if (!db.objectStoreNames.contains('products_cache')) {
                    db.createObjectStore('products_cache', { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('categories_cache')) {
                    db.createObjectStore('categories_cache', { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('customers_cache')) {
                    db.createObjectStore('customers_cache', { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('auth_cache')) {
                    db.createObjectStore('auth_cache', { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains('settings_cache')) {
                    db.createObjectStore('settings_cache', { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains('offline_orders')) {
                    const offStore = db.createObjectStore('offline_orders', {
                        keyPath: 'local_id', autoIncrement: true
                    });
                    offStore.createIndex('status', 'status', { unique: false });
                    offStore.createIndex('created_at', 'created_at', { unique: false });
                }
            };

            req.onsuccess = e => {
                this.db    = e.target.result;
                this.ready = true;
                console.log('[OfflineDB] Initialized v2');
                resolve(this.db);
            };

            req.onerror = () => reject(req.error);
        });
    },

    // ── Generic helpers ──────────────────
    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            try {
                const tx    = this.db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const req   = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror   = () => reject(req.error);
            } catch (e) {
                resolve([]);
            }
        });
    },

    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            try {
                const tx    = this.db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const req   = store.get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror   = () => reject(req.error);
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

    async delete(storeName, key) {
        return new Promise((resolve, reject) => {
            try {
                const tx    = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const req   = store.delete(key);
                req.onsuccess = () => resolve();
                req.onerror   = () => reject(req.error);
            } catch (e) {
                resolve();
            }
        });
    },

    async clear(storeName) {
        return new Promise((resolve, reject) => {
            try {
                const tx    = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const req   = store.clear();
                req.onsuccess = () => resolve();
                req.onerror   = () => reject(req.error);
            } catch (e) {
                resolve();
            }
        });
    },

    // ── Auth Cache ───────────────────────
    async saveAuth(user, token, passwordHash) {
        await this.put('auth_cache', {
            key:           'current_user',
            user,
            token,
            password_hash: passwordHash,
            cached_at:     new Date().toISOString(),
        });
        console.log('[OfflineDB] Auth cached for', user.name);
    },

    async getAuth() {
        return this.get('auth_cache', 'current_user');
    },

    async clearAuth() {
        await this.delete('auth_cache', 'current_user');
    },

    // ── Settings Cache ───────────────────
    async saveSettings(settings) {
        await this.put('settings_cache', { key: 'store_settings', ...settings });
    },

    async getSettings() {
        return this.get('settings_cache', 'store_settings');
    },

    // ── Product/Category/Customer Cache ──
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

    async getCachedProducts()   { return this.getAll('products_cache');   },
    async getCachedCategories() { return this.getAll('categories_cache'); },
    async getCachedCustomers()  { return this.getAll('customers_cache');  },

    // ── Offline Orders ───────────────────
    async queueOrder(orderData) {
        const localOrderNum = 'OFF-' + Date.now();
        const entry = {
            ...orderData,
            status:       'pending',
            order_number: localOrderNum,
            created_at:   new Date().toISOString(),
            is_offline:   true,
        };
        const localId = await this.put('offline_orders', entry);
        console.log('[OfflineDB] Order queued:', localOrderNum);
        return { ...entry, local_id: localId };
    },

    async getPendingOrders() {
        const all = await this.getAll('offline_orders');
        return all.filter(o => o.status === 'pending');
    },

    async markOrderSynced(localId, serverOrderNumber) {
        const all   = await this.getAll('offline_orders');
        const order = all.find(o => o.local_id === localId);
        if (order) {
            order.status              = 'synced';
            order.server_order_number = serverOrderNumber;
            order.synced_at           = new Date().toISOString();
            await this.put('offline_orders', order);
        }
    },

    async markOrderFailed(localId, error) {
        const all   = await this.getAll('offline_orders');
        const order = all.find(o => o.local_id === localId);
        if (order) {
            order.attempts  = (order.attempts || 0) + 1;
            order.last_error = error;
            if (order.attempts >= 3) order.status = 'failed';
            await this.put('offline_orders', order);
        }
    },

    async getPendingCount() {
        const pending = await this.getPendingOrders();
        return pending.length;
    },

    // ── Offline Stock Management ─────────
    async deductStock(productId, quantity) {
        const products = await this.getCachedProducts();
        const product  = products.find(p => p.id === productId);
        if (product && product.track_stock) {
            product.stock_qty = Math.max(0, parseFloat(product.stock_qty) - quantity);
            await this.put('products_cache', product);
        }
    },
};

// ═══════════════════════════════════════════
//  Offline Auth Manager
// ═══════════════════════════════════════════
const OfflineAuth = {
    // Simple hash comparison for offline login
    async verifyPassword(inputPassword, cachedHash) {
        if (cachedHash.secure && window.crypto?.subtle) {
            // Secure hash verification
            const encoder = new TextEncoder();
            const data    = encoder.encode(inputPassword + cachedHash.salt);
            const hashBuf = await crypto.subtle.digest('SHA-256', data);
            const hashArr = Array.from(new Uint8Array(hashBuf));
            const hashHex = hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex === cachedHash.hash;
        } else {
            // Simple hash verification
            let hash = 0;
            const str = inputPassword + cachedHash.salt;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(16) === cachedHash.hash;
        }
    },

    async cacheLoginCredentials(user, token, password) {
        let passwordHash;

        if (window.crypto?.subtle && window.isSecureContext) {
            // HTTPS — use proper crypto
            const salt    = crypto.getRandomValues(new Uint8Array(16));
            const saltHex = Array.from(salt)
                .map(b => b.toString(16).padStart(2, '0')).join('');
            const encoder = new TextEncoder();
            const data    = encoder.encode(password + saltHex);
            const hashBuf = await crypto.subtle.digest('SHA-256', data);
            const hashArr = Array.from(new Uint8Array(hashBuf));
            const hashHex = hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
            passwordHash  = { hash: hashHex, salt: saltHex, secure: true };
        } else {
            // HTTP fallback — simple hash
            const saltHex = Math.random().toString(36).substring(2);
            let hash = 0;
            const str = password + saltHex;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            passwordHash = {
                hash:    Math.abs(hash).toString(16),
                salt:    saltHex,
                secure:  false,
            };
        }

        await OfflineDB.saveAuth(user, token, passwordHash);
        console.log('[OfflineAuth] Credentials cached');
    },

    async attemptOfflineLogin(email, password) {
        const cached = await OfflineDB.getAuth();
        if (!cached) {
            throw new Error('No offline credentials cached. Please login online first.');
        }

        if (cached.user.email !== email) {
            throw new Error('Email not recognized in offline mode.');
        }

        const valid = await this.verifyPassword(password, cached.password_hash);
        if (!valid) {
            throw new Error('Incorrect password.');
        }

        return {
            user:  cached.user,
            token: cached.token,
        };
    }
};

// ═══════════════════════════════════════════
//  Sync Manager
// ═══════════════════════════════════════════
const SyncManager = {
    isSyncing: false,

    async init() {
        await OfflineDB.init();
        await this.cacheAllData();
        this.updatePendingBadge();

        window.addEventListener('online', async () => {
            console.log('[SyncManager] Back online — syncing...');
            this.updateSyncStatus('syncing');
            await this.cacheAllData();
            await this.syncPendingOrders();
        });

        window.addEventListener('offline', () => {
            this.updateSyncStatus('offline');
            Toast.show('You are now offline. Sales will be queued.', 'warning', 5000);
        });
    },

    async cacheAllData() {
        if (!navigator.onLine) return;
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

            this.updateSyncStatus('online');
            console.log('[SyncManager] All data cached');
        } catch (e) {
            console.warn('[SyncManager] Cache failed:', e);
        }
    },

    async syncPendingOrders() {
        if (this.isSyncing || !navigator.onLine) return;
        const pending = await OfflineDB.getPendingOrders();
        if (!pending.length) {
            this.updateSyncStatus('online');
            return;
        }

        this.isSyncing = true;
        this.updateSyncStatus('syncing');
        Toast.show(`Syncing ${pending.length} offline order(s)...`, 'info', 3000);

        let synced  = 0;
        let failed  = 0;

        for (const order of pending) {
            try {
                // Remove local fields before sending
                const { local_id, is_offline, status, ...orderData } = order;
                const res = await API.post('/orders', orderData);

                if (res?.success) {
                    await OfflineDB.markOrderSynced(local_id, res.data.order_number);
                    synced++;
                } else {
                    await OfflineDB.markOrderFailed(local_id, res?.message);
                    failed++;
                }
            } catch (e) {
                await OfflineDB.markOrderFailed(order.local_id, e.message);
                failed++;
            }
        }

        this.isSyncing = false;
        this.updateSyncStatus('online');
        this.updatePendingBadge();

        if (synced > 0) {
            Toast.show(`✅ ${synced} offline order(s) synced!`, 'success', 4000);
            // Refresh products to update stock
            const prodRes = await API.get('/products');
            if (prodRes?.success) await OfflineDB.cacheProducts(prodRes.data);
        }
        if (failed > 0) {
            Toast.show(`⚠️ ${failed} order(s) failed to sync`, 'warning', 5000);
        }
    },

    updateSyncStatus(state) {
        const el = document.getElementById('sync-status');
        if (!el) return;
        const states = {
            online:  { class: 'sync-status',        icon: 'check-circle',       text: 'Synced'     },
            offline: { class: 'sync-status offline', icon: 'exclamation-circle', text: 'Offline'    },
            syncing: { class: 'sync-status syncing', icon: 'spinner fa-spin',    text: 'Syncing...' },
        };
        const s      = states[state] || states.online;
        el.className = s.class;
        el.innerHTML = `<i class="fas fa-${s.icon}"></i><span>${s.text}</span>`;
    },

    async updatePendingBadge() {
        const count = await OfflineDB.getPendingCount();
        const badge = document.getElementById('pending-badge');
        if (!badge) return;
        badge.textContent   = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
};