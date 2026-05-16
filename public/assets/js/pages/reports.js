// ═══════════════════════════════════════════
//  HybridPOS — Reports & Exports Page
// ═══════════════════════════════════════════

const ReportsPage = {
    activeTab:  'sales',
    period:     'this_month',

    async load() {
        document.getElementById('page-content').innerHTML = `
            <div class="tabs-container">
                ${[
                    { id: 'sales',      icon: 'chart-line',     label: 'Sales Report'    },
                    { id: 'profit',     icon: 'balance-scale',  label: 'Profit & Loss'   },
                    { id: 'products',   icon: 'box',            label: 'Top Products'    },
                    { id: 'cashiers',   icon: 'users',          label: 'Cashier Stats'   },
                    { id: 'export',     icon: 'download',       label: 'Export Data'     },
                ].map(tab => `
                    <button class="settings-tab ${tab.id === ReportsPage.activeTab ? 'active' : ''}"
                        data-tab="${tab.id}"
                        onclick="ReportsPage.switchTab('${tab.id}')">
                        <i class="fas fa-${tab.icon}"></i> ${tab.label}
                    </button>
                `).join('')}
            </div>
            <div id="reports-content">
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
        const el = document.getElementById('reports-content');
        el.innerHTML = `<div class="empty-state">
            <i class="fas fa-spinner fa-spin"></i>
        </div>`;

        switch (tab) {
            case 'sales':    await this.loadSales();    break;
            case 'profit':   await this.loadProfit();   break;
            case 'products': await this.loadProducts(); break;
            case 'cashiers': await this.loadCashiers(); break;
            case 'export':        this.loadExport();   break;
        }
    },

    periodSelector(currentPeriod, onchange = 'ReportsPage.changePeriod') {
        return `
            <select onchange="${onchange}(this.value)"
                style="width:auto;min-width:160px;">
                ${[
                    ['today',       'Today'],
                    ['yesterday',   'Yesterday'],
                    ['this_week',   'This Week'],
                    ['last_week',   'Last Week'],
                    ['this_month',  'This Month'],
                    ['last_month',  'Last Month'],
                    ['this_year',   'This Year'],
                    ['last_year',   'Last Year'],
                ].map(([val, label]) => `
                    <option value="${val}"
                        ${currentPeriod === val ? 'selected' : ''}>
                        ${label}
                    </option>
                `).join('')}
            </select>
        `;
    },

    changePeriod(period) {
        this.period = period;
        this.switchTab(this.activeTab);
    },

    // ── Sales Report ─────────────────────
    async loadSales() {
        const [salesRes, dailyRes] = await Promise.all([
            API.get(`/reports/sales?period=${this.period}`),
            API.get(`/reports/daily-sales?period=${this.period}`),
        ]);

        const s     = salesRes?.data?.summary || {};
        const daily = dailyRes?.data          || [];
        const range = salesRes?.data?.period  || {};

        document.getElementById('reports-content').innerHTML = `
            <!-- Period selector -->
            <div style="display:flex;justify-content:space-between;
                align-items:center;margin-bottom:20px;">
                <div>
                    <h3 style="font-weight:700;font-size:16px;">Sales Report</h3>
                    <p style="font-size:12px;color:var(--text-muted);">
                        ${range.start} to ${range.end}
                    </p>
                </div>
                <div style="display:flex;gap:10px;align-items:center;">
                    ${this.periodSelector(this.period)}
                    <button class="btn btn-ghost btn-sm"
                        onclick="ReportsPage.exportReport('sales')">
                        <i class="fas fa-download"></i> Export CSV
                    </button>
                </div>
            </div>

            <!-- Stats -->
            <div class="stats-grid" style="margin-bottom:24px;">
                <div class="stat-card">
                    <div class="stat-icon green">
                        <i class="fas fa-coins"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">
                            ${formatCurrency(s.total_revenue || 0)}
                        </div>
                        <div class="stat-label">Total Revenue</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon purple">
                        <i class="fas fa-receipt"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">
                            ${parseInt(s.completed_orders || 0)}
                        </div>
                        <div class="stat-label">Completed Orders</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon blue">
                        <i class="fas fa-calculator"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">
                            ${formatCurrency(s.avg_order_value || 0)}
                        </div>
                        <div class="stat-label">Avg Order Value</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon yellow">
                        <i class="fas fa-tags"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">
                            ${formatCurrency(s.total_discounts || 0)}
                        </div>
                        <div class="stat-label">Total Discounts</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red">
                        <i class="fas fa-ban"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">
                            ${parseInt(s.voided_orders || 0)}
                        </div>
                        <div class="stat-label">Voided Orders</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon blue">
                        <i class="fas fa-percentage"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">
                            ${formatCurrency(s.total_tax || 0)}
                        </div>
                        <div class="stat-label">Total Tax</div>
                    </div>
                </div>
            </div>

            <!-- Payment breakdown -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Payment Methods</h3>
                    </div>
                    <div class="card-body">
                        ${[
                            ['Cash',  s.cash_revenue,  '#10b981', 'money-bill-wave'],
                            ['MoMo',  s.momo_revenue,  '#f59e0b', 'mobile-alt'],
                            ['Card',  s.card_revenue,  '#3b82f6', 'credit-card'],
                            ['Split', s.split_revenue, '#8b5cf6', 'random'],
                        ].map(([method, amount, color, icon]) => {
                            const total = parseFloat(s.total_revenue || 0);
                            const amt   = parseFloat(amount || 0);
                            const pct   = total > 0 ? ((amt / total) * 100).toFixed(1) : 0;
                            return `
                                <div style="margin-bottom:14px;">
                                    <div style="display:flex;justify-content:space-between;
                                        margin-bottom:5px;">
                                        <div style="display:flex;align-items:center;gap:8px;">
                                            <i class="fas fa-${icon}"
                                                style="color:${color};width:16px;"></i>
                                            <span style="font-size:13px;font-weight:600;">
                                                ${method}
                                            </span>
                                        </div>
                                        <span style="font-weight:700;">
                                            ${formatCurrency(amt)}
                                        </span>
                                    </div>
                                    <div style="background:var(--bg-tertiary);
                                        border-radius:99px;height:6px;overflow:hidden;">
                                        <div style="height:100%;border-radius:99px;
                                            background:${color};width:${pct}%;"></div>
                                    </div>
                                    <div style="font-size:11px;color:var(--text-muted);
                                        margin-top:3px;">${pct}%</div>
                                </div>`;
                        }).join('')}
                    </div>
                </div>

                <!-- Daily sales chart -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Daily Sales</h3>
                    </div>
                    <div class="card-body" style="padding:16px;">
                        ${!daily.length ? `
                            <div class="empty-state" style="padding:20px;">
                                <i class="fas fa-chart-line"></i>
                                <p>No data for this period</p>
                            </div>` :
                            ReportsPage.renderBarChart(daily)
                        }
                    </div>
                </div>
            </div>
        `;
    },

    renderBarChart(daily) {
        if (!daily.length) return '';
        const maxRevenue = Math.max(...daily.map(d => parseFloat(d.revenue)));

        return `
            <div style="display:flex;align-items:flex-end;gap:4px;
                height:160px;padding-bottom:20px;position:relative;">
                ${daily.map(d => {
                    const pct = maxRevenue > 0
                        ? (parseFloat(d.revenue) / maxRevenue) * 100
                        : 0;
                    const date = new Date(d.sale_date);
                    const label = date.toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short'
                    });
                    return `
                        <div style="flex:1;display:flex;flex-direction:column;
                            align-items:center;height:100%;justify-content:flex-end;"
                            title="${label}: ${formatCurrency(d.revenue)}">
                            <div style="width:100%;background:var(--accent);
                                border-radius:4px 4px 0 0;
                                height:${Math.max(pct, 2)}%;
                                transition:height 0.3s ease;
                                opacity:0.8;cursor:pointer;"
                                onmouseover="this.style.opacity='1'"
                                onmouseout="this.style.opacity='0.8'">
                            </div>
                            ${daily.length <= 15 ? `
                                <div style="font-size:9px;color:var(--text-muted);
                                    margin-top:4px;transform:rotate(-45deg);
                                    white-space:nowrap;position:absolute;bottom:0;">
                                    ${date.getDate()}
                                </div>` : ''}
                        </div>`;
                }).join('')}
            </div>
            <div style="display:flex;justify-content:space-between;
                font-size:10px;color:var(--text-muted);">
                <span>${daily[0]?.sale_date}</span>
                <span>${daily[daily.length-1]?.sale_date}</span>
            </div>
        `;
    },

    // ── Profit & Loss ────────────────────
    async loadProfit() {
        const res = await API.get(`/reports/profit-loss?period=${this.period}`);
        const d   = res?.data || {};

        const isProfit = d.net_profit >= 0;

        document.getElementById('reports-content').innerHTML = `
            <div style="display:flex;justify-content:space-between;
                align-items:center;margin-bottom:20px;">
                <div>
                    <h3 style="font-weight:700;font-size:16px;">Profit & Loss</h3>
                    <p style="font-size:12px;color:var(--text-muted);">
                        ${d.period?.start} to ${d.period?.end}
                    </p>
                </div>
                ${this.periodSelector(this.period)}
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;
                gap:20px;margin-bottom:24px;">

                <!-- P&L Statement -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">P&L Statement</h3>
                    </div>
                    <div class="card-body">
                        <div style="display:flex;flex-direction:column;gap:12px;">
                            <div style="display:flex;justify-content:space-between;
                                padding:12px;background:var(--success-light);
                                border-radius:var(--radius-sm);">
                                <span style="font-weight:600;color:var(--success);">
                                    <i class="fas fa-plus-circle"></i> Gross Revenue
                                </span>
                                <strong style="color:var(--success);">
                                    ${formatCurrency(d.gross_revenue || 0)}
                                </strong>
                            </div>
                            <div style="display:flex;justify-content:space-between;
                                padding:12px;background:var(--danger-light);
                                border-radius:var(--radius-sm);">
                                <span style="font-weight:600;color:var(--danger);">
                                    <i class="fas fa-minus-circle"></i> Cost of Goods Sold
                                </span>
                                <strong style="color:var(--danger);">
                                    -${formatCurrency(d.cost_of_goods || 0)}
                                </strong>
                            </div>
                            <div style="display:flex;justify-content:space-between;
                                padding:12px;background:var(--info-light);
                                border-radius:var(--radius-sm);">
                                <span style="font-weight:600;color:var(--info);">
                                    <i class="fas fa-equals"></i> Gross Profit
                                </span>
                                <strong style="color:var(--info);">
                                    ${formatCurrency(d.gross_profit || 0)}
                                </strong>
                            </div>
                            <div style="display:flex;justify-content:space-between;
                                padding:12px;background:var(--danger-light);
                                border-radius:var(--radius-sm);">
                                <span style="font-weight:600;color:var(--danger);">
                                    <i class="fas fa-minus-circle"></i> Total Expenses
                                </span>
                                <strong style="color:var(--danger);">
                                    -${formatCurrency(d.total_expenses || 0)}
                                </strong>
                            </div>
                            <div style="display:flex;justify-content:space-between;
                                padding:16px;
                                background:${isProfit ? 'var(--success-light)' : 'var(--danger-light)'};
                                border-radius:var(--radius-sm);
                                border:2px solid ${isProfit ? 'var(--success)' : 'var(--danger)'};">
                                <span style="font-size:16px;font-weight:800;
                                    color:${isProfit ? 'var(--success)' : 'var(--danger)'};">
                                    <i class="fas fa-${isProfit ? 'arrow-up' : 'arrow-down'}"></i>
                                    Net ${isProfit ? 'Profit' : 'Loss'}
                                </span>
                                <strong style="font-size:20px;
                                    color:${isProfit ? 'var(--success)' : 'var(--danger)'};">
                                    ${formatCurrency(Math.abs(d.net_profit || 0))}
                                </strong>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Margin card -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Key Metrics</h3>
                    </div>
                    <div class="card-body">
                        <div style="display:flex;flex-direction:column;gap:16px;">
                            ${[
                                ['Profit Margin',    `${d.profit_margin || 0}%`,
                                    isProfit ? 'var(--success)' : 'var(--danger)'],
                                ['Gross Revenue',    formatCurrency(d.gross_revenue || 0),
                                    'var(--success)'],
                                ['Cost of Goods',    formatCurrency(d.cost_of_goods || 0),
                                    'var(--danger)'],
                                ['Gross Profit',     formatCurrency(d.gross_profit || 0),
                                    'var(--info)'],
                                ['Operating Costs',  formatCurrency(d.total_expenses || 0),
                                    'var(--warning)'],
                            ].map(([label, value, color]) => `
                                <div style="display:flex;justify-content:space-between;
                                    align-items:center;padding-bottom:12px;
                                    border-bottom:1px solid var(--border);">
                                    <span style="font-size:13px;color:var(--text-secondary);">
                                        ${label}
                                    </span>
                                    <strong style="color:${color};font-size:15px;">
                                        ${value}
                                    </strong>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // ── Top Products ─────────────────────
    async loadProducts() {
        const res      = await API.get(`/reports/top-products?period=${this.period}&limit=20`);
        const products = res?.data || [];
        const maxRev   = Math.max(...products.map(p => parseFloat(p.total_revenue)));

        document.getElementById('reports-content').innerHTML = `
            <div style="display:flex;justify-content:space-between;
                align-items:center;margin-bottom:20px;">
                <h3 style="font-weight:700;font-size:16px;">Top Products</h3>
                <div style="display:flex;gap:10px;">
                    ${this.periodSelector(this.period)}
                    <button class="btn btn-ghost btn-sm"
                        onclick="ReportsPage.exportReport('products')">
                        <i class="fas fa-download"></i> Export
                    </button>
                </div>
            </div>

            <div class="card">
                <div class="card-body" style="padding:0;">
                    ${!products.length ? `
                        <div class="empty-state">
                            <i class="fas fa-box-open"></i>
                            <h3>No sales data</h3>
                            <p>No products sold in this period</p>
                        </div>` : `
                    <div class="table-wrapper">
                        <table>
                            <thead><tr>
                                <th>#</th>
                                <th>Product</th>
                                <th>Category</th>
                                <th>Qty Sold</th>
                                <th>Revenue</th>
                                <th>Cost</th>
                                <th>Profit</th>
                                <th>Orders</th>
                                <th>Performance</th>
                            </tr></thead>
                            <tbody>
                                ${products.map((p, i) => {
                                    const pct = maxRev > 0
                                        ? (parseFloat(p.total_revenue) / maxRev * 100).toFixed(0)
                                        : 0;
                                    const margin = parseFloat(p.total_revenue) > 0
                                        ? ((parseFloat(p.total_profit) /
                                            parseFloat(p.total_revenue)) * 100).toFixed(1)
                                        : 0;
                                    return `
                                    <tr>
                                        <td style="color:var(--text-muted);font-weight:700;">
                                            ${i + 1}
                                        </td>
                                        <td><strong>${p.name}</strong></td>
                                        <td>
                                            <span class="badge badge-purple">
                                                ${p.category_name || 'None'}
                                            </span>
                                        </td>
                                        <td style="font-weight:600;">
                                            ${parseFloat(p.total_qty)} ${p.unit}
                                        </td>
                                        <td style="color:var(--success);font-weight:700;">
                                            ${formatCurrency(p.total_revenue)}
                                        </td>
                                        <td style="color:var(--danger);">
                                            ${formatCurrency(p.total_cost)}
                                        </td>
                                        <td style="color:var(--info);font-weight:700;">
                                            ${formatCurrency(p.total_profit)}
                                            <div style="font-size:10px;color:var(--text-muted);">
                                                ${margin}% margin
                                            </div>
                                        </td>
                                        <td style="color:var(--text-muted);">
                                            ${p.order_count}
                                        </td>
                                        <td style="min-width:100px;">
                                            <div style="background:var(--bg-tertiary);
                                                border-radius:99px;height:6px;overflow:hidden;">
                                                <div style="height:100%;border-radius:99px;
                                                    background:var(--accent);width:${pct}%;"></div>
                                            </div>
                                        </td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>`}
                </div>
            </div>
        `;
    },

    // ── Cashier Performance ──────────────
    async loadCashiers() {
        const res      = await API.get(`/reports/cashiers?period=${this.period}`);
        const cashiers = res?.data || [];

        document.getElementById('reports-content').innerHTML = `
            <div style="display:flex;justify-content:space-between;
                align-items:center;margin-bottom:20px;">
                <h3 style="font-weight:700;font-size:16px;">Cashier Performance</h3>
                ${this.periodSelector(this.period)}
            </div>

            <div class="card">
                <div class="card-body" style="padding:0;">
                    ${!cashiers.length ? `
                        <div class="empty-state">
                            <i class="fas fa-users"></i>
                            <h3>No data</h3>
                            <p>No cashier activity in this period</p>
                        </div>` : `
                    <div class="table-wrapper">
                        <table>
                            <thead><tr>
                                <th>Cashier</th>
                                <th>Orders</th>
                                <th>Revenue</th>
                                <th>Avg Order</th>
                                <th>Discounts Given</th>
                                <th>Voided</th>
                                <th>Performance</th>
                            </tr></thead>
                            <tbody>
                                ${(() => {
                                    const maxRev = Math.max(
                                        ...cashiers.map(c => parseFloat(c.total_revenue))
                                    );
                                    return cashiers.map(c => {
                                        const pct = maxRev > 0
                                            ? (parseFloat(c.total_revenue) / maxRev * 100).toFixed(0)
                                            : 0;
                                        const initials = c.cashier_name
                                            .split(' ')
                                            .map(n => n[0])
                                            .join('')
                                            .substring(0, 2)
                                            .toUpperCase();
                                        return `
                                        <tr>
                                            <td>
                                                <div style="display:flex;
                                                    align-items:center;gap:10px;">
                                                    <div class="user-avatar"
                                                        style="width:32px;height:32px;
                                                        font-size:11px;">
                                                        ${initials}
                                                    </div>
                                                    <strong>${c.cashier_name}</strong>
                                                </div>
                                            </td>
                                            <td>
                                                <span class="badge badge-info">
                                                    ${c.total_orders}
                                                </span>
                                            </td>
                                            <td style="color:var(--success);font-weight:700;">
                                                ${formatCurrency(c.total_revenue)}
                                            </td>
                                            <td>${formatCurrency(c.avg_order_value)}</td>
                                            <td style="color:var(--warning);">
                                                ${formatCurrency(c.total_discounts)}
                                            </td>
                                            <td>
                                                <span class="badge ${parseInt(c.voided_orders) > 0
                                                    ? 'badge-danger' : 'badge-success'}">
                                                    ${c.voided_orders}
                                                </span>
                                            </td>
                                            <td style="min-width:120px;">
                                                <div style="background:var(--bg-tertiary);
                                                    border-radius:99px;height:8px;
                                                    overflow:hidden;">
                                                    <div style="height:100%;border-radius:99px;
                                                        background:var(--accent);
                                                        width:${pct}%;"></div>
                                                </div>
                                                <div style="font-size:11px;
                                                    color:var(--text-muted);margin-top:2px;">
                                                    ${pct}% of top
                                                </div>
                                            </td>
                                        </tr>`;
                                    }).join('');
                                })()}
                            </tbody>
                        </table>
                    </div>`}
                </div>
            </div>
        `;
    },

    // ── Export ───────────────────────────
    loadExport() {
        document.getElementById('reports-content').innerHTML = `
            <div class="card" style="max-width:600px;">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-download"
                            style="color:var(--accent);margin-right:8px;"></i>
                        Export Data
                    </h3>
                </div>
                <div class="card-body">
                    <p style="font-size:13px;color:var(--text-muted);margin-bottom:24px;">
                        Export your data as CSV files that can be opened in
                        Excel, Google Sheets, or any spreadsheet application.
                    </p>

                    <div class="form-row" style="margin-bottom:20px;">
                        <div class="form-group">
                            <label>Period</label>
                            <select id="export-period">
                                <option value="today">Today</option>
                                <option value="yesterday">Yesterday</option>
                                <option value="this_week">This Week</option>
                                <option value="last_week">Last Week</option>
                                <option value="this_month" selected>This Month</option>
                                <option value="last_month">Last Month</option>
                                <option value="this_year">This Year</option>
                                <option value="last_year">Last Year</option>
                            </select>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        ${[
                            {
                                type:  'sales',
                                icon:  'receipt',
                                label: 'Sales Report',
                                desc:  'All orders with payment details',
                                color: 'var(--success)',
                            },
                            {
                                type:  'products',
                                icon:  'box',
                                label: 'Products List',
                                desc:  'All products with stock and pricing',
                                color: 'var(--accent)',
                            },
                            {
                                type:  'expenses',
                                icon:  'file-invoice-dollar',
                                label: 'Expenses',
                                desc:  'All recorded expenses by period',
                                color: 'var(--danger)',
                            },
                            {
                                type:  'stock',
                                icon:  'history',
                                label: 'Stock Movements',
                                desc:  'All stock in/out movements',
                                color: 'var(--warning)',
                            },
                        ].map(item => `
                            <div style="background:var(--bg-tertiary);
                                border-radius:var(--radius);padding:20px;
                                border:1px solid var(--border);
                                transition:var(--transition);"
                                onmouseover="this.style.borderColor='${item.color}'"
                                onmouseout="this.style.borderColor='var(--border)'">
                                <div style="display:flex;align-items:center;
                                    gap:12px;margin-bottom:12px;">
                                    <div style="width:40px;height:40px;
                                        border-radius:var(--radius-sm);
                                        background:${item.color}22;
                                        display:flex;align-items:center;
                                        justify-content:center;
                                        color:${item.color};font-size:18px;">
                                        <i class="fas fa-${item.icon}"></i>
                                    </div>
                                    <div>
                                        <div style="font-weight:700;font-size:14px;">
                                            ${item.label}
                                        </div>
                                        <div style="font-size:11px;color:var(--text-muted);">
                                            ${item.desc}
                                        </div>
                                    </div>
                                </div>
                                <button class="btn btn-primary btn-sm" style="width:100%;
                                    background:${item.color}22;color:${item.color};
                                    border:1px solid ${item.color}44;"
                                    onclick="ReportsPage.exportReport('${item.type}')">
                                    <i class="fas fa-download"></i> Download CSV
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    exportReport(type) {
        const period = document.getElementById('export-period')?.value || this.period;
        const token  = localStorage.getItem('pos_token');
        const url    = `/public/api/reports/export?type=${type}&period=${period}&format=csv`;

        Toast.show(`Preparing ${type} export...`, 'info', 2000);

        // Create a temporary link to download
        const link    = document.createElement('a');
        link.href     = url + `&token=${token}`;
        link.download = `${type}_report_${new Date().toISOString().split('T')[0]}.csv`;

        // Use fetch with auth header
        fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.blob())
        .then(blob => {
            const blobUrl  = URL.createObjectURL(blob);
            link.href      = blobUrl;
            link.download  = `${type}_report_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
            Toast.show(`${type} report downloaded!`, 'success');
        })
        .catch(() => Toast.show('Export failed', 'error'));
    }
};