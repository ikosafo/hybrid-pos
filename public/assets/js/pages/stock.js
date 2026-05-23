// ═══════════════════════════════════════════
//  HybridPOS — Stock Management Page
//  v2: Select2 searchable product dropdowns
// ═══════════════════════════════════════════

const StockPage = {
    products:   [],
    movements:  [],
    activeTab:  'overview',

    // ─────────────────────────────────────────────────────────────
    //  Ensure Select2 is loaded (shared helper)
    // ─────────────────────────────────────────────────────────────
    async _ensureSelect2() {
        if (!document.getElementById('select2-css')) {
            const lnk = document.createElement('link');
            lnk.id    = 'select2-css';
            lnk.rel   = 'stylesheet';
            lnk.href  = 'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css';
            document.head.appendChild(lnk);
        }
        if (!window.jQuery) {
            await this._loadScript('https://code.jquery.com/jquery-3.7.1.min.js');
        }
        if (!window.jQuery?.fn?.select2) {
            await this._loadScript(
                'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js'
            );
        }
    },

    _loadScript(src) {
        return new Promise((res, rej) => {
            // Avoid double-loading
            if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
            const s   = document.createElement('script');
            s.src     = src;
            s.onload  = res;
            s.onerror = rej;
            document.head.appendChild(s);
        });
    },

    // ─────────────────────────────────────────────────────────────
    //  Inject the shared Select2 dark-theme overrides once
    // ─────────────────────────────────────────────────────────────
    _injectSelect2Styles() {
        if (document.getElementById('stock-select2-styles')) return;
        const style = document.createElement('style');
        style.id    = 'stock-select2-styles';
        style.textContent = `
            /* ── Stock page Select2 dark overrides ── */
            .stock-select2 + .select2-container { width: 100% !important; }
            .select2-container--default .select2-selection--single {
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                height: 42px;
                display: flex;
                align-items: center;
                padding: 0 12px;
                transition: border-color .15s;
            }
            .select2-container--default.select2-container--focus
                .select2-selection--single,
            .select2-container--default.select2-container--open
                .select2-selection--single {
                border-color: var(--accent);
                outline: none;
            }
            .select2-container--default .select2-selection--single
                .select2-selection__rendered {
                color: var(--text-primary);
                font-size: 13px;
                line-height: 40px;
                padding-left: 0;
            }
            .select2-container--default .select2-selection--single
                .select2-selection__placeholder {
                color: var(--text-muted);
            }
            .select2-container--default .select2-selection--single
                .select2-selection__arrow {
                height: 40px;
                right: 10px;
            }
            .select2-container--default .select2-selection--single
                .select2-selection__arrow b {
                border-color: var(--text-muted) transparent transparent transparent;
            }
            .select2-dropdown {
                background: var(--bg-secondary);
                border: 1px solid var(--accent);
                border-radius: var(--radius-sm);
                box-shadow: 0 10px 32px rgba(0,0,0,.40);
                z-index: 9999;
            }
            .select2-container--default .select2-results__option {
                color: var(--text-primary);
                font-size: 13px;
                padding: 9px 14px;
                border-bottom: 1px solid var(--border);
            }
            .select2-container--default .select2-results__option:last-child {
                border-bottom: none;
            }
            .select2-container--default
                .select2-results__option--highlighted[aria-selected] {
                background: var(--accent);
                color: #fff;
            }
            .select2-container--default
                .select2-results__option[aria-selected=true] {
                background: var(--bg-primary);
                color: var(--accent);
                font-weight: 700;
            }
            .select2-search--dropdown {
                padding: 8px 10px;
                border-bottom: 1px solid var(--border);
                background: var(--bg-primary);
            }
            .select2-search--dropdown .select2-search__field {
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                color: var(--text-primary);
                border-radius: var(--radius-sm);
                padding: 7px 12px;
                font-size: 13px;
                width: 100%;
            }
            .select2-search--dropdown .select2-search__field:focus {
                border-color: var(--accent);
                outline: none;
            }
            .select2-results__options { max-height: 280px; }
            /* Stock sub-label inside option */
            .s2-product-stock {
                float: right;
                font-size: 11px;
                font-weight: 700;
                opacity: .75;
            }
            .s2-product-stock.low  { color: #f59e0b; }
            .s2-product-stock.out  { color: #ef4444; }
            .s2-product-stock.ok   { color: #22c55e; }
        `;
        document.head.appendChild(style);
    },

    // ─────────────────────────────────────────────────────────────
    //  Build a Select2 on a given <select> element id
    //  Adds stock-level badges inside each option using templateResult
    // ─────────────────────────────────────────────────────────────
    _initProductSelect2(selectId, onChangeFn) {
        if (!window.jQuery?.fn?.select2) return;
        const $ = window.jQuery;

        const formatOption = (opt) => {
            if (!opt.id) return opt.text; // placeholder

            const $opt  = $(opt.element);
            const stock = parseFloat($opt.data('stock') || 0);
            const unit  = $opt.data('unit') || '';
            const alert = parseFloat($opt.data('alert') || 0);

            let cls = 'ok';
            if (stock <= 0)           cls = 'out';
            else if (stock <= alert)  cls = 'low';

            const $el = $(
                `<span>${opt.text}
                    <span class="s2-product-stock ${cls}">
                        ${stock} ${unit}
                    </span>
                </span>`
            );
            return $el;
        };

        $(`#${selectId}`).select2({
            theme:                   'default',
            placeholder:             '— Search or choose a product —',
            allowClear:              true,
            width:                   '100%',
            templateResult:          formatOption,
            // Plain text for the selected label (no badge clutter)
            templateSelection: (opt) => opt.text || '— Search or choose a product —',
        });

        if (onChangeFn) {
            $(`#${selectId}`).on('change', onChangeFn);
        }
    },

    // ─────────────────────────────────────────────────────────────
    //  Build the <option> list HTML shared across all three forms
    // ─────────────────────────────────────────────────────────────
    _productOptions() {
        return this.products.map(p => {
            const stock = parseFloat(p.stock_qty);
            const alert = parseFloat(p.low_stock_alert || 0);
            return `<option
                value="${p.id}"
                data-stock="${p.stock_qty}"
                data-unit="${p.unit}"
                data-alert="${alert}">
                ${p.name} (${stock} ${p.unit} in stock)
            </option>`;
        }).join('');
    },

    // ─────────────────────────────────────────────────────────────
    //  LOAD
    // ─────────────────────────────────────────────────────────────
    async load() {
        document.getElementById('page-content').innerHTML = `
            <div class="tabs-container">
                ${[
                    { id: 'overview',   icon: 'chart-bar',            label: 'Overview'          },
                    { id: 'restock',    icon: 'plus-circle',          label: 'Restock'           },
                    { id: 'adjust',     icon: 'sliders-h',            label: 'Adjust Stock'      },
                    { id: 'damage',     icon: 'exclamation-triangle', label: 'Damage / Return'   },
                    { id: 'movements',  icon: 'history',              label: 'Movement History'  },
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

        // Load Select2 and styles early so tabs are instant
        await this._ensureSelect2();
        this._injectSelect2Styles();

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
                    <div class="stat-icon blue"><i class="fas fa-boxes"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${parseInt(s.total_products || 0)}</div>
                        <div class="stat-label">Total Products</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green"><i class="fas fa-cubes"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${parseFloat(s.total_units || 0).toFixed(0)}</div>
                        <div class="stat-label">Total Units in Stock</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon purple"><i class="fas fa-tag"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatCurrency(s.total_retail_value || 0)}</div>
                        <div class="stat-label">Retail Value</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon yellow"><i class="fas fa-coins"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatCurrency(s.total_cost_value || 0)}</div>
                        <div class="stat-label">Cost Value</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${parseInt(s.low_stock_count || 0)}</div>
                        <div class="stat-label">Low Stock Items</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red"><i class="fas fa-times-circle"></i></div>
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
                        <select id="restock-product" class="stock-select2">
                            <option value=""></option>
                            ${this._productOptions()}
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

        this._initProductSelect2('restock-product', () =>
            StockPage.showCurrentStock('restock')
        );
    },

    showCurrentStock(type) {
        const $ = window.jQuery;
        const selectId = `${type}-product`;

        let stock, unit;

        if ($ && $(`#${selectId}`).data('select2')) {
            // Reading from Select2
            const selectedOpt = $(`#${selectId} option:selected`);
            stock = selectedOpt.data('stock');
            unit  = selectedOpt.data('unit');
        } else {
            const sel = document.getElementById(selectId);
            const opt = sel?.options[sel.selectedIndex];
            stock     = opt?.dataset.stock;
            unit      = opt?.dataset.unit;
        }

        const el = document.getElementById(`${type}-current-stock`);
        if (!el || !stock) { if (el) el.innerHTML = ''; return; }

        const stockNum  = parseFloat(stock);
        const alertNum  = parseFloat(
            ($ && $(`#${selectId} option:selected`).data('alert')) || 0
        );
        let color = 'var(--info)';
        let bg    = 'var(--info-light, #eff6ff)';
        if (stockNum <= 0)          { color = 'var(--danger)';  bg = '#fee2e222'; }
        else if (stockNum <= alertNum) { color = 'var(--warning)'; bg = '#fef3c722'; }

        el.innerHTML = `
            <div style="background:${bg};border:1px solid ${color}33;
                border-radius:var(--radius-sm);padding:12px 16px;
                margin-bottom:16px;display:flex;
                justify-content:space-between;align-items:center;">
                <span style="font-size:13px;color:${color};">
                    <i class="fas fa-box" style="margin-right:6px;"></i>
                    Current Stock
                </span>
                <strong style="color:${color};font-size:16px;">
                    ${stockNum} ${unit}
                </strong>
            </div>`;
    },

    async submitRestock() {
        const $ = window.jQuery;
        const productId = $ ? $(`#restock-product`).val()
                            : document.getElementById('restock-product').value;
        const qty   = parseFloat(document.getElementById('restock-qty').value);
        const notes = document.getElementById('restock-notes').value.trim();

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
            if ($) $(`#restock-product`).val(null).trigger('change');
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
                        <select id="adjust-product" class="stock-select2">
                            <option value=""></option>
                            ${this._productOptions()}
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

        this._initProductSelect2('adjust-product', () =>
            StockPage.showCurrentStock('adjust')
        );
    },

    async submitAdjust() {
        const $ = window.jQuery;
        const productId = $ ? $(`#adjust-product`).val()
                            : document.getElementById('adjust-product').value;
        const qty   = parseFloat(document.getElementById('adjust-qty').value);
        const notes = document.getElementById('adjust-notes').value.trim();

        if (!productId)  { Toast.show('Please select a product', 'warning'); return; }
        if (isNaN(qty))  { Toast.show('Please enter a valid quantity', 'warning'); return; }
        if (!notes)      { Toast.show('Please provide a reason for adjustment', 'warning'); return; }

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
            if ($) $(`#adjust-product`).val(null).trigger('change');
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
                        <select id="damage-product" class="stock-select2">
                            <option value=""></option>
                            ${this._productOptions()}
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

        this._initProductSelect2('damage-product', () =>
            StockPage.showCurrentStock('damage')
        );

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
        const $ = window.jQuery;
        const productId = $ ? $(`#damage-product`).val()
                            : document.getElementById('damage-product').value;
        const qty   = parseFloat(document.getElementById('damage-qty').value);
        const notes = document.getElementById('damage-notes').value.trim();
        const type  = document.querySelector('input[name="damage-type"]:checked')?.value || 'damage';

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
            if ($) $(`#damage-product`).val(null).trigger('change');
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