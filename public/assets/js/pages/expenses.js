// ═══════════════════════════════════════════
//  HybridPOS — Expense Tracking Page
// ═══════════════════════════════════════════

const ExpensesPage = {
    expenses:   [],
    activeTab:  'list',

    defaultCategories: [
        'Rent', 'Utilities', 'Salaries', 'Supplies',
        'Transport', 'Marketing', 'Maintenance', 'Food',
        'Internet', 'Equipment', 'Tax', 'General'
    ],

    async load() {
        document.getElementById('page-content').innerHTML = `
            <div class="tabs-container">
                ${[
                    { id: 'list',    icon: 'list',         label: 'All Expenses' },
                    { id: 'add',     icon: 'plus-circle',  label: 'Add Expense'  },
                    { id: 'summary', icon: 'chart-pie',    label: 'Summary'      },
                ].map(tab => `
                    <button class="settings-tab ${tab.id === ExpensesPage.activeTab ? 'active' : ''}"
                        data-tab="${tab.id}"
                        onclick="ExpensesPage.switchTab('${tab.id}')">
                        <i class="fas fa-${tab.icon}"></i> ${tab.label}
                    </button>
                `).join('')}
            </div>
            <div id="expenses-content">
                <div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>
            </div>
        `;

        await this.switchTab(this.activeTab);
    },

    async switchTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.settings-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        const el = document.getElementById('expenses-content');
        el.innerHTML = `<div class="empty-state">
            <i class="fas fa-spinner fa-spin"></i>
        </div>`;

        switch (tab) {
            case 'list':    await this.loadList();    break;
            case 'add':          this.loadAdd();     break;
            case 'summary': await this.loadSummary(); break;
        }
    },

    // ── List ─────────────────────────────
    async loadList() {
        const period   = 'all';
        const category = '';
        await this.fetchAndRender(period, category);
    },

    async fetchAndRender(period = '', category = '') {
        let url = '/expenses?limit=200';
        if (period)   url += `&period=${period}`;
        if (category) url += `&category=${encodeURIComponent(category)}`;

        const res = await API.get(url);
        if (!res?.success) { Toast.show('Failed to load expenses', 'error'); return; }
        this.expenses = res.data;
        this.renderList();
    },

    renderList() {
        const el = document.getElementById('expenses-content');
        el.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div class="toolbar" style="flex:1;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                        <select id="expense-period-filter"
                            onchange="ExpensesPage.applyFilters()"
                            style="width:auto;min-width:140px;flex-shrink:0;">
                            <option value="">All Time</option>
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="this_week">This Week</option>
                            <option value="last_week">Last Week</option>
                            <option value="this_month">This Month</option>
                            <option value="last_month">Last Month</option>
                            <option value="this_year">This Year</option>
                        </select>
                        <select id="expense-category-filter"
                            onchange="ExpensesPage.applyFilters()"
                            style="width:auto;min-width:150px;flex-shrink:0;">
                            <option value="">All Categories</option>
                            ${this.defaultCategories.map(c =>
                                `<option value="${c}">${c}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <button class="btn btn-primary btn-sm"
                        onclick="ExpensesPage.switchTab('add')">
                        <i class="fas fa-plus"></i> Add Expense
                    </button>
                </div>
                <div id="expenses-table-body" class="card-body" style="padding:0;">
                    ${this.renderTable()}
                </div>
                <div style="padding:16px 24px;border-top:1px solid var(--border);
                    display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:13px;color:var(--text-muted);">
                        ${this.expenses.length} expense${this.expenses.length !== 1 ? 's' : ''}
                    </span>
                    <span style="font-weight:700;font-size:15px;color:var(--danger);">
                        Total: ${formatCurrency(
                            this.expenses.reduce((s, e) => s + parseFloat(e.amount), 0)
                        )}
                    </span>
                </div>
            </div>
        `;
    },

    renderTable() {
        if (!this.expenses.length) {
            return `<div class="empty-state">
                <i class="fas fa-receipt"></i>
                <h3>No expenses found</h3>
                <p>Record your first expense to get started</p>
            </div>`;
        }

        const catColors = {
            'Rent':        '#6366f1', 'Utilities':   '#3b82f6',
            'Salaries':    '#10b981', 'Supplies':    '#f59e0b',
            'Transport':   '#8b5cf6', 'Marketing':   '#ec4899',
            'Maintenance': '#ef4444', 'Food':        '#f97316',
            'Internet':    '#06b6d4', 'Equipment':   '#84cc16',
            'Tax':         '#dc2626', 'General':     '#94a3b8',
        };

        return `
            <div class="table-wrapper">
                <table>
                    <thead><tr>
                        <th>Date</th><th>Category</th><th>Description</th>
                        <th>Notes</th><th>Amount</th><th>Recorded By</th>
                        <th>Actions</th>
                    </tr></thead>
                    <tbody>
                        ${this.expenses.map(e => `
                        <tr>
                            <td style="color:var(--text-muted);font-size:12px;white-space:nowrap;">
                                ${formatDate(e.expense_date || e.created_at)}
                            </td>
                            <td>
                                <span class="badge" style="
                                    background:${catColors[e.category] || '#94a3b8'}22;
                                    color:${catColors[e.category] || '#94a3b8'};">
                                    ${e.category || 'General'}
                                </span>
                            </td>
                            <td><strong>${e.description}</strong></td>
                            <td style="color:var(--text-muted);font-size:12px;
                                max-width:150px;overflow:hidden;
                                text-overflow:ellipsis;white-space:nowrap;"
                                title="${e.notes || ''}">
                                ${e.notes || '—'}
                            </td>
                            <td style="font-weight:700;color:var(--danger);">
                                ${formatCurrency(e.amount)}
                            </td>
                            <td style="color:var(--text-muted);font-size:12px;">
                                ${e.recorded_by_name || '—'}
                            </td>
                            <td>
                                <div style="display:flex;gap:6px;">
                                    <button class="btn btn-ghost btn-sm"
                                        onclick="ExpensesPage.openEditModal(${e.id})">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-danger btn-sm"
                                        onclick="ExpensesPage.delete(${e.id}, '${e.description.replace(/'/g, "\\'")}')">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    },

    async applyFilters() {
        const period   = document.getElementById('expense-period-filter')?.value   || '';
        const category = document.getElementById('expense-category-filter')?.value || '';
        await this.fetchAndRender(period, category);
        this.renderList();
    },

    // ── Add Expense ──────────────────────
    loadAdd() {
        document.getElementById('expenses-content').innerHTML = `
            <div class="card" style="max-width:560px;">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-plus-circle"
                            style="color:var(--success);margin-right:8px;"></i>
                        Record Expense
                    </h3>
                </div>
                <div class="card-body">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Category *</label>
                            <select id="exp-category">
                                ${this.defaultCategories.map(c =>
                                    `<option value="${c}">${c}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Date *</label>
                            <input type="date" id="exp-date"
                                value="${new Date().toISOString().split('T')[0]}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Description *</label>
                        <input type="text" id="exp-description"
                            placeholder="e.g. Monthly rent payment">
                    </div>
                    <div class="form-group">
                        <label>Amount (₵) *</label>
                        <input type="number" id="exp-amount"
                            placeholder="0.00" min="0.01" step="0.01"
                            style="font-size:20px;text-align:center;padding:14px;">
                    </div>
                    <div class="form-group">
                        <label>Notes (optional)</label>
                        <textarea id="exp-notes"
                            placeholder="Additional details, receipt number, etc."
                            style="min-height:80px;"></textarea>
                    </div>

                    <!-- Quick amount buttons -->
                    <div style="margin-bottom:16px;">
                        <div style="font-size:12px;color:var(--text-muted);
                            margin-bottom:8px;">Quick amounts:</div>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;">
                            ${[50, 100, 200, 500, 1000, 2000].map(amt => `
                                <button class="btn btn-ghost btn-sm"
                                    onclick="document.getElementById('exp-amount').value=${amt}">
                                    ${formatCurrency(amt)}
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <div style="display:flex;gap:12px;">
                        <button class="btn btn-success btn-lg" style="flex:1;"
                            onclick="ExpensesPage.submitExpense()">
                            <i class="fas fa-save"></i> Record Expense
                        </button>
                        <button class="btn btn-ghost btn-lg"
                            onclick="ExpensesPage.switchTab('list')">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
        setTimeout(() => document.getElementById('exp-description')?.focus(), 100);
    },

    async submitExpense() {
        const data = {
            category:     document.getElementById('exp-category').value,
            description:  document.getElementById('exp-description').value.trim(),
            amount:       parseFloat(document.getElementById('exp-amount').value),
            notes:        document.getElementById('exp-notes').value.trim() || null,
            expense_date: document.getElementById('exp-date').value,
        };

        if (!data.description)      { Toast.show('Description is required', 'warning'); return; }
        if (!data.amount || data.amount <= 0) {
            Toast.show('Please enter a valid amount', 'warning'); return;
        }

        const res = await API.post('/expenses', data);
        if (res?.success) {
            Toast.show(`Expense of ${formatCurrency(data.amount)} recorded!`, 'success');
            await this.switchTab('list');
        } else {
            Toast.show(res?.message || 'Failed to record expense', 'error');
        }
    },

    // ── Edit Modal ───────────────────────
    openEditModal(id) {
        const e = this.expenses.find(x => x.id == id);
        if (!e) return;

        Modal.show(`
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title">Edit Expense</h3>
                        <button class="btn-icon" onclick="Modal.close()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Category</label>
                                <select id="edit-exp-category">
                                    ${this.defaultCategories.map(c =>
                                        `<option value="${c}"
                                            ${e.category === c ? 'selected' : ''}>${c}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Date</label>
                                <input type="date" id="edit-exp-date"
                                    value="${e.expense_date || e.created_at?.split(' ')[0]}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Description *</label>
                            <input type="text" id="edit-exp-description"
                                value="${e.description}">
                        </div>
                        <div class="form-group">
                            <label>Amount (₵) *</label>
                            <input type="number" id="edit-exp-amount"
                                value="${e.amount}" step="0.01" min="0.01">
                        </div>
                        <div class="form-group">
                            <label>Notes</label>
                            <textarea id="edit-exp-notes">${e.notes || ''}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
                        <button class="btn btn-primary"
                            onclick="ExpensesPage.saveEdit(${e.id})">
                            <i class="fas fa-save"></i> Update
                        </button>
                    </div>
                </div>
            </div>
        `);
    },

    async saveEdit(id) {
        const data = {
            category:     document.getElementById('edit-exp-category').value,
            description:  document.getElementById('edit-exp-description').value.trim(),
            amount:       parseFloat(document.getElementById('edit-exp-amount').value),
            notes:        document.getElementById('edit-exp-notes').value.trim() || null,
            expense_date: document.getElementById('edit-exp-date').value,
        };

        if (!data.description) { Toast.show('Description is required', 'warning'); return; }
        if (!data.amount)      { Toast.show('Amount is required', 'warning'); return; }

        const res = await API.put(`/expenses/${id}`, data);
        if (res?.success) {
            Modal.close();
            Toast.show('Expense updated', 'success');
            await this.fetchAndRender();
            this.renderList();
        } else {
            Toast.show(res?.message || 'Failed to update', 'error');
        }
    },

    delete(id, description) {
        Modal.confirm(
            `Delete expense "<strong>${description}</strong>"? This cannot be undone.`,
            async () => {
                const res = await API.delete(`/expenses/${id}`);
                if (res?.success) {
                    Toast.show('Expense deleted', 'success');
                    await this.fetchAndRender();
                    this.renderList();
                } else {
                    Toast.show(res?.message || 'Failed to delete', 'error');
                }
            },
            'Delete Expense'
        );
    },

    // ── Summary ──────────────────────────
    async loadSummary() {
        const [summaryRes, catRes] = await Promise.all([
            API.get('/expenses/summary'),
            API.get('/expenses/categories'),
        ]);

        const s    = summaryRes?.data || {};
        const cats = catRes?.data     || [];

        const catColors = {
            'Rent':        '#6366f1', 'Utilities':   '#3b82f6',
            'Salaries':    '#10b981', 'Supplies':    '#f59e0b',
            'Transport':   '#8b5cf6', 'Marketing':   '#ec4899',
            'Maintenance': '#ef4444', 'Food':        '#f97316',
            'Internet':    '#06b6d4', 'Equipment':   '#84cc16',
            'Tax':         '#dc2626', 'General':     '#94a3b8',
        };

        document.getElementById('expenses-content').innerHTML = `
            <div class="stats-grid" style="margin-bottom:24px;">
                <div class="stat-card">
                    <div class="stat-icon red">
                        <i class="fas fa-calendar-day"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">
                            ${formatCurrency(s.today_amount || 0)}
                        </div>
                        <div class="stat-label">Today's Expenses</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon yellow">
                        <i class="fas fa-calendar-week"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">
                            ${formatCurrency(s.week_amount || 0)}
                        </div>
                        <div class="stat-label">This Week</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon purple">
                        <i class="fas fa-calendar-alt"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">
                            ${formatCurrency(s.month_amount || 0)}
                        </div>
                        <div class="stat-label">This Month</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon blue">
                        <i class="fas fa-receipt"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">
                            ${formatCurrency(s.total_amount || 0)}
                        </div>
                        <div class="stat-label">All Time Total</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-chart-pie"
                            style="color:var(--accent);margin-right:8px;"></i>
                        Expenses by Category
                    </h3>
                </div>
                <div class="card-body">
                    ${!cats.length ? `
                        <div class="empty-state">
                            <i class="fas fa-chart-pie"></i>
                            <p>No expense data yet</p>
                        </div>` :
                        cats.map(c => {
                            const total = cats.reduce((s, x) =>
                                s + parseFloat(x.total), 0);
                            const pct   = total > 0
                                ? ((parseFloat(c.total) / total) * 100).toFixed(1)
                                : 0;
                            const color = catColors[c.category] || '#94a3b8';
                            return `
                                <div style="margin-bottom:16px;">
                                    <div style="display:flex;justify-content:space-between;
                                        margin-bottom:6px;align-items:center;">
                                        <div style="display:flex;align-items:center;gap:8px;">
                                            <div style="width:12px;height:12px;border-radius:50%;
                                                background:${color};flex-shrink:0;"></div>
                                            <span style="font-weight:600;font-size:13px;">
                                                ${c.category}
                                            </span>
                                            <span style="font-size:11px;color:var(--text-muted);">
                                                ${c.count} record${c.count != 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <span style="font-weight:700;">
                                            ${formatCurrency(c.total)}
                                        </span>
                                    </div>
                                    <div style="background:var(--bg-tertiary);
                                        border-radius:99px;height:8px;overflow:hidden;">
                                        <div style="height:100%;border-radius:99px;
                                            background:${color};width:${pct}%;
                                            transition:width 0.6s ease;"></div>
                                    </div>
                                    <div style="font-size:11px;color:var(--text-muted);
                                        margin-top:4px;">${pct}% of total expenses</div>
                                </div>`;
                        }).join('')}
                </div>
            </div>
        `;
    }
};