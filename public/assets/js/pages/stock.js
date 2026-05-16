// ═══════════════════════════════════════════
//  HybridPOS — Stock Management Page
// ═══════════════════════════════════════════

const StockPage = {
    products:   [],
    movements:  [],
    activeTab:  'overview',

    async load() {
        document.getElementById('page-content').innerHTML = `
            <div class="tabs-container">
                ${[
                    { id: 'overview',   icon: 'chart-bar',      label: 'Overview' },
                    { id: 'restock',    icon: 'plus-circle',    label: 'Restock' },
                    { id: 'adjust',     icon: 'sliders-h',      label: 'Adjust Stock' },
                    { id: 'damage',     icon: 'exclamation-triangle', label: 'Damage / Return' },
                    { id: 'movements',  icon: 'history',        label: 'Movement History' },
                ].map(tab => `
                    <button class="settings-tab ${tab.id === StockPage.activeTab ? 'active' : ''}"
                        data-tab="${tab.id}"
                        onclick="StockPage.switchTab('${tab.id}')">
                        <i class="fas fa-${tab.icon}"></i> ${tab.label}
                    </button>
                `).join('')}
            </div>
            <div id="stock-content">
                <div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>
            </div>
        `;

        await this.fetchProducts();
        await this.switchTab(this.activeTab);
    },

    async fetchProducts() {
        const res = await API.get('/products');
        if (res?.success) this.products = res.data;
    },

    async switchTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.settings-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        const el = document.getElementById('stock-content');
        el.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>`;

        switch (tab) {
            case 'overview':  await this.loadOverview();  break;
            case 'restock':        this.loadRestock();   break;
            case 'adjust':         this.loadAdjust();    break;
            case 'damage':         this.loadDamage();    break;
            case 'movements': await this.loadMovements(); break;
        }
    },

    // ── Overview ─────────────────────────
    async loadOverview() {
        const [summaryRes, lowRes] = await Promise.all([
            API.get('/stock/summary'),
            API.get('/products/low-stock'),
        ]);

        const s   = summaryRes?.data || {};
        const low = lowRes?.data     || [];

        document.getElementById('stock-content').innerHTML = `
            <div class="stats-grid" style="margin-bottom:24px;">
                <div class="stat-card">
                    <div class="stat-icon blue">
                        <i class="fas fa-boxes"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">${parseInt(s.total_products || 0)}</div>
                        <div class="stat-label">Total Products</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green">
                        <i class="fas fa-cubes"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">${parseFloat(s.total_units || 0).toFixed(0)}</div>
                        <div class="stat-label">Total Units in Stock</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon purple">
                        <i class="fas fa-tag"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">${formatCurrency(s.total_retail_value || 0)}</div>
                        <div class="stat-label">Retail Value</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon yellow">
                        <i class="fas fa-coins"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">${formatCurrency(s.total_cost_value || 0)}</div>
                        <div class="stat-label">Cost Value</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">${parseInt(s.low_stock_count || 0)}</div>
                        <div class="stat-label">Low Stock Items</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red">
                        <i class="fas fa-times-circle"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">${parseInt(s.out_of_stock_count || 0)}</div>
                        <div class="stat-label">Out of Stock</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-exclamation-triangle"
                            style="color:var(--danger);margin-right:8px;"></i>
                        Low Stock Products
                    </h3>
                    <button class="btn btn-primary btn-sm"
                        onclick="StockPage.switchTab('restock')">
                        <i class="fas fa-plus"></i> Restock
                    </button>
                </div>
                <div class="card-body" style="padding:0;">
                    ${!low.length ? `
                        <div class="empty-state">
                            <i class="fas fa-check-circle" style="color:var(--success);"></i>
                            <h3 style="color:var(--success);">All stock levels healthy!</h3>
                            <p>No products are running low</p>
                        </div>` : `
                    <div class="table-wrapper">
                        <table>
                            <thead><tr>
                                <th>Product</th><th>Category</th><th>Current Stock</th>
                                <th>Alert Level</th><th>Status</th><th>Action</th>
                            </tr></thead>
                            <tbody>
                                ${low.map(p => `
                                <tr>
                                    <td>
                                        <strong>${p.name}</strong>
                                        ${p.sku
                                            ? `<div style="font-size:11px;color:var(--text-muted);">
                                                SKU: ${p.sku}</div>`
                                            : ''}
                                    </td>
                                    <td>${p.category_name ||
                                        '<span style="color:var(--text-muted);">—</span>'}</td>
                                    <td>
                                        <span class="badge ${parseFloat(p.stock_qty) <= 0
                                            ? 'badge-danger' : 'badge-warning'}">
                                            ${parseFloat(p.stock_qty)} ${p.unit}
                                        </span>
                                    </td>
                                    <td style="color:var(--text-muted);">
                                        ${p.low_stock_alert} ${p.unit}
                                    </td>
                                    <td>
                                        <span class="badge ${parseFloat(p.stock_qty) <= 0
                                            ? 'badge-danger' : 'badge-warning'}">
                                            ${parseFloat(p.stock_qty) <= 0
                                                ? 'Out of Stock' : 'Low Stock'}
                                        </span>
                                    </td>
                                    <td>
                                        <button class="btn btn-primary btn-sm"
                                            onclick="StockPage.quickRestock(${p.id}, '${p.name}', '${p.unit}')">
                                            <i class="fas fa-plus"></i> Restock
                                        </button>
                                    </td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>`}
                </div>
            </div>
        `;
    },

    // ── Restock ──────────────────────────
    loadRestock() {
        document.getElementById('stock-content').innerHTML = `
            <div class="card" style="max-width:560px;">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-plus-circle"
                            style="color:var(--success);margin-right:8px;"></i>
                        Restock Product
                    </h3>
                </div>
                <div class="card-body">
                    <div class="form-group">
                        <label>Select Product *</label>
                        <select id="restock-product" onchange="StockPage.showCurrentStock('restock')">
                            <option value="">— Choose Product —</option>
                            ${StockPage.products.map(p => `
                                <option value="${p.id}"
                                    data-stock="${p.stock_qty}"
                                    data-unit="${p.unit}">
                                    ${p.name} (${parseFloat(p.stock_qty)} ${p.unit} in stock)
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div id="restock-current-stock"></div>
                    <div class="form-group">
                        <label>Quantity to Add *</label>
                        <input type="number" id="restock-qty" placeholder="0"
                            min="0.01" step="0.01">
                    </div>
                    <div class="form-group">
                        <label>Notes (optional)</label>
                        <textarea id="restock-notes"
                            placeholder="e.g. Received from supplier, Invoice #123"
                            style="min-height:80px;"></textarea>
                    </div>
                    <button class="btn btn-success btn-lg"
                        onclick="StockPage.submitRestock()">
                        <i class="fas fa-plus-circle"></i> Add Stock
                    </button>
                </div>
            </div>
        `;
    },

    showCurrentStock(type) {
        const sel     = document.getElementById(`${type}-product`);
        const opt     = sel.options[sel.selectedIndex];
        const stock   = opt.dataset.stock;
        const unit    = opt.dataset.unit;
        const el      = document.getElementById(`${type}-current-stock`);
        if (!el || !stock) return;
        el.innerHTML  = `
            <div style="background:var(--info-light);border-radius:var(--radius-sm);
                padding:12px 16px;margin-bottom:16px;display:flex;
                justify-content:space-between;align-items:center;">
                <span style="font-size:13px;color:var(--info);">Current Stock</span>
                <strong style="color:var(--info);">${parseFloat(stock)} ${unit}</strong>
            </div>`;
    },

    async submitRestock() {
        const productId = document.getElementById('restock-product').value;
        const qty       = parseFloat(document.getElementById('restock-qty').value);
        const notes     = document.getElementById('restock-notes').value.trim();

        if (!productId) { Toast.show('Please select a product', 'warning'); return; }
        if (!qty || qty <= 0) { Toast.show('Please enter a valid quantity', 'warning'); return; }

        const res = await API.post('/stock/restock', {
            product_id: parseInt(productId),
            quantity:   qty,
            notes
        });

        if (res?.success) {
            Toast.show(
                `✅ ${res.data.product_name}: ${res.data.qty_before} → ${res.data.qty_after} ${res.data.unit}`,
                'success', 4000
            );
            document.getElementById('restock-product').value = '';
            document.getElementById('restock-qty').value     = '';
            document.getElementById('restock-notes').value   = '';
            document.getElementById('restock-current-stock').innerHTML = '';
            await this.fetchProducts();
        } else {
            Toast.show(res?.message || 'Failed to restock', 'error');
        }
    },

    quickRestock(productId, name, unit) {
        Modal.show(`
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-plus-circle"
                                style="color:var(--success);"></i> Restock
                        </h3>
                        <button class="btn-icon" onclick="Modal.close()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <p style="font-weight:600;margin-bottom:16px;">${name}</p>
                        <div class="form-group">
                            <label>Quantity to Add (${unit}) *</label>
                            <input type="number" id="quick-restock-qty"
                                placeholder="0" min="0.01" step="0.01"
                                style="font-size:20px;text-align:center;padding:14px;">
                        </div>
                        <div class="form-group">
                            <label>Notes</label>
                            <textarea id="quick-restock-notes"
                                placeholder="Optional notes"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
                        <button class="btn btn-success"
                            onclick="StockPage.submitQuickRestock(${productId})">
                            <i class="fas fa-plus"></i> Add Stock
                        </button>
                    </div>
                </div>
            </div>
        `);
        setTimeout(() => document.getElementById('quick-restock-qty')?.focus(), 100);
    },

    async submitQuickRestock(productId) {
        const qty   = parseFloat(document.getElementById('quick-restock-qty').value);
        const notes = document.getElementById('quick-restock-notes').value.trim();

        if (!qty || qty <= 0) { Toast.show('Please enter a valid quantity', 'warning'); return; }

        const res = await API.post('/stock/restock', {
            product_id: productId,
            quantity:   qty,
            notes
        });

        if (res?.success) {
            Modal.close();
            Toast.show(
                `✅ ${res.data.product_name}: ${res.data.qty_before} → ${res.data.qty_after} ${res.data.unit}`,
                'success', 4000
            );
            await this.fetchProducts();
            await this.loadOverview();
        } else {
            Toast.show(res?.message || 'Failed to restock', 'error');
        }
    },

    // ── Adjust ───────────────────────────
    loadAdjust() {
        document.getElementById('stock-content').innerHTML = `
            <div class="card" style="max-width:560px;">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-sliders-h"
                            style="color:var(--warning);margin-right:8px;"></i>
                        Adjust Stock
                    </h3>
                </div>
                <div class="card-body">
                    <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px;">
                        Set the exact stock quantity for a product.
                        Use this after a physical stock count.
                    </p>
                    <div class="form-group">
                        <label>Select Product *</label>
                        <select id="adjust-product"
                            onchange="StockPage.showCurrentStock('adjust')">
                            <option value="">— Choose Product —</option>
                            ${StockPage.products.map(p => `
                                <option value="${p.id}"
                                    data-stock="${p.stock_qty}"
                                    data-unit="${p.unit}">
                                    ${p.name} (${parseFloat(p.stock_qty)} ${p.unit} in stock)
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div id="adjust-current-stock"></div>
                    <div class="form-group">
                        <label>New Quantity *</label>
                        <input type="number" id="adjust-qty"
                            placeholder="Enter actual stock count"
                            min="0" step="0.01">
                    </div>
                    <div class="form-group">
                        <label>Reason *</label>
                        <textarea id="adjust-notes"
                            placeholder="e.g. Physical stock count on 15 May 2026"
                            style="min-height:80px;"></textarea>
                    </div>
                    <button class="btn btn-warning btn-lg"
                        style="color:white;"
                        onclick="StockPage.submitAdjust()">
                        <i class="fas fa-sliders-h"></i> Adjust Stock
                    </button>
                </div>
            </div>
        `;
    },

    async submitAdjust() {
        const productId = document.getElementById('adjust-product').value;
        const qty       = parseFloat(document.getElementById('adjust-qty').value);
        const notes     = document.getElementById('adjust-notes').value.trim();

        if (!productId)     { Toast.show('Please select a product', 'warning'); return; }
        if (isNaN(qty))     { Toast.show('Please enter a valid quantity', 'warning'); return; }
        if (!notes)         { Toast.show('Please provide a reason for adjustment', 'warning'); return; }

        const res = await API.post('/stock/adjust', {
            product_id:   parseInt(productId),
            new_quantity: qty,
            notes
        });

        if (res?.success) {
            Toast.show(
                `✅ ${res.data.product_name}: ${res.data.qty_before} → ${res.data.qty_after} ${res.data.unit}`,
                'success', 4000
            );
            document.getElementById('adjust-product').value = '';
            document.getElementById('adjust-qty').value     = '';
            document.getElementById('adjust-notes').value   = '';
            document.getElementById('adjust-current-stock').innerHTML = '';
            await this.fetchProducts();
        } else {
            Toast.show(res?.message || 'Failed to adjust stock', 'error');
        }
    },

    // ── Damage / Return ──────────────────
    loadDamage() {
        document.getElementById('stock-content').innerHTML = `
            <div class="card" style="max-width:560px;">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-exclamation-triangle"
                            style="color:var(--danger);margin-right:8px;"></i>
                        Record Damage / Return
                    </h3>
                </div>
                <div class="card-body">
                    <div class="form-group">
                        <label>Type *</label>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                            ${[
                                { value: 'damage', icon: 'times-circle',
                                  label: 'Damage',  color: 'var(--danger)' },
                                { value: 'return',  icon: 'undo',
                                  label: 'Return',  color: 'var(--warning)' },
                            ].map(t => `
                                <label style="display:flex;align-items:center;gap:10px;
                                    padding:12px;border:2px solid var(--border);
                                    border-radius:var(--radius-sm);cursor:pointer;
                                    transition:var(--transition);"
                                    onclick="StockPage.selectDamageType('${t.value}', this)">
                                    <input type="radio" name="damage-type"
                                        value="${t.value}"
                                        ${t.value === 'damage' ? 'checked' : ''}
                                        style="display:none;">
                                    <i class="fas fa-${t.icon}"
                                        style="color:${t.color};font-size:18px;"></i>
                                    <span style="font-weight:600;">${t.label}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Select Product *</label>
                        <select id="damage-product"
                            onchange="StockPage.showCurrentStock('damage')">
                            <option value="">— Choose Product —</option>
                            ${StockPage.products.map(p => `
                                <option value="${p.id}"
                                    data-stock="${p.stock_qty}"
                                    data-unit="${p.unit}">
                                    ${p.name} (${parseFloat(p.stock_qty)} ${p.unit} in stock)
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div id="damage-current-stock"></div>
                    <div class="form-group">
                        <label>Quantity *</label>
                        <input type="number" id="damage-qty"
                            placeholder="0" min="0.01" step="0.01">
                    </div>
                    <div class="form-group">
                        <label>Notes *</label>
                        <textarea id="damage-notes"
                            placeholder="e.g. Broken during delivery, Customer returned expired item"
                            style="min-height:80px;"></textarea>
                    </div>
                    <button class="btn btn-danger btn-lg"
                        onclick="StockPage.submitDamage()">
                        <i class="fas fa-exclamation-triangle"></i> Record
                    </button>
                </div>
            </div>
        `;

        // Highlight first option
        const first = document.querySelector('label[onclick*="damage"]');
        if (first) first.style.borderColor = 'var(--danger)';
    },

    selectDamageType(value, label) {
        document.querySelectorAll('label[onclick*="selectDamageType"]').forEach(l => {
            l.style.borderColor = 'var(--border)';
        });
        label.style.borderColor = value === 'damage' ? 'var(--danger)' : 'var(--warning)';
    },

    async submitDamage() {
        const productId = document.getElementById('damage-product').value;
        const qty       = parseFloat(document.getElementById('damage-qty').value);
        const notes     = document.getElementById('damage-notes').value.trim();
        const type      = document.querySelector('input[name="damage-type"]:checked')?.value || 'damage';

        if (!productId)       { Toast.show('Please select a product', 'warning'); return; }
        if (!qty || qty <= 0) { Toast.show('Please enter a valid quantity', 'warning'); return; }
        if (!notes)           { Toast.show('Please provide notes', 'warning'); return; }

        const res = await API.post('/stock/damage', {
            product_id: parseInt(productId),
            quantity:   qty,
            type,
            notes
        });

        if (res?.success) {
            Toast.show(
                `✅ ${res.data.product_name}: ${res.data.qty_before} → ${res.data.qty_after} ${res.data.unit}`,
                'success', 4000
            );
            document.getElementById('damage-product').value = '';
            document.getElementById('damage-qty').value     = '';
            document.getElementById('damage-notes').value   = '';
            document.getElementById('damage-current-stock').innerHTML = '';
            await this.fetchProducts();
        } else {
            Toast.show(res?.message || 'Failed to record', 'error');
        }
    },

    // ── Movement History ─────────────────
    async loadMovements() {
        const res = await API.get('/stock/movements?limit=100');
        const el  = document.getElementById('stock-content');

        const movements = res?.data || [];

        const typeColors = {
            sale:       'badge-danger',
            restock:    'badge-success',
            adjustment: 'badge-warning',
            return:     'badge-info',
            damage:     'badge-danger',
        };

        const typeIcons = {
            sale:       'shopping-cart',
            restock:    'plus-circle',
            adjustment: 'sliders-h',
            return:     'undo',
            damage:     'times-circle',
        };

        el.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-history"
                            style="color:var(--accent);margin-right:8px;"></i>
                        Stock Movement History
                    </h3>
                    <button class="btn btn-ghost btn-sm"
                        onclick="StockPage.loadMovements()">
                        <i class="fas fa-sync"></i> Refresh
                    </button>
                </div>
                <div class="card-body" style="padding:0;">
                    ${!movements.length ? `
                        <div class="empty-state">
                            <i class="fas fa-history"></i>
                            <h3>No movements yet</h3>
                            <p>Stock movements will appear here</p>
                        </div>` : `
                    <div class="table-wrapper">
                        <table>
                            <thead><tr>
                                <th>Product</th><th>Type</th><th>Before</th>
                                <th>Change</th><th>After</th>
                                <th>By</th><th>Notes</th><th>Date</th>
                            </tr></thead>
                            <tbody>
                                ${movements.map(m => `
                                <tr>
                                    <td><strong>${m.product_name}</strong></td>
                                    <td>
                                        <span class="badge ${typeColors[m.type] || 'badge-info'}">
                                            <i class="fas fa-${typeIcons[m.type] || 'circle'}"></i>
                                            ${m.type}
                                        </span>
                                    </td>
                                    <td style="color:var(--text-muted);">
                                        ${parseFloat(m.qty_before)} ${m.product_unit}
                                    </td>
                                    <td style="color:${parseFloat(m.qty_change) >= 0
                                        ? 'var(--success)' : 'var(--danger)'};font-weight:700;">
                                        ${parseFloat(m.qty_change) >= 0 ? '+' : ''}
                                        ${parseFloat(m.qty_change)} ${m.product_unit}
                                    </td>
                                    <td style="font-weight:600;">
                                        ${parseFloat(m.qty_after)} ${m.product_unit}
                                    </td>
                                    <td style="color:var(--text-muted);">${m.user_name}</td>
                                    <td style="color:var(--text-muted);font-size:12px;
                                        max-width:150px;overflow:hidden;
                                        text-overflow:ellipsis;white-space:nowrap;"
                                        title="${m.notes || ''}">
                                        ${m.notes || '—'}
                                    </td>
                                    <td style="color:var(--text-muted);font-size:12px;">
                                        ${formatDateTime(m.created_at)}
                                    </td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>`}
                </div>
            </div>
        `;
    }
};