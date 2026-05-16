// ═══════════════════════════════════════════
//  HybridPOS — Settings Page
// ═══════════════════════════════════════════

const SettingsPageModule = {
    settings: null,
    users: [],
    activeTab: 'store',

    async load() {
        document.getElementById('page-content').innerHTML = `
            <div style="display:flex;gap:8px;margin-bottom:24px;border-bottom:1px solid var(--border);padding-bottom:0;">
                ${[
                    { id: 'store',    icon: 'store',          label: 'Store Settings' },
                    { id: 'users',    icon: 'users',          label: 'User Management' },
                    { id: 'password', icon: 'lock',           label: 'Change Password' },
                    { id: 'about',    icon: 'info-circle',    label: 'About' },
                ].map(tab => `
                    <button class="settings-tab ${tab.id === this.activeTab ? 'active' : ''}"
                        data-tab="${tab.id}" onclick="SettingsPageModule.switchTab('${tab.id}')">
                        <i class="fas fa-${tab.icon}"></i> ${tab.label}
                    </button>
                `).join('')}
            </div>
            <div id="settings-content">
                <div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>
            </div>
        `;

        // Add tab styles
        if (!document.getElementById('settings-tab-style')) {
            const style = document.createElement('style');
            style.id = 'settings-tab-style';
            style.textContent = `
                .settings-tab {
                    padding: 10px 20px;
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--text-muted);
                    border-bottom: 2px solid transparent;
                    border-radius: 0;
                    transition: var(--transition);
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: -1px;
                    font-family: inherit;
                    background: none;
                    cursor: pointer;
                }
                .settings-tab:hover { color: var(--text-primary); }
                .settings-tab.active {
                    color: var(--accent);
                    border-bottom-color: var(--accent);
                }
            `;
            document.head.appendChild(style);
        }

        await this.switchTab(this.activeTab);
    },

    async switchTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.settings-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });

        const el = document.getElementById('settings-content');
        el.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>`;

        switch (tab) {
            case 'store':    await this.loadStoreSettings(); break;
            case 'users':    await this.loadUsers();         break;
            case 'password': this.loadChangePassword();      break;
            case 'about':    this.loadAbout();               break;
        }
    },

    // ── Store Settings ───────────────────
    async loadStoreSettings() {
        const res = await API.get('/settings');
        if (!res?.success) { Toast.show('Failed to load settings', 'error'); return; }
        this.settings = res.data;
        const s = this.settings;

        document.getElementById('settings-content').innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-store" style="color:var(--accent);margin-right:8px;"></i>Store Information</h3>
                </div>
                <div class="card-body">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Store Name *</label>
                            <input type="text" id="s-name" value="${s.store_name || ''}" placeholder="Your Store Name">
                        </div>
                        <div class="form-group">
                            <label>Phone</label>
                            <input type="text" id="s-phone" value="${s.phone || ''}" placeholder="024 000 0000">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="s-email" value="${s.email || ''}" placeholder="store@example.com">
                        </div>
                        <div class="form-group">
                            <label>Timezone</label>
                            <select id="s-timezone">
                                ${[
                                    'Africa/Accra', 'Africa/Lagos', 'Africa/Nairobi',
                                    'Europe/London', 'America/New_York', 'America/Los_Angeles',
                                    'Asia/Dubai', 'Asia/Singapore'
                                ].map(tz => `
                                    <option value="${tz}" ${s.timezone === tz ? 'selected' : ''}>${tz}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Address</label>
                        <textarea id="s-address" placeholder="Store address">${s.address || ''}</textarea>
                    </div>
                </div>
            </div>

            <div class="card" style="margin-top:20px;">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-coins" style="color:var(--warning);margin-right:8px;"></i>Currency & Tax</h3>
                </div>
                <div class="card-body">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Currency Code</label>
                            <input type="text" id="s-currency-code" value="${s.currency_code || 'GHS'}"
                                placeholder="GHS" maxlength="3">
                        </div>
                        <div class="form-group">
                            <label>Currency Symbol</label>
                            <input type="text" id="s-currency-symbol" value="${s.currency_symbol || '₵'}"
                                placeholder="₵" maxlength="5">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Tax Rate (%)</label>
                        <input type="number" id="s-tax-rate" value="${s.tax_rate || 0}"
                            placeholder="0.00" step="0.01" min="0" max="100"
                            style="max-width:200px;">
                        <p style="font-size:12px;color:var(--text-muted);margin-top:6px;">
                            Set to 0 to disable tax. Enter percentage e.g. 12.5 for 12.5% VAT.
                        </p>
                    </div>
                </div>
            </div>

            <div class="card" style="margin-top:20px;">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-receipt" style="color:var(--success);margin-right:8px;"></i>Receipt</h3>
                </div>
                <div class="card-body">
                    <div class="form-group">
                        <label>Receipt Footer Message</label>
                        <textarea id="s-receipt-footer" placeholder="e.g. Thank you for shopping with us! Returns accepted within 7 days."
                            style="min-height:100px;">${s.receipt_footer || ''}</textarea>
                    </div>
                </div>
            </div>

            <div style="margin-top:20px;display:flex;justify-content:flex-end;">
                <button class="btn btn-primary btn-lg" onclick="SettingsPageModule.saveStoreSettings()">
                    <i class="fas fa-save"></i> Save Settings
                </button>
            </div>
        `;
    },

    async saveStoreSettings() {
        const data = {
            store_name:      document.getElementById('s-name').value.trim(),
            phone:           document.getElementById('s-phone').value.trim(),
            email:           document.getElementById('s-email').value.trim(),
            address:         document.getElementById('s-address').value.trim(),
            timezone:        document.getElementById('s-timezone').value,
            currency_code:   document.getElementById('s-currency-code').value.trim(),
            currency_symbol: document.getElementById('s-currency-symbol').value.trim(),
            tax_rate:        parseFloat(document.getElementById('s-tax-rate').value) || 0,
            receipt_footer:  document.getElementById('s-receipt-footer').value.trim(),
        };

        if (!data.store_name) { Toast.show('Store name is required', 'warning'); return; }

        const res = await API.put('/settings', data);
        if (res?.success) {
            Toast.show('Settings saved successfully!', 'success');
        } else {
            Toast.show(res?.message || 'Failed to save settings', 'error');
        }
    },

    // ── User Management ──────────────────
    async loadUsers() {
        const res = await API.get('/users');
        if (!res?.success) {
            document.getElementById('settings-content').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-lock"></i>
                    <h3>Access Denied</h3>
                    <p>You don't have permission to manage users</p>
                </div>`;
            return;
        }
        this.users = res.data;
        this.renderUsers();
    },

    renderUsers() {
        const roleColors = {
            superadmin: 'badge-danger',
            admin:      'badge-warning',
            manager:    'badge-info',
            cashier:    'badge-success',
        };

        document.getElementById('settings-content').innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-users" style="color:var(--accent);margin-right:8px;"></i>
                        System Users
                        <span class="badge badge-info" style="margin-left:8px;">${this.users.length}</span>
                    </h3>
                    <button class="btn btn-primary btn-sm" onclick="SettingsPageModule.openUserModal()">
                        <i class="fas fa-plus"></i> Add User
                    </button>
                </div>
                <div class="card-body" style="padding:0;">
                    <div class="table-wrapper">
                        <table>
                            <thead><tr>
                                <th>User</th><th>Email</th><th>Role</th>
                                <th>PIN</th><th>Status</th><th>Joined</th><th>Actions</th>
                            </tr></thead>
                            <tbody>
                                ${this.users.map(u => `
                                <tr>
                                    <td>
                                        <div style="display:flex;align-items:center;gap:10px;">
                                            <div class="user-avatar" style="width:34px;height:34px;font-size:11px;">
                                                ${u.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
                                            </div>
                                            <strong>${u.name}</strong>
                                            ${u.id == Auth.user.id
                                                ? '<span class="badge badge-purple" style="font-size:10px;">You</span>'
                                                : ''}
                                        </div>
                                    </td>
                                    <td style="color:var(--text-muted);">${u.email}</td>
                                    <td><span class="badge ${roleColors[u.role] || 'badge-info'}">${u.role}</span></td>
                                    <td style="color:var(--text-muted);">${u.pin || '—'}</td>
                                    <td>
                                        <span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">
                                            ${u.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td style="color:var(--text-muted);font-size:12px;">${formatDate(u.created_at)}</td>
                                    <td>
                                        <div style="display:flex;gap:6px;">
                                            <button class="btn btn-ghost btn-sm"
                                                onclick="SettingsPageModule.openUserModal(${u.id})">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}"
                                                onclick="SettingsPageModule.toggleUser(${u.id}, '${u.name}', ${u.is_active})"
                                                ${u.id == Auth.user.id ? 'disabled' : ''}>
                                                <i class="fas fa-${u.is_active ? 'ban' : 'check'}"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    openUserModal(id = null) {
        const u = id ? this.users.find(x => x.id === id) : null;
        Modal.show(`
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title">${u ? 'Edit' : 'Add'} User</h3>
                        <button class="btn-icon" onclick="Modal.close()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Full Name *</label>
                                <input type="text" id="u-name" value="${u?.name || ''}" placeholder="John Doe">
                            </div>
                            <div class="form-group">
                                <label>Role *</label>
                                <select id="u-role">
                                    ${['superadmin','admin','manager','cashier'].map(r => `
                                        <option value="${r}" ${u?.role === r ? 'selected' : ''}>${r}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Email *</label>
                            <input type="email" id="u-email" value="${u?.email || ''}" placeholder="user@example.com">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>${u ? 'New Password' : 'Password *'}</label>
                                <input type="password" id="u-password"
                                    placeholder="${u ? 'Leave blank to keep current' : 'Min 6 characters'}">
                            </div>
                            <div class="form-group">
                                <label>PIN (optional)</label>
                                <input type="text" id="u-pin" value="${u?.pin || ''}"
                                    placeholder="4-6 digit PIN" maxlength="6">
                            </div>
                        </div>
                        ${u ? `
                        <div class="form-group">
                            <label>Status</label>
                            <select id="u-active">
                                <option value="1" ${u.is_active ? 'selected' : ''}>Active</option>
                                <option value="0" ${!u.is_active ? 'selected' : ''}>Inactive</option>
                            </select>
                        </div>` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
                        <button class="btn btn-primary" onclick="SettingsPageModule.saveUser(${id || 'null'})">
                            <i class="fas fa-save"></i> ${u ? 'Update' : 'Create'} User
                        </button>
                    </div>
                </div>
            </div>
        `);
        setTimeout(() => document.getElementById('u-name')?.focus(), 100);
    },

    async saveUser(id) {
        const data = {
            name:      document.getElementById('u-name').value.trim(),
            email:     document.getElementById('u-email').value.trim(),
            role:      document.getElementById('u-role').value,
            password:  document.getElementById('u-password').value,
            pin:       document.getElementById('u-pin').value.trim() || null,
            is_active: id ? parseInt(document.getElementById('u-active')?.value ?? 1) : 1,
        };

        if (!data.name)              { Toast.show('Name is required', 'warning'); return; }
        if (!data.email)             { Toast.show('Email is required', 'warning'); return; }
        if (!id && !data.password)   { Toast.show('Password is required', 'warning'); return; }
        if (data.password && data.password.length < 6) {
            Toast.show('Password must be at least 6 characters', 'warning'); return;
        }

        const res = id
            ? await API.put(`/users/${id}`, data)
            : await API.post('/users', data);

        if (res?.success) {
            Modal.close();
            Toast.show(`User ${id ? 'updated' : 'created'} successfully`, 'success');
            await this.loadUsers();
        } else {
            Toast.show(res?.message || 'Failed to save user', 'error');
        }
    },

    toggleUser(id, name, isActive) {
        Modal.confirm(
            `${isActive ? 'Deactivate' : 'Activate'} user <strong>${name}</strong>?`,
            async () => {
                const res = await API.put(`/users/${id}/toggle`, {});
                if (res?.success) {
                    Toast.show(res.message, 'success');
                    await this.loadUsers();
                } else {
                    Toast.show(res?.message || 'Failed', 'error');
                }
            },
            `${isActive ? 'Deactivate' : 'Activate'} User`
        );
    },

    // ── Change Password ──────────────────
    loadChangePassword() {
        document.getElementById('settings-content').innerHTML = `
            <div class="card" style="max-width:480px;">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-lock" style="color:var(--warning);margin-right:8px;"></i>
                        Change Your Password
                    </h3>
                </div>
                <div class="card-body">
                    <div class="form-group">
                        <label>Current Password</label>
                        <input type="password" id="cp-current" placeholder="Enter current password">
                    </div>
                    <div class="form-group">
                        <label>New Password</label>
                        <input type="password" id="cp-new" placeholder="Min 6 characters">
                    </div>
                    <div class="form-group">
                        <label>Confirm New Password</label>
                        <input type="password" id="cp-confirm" placeholder="Repeat new password">
                    </div>
                    <button class="btn btn-primary" onclick="SettingsPageModule.changePassword()">
                        <i class="fas fa-key"></i> Update Password
                    </button>
                </div>
            </div>
        `;
    },

    async changePassword() {
        const current = document.getElementById('cp-current').value;
        const newPass = document.getElementById('cp-new').value;
        const confirm = document.getElementById('cp-confirm').value;

        if (!current) { Toast.show('Current password is required', 'warning'); return; }
        if (!newPass)  { Toast.show('New password is required', 'warning'); return; }
        if (newPass.length < 6) { Toast.show('Password must be at least 6 characters', 'warning'); return; }
        if (newPass !== confirm) { Toast.show('Passwords do not match', 'warning'); return; }

        const res = await API.put('/users/change-password', {
            current_password: current,
            new_password:     newPass,
        });

        if (res?.success) {
            Toast.show('Password changed successfully!', 'success');
            document.getElementById('cp-current').value = '';
            document.getElementById('cp-new').value     = '';
            document.getElementById('cp-confirm').value = '';
        } else {
            Toast.show(res?.message || 'Failed to change password', 'error');
        }
    },

    // ── About ────────────────────────────
    loadAbout() {
        document.getElementById('settings-content').innerHTML = `
            <div class="card" style="max-width:560px;">
                <div class="card-body" style="text-align:center;padding:40px;">
                    <div class="logo-icon" style="width:72px;height:72px;font-size:30px;margin:0 auto 20px;">
                        <i class="fas fa-bolt"></i>
                    </div>
                    <h2 style="font-size:24px;font-weight:800;margin-bottom:8px;">HybridPOS</h2>
                    <p style="color:var(--text-muted);margin-bottom:24px;">Professional Point of Sale System</p>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:left;margin-bottom:24px;">
                        ${[
                            ['Version',    'v1.0.0'],
                            ['Build',      'Production Ready'],
                            ['PHP',        '8.x'],
                            ['Database',   'MySQL 8.x'],
                            ['Offline',    'IndexedDB + Service Worker'],
                            ['License',    'Commercial'],
                        ].map(([label, value]) => `
                            <div style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:12px;">
                                <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">${label}</div>
                                <div style="font-weight:600;font-size:13px;">${value}</div>
                            </div>
                        `).join('')}
                    </div>

                    <div style="background:var(--success-light);border-radius:var(--radius-sm);padding:16px;">
                        <div style="color:var(--success);font-weight:700;margin-bottom:4px;">
                            <i class="fas fa-check-circle"></i> System Status: Healthy
                        </div>
                        <div style="font-size:12px;color:var(--text-muted);">
                            All systems operational
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
};