// ═══════════════════════════════════════════
//  HybridPOS — App Core
// ═══════════════════════════════════════════

// ── Auth ─────────────────────────────────
const Auth = {
    user: null,

    init() {
        const token = localStorage.getItem('pos_token');
        const user  = localStorage.getItem('pos_user');
        if (token && user) {
            this.user = JSON.parse(user);
            this.showApp();
        } else {
            this.showLogin();
        }
    },

    async login(email, password) {
        if (navigator.onLine) {
            // Online login
            const res = await API.post('/auth/login', { email, password });
            if (res && res.success) {
                localStorage.setItem('pos_token', res.data.token);
                localStorage.setItem('pos_user', JSON.stringify(res.data.user));
                this.user = res.data.user;

                // Cache credentials for offline use (non-blocking)
                if (typeof OfflineAuth !== 'undefined' && OfflineDB.ready) {
                    try {
                        await OfflineAuth.cacheLoginCredentials(
                            res.data.user,
                            res.data.token,
                            password
                        );
                    } catch (e) {
                        console.warn('[Auth] Failed to cache credentials:', e);
                    }
                }

                this.showApp();
                Toast.show('Welcome back, ' + this.user.name + '!', 'success');
            } else {
                throw new Error(res?.message || 'Login failed');
            }
        } else {
            // Offline login
            try {
                const cached = await OfflineAuth.attemptOfflineLogin(email, password);
                localStorage.setItem('pos_token', cached.token);
                localStorage.setItem('pos_user', JSON.stringify(cached.user));
                this.user = cached.user;
                this.showApp();
                Toast.show('Logged in offline. Data will sync when connected.', 'warning', 5000);
            } catch (err) {
                throw new Error(err.message);
            }
        }
    },

    logout() {
        localStorage.removeItem('pos_token');
        localStorage.removeItem('pos_user');
        this.user = null;
        this.showLogin();
        Toast.show('Logged out successfully', 'info');
    },

    showLogin() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    },

    async showApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        this.populateUserUI();
        Clock.start();
        Network.watch();

        // Init OfflineDB first, then start routing
        if (typeof SyncManager !== 'undefined') {
            await SyncManager.init();
        }

        Router.init();
        setTimeout(() => checkResetRequests(), 2000);
    },

    populateUserUI() {
        const u = this.user;
        if (!u) return;
        const initials = u.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        document.getElementById('user-avatar').textContent       = initials;
        document.getElementById('sidebar-user-name').textContent = u.name;
        document.getElementById('sidebar-user-role').textContent = u.role;
    },

    hasRole(...roles) {
        return roles.includes(this.user?.role);
    }
};

// ── Router ───────────────────────────────
const Router = {
    currentPage: null,

    pages: {
        pos:        { title: 'Point of Sale',  load: () => POSPage.load() },
        dashboard:  { title: 'Dashboard',      load: () => DashboardPage.load() },
        products:   { title: 'Products',       load: () => ProductsPage.load() },
        categories: { title: 'Categories',     load: () => CategoriesPage.load() },
        customers:  { title: 'Customers',      load: () => CustomersPage.load() },
        orders:     { title: 'Orders',         load: () => OrdersPage.load() },
        stock:      { title: 'Stock Management', load: () => StockPage.load() },
        settings:   { title: 'Settings',       load: () => SettingsPage.load() },
        expenses:   { title: 'Expense Tracking', load: () => ExpensesPage.load() },
        reports:    { title: 'Reports & Exports', load: () => ReportsPage.load() },
    },

    init() {
        document.querySelectorAll('.nav-item[data-page]').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                this.navigate(link.dataset.page);
            });
        });
        this.navigate('pos');
    },

    navigate(page) {
        if (!this.pages[page]) page = 'pos';
        this.currentPage = page;

        // Update nav
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (activeLink) activeLink.classList.add('active');

        // Update title
        document.getElementById('page-title').textContent = this.pages[page].title;

        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('mobile-open');

        // Load page
        const content = document.getElementById('page-content');
        content.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>`;
        this.pages[page].load();
    }
};

// ── Toast Notifications ──────────────────
const Toast = {
    icons: {
        success: 'fa-check-circle',
        error:   'fa-times-circle',
        warning: 'fa-exclamation-circle',
        info:    'fa-info-circle',
    },

    show(message, type = 'info', duration = 3500) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${this.icons[type]} toast-icon"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close btn-icon" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }
};

// ── Modal Manager ────────────────────────
const Modal = {
    show(html) {
        const container = document.getElementById('modals-container');
        container.innerHTML = html;
        container.querySelector('.modal-overlay')?.addEventListener('click', e => {
            if (e.target === e.currentTarget) this.close();
        });
    },

    close() {
        document.getElementById('modals-container').innerHTML = '';
    },

    confirm(message, onConfirm, title = 'Confirm Action') {
        this.show(`
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                        <button class="btn-icon" onclick="Modal.close()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <p style="color:var(--text-secondary);font-size:14px;line-height:1.6;">
                            ${message}
                        </p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
                        <button class="btn btn-danger" id="confirm-btn">Confirm</button>
                    </div>
                </div>
            </div>
        `);
        document.getElementById('confirm-btn').addEventListener('click', () => {
            Modal.close();
            onConfirm();
        });
    }
};

// ── Clock ────────────────────────────────
const Clock = {
    start() {
        const el = document.getElementById('topbar-time');
        const tick = () => {
            const now = new Date();
            el.textContent = now.toLocaleTimeString([], {
                hour:   '2-digit',
                minute: '2-digit'
            });
        };
        tick();
        setInterval(tick, 1000);
    }
};

// ── Network Monitor ──────────────────────
const Network = {
    watch() {
        const update = () => {
            const online = navigator.onLine;
            const badge  = document.getElementById('connection-badge');
            const sync   = document.getElementById('sync-status');

            if (badge) {
                badge.className = online ? 'online-badge' : 'online-badge offline';
                badge.innerHTML = `<i class="fas fa-circle"></i> ${online ? 'Online' : 'Offline'}`;
            }
            if (sync) {
                sync.className = online ? 'sync-status' : 'sync-status offline';
                sync.innerHTML = online
                    ? `<i class="fas fa-check-circle"></i><span>Synced</span>`
                    : `<i class="fas fa-exclamation-circle"></i><span>Offline</span>`;
            }
        };
        window.addEventListener('online',  update);
        window.addEventListener('offline', update);
        update();
    }
};

// ── Helpers ──────────────────────────────
function formatCurrency(amount) {
    return '₵' + parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

function formatDateTime(dateStr) {
    return new Date(dateStr).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('mobile-open');
    } else {
        sidebar.classList.toggle('collapsed');
    }
}

function toggleTheme() {
    const html   = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('theme-icon').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('pos_theme', isDark ? 'light' : 'dark');
}

function togglePassword() {
    const input = document.getElementById('login-password');
    const icon  = document.getElementById('eye-icon');
    if (input.type === 'password') {
        input.type    = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type    = 'password';
        icon.className = 'fas fa-eye';
    }
}

function logout() {
    Modal.confirm('Are you sure you want to log out?', () => Auth.logout(), 'Log Out');
}

// ── Stub Pages ───────────────────────────
const OrdersPage = {
    load: () => OrdersHistoryPage.load()
};

const SettingsPage = {
    load: () => SettingsPageModule.load()
};


// ── Forgot Password ──────────────────────
function showForgotPassword() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('login-error').classList.add('hidden');

    const existing = document.getElementById('forgot-form');
    if (existing) existing.remove();

    const forgotHTML = `
        <div id="forgot-form">
            <div class="auth-logo" style="margin-bottom:20px;">
                <div class="logo-icon" style="width:44px;height:44px;font-size:18px;margin:0 auto 12px;">
                    <i class="fas fa-envelope"></i>
                </div>
                <h1 style="font-size:22px;">Forgot Password</h1>
                <p>Enter your email to receive a reset link</p>
            </div>
            <div class="form-group">
                <label>Email Address</label>
                <div class="input-icon">
                    <i class="fas fa-envelope"></i>
                    <input type="email" id="forgot-email" placeholder="your@email.com">
                </div>
            </div>
            <div id="forgot-message" class="alert hidden"></div>
            <button class="btn btn-primary btn-full" onclick="sendResetLink()">
                <i class="fas fa-paper-plane"></i> Send Reset Link
            </button>
            <div style="text-align:center;margin-top:16px;">
                <a href="#" onclick="showLoginForm()"
                    style="color:var(--accent);font-size:13px;">
                    <i class="fas fa-arrow-left"></i> Back to Login
                </a>
            </div>
        </div>
    `;

    const card = document.querySelector('.auth-card');
    card.insertAdjacentHTML('beforeend', forgotHTML);
    setTimeout(() => document.getElementById('forgot-email')?.focus(), 100);
}

function showLoginForm() {
    document.getElementById('login-form').classList.remove('hidden');
    const forgot = document.getElementById('forgot-form');
    if (forgot) forgot.remove();
}

async function sendResetLink() {
    const email  = document.getElementById('forgot-email')?.value.trim();
    const msgBox = document.getElementById('forgot-message');
    if (!msgBox) return;

    msgBox.className   = 'alert hidden';
    msgBox.textContent = '';

    if (!email) {
        msgBox.textContent = 'Please enter your email address.';
        msgBox.className   = 'alert alert-error';
        return;
    }

    const res = await fetch('/public/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email })
    });

    const data = await res.json();
    msgBox.textContent = data.message;
    msgBox.className   = `alert ${data.success ? 'alert-success' : 'alert-error'}`;
}


async function checkResetRequests() {
    if (!Auth.hasRole('superadmin', 'admin')) return;
    const res = await API.get('/auth/reset-requests');
    if (res?.success && res.data.length > 0) {
        // Show badge on settings nav item
        const settingsLink = document.querySelector('.nav-item[data-page="settings"]');
        if (settingsLink) {
            const existing = settingsLink.querySelector('.nav-badge');
            if (!existing) {
                settingsLink.insertAdjacentHTML('beforeend',
                    `<span class="nav-badge">${res.data.length}</span>`
                );
            } else {
                existing.textContent = res.data.length;
            }
        }
        Toast.show(
            `${res.data.length} password reset request(s) pending`,
            'warning',
            5000
        );
    }
}

// ── Boot ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Restore theme
    const savedTheme = localStorage.getItem('pos_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) themeIcon.className = savedTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';

    // Login form
    document.getElementById('login-form').addEventListener('submit', async e => {
        e.preventDefault();
        const btn     = document.getElementById('login-btn');
        const btnText = btn.querySelector('.btn-text');
        const loader  = btn.querySelector('.btn-loader');
        const errBox  = document.getElementById('login-error');

        btnText.classList.add('hidden');
        loader.classList.remove('hidden');
        btn.disabled = true;
        errBox.classList.add('hidden');

        try {
            await Auth.login(
                document.getElementById('login-email').value,
                document.getElementById('login-password').value
            );
        } catch (err) {
            errBox.textContent = err.message;
            errBox.classList.remove('hidden');
        } finally {
            btnText.classList.remove('hidden');
            loader.classList.add('hidden');
            btn.disabled = false;
        }
    });

    Auth.init();
});