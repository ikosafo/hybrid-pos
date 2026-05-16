const OrdersHistoryPage = {
    orders: [],
    currentOrder: null,

    async load() {
        document.getElementById('page-content').innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div class="toolbar" style="flex:1;">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="order-search" placeholder="Search order number...">
                        </div>
                        <select id="order-status-filter">
                            <option value="">All Status</option>
                            <option value="completed">Completed</option>
                            <option value="voided">Voided</option>
                            <option value="refunded">Refunded</option>
                        </select>
                        <select id="order-payment-filter">
                            <option value="">All Payments</option>
                            <option value="cash">Cash</option>
                            <option value="momo">MoMo</option>
                            <option value="card">Card</option>
                            <option value="split">Split</option>
                        </select>
                    </div>
                    <button class="btn btn-ghost btn-sm" onclick="OrdersHistoryPage.fetchAndRender()">
                        <i class="fas fa-sync"></i> Refresh
                    </button>
                </div>
                <div class="card-body" style="padding:0">
                    <div id="orders-table">
                        <div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>
                    </div>
                </div>
                <div style="padding:16px 24px;border-top:1px solid var(--border);display:flex;
                    justify-content:space-between;align-items:center;">
                    <span id="orders-count" style="font-size:13px;color:var(--text-muted);"></span>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-ghost btn-sm" id="prev-btn" onclick="OrdersHistoryPage.prevPage()" disabled>
                            <i class="fas fa-chevron-left"></i> Prev
                        </button>
                        <span id="page-indicator" style="font-size:13px;color:var(--text-muted);
                            display:flex;align-items:center;padding:0 8px;"></span>
                        <button class="btn btn-ghost btn-sm" id="next-btn" onclick="OrdersHistoryPage.nextPage()">
                            Next <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.page   = 1;
        this.limit  = 20;
        await this.fetchAndRender();

        document.getElementById('order-search').addEventListener('input',
            debounce(() => { this.page = 1; this.renderFiltered(); }, 300)
        );
        document.getElementById('order-status-filter').addEventListener('change',
            () => { this.page = 1; this.renderFiltered(); }
        );
        document.getElementById('order-payment-filter').addEventListener('change',
            () => { this.page = 1; this.renderFiltered(); }
        );
    },

    page:  1,
    limit: 20,

    async fetchAndRender() {
        const offset = (this.page - 1) * this.limit;
        const res    = await API.get(`/orders?limit=500&offset=0`);
        if (!res?.success) { Toast.show('Failed to load orders', 'error'); return; }
        this.orders = res.data;
        this.renderFiltered();
    },

    renderFiltered() {
        const search  = document.getElementById('order-search')?.value?.toLowerCase() || '';
        const status  = document.getElementById('order-status-filter')?.value || '';
        const payment = document.getElementById('order-payment-filter')?.value || '';

        let filtered = this.orders;
        if (search)  filtered = filtered.filter(o => o.order_number.toLowerCase().includes(search) ||
            (o.customer_name && o.customer_name.toLowerCase().includes(search)));
        if (status)  filtered = filtered.filter(o => o.status  === status);
        if (payment) filtered = filtered.filter(o => o.payment_method === payment);

        const total  = filtered.length;
        const start  = (this.page - 1) * this.limit;
        const paged  = filtered.slice(start, start + this.limit);

        const countEl = document.getElementById('orders-count');
        const pageEl  = document.getElementById('page-indicator');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');

        if (countEl) countEl.textContent = `${total} order${total !== 1 ? 's' : ''} found`;
        if (pageEl)  pageEl.textContent  = `Page ${this.page} of ${Math.max(1, Math.ceil(total / this.limit))}`;
        if (prevBtn) prevBtn.disabled    = this.page <= 1;
        if (nextBtn) nextBtn.disabled    = start + this.limit >= total;

        this.render(paged, total);
    },

    render(orders, total) {
        const el = document.getElementById('orders-table');
        if (!el) return;

        if (!orders.length) {
            el.innerHTML = `<div class="empty-state">
                <i class="fas fa-receipt"></i>
                <h3>No orders found</h3>
                <p>Try adjusting your filters</p>
            </div>`;
            return;
        }

        el.innerHTML = `
            <div class="table-wrapper">
                <table>
                    <thead><tr>
                        <th>Order #</th><th>Customer</th><th>Cashier</th>
                        <th>Items</th><th>Payment</th><th>Discount</th>
                        <th>Total</th><th>Status</th><th>Date</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                        ${orders.map(o => `
                        <tr>
                            <td><strong style="color:var(--accent);cursor:pointer;"
                                onclick="OrdersHistoryPage.viewOrder(${o.id})">${o.order_number}</strong></td>
                            <td>${o.customer_name || '<span style="color:var(--text-muted);">Guest</span>'}</td>
                            <td>${o.cashier_name}</td>
                            <td><span class="badge badge-info">${o.item_count}</span></td>
                            <td>
                                <span class="badge ${DashboardPage.paymentBadge(o.payment_method)}">
                                    <i class="fas fa-${this.paymentIcon(o.payment_method)}"></i>
                                    ${o.payment_method.toUpperCase()}
                                </span>
                            </td>
                            <td style="color:var(--success);">
                                ${parseFloat(o.discount_amount) > 0
                                    ? formatCurrency(o.discount_amount)
                                    : '<span style="color:var(--text-muted);">—</span>'}
                            </td>
                            <td style="font-weight:700;color:var(--success);">${formatCurrency(o.total_amount)}</td>
                            <td>
                                <span class="badge ${o.status === 'completed' ? 'badge-success' :
                                    o.status === 'voided' ? 'badge-danger' : 'badge-warning'}">
                                    ${o.status}
                                </span>
                            </td>
                            <td style="color:var(--text-muted);font-size:12px;">${formatDateTime(o.created_at)}</td>
                            <td>
                                <div style="display:flex;gap:6px;">
                                    <button class="btn btn-ghost btn-sm"
                                        onclick="OrdersHistoryPage.viewOrder(${o.id})" title="View">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    ${o.status !== 'voided' && Auth.hasRole('superadmin','admin','manager') ? `
                                    <button class="btn btn-danger btn-sm"
                                        onclick="OrdersHistoryPage.voidOrder(${o.id}, '${o.order_number}')" title="Void">
                                        <i class="fas fa-ban"></i>
                                    </button>` : ''}
                                </div>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    },

    prevPage() { if (this.page > 1) { this.page--; this.renderFiltered(); } },
    nextPage() { this.page++; this.renderFiltered(); },

    async viewOrder(id) {
        const res = await API.get(`/orders/${id}`);
        if (!res?.success) { Toast.show('Failed to load order', 'error'); return; }
        const o = res.data;

        Modal.show(`
            <div class="modal-overlay">
                <div class="modal modal-lg">
                    <div class="modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-receipt" style="color:var(--accent);margin-right:8px;"></i>
                            ${o.order_number}
                        </h3>
                        <button class="btn-icon" onclick="Modal.close()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body">

                        <!-- Order Meta -->
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
                            <div style="background:var(--bg-primary);border-radius:var(--radius-sm);padding:14px;">
                                <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">CASHIER</div>
                                <div style="font-weight:600;">${o.cashier_name}</div>
                            </div>
                            <div style="background:var(--bg-primary);border-radius:var(--radius-sm);padding:14px;">
                                <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">CUSTOMER</div>
                                <div style="font-weight:600;">${o.customer_name || 'Guest'}</div>
                            </div>
                            <div style="background:var(--bg-primary);border-radius:var(--radius-sm);padding:14px;">
                                <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">PAYMENT</div>
                                <span class="badge ${DashboardPage.paymentBadge(o.payment_method)}">
                                    ${o.payment_method.toUpperCase()}
                                </span>
                            </div>
                            <div style="background:var(--bg-primary);border-radius:var(--radius-sm);padding:14px;">
                                <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">STATUS</div>
                                <span class="badge ${o.status === 'completed' ? 'badge-success' :
                                    o.status === 'voided' ? 'badge-danger' : 'badge-warning'}">
                                    ${o.status}
                                </span>
                            </div>
                            <div style="background:var(--bg-primary);border-radius:var(--radius-sm);padding:14px;">
                                <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">DATE & TIME</div>
                                <div style="font-weight:600;font-size:13px;">${formatDateTime(o.created_at)}</div>
                            </div>
                            <div style="background:var(--bg-primary);border-radius:var(--radius-sm);padding:14px;">
                                <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">CHANGE GIVEN</div>
                                <div style="font-weight:600;color:var(--success);">${formatCurrency(o.change_due)}</div>
                            </div>
                        </div>

                        <!-- Items Table -->
                        <div class="table-wrapper" style="margin-bottom:16px;">
                            <table>
                                <thead><tr>
                                    <th>Product</th><th>Unit Price</th><th>Qty</th><th>Total</th>
                                </tr></thead>
                                <tbody>
                                    ${o.items.map(i => `
                                    <tr>
                                        <td><strong>${i.product_name}</strong></td>
                                        <td>${formatCurrency(i.unit_price)}</td>
                                        <td><span class="badge badge-info">${i.quantity}</span></td>
                                        <td style="font-weight:700;">${formatCurrency(i.total)}</td>
                                    </tr>`).join('')}
                                </tbody>
                            </table>
                        </div>

                        <!-- Totals -->
                        <div style="background:var(--bg-primary);border-radius:var(--radius-sm);padding:16px;">
                            <div class="summary-row"><span>Subtotal</span><span>${formatCurrency(o.subtotal)}</span></div>
                            ${parseFloat(o.discount_amount) > 0 ? `
                            <div class="summary-row">
                                <span style="color:var(--success);">Discount</span>
                                <span style="color:var(--success);">-${formatCurrency(o.discount_amount)}</span>
                            </div>` : ''}
                            ${parseFloat(o.tax_amount) > 0 ? `
                            <div class="summary-row"><span>Tax</span><span>${formatCurrency(o.tax_amount)}</span></div>` : ''}
                            <div class="summary-row total">
                                <span>TOTAL</span>
                                <span>${formatCurrency(o.total_amount)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
                        <button class="btn btn-primary" onclick="window.print()">
                            <i class="fas fa-print"></i> Print
                        </button>
                        ${o.status !== 'voided' && Auth.hasRole('superadmin','admin','manager') ? `
                        <button class="btn btn-danger"
                            onclick="Modal.close();OrdersHistoryPage.voidOrder(${o.id},'${o.order_number}')">
                            <i class="fas fa-ban"></i> Void Order
                        </button>` : ''}
                    </div>
                </div>
            </div>
        `);
    },

    voidOrder(id, orderNumber) {
        Modal.confirm(
            `Void order <strong>${orderNumber}</strong>? Stock will NOT be automatically restored.`,
            async () => {
                const res = await API.put(`/orders/${id}/void`, {});
                if (res?.success) {
                    Toast.show('Order voided successfully', 'success');
                    await this.fetchAndRender();
                } else {
                    Toast.show(res?.message || 'Failed to void order', 'error');
                }
            },
            'Void Order'
        );
    },

    paymentIcon(method) {
        const map = { cash: 'money-bill-wave', momo: 'mobile-alt', card: 'credit-card', split: 'random', credit: 'file-invoice-dollar' };
        return map[method] || 'money-bill';
    }
};