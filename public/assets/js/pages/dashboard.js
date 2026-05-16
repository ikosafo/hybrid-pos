const DashboardPage = {
    async load() {
        document.getElementById('page-content').innerHTML = `
            <div class="stats-grid" id="stats-grid">
                ${['Today\'s Sales','Orders Today','Total Products','Low Stock'].map((label, i) => `
                <div class="stat-card">
                    <div class="stat-icon ${['green','purple','blue','red'][i]}">
                        <i class="fas ${['fa-coins','fa-receipt','fa-box','fa-exclamation-triangle'][i]}"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value skeleton" style="height:28px;width:80px;margin-bottom:6px;"></div>
                        <div class="stat-label">${label}</div>
                    </div>
                </div>`).join('')}
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;" id="chart-row">
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Payment Methods Today</h3></div>
                    <div class="card-body" id="payment-breakdown">
                        <div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Low Stock Alert</h3></div>
                    <div class="card-body" style="padding:0" id="low-stock-list">
                        <div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Recent Orders</h3>
                    <button class="btn btn-ghost btn-sm" onclick="Router.navigate('orders')">
                        View All <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
                <div class="card-body" style="padding:0" id="recent-orders-table">
                    <div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>
                </div>
            </div>
        `;

        await this.loadStats();
        await Promise.all([
            this.loadRecentOrders(),
            this.loadPaymentBreakdown(),
            this.loadLowStock(),
        ]);
    },

    async loadStats() {
        const [ordersRes, productsRes, lowStockRes] = await Promise.all([
            API.get('/orders?limit=200'),
            API.get('/products'),
            API.get('/products/low-stock'),
        ]);

        const today  = new Date().toDateString();
        const orders = ordersRes?.data || [];

        const todayOrders = orders.filter(o =>
            new Date(o.created_at).toDateString() === today && o.status !== 'voided'
        );

        const todaySales  = todayOrders.reduce((s, o) => s + parseFloat(o.total_amount), 0);
        const totalProds  = productsRes?.data?.length || 0;
        const lowStockCnt = lowStockRes?.data?.length || 0;

        const statCards = document.querySelectorAll('.stat-card');
        const values    = [
            formatCurrency(todaySales),
            todayOrders.length,
            totalProds,
            lowStockCnt,
        ];

        statCards.forEach((card, i) => {
            const skeleton = card.querySelector('.skeleton');
            if (skeleton) {
                skeleton.classList.remove('skeleton');
                skeleton.style = '';
                skeleton.className = 'stat-value';
                skeleton.textContent = values[i];
            }
        });
    },

    async loadRecentOrders() {
        const res = await API.get('/orders?limit=10');
        const el  = document.getElementById('recent-orders-table');
        if (!el) return;

        const orders = res?.data || [];
        if (!orders.length) {
            el.innerHTML = `<div class="empty-state">
                <i class="fas fa-receipt"></i>
                <h3>No orders yet</h3>
                <p>Complete your first sale to see it here</p>
            </div>`;
            return;
        }

        el.innerHTML = `
            <div class="table-wrapper">
                <table>
                    <thead><tr>
                        <th>Order #</th><th>Customer</th><th>Cashier</th>
                        <th>Items</th><th>Payment</th><th>Total</th>
                        <th>Status</th><th>Time</th>
                    </tr></thead>
                    <tbody>
                        ${orders.map(o => `
                        <tr>
                            <td><strong style="color:var(--accent);">${o.order_number}</strong></td>
                            <td>${o.customer_name || '<span style="color:var(--text-muted);">Guest</span>'}</td>
                            <td>${o.cashier_name}</td>
                            <td><span class="badge badge-info">${o.item_count} item${o.item_count != 1 ? 's' : ''}</span></td>
                            <td>
                                <span class="badge ${DashboardPage.paymentBadge(o.payment_method)}">
                                    ${o.payment_method.toUpperCase()}
                                </span>
                            </td>
                            <td style="font-weight:700;color:var(--success);">${formatCurrency(o.total_amount)}</td>
                            <td>
                                <span class="badge ${o.status === 'completed' ? 'badge-success' : o.status === 'voided' ? 'badge-danger' : 'badge-warning'}">
                                    ${o.status}
                                </span>
                            </td>
                            <td style="color:var(--text-muted);font-size:12px;">${formatDateTime(o.created_at)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    },

    async loadPaymentBreakdown() {
        const res    = await API.get('/orders?limit=200');
        const el     = document.getElementById('payment-breakdown');
        if (!el) return;

        const today  = new Date().toDateString();
        const orders = (res?.data || []).filter(o =>
            new Date(o.created_at).toDateString() === today && o.status !== 'voided'
        );

        if (!orders.length) {
            el.innerHTML = `<div class="empty-state" style="padding:20px;">
                <i class="fas fa-chart-pie"></i><p>No sales today yet</p>
            </div>`;
            return;
        }

        const methods = {};
        orders.forEach(o => {
            const m = o.payment_method;
            if (!methods[m]) methods[m] = { count: 0, total: 0 };
            methods[m].count++;
            methods[m].total += parseFloat(o.total_amount);
        });

        const total   = orders.reduce((s, o) => s + parseFloat(o.total_amount), 0);
        const colors  = { cash: '#10b981', momo: '#f59e0b', card: '#3b82f6', split: '#8b5cf6', credit: '#ef4444' };
        const icons   = { cash: 'money-bill-wave', momo: 'mobile-alt', card: 'credit-card', split: 'random', credit: 'file-invoice-dollar' };

        el.innerHTML = Object.entries(methods).map(([method, data]) => {
            const pct = total > 0 ? ((data.total / total) * 100).toFixed(1) : 0;
            const color = colors[method] || '#6366f1';
            return `
                <div style="margin-bottom:16px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;align-items:center;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <i class="fas fa-${icons[method] || 'money-bill'}" style="color:${color};width:16px;"></i>
                            <span style="font-weight:600;font-size:13px;text-transform:uppercase;">${method}</span>
                            <span style="font-size:11px;color:var(--text-muted);">${data.count} order${data.count !== 1 ? 's' : ''}</span>
                        </div>
                        <span style="font-weight:700;font-size:14px;">${formatCurrency(data.total)}</span>
                    </div>
                    <div style="background:var(--bg-tertiary);border-radius:99px;height:8px;overflow:hidden;">
                        <div style="height:100%;border-radius:99px;background:${color};width:${pct}%;
                            transition:width 0.6s ease;"></div>
                    </div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${pct}% of today's revenue</div>
                </div>`;
        }).join('');
    },

    async loadLowStock() {
        const res = await API.get('/products/low-stock');
        const el  = document.getElementById('low-stock-list');
        if (!el) return;

        const products = res?.data || [];
        if (!products.length) {
            el.innerHTML = `<div class="empty-state" style="padding:20px;">
                <i class="fas fa-check-circle" style="color:var(--success);"></i>
                <p style="color:var(--success);">All stock levels are healthy!</p>
            </div>`;
            return;
        }

        el.innerHTML = `
            <div style="max-height:240px;overflow-y:auto;">
                ${products.map(p => `
                <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;
                    border-bottom:1px solid var(--border);">
                    <div class="stat-icon red" style="width:36px;height:36px;font-size:14px;flex-shrink:0;">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${p.name}
                        </div>
                        <div style="font-size:11px;color:var(--text-muted);">${p.category_name || 'No category'}</div>
                    </div>
                    <span class="badge badge-danger">${parseFloat(p.stock_qty)} ${p.unit} left</span>
                </div>`).join('')}
            </div>`;
    },

    paymentBadge(method) {
        const map = { cash: 'badge-success', momo: 'badge-warning', card: 'badge-info', split: 'badge-purple', credit: 'badge-danger' };
        return map[method] || 'badge-info';
    }
};