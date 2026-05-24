// ═══════════════════════════════════════════
//  HybridPOS — Sync Engine
//  Bidirectional sync between
//  hybridpos.local ↔ bestcobb.shop
// ═══════════════════════════════════════════

const SyncEngine = {
    LIVE_URL:      'https://bestcobb.shop/public/api',
    SYNC_KEY:      'hybridpos-sync-key-bestcobb-2026',
    SYNC_INTERVAL: 60000, // 60 seconds
    isSyncing:     false,
    lastSyncTime:  null,
    syncTimer:     null,
    isLocalServer: window.location.hostname === 'hybridpos.local',

    // ── Initialize ───────────────────────────
    async init() {
        if (!this.isLocalServer) {
            console.log('[SyncEngine] Running on live server — sync disabled');
            return;
        }

        console.log('[SyncEngine] Initialized on local server');
        this.loadLastSyncTime();
        this.updateSyncUI();

        // Start sync loop
        if (navigator.onLine) {
            await this.sync();
        }

        this.startSyncLoop();

        // Sync when internet comes back
        window.addEventListener('online', async () => {
            console.log('[SyncEngine] Internet restored — syncing...');
            await this.sync();
        });
    },

    // ── Start sync loop ──────────────────────
    startSyncLoop() {
        this.syncTimer = setInterval(async () => {
            if (navigator.onLine && !this.isSyncing) {
                await this.sync();
            }
        }, this.SYNC_INTERVAL);
    },

    // ── Main sync function ───────────────────
    async sync() {
        if (this.isSyncing || !navigator.onLine) return;
        if (!this.isLocalServer) return;

        this.isSyncing = true;
        this.updateSyncUI('syncing');
        console.log('[SyncEngine] Starting sync...');

        try {
            // Check if local DB is empty — do full sync
            const isFirstSync = await this.isFirstSync();

            if (isFirstSync) {
                console.log('[SyncEngine] First sync detected — pulling all data from live');
                Toast.show('Setting up local database...', 'info', 3000);
                await this.pullFromLive('1970-01-01 00:00:00');
                await this.pushToLive();
            } else {
                // Normal sync
                await this.pushToLive();
                await this.pullFromLive();
            }

            this.lastSyncTime = new Date();
            this.saveLastSyncTime();
            this.updateSyncUI('synced');

            // Refresh current page after first sync
            if (isFirstSync) {
                Toast.show('Local database ready!', 'success', 3000);
                setTimeout(() => Router.navigate(Router.currentPage || 'pos'), 1000);
            }

            console.log('[SyncEngine] Sync complete at', this.lastSyncTime);

        } catch (e) {
            console.error('[SyncEngine] Sync failed:', e.message);
            this.updateSyncUI('error');
        } finally {
            this.isSyncing = false;
        }
    },

    // ── Check if local DB needs initial sync ─
    async isFirstSync() {
        try {
            const res = await API.get('/sync/status');
            if (!res?.success) return false;

            const totalRecords = Object.values(res.data.status)
                .reduce((sum, table) => sum + parseInt(table.total || 0), 0);

            console.log('[SyncEngine] Total local records:', totalRecords);
            return totalRecords === 0;
        } catch (e) {
            return false;
        }
    },

    // ── Sync headers (X-Sync-Key only, no JWT) ──
    _headers() {
        return {
            'Content-Type': 'application/json',
            'X-Sync-Key':   this.SYNC_KEY,
        };
    },

    // ── Push local data to live ──────────────
    async pushToLive() {
        const entities = [
            'users',
            'categories',
            'products',
            'customers',
            'orders',
            'expenses',
            'stock_movements',
        ];

        for (const entity of entities) {
            console.log(`[DEBUG] pushToLive: trying ${entity}`);
            try {
                await this.pushEntity(entity);
            } catch (e) {
                console.error(`[SyncEngine] Push failed for ${entity}:`, e);
            }
        }
    },

    // ── Push single entity to live ───────────
    async pushEntity(entityType) {
        // Get ONLY unsynced records from local
        const localRes = await API.get(
            `/sync/pull?entity_type=${entityType}&since=1970-01-01&unsynced_only=true`
        );

        console.log(`[DEBUG] pushEntity ${entityType}:`, localRes?.data?.records?.length || 0, 'records');

        if (!localRes?.success || !localRes.data.records.length) return;

        const records = localRes.data.records;

        console.log(`[SyncEngine] Pushing ${records.length} ${entityType} to live`);

        if (entityType === 'orders') {
            console.log('[DEBUG] Order records being pushed:', JSON.stringify(records));
        }

        // Send to live server
        const res = await fetch(`${this.LIVE_URL}/sync/push`, {
            method:  'POST',
            headers: this._headers(),
            body:    JSON.stringify({ entity_type: entityType, records }),
        });

        const data = await res.json();
        console.log(`[DEBUG] Push response:`, JSON.stringify(data));

        if (data.success && data.data.synced > 0) {
            console.log(`[SyncEngine] Pushed ${data.data.synced} ${entityType}`);

            // Acknowledge the synced records so they are marked is_synced=1 locally
            const uuids = records
                .filter(r => r.uuid)
                .map(r => r.uuid);

            if (uuids.length) {
                await API.post('/sync/acknowledge', {
                    entity_type: entityType,
                    uuids,
                });
            }
        } else {
            console.warn(`[SyncEngine] Push ${entityType} failed:`, data.message || '0 records synced');
        }
    },

    // ── Pull live data to local ──────────────
    async pullFromLive(forceSince = null) {
        const entities = [
            'users',
            'categories',
            'products',
            'customers',
            'orders',
            'expenses',
            'stock_movements',
        ];

        const since = forceSince || (this.lastSyncTime
            ? this.lastSyncTime.toISOString().replace('T', ' ').split('.')[0]
            : '1970-01-01 00:00:00');

        for (const entity of entities) {
            try {
                await this.pullEntity(entity, since);
            } catch (e) {
                console.error(`[SyncEngine] Pull failed for ${entity}:`, e);
            }
        }
    },

    // ── Pull single entity from live ─────────
    async pullEntity(entityType, since) {
        const res = await fetch(
            `${this.LIVE_URL}/sync/pull?entity_type=${entityType}&since=${encodeURIComponent(since)}`,
            { headers: this._headers() }
        );

        const data = await res.json();
        if (!data.success || !data.data.records.length) return;

        console.log(`[SyncEngine] Pulling ${data.data.records.length} ${entityType} from live`);

        // Push to local DB
        const localRes = await API.post('/sync/push', {
            entity_type: entityType,
            records:     data.data.records,
        });

        if (localRes?.success) {
            console.log(`[SyncEngine] Pulled ${localRes.data.synced} ${entityType}`);
        }
    },

    // ── Sync UI ──────────────────────────────
    updateSyncUI(state = 'synced') {
        const el = document.getElementById('sync-status');
        if (!el) return;

        const states = {
            synced:  {
                class: 'sync-status',
                icon:  'check-circle',
                text:  this.lastSyncTime
                    ? `Synced ${this.formatSyncTime()}`
                    : 'Synced'
            },
            syncing: {
                class: 'sync-status syncing',
                icon:  'spinner fa-spin',
                text:  'Syncing...'
            },
            error:   {
                class: 'sync-status offline',
                icon:  'exclamation-circle',
                text:  'Sync Failed'
            },
            offline: {
                class: 'sync-status offline',
                icon:  'exclamation-circle',
                text:  'Offline'
            },
        };

        const s      = states[state] || states.synced;
        el.className = s.class;
        el.innerHTML = `<i class="fas fa-${s.icon}"></i><span>${s.text}</span>`;
    },

    formatSyncTime() {
        if (!this.lastSyncTime) return '';
        const diff = Math.floor((new Date() - this.lastSyncTime) / 1000);
        if (diff < 60)   return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        return `${Math.floor(diff / 3600)}h ago`;
    },

    saveLastSyncTime() {
        if (this.lastSyncTime) {
            localStorage.setItem('last_sync_time', this.lastSyncTime.toISOString());
        }
    },

    loadLastSyncTime() {
        const saved = localStorage.getItem('last_sync_time');
        if (saved) this.lastSyncTime = new Date(saved);
    },

    // ── Manual sync trigger ──────────────────
    async manualSync() {
        if (this.isSyncing) {
            Toast.show('Sync already in progress...', 'info');
            return;
        }
        if (!navigator.onLine) {
            Toast.show('No internet connection', 'warning');
            return;
        }
        Toast.show('Syncing with live server...', 'info', 2000);
        await this.sync();
        Toast.show('Sync complete!', 'success');
    },
};