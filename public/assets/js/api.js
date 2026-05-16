// ═══════════════════════════════════════════
//  HybridPOS — API Client
// ═══════════════════════════════════════════

const API = {
    baseURL: '/public/api',

    getToken() {
        return localStorage.getItem('pos_token');
    },

    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        const token = this.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    },

    async request(method, endpoint, data = null) {
        const config = {
            method,
            headers: this.getHeaders(),
        };
        if (data) config.body = JSON.stringify(data);

        try {
            const res  = await fetch(`${this.baseURL}${endpoint}`, config);
            const text = await res.text();

            // Extract JSON even if PHP warnings are prepended
            const jsonMatch = text.match(/\{[\s\S]*\}$/);
            if (jsonMatch) {
                try {
                    const json = JSON.parse(jsonMatch[0]);
                    if (res.status === 401) {
                        Auth.logout();
                        return null;
                    }
                    return json;
                } catch {
                    console.error('JSON parse error:', text);
                    return { success: false, message: 'Server error. Please try again.' };
                }
            }

            console.error('Non-JSON response:', text);
            return { success: false, message: 'Server error. Please try again.' };

        } catch (err) {
            console.error('API Error:', err);
            return { success: false, message: 'Network error. Check your connection.' };
        }
    },


    async checkDBMode() {
        const res = await this.get('/system/status');
        if (res?.success) {
            const mode = res.data.db_mode;
            console.log('[API] DB Mode:', mode);

            // Update sync status indicator
            const sync = document.getElementById('sync-status');
            if (sync) {
                if (mode === 'live') {
                    sync.className = 'sync-status';
                    sync.innerHTML = `<i class="fas fa-check-circle"></i>
                        <span>Live DB</span>`;
                } else if (mode === 'online') {
                    sync.className = 'sync-status';
                    sync.innerHTML = `<i class="fas fa-check-circle"></i>
                        <span>Synced</span>`;
                } else {
                    sync.className = 'sync-status offline';
                    sync.innerHTML = `<i class="fas fa-exclamation-circle"></i>
                        <span>Local DB</span>`;
                }
            }

            return mode;
        }
        return 'unknown';
    },

    get(endpoint)         { return this.request('GET', endpoint); },
    post(endpoint, data)  { return this.request('POST', endpoint, data); },
    put(endpoint, data)   { return this.request('PUT', endpoint, data); },
    delete(endpoint)      { return this.request('DELETE', endpoint); },
};