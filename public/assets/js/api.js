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
            const res = await fetch(`${this.baseURL}${endpoint}`, config);
            const json = await res.json();

            if (res.status === 401) {
                Auth.logout();
                return null;
            }

            return json;
        } catch (err) {
            console.error('API Error:', err);
            return { success: false, message: 'Network error. Check your connection.' };
        }
    },

    get(endpoint)         { return this.request('GET', endpoint); },
    post(endpoint, data)  { return this.request('POST', endpoint, data); },
    put(endpoint, data)   { return this.request('PUT', endpoint, data); },
    delete(endpoint)      { return this.request('DELETE', endpoint); },
};