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
            try {
                const parsedUser = JSON.parse(user);
                if (parsedUser && parsedUser.name && parsedUser.role) {
                    this.user = parsedUser;
                    this.showApp();
                    return;
                } else {
                    console.warn('Invalid user data structure, clearing...');
                    localStorage.removeItem('pos_token');
                    localStorage.removeItem('pos_user');
                }
            } catch (e) {
                console.warn('Invalid user data in localStorage, clearing...');
                localStorage.removeItem('pos_token');
                localStorage.removeItem('pos_user');
            }
        }
        
        this.showLogin();
    },


    async login(email, password) {
        const res = await API.post('/auth/login', { email, password });
        if (res && res.success) {
            if (!res.data.user.name) {
                res.data.user.name = res.data.user.email.split('@')[0] || 'User';
            }
            
            localStorage.setItem('pos_token', res.data.token);
            localStorage.setItem('pos_user', JSON.stringify(res.data.user));
            this.user = res.data.user;

            // ── Sync engine uses X-Sync-Key only — no credentials needed ──

            this.showApp();
            Toast.show('Welcome back, ' + this.user.name + '!', 'success');
        } else {
            throw new Error(res?.message || 'Login failed');
        }
    },


    logout() {
        localStorage.removeItem('pos_token');
        localStorage.removeItem('pos_user');
        localStorage.removeItem('pos_current_page');
        this.user = null;
        this.showLogin();
        Toast.show('Logged out successfully', 'info');
    },

    showLogin() {
        const loginScreen = document.getElementById('login-screen');
        const mainApp = document.getElementById('main-app');
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (mainApp) mainApp.classList.add('hidden');
    },


    async showApp() {
        if (!this.user || !this.user.name) {
            console.warn('showApp called without valid user');
            this.showLogin();
            return;
        }
        
        const loginScreen = document.getElementById('login-screen');
        const mainApp = document.getElementById('main-app');
        
        if (loginScreen) loginScreen.classList.add('hidden');
        if (mainApp) mainApp.classList.remove('hidden');
        
        this.populateUserUI();
        Network.watch();

        await new Promise(resolve => setTimeout(resolve, 50));
        Clock.start();

        if (typeof SyncManager !== 'undefined') {
            await SyncManager.init();
            SyncManager.cacheAllData();
        }

        if (typeof API !== 'undefined') {
            API.checkDBMode();
        }

        if (typeof SyncEngine !== 'undefined') {
            SyncEngine.init();
        }

        if (typeof Router !== 'undefined') {
            Router.init();
        }
        
        setTimeout(() => checkResetRequests(), 2000);
    },


    populateUserUI() {
        const u = this.user;
        if (!u) {
            console.warn('populateUserUI called with no valid user');
            return;
        }
        
        if (!u.name) {
            u.name = (u.email ? u.email.split('@')[0] : 'User');
        }

        const initials = u.name.split(' ')
            .map(n => n[0]).join('').substring(0, 2).toUpperCase();
            
        const userAvatar      = document.getElementById('user-avatar');
        const sidebarUserName = document.getElementById('sidebar-user-name');
        const sidebarUserRole = document.getElementById('sidebar-user-role');
        
        if (userAvatar)      userAvatar.textContent      = initials;
        if (sidebarUserName) sidebarUserName.textContent = u.name;
        if (sidebarUserRole) sidebarUserRole.textContent = u.role || '';

        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            const page = item.dataset.page;
            if (!Permissions.canAccess(page)) {
                item.style.display = 'none';
            } else {
                item.style.display = 'flex';
            }
        });
    },


    hasRole(...roles) {
        return roles.includes(this.user?.role);
    }
};

// ── Router ───────────────────────────────
const Router = {
    currentPage: null,

    pages: {
        pos:        { title: 'Point of Sale',    load: () => POSPage.load()           },
        dashboard:  { title: 'Dashboard',        load: () => DashboardPage.load()     },
        products:   { title: 'Products',         load: () => ProductsPage.load()      },
        categories: { title: 'Categories',       load: () => CategoriesPage.load()    },
        customers:  { title: 'Customers',        load: () => CustomersPage.load()     },
        orders:     { title: 'Orders',           load: () => OrdersHistoryPage.load() },
        stock:      { title: 'Stock Management', load: () => StockPage.load()         },
        expenses:   { title: 'Expense Tracking', load: () => ExpensesPage.load()      },
        reports:    { title: 'Reports',          load: () => ReportsPage.load()       },
        settings:   { title: 'Settings',         load: () => SettingsPage.load()      },
    },

    init() {
        document.querySelectorAll('.nav-item[data-page]').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                this.navigate(link.dataset.page);
            });
        });

        const saved = localStorage.getItem('pos_current_page') || 'pos';
        this.navigate(saved);
    },

    navigate(page) {
        if (!this.pages[page]) page = 'pos';

        if (!Permissions.canAccess(page)) {
            Toast.show('You do not have permission to access this page', 'warning');
            page = 'pos';
        }

        this.currentPage = page;
        localStorage.setItem('pos_current_page', page);

        document.querySelectorAll('.nav-item').forEach(i =>
            i.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (activeLink) activeLink.classList.add('active');

        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = this.pages[page].title;
        
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('mobile-open');

        const content = document.getElementById('page-content');
        if (content) {
            content.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>`;
        }
        
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
        if (!container) return;
        
        const toast     = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${this.icons[type]} toast-icon"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close btn-icon"
                onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, duration);
    }
};

// ── Modal Manager ────────────────────────
const Modal = {
    show(html) {
        const container = document.getElementById('modals-container');
        if (!container) return;
        
        container.innerHTML = html;
        container.querySelector('.modal-overlay')
            ?.addEventListener('click', e => {
                if (e.target === e.currentTarget) this.close();
            });
    },

    close() {
        const container = document.getElementById('modals-container');
        if (container) container.innerHTML = '';
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
                        <p style="color:var(--text-secondary);
                            font-size:14px;line-height:1.6;">
                            ${message}
                        </p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost"
                            onclick="Modal.close()">Cancel</button>
                        <button class="btn btn-danger"
                            id="confirm-btn">Confirm</button>
                    </div>
                </div>
            </div>
        `);
        const confirmBtn = document.getElementById('confirm-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                Modal.close();
                onConfirm();
            });
        }
    }
};

// ── Clock ────────────────────────────────
const Clock = {
    timer: null,
    
    start() {
        const tick = () => {
            const el = document.getElementById('topbar-time');
            if (!el) return;
            const now = new Date();
            el.textContent = now.toLocaleTimeString([], {
                hour: '2-digit', minute: '2-digit'
            });
        };
        tick();
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(tick, 1000);
    }
};

// ── Network Monitor ──────────────────────
const Network = {
    watch() {
        const update = () => {
            const online = navigator.onLine;
            const badge  = document.getElementById('connection-badge');

            if (badge) {
                badge.className = online ? 'online-badge' : 'online-badge offline';
                badge.innerHTML = `
                    <i class="fas fa-circle"></i>
                    ${online ? 'Online' : 'Offline'}`;
            }

            if (typeof SyncManager !== 'undefined') {
                SyncManager.updateSyncStatus(online ? 'online' : 'offline');
            }
        };
        window.addEventListener('online',  update);
        window.addEventListener('offline', update);
        update();
    }
};


// ── Permissions ──────────────────────────
const Permissions = {
    rules: {
        superadmin: {
            dashboard:       true,
            pos:             true,
            orders:          true,
            orders_void:     true,
            products:        true,
            products_add:    true,
            products_edit:   true,
            products_delete: true,
            categories:      true,
            customers:       true,
            stock:           true,
            expenses:        true,
            reports:         true,
            settings:        true,
            users:           true,
        },
        admin: {
            dashboard:       true,
            pos:             true,
            orders:          true,
            orders_void:     true,
            products:        true,
            products_add:    true,
            products_edit:   true,
            products_delete: true,
            categories:      true,
            customers:       true,
            stock:           true,
            expenses:        true,
            reports:         true,
            settings:        true,
            users:           true,
        },
        manager: {
            dashboard:       true,
            pos:             true,
            orders:          true,
            orders_void:     true,
            products:        true,
            products_add:    true,
            products_edit:   true,
            products_delete: false,
            categories:      true,
            customers:       true,
            stock:           true,
            expenses:        true,
            reports:         true,
            settings:        false,
            users:           false,
        },
        cashier: {
            dashboard:       false,
            pos:             true,
            orders:          true,
            orders_void:     false,
            products:        false,
            products_add:    false,
            products_edit:   false,
            products_delete: false,
            categories:      false,
            customers:       true,
            stock:           false,
            expenses:        false,
            reports:         false,
            settings:        false,
            users:           false,
        },
    },

    can(permission) {
        const role  = Auth.user?.role || 'cashier';
        const perms = this.rules[role] || this.rules.cashier;
        return perms[permission] === true;
    },

    canAccess(page) {
        return this.can(page);
    },
};

// ── Helpers ──────────────────────────────
function formatCurrency(amount) {
    return '₵' + parseFloat(amount || 0).toFixed(2)
        .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
    if (!sidebar) return;
    
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
    
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    localStorage.setItem('pos_theme', isDark ? 'light' : 'dark');
}

function togglePassword() {
    const input = document.getElementById('login-password');
    const icon  = document.getElementById('eye-icon');
    if (!input || !icon) return;
    
    if (input.type === 'password') {
        input.type     = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type     = 'password';
        icon.className = 'fas fa-eye';
    }
}

function logout() {
    Modal.confirm(
        'Are you sure you want to log out?',
        () => Auth.logout(),
        'Log Out'
    );
}

// ── Page Stubs ───────────────────────────
const OrdersPage = {
    load: () => {
        if (typeof OrdersHistoryPage !== 'undefined') {
            OrdersHistoryPage.load();
        }
    }
};

const SettingsPage = {
    load: () => {
        if (typeof SettingsPageModule !== 'undefined') {
            SettingsPageModule.load();
        }
    }
};

// ── Password Reset Requests Check ────────
async function checkResetRequests() {
    if (!Auth.hasRole('superadmin', 'admin')) return;
    if (typeof API === 'undefined') return;
    
    const res = await API.get('/password-resets');
    if (!res?.success) return;
    
    const pending = res.data.filter(r =>
        !r.used && new Date(r.expires_at) > new Date()
    );
    if (pending.length > 0) {
        Toast.show(
            `${pending.length} password reset request(s) pending`,
            'warning', 6000
        );
    }
}

// ── Forgot Password ──────────────────────
function showForgotPassword() {
    const loginForm  = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    
    if (loginForm)  loginForm.classList.add('hidden');
    if (loginError) loginError.classList.add('hidden');

    const existing = document.getElementById('forgot-form');
    if (existing) existing.remove();

    const forgotHTML = `
        <div id="forgot-form">
            <div class="auth-logo" style="margin-bottom:20px;">
                <div class="logo-icon"
                    style="width:44px;height:44px;
                    font-size:18px;margin:0 auto 12px;">
                    <i class="fas fa-envelope"></i>
                </div>
                <h1 style="font-size:22px;">Forgot Password</h1>
                <p>Enter your email to receive a reset link</p>
            </div>
            <div class="form-group">
                <label>Email Address</label>
                <div class="input-icon">
                    <i class="fas fa-envelope"></i>
                    <input type="email" id="forgot-email"
                        placeholder="your@email.com">
                </div>
            </div>
            <div id="forgot-message" class="alert hidden"></div>
            <button class="btn btn-primary btn-full"
                onclick="sendResetLink()">
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
    if (card) {
        card.insertAdjacentHTML('beforeend', forgotHTML);
        setTimeout(() => {
            const forgotEmail = document.getElementById('forgot-email');
            if (forgotEmail) forgotEmail.focus();
        }, 100);
    }
}

function showLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.classList.remove('hidden');
    
    const forgot = document.getElementById('forgot-form');
    if (forgot) forgot.remove();
    
    const pin = document.getElementById('pin-login-form');
    if (pin) pin.remove();
    
    loginPIN = '';
}

function showPINLogin() {
    const loginForm  = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    
    if (loginForm)  loginForm.classList.add('hidden');
    if (loginError) loginError.classList.add('hidden');

    const existing = document.getElementById('pin-login-form');
    if (existing) existing.remove();

    const pinHTML = `
        <div id="pin-login-form">
            <div class="pin-screen">
                <div style="text-align:center;margin-bottom:8px;">
                    <div class="logo-icon"
                        style="width:44px;height:44px;font-size:18px;
                        margin:0 auto 12px;">
                        <i class="fas fa-th"></i>
                    </div>
                    <h2 style="font-size:20px;font-weight:800;">PIN Login</h2>
                    <p style="color:var(--text-muted);font-size:13px;margin-top:4px;">
                        Enter your PIN to login
                    </p>
                </div>

                <div class="pin-display" id="login-pin-display">
                    ${[1,2,3,4,5,6].map(i => `
                        <div class="pin-dot" id="login-pin-dot-${i}"></div>
                    `).join('')}
                </div>

                <div id="login-pin-error"
                    style="color:var(--danger);font-size:13px;
                    min-height:20px;text-align:center;">
                </div>

                <div class="pin-keypad">
                    ${[1,2,3,4,5,6,7,8,9].map(n => `
                        <button class="pin-key"
                            onclick="loginPINPress('${n}')">
                            ${n}
                        </button>
                    `).join('')}
                    <button class="pin-key pin-zero"
                        onclick="loginPINPress('0')">0</button>
                    <button class="pin-key pin-delete"
                        onclick="loginPINDelete()">
                        <i class="fas fa-backspace"></i>
                    </button>
                    <button class="pin-key pin-enter"
                        onclick="loginPINSubmit()">
                        <i class="fas fa-check"></i> Enter
                    </button>
                </div>

                <div style="text-align:center;margin-top:8px;">
                    <a href="#" onclick="showLoginForm()"
                        style="color:var(--accent);font-size:13px;">
                        <i class="fas fa-arrow-left"></i> Back to Login
                    </a>
                </div>
            </div>
        </div>
    `;

    const card = document.querySelector('.auth-card');
    if (card) card.insertAdjacentHTML('beforeend', pinHTML);
}

// ── PIN Login (login screen) ─────────────
let loginPIN = '';

function loginPINPress(digit) {
    if (loginPIN.length >= 6) return;
    loginPIN += digit;
    updateLoginPINDisplay();
    if (loginPIN.length === 4) {
        setTimeout(() => {
            if (loginPIN.length === 4) loginPINSubmit();
        }, 300);
    }
}

function loginPINDelete() {
    loginPIN = loginPIN.slice(0, -1);
    updateLoginPINDisplay();
    const errEl = document.getElementById('login-pin-error');
    if (errEl) errEl.textContent = '';
}

function updateLoginPINDisplay() {
    for (let i = 1; i <= 6; i++) {
        const dot = document.getElementById(`login-pin-dot-${i}`);
        if (dot) dot.classList.toggle('filled', i <= loginPIN.length);
    }
}

async function loginPINSubmit() {
    if (!loginPIN) return;
    const errEl = document.getElementById('login-pin-error');
    if (errEl) errEl.textContent = '';

    try {
        const res = await fetch('/public/api/auth/pin-login', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ pin: loginPIN }),
        });

        const data = await res.json();

        if (data.success) {
            localStorage.setItem('pos_token', data.data.token);
            localStorage.setItem('pos_user', JSON.stringify(data.data.user));
            Auth.user = data.data.user;

            const pinForm = document.getElementById('pin-login-form');
            if (pinForm) pinForm.remove();

            Auth.showApp();
            Toast.show(`Welcome, ${data.data.user.name}!`, 'success');
        } else {
            loginPIN = '';
            updateLoginPINDisplay();
            if (errEl) errEl.textContent = 'Invalid PIN. Try again.';
        }
    } catch (e) {
        loginPIN = '';
        updateLoginPINDisplay();
        if (errEl) errEl.textContent = 'Error. Try again.';
    }
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

    try {
        const res = await fetch('/public/api/auth/forgot-password', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email })
        });

        const data         = await res.json();
        msgBox.textContent = data.message;
        msgBox.className   = `alert ${data.success ? 'alert-success' : 'alert-error'}`;
    } catch (error) {
        msgBox.textContent = 'An error occurred. Please try again.';
        msgBox.className   = 'alert alert-error';
    }
}


// ── PIN Quick-Switch (in-app) ────────────
const PINLogin = {
    pin:       '',
    maxLength: 6,

    show() {
        Modal.show(`
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-th" style="color:var(--accent);"></i>
                            Quick Switch
                        </h3>
                        <button class="btn-icon" onclick="Modal.close()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="pin-screen">
                            <div id="pin-user-info"
                                style="text-align:center;margin-bottom:4px;">
                                <p style="color:var(--text-muted);font-size:13px;">
                                    Enter your PIN to switch cashier
                                </p>
                            </div>

                            <div class="pin-display" id="pin-display">
                                ${[1,2,3,4,5,6].map(i => `
                                    <div class="pin-dot" id="pin-dot-${i}"></div>
                                `).join('')}
                            </div>

                            <div id="pin-error"
                                style="color:var(--danger);font-size:13px;
                                min-height:20px;text-align:center;">
                            </div>

                            <div class="pin-keypad">
                                ${[1,2,3,4,5,6,7,8,9].map(n => `
                                    <button class="pin-key"
                                        onclick="PINLogin.press('${n}')">
                                        ${n}
                                    </button>
                                `).join('')}
                                <button class="pin-key pin-zero"
                                    onclick="PINLogin.press('0')">0</button>
                                <button class="pin-key pin-delete"
                                    onclick="PINLogin.delete()">
                                    <i class="fas fa-backspace"></i>
                                </button>
                                <button class="pin-key pin-enter"
                                    onclick="PINLogin.submit()">
                                    <i class="fas fa-check"></i> Enter
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer" style="justify-content:center;">
                        <button class="btn btn-ghost btn-sm"
                            onclick="Modal.close()">Cancel</button>
                    </div>
                </div>
            </div>
        `);

        this.pin = '';
        this.updateDisplay();

        this._handleKeydown = this.handleKeydown.bind(this);
        document.addEventListener('keydown', this._handleKeydown);
    },

    handleKeydown(e) {
        if (e.key >= '0' && e.key <= '9') {
            PINLogin.press(e.key);
        } else if (e.key === 'Backspace') {
            PINLogin.delete();
        } else if (e.key === 'Enter') {
            PINLogin.submit();
        }
    },

    press(digit) {
        if (this.pin.length >= this.maxLength) return;
        this.pin += digit;
        this.updateDisplay();
        if (this.pin.length === 4) {
            setTimeout(() => {
                if (this.pin.length === 4) this.submit();
            }, 300);
        }
    },

    delete() {
        this.pin = this.pin.slice(0, -1);
        this.updateDisplay();
        const errEl = document.getElementById('pin-error');
        if (errEl) errEl.textContent = '';
    },

    updateDisplay() {
        for (let i = 1; i <= 6; i++) {
            const dot = document.getElementById(`pin-dot-${i}`);
            if (dot) dot.classList.toggle('filled', i <= this.pin.length);
        }
    },

    async submit() {
        if (!this.pin) return;

        const errEl = document.getElementById('pin-error');
        if (errEl) errEl.textContent = '';

        try {
            const res = await fetch('/public/api/auth/pin-login', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ pin: this.pin }),
            });

            const data = await res.json();

            if (data.success) {
                localStorage.setItem('pos_token', data.data.token);
                localStorage.setItem('pos_user', JSON.stringify(data.data.user));
                Auth.user = data.data.user;

                Modal.close();
                if (this._handleKeydown) {
                    document.removeEventListener('keydown', this._handleKeydown);
                }

                Auth.populateUserUI();
                Toast.show(`Switched to ${data.data.user.name}`, 'success', 3000);
                Router.navigate('pos');

            } else {
                this.pin = '';
                this.updateDisplay();
                if (errEl) errEl.textContent = 'Invalid PIN. Try again.';

                const display = document.getElementById('pin-display');
                if (display) {
                    display.style.animation = 'shake 0.3s ease';
                    setTimeout(() => { display.style.animation = ''; }, 300);
                }
            }
        } catch (e) {
            if (errEl) errEl.textContent = 'Error. Try again.';
            this.pin = '';
            this.updateDisplay();
        }
    },
};


// ── Boot ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Restore theme
    const savedTheme = localStorage.getItem('pos_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        themeIcon.className = savedTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }

    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async e => {
            e.preventDefault();
            const btn = document.getElementById('login-btn');
            if (!btn) return;
            
            const btnText = btn.querySelector('.btn-text');
            const loader  = btn.querySelector('.btn-loader');
            const errBox  = document.getElementById('login-error');

            if (btnText) btnText.classList.add('hidden');
            if (loader)  loader.classList.remove('hidden');
            btn.disabled = true;
            if (errBox)  errBox.classList.add('hidden');

            try {
                const emailInput    = document.getElementById('login-email');
                const passwordInput = document.getElementById('login-password');
                
                if (emailInput && passwordInput) {
                    await Auth.login(emailInput.value, passwordInput.value);
                }
            } catch (err) {
                if (errBox) {
                    errBox.textContent = err.message;
                    errBox.classList.remove('hidden');
                }
            } finally {
                if (btnText) btnText.classList.remove('hidden');
                if (loader)  loader.classList.add('hidden');
                btn.disabled = false;
            }
        });
    }

    Auth.init();
});