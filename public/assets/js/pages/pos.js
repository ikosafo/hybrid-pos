// ═══════════════════════════════════════════
//  HybridPOS — POS Page
// ═══════════════════════════════════════════

const POSPage = {
    products:         [],
    categories:       [],
    cart:             [],
    selectedCategory: 'all',
    paymentMethod:    'cash',
    discount:         0,
    discountType:     'fixed',
    selectedCustomer: null,
    storeSettings:    null,

    async load() {
        document.getElementById('page-content').innerHTML = `
            <div class="pos-layout">

                <!-- Left: Products -->
                <div class="pos-products">

                    <!-- Search + Category Tabs -->
                    <div style="display:flex;flex-direction:column;gap:12px;">
                        <div style="display:flex;gap:10px;align-items:center;">
                            <div id="pos-offline-banner"
                                style="display:none;background:var(--warning-light);
                                color:var(--warning);padding:8px 14px;
                                border-radius:var(--radius-sm);font-size:12px;
                                font-weight:600;align-items:center;
                                gap:6px;flex-shrink:0;">
                                <i class="fas fa-exclamation-triangle"></i> OFFLINE MODE
                            </div>
                            <div class="search-box" style="flex:1;">
                                <i class="fas fa-search"></i>
                                <input type="text" id="pos-search"
                                    placeholder="Search products or scan barcode...">
                            </div>
                            <button class="btn btn-ghost"
                                onclick="POSPage.openCustomerPicker()"
                                id="customer-btn" title="Select Customer">
                                <i class="fas fa-user"></i>
                                <span id="customer-label">Guest</span>
                            </button>
                        </div>
                        <div class="category-tabs" id="category-tabs">
                            <div class="skeleton"
                                style="height:34px;width:70px;border-radius:99px;"></div>
                            <div class="skeleton"
                                style="height:34px;width:90px;border-radius:99px;"></div>
                            <div class="skeleton"
                                style="height:34px;width:80px;border-radius:99px;"></div>
                        </div>
                    </div>

                    <!-- Products Grid -->
                    <div class="products-grid" id="products-grid">
                        ${[1,2,3,4,5,6].map(() => `
                            <div class="skeleton"
                                style="height:130px;border-radius:12px;"></div>
                        `).join('')}
                    </div>
                </div>

                <!-- Right: Cart -->
                <div class="pos-cart">
                    <div class="cart-header">
                        <div class="cart-title">
                            <i class="fas fa-shopping-cart"></i>
                            Current Order
                            <span class="cart-count" id="cart-count">0</span>
                        </div>
                        <button class="btn btn-ghost btn-sm"
                            onclick="POSPage.clearCart()" title="Clear cart">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>

                    <!-- Cart Items -->
                    <div class="cart-items" id="cart-items">
                        <div class="cart-empty">
                            <i class="fas fa-shopping-basket"></i>
                            <p>Cart is empty</p>
                            <p style="font-size:12px;">Tap a product to add it</p>
                        </div>
                    </div>

                    <!-- Cart Summary -->
                    <div class="cart-summary">

                        <!-- Customer -->
                        <div class="summary-row" id="customer-summary-row"
                            style="display:none;">
                            <span>
                                <i class="fas fa-user" style="margin-right:4px;"></i>
                                Customer
                            </span>
                            <span id="customer-summary-name"
                                style="color:var(--accent);font-weight:600;"></span>
                        </div>

                        <!-- Discount -->
                        <div class="discount-row">
                            <input type="number" id="discount-input"
                                placeholder="Discount" min="0"
                                oninput="POSPage.updateDiscount(this.value)"
                                style="max-width:100px;">
                            <select id="discount-type"
                                onchange="POSPage.updateDiscountType(this.value)"
                                style="flex:1;padding:7px 10px;">
                                <option value="fixed">₵ Fixed</option>
                                <option value="percent">% Percent</option>
                            </select>
                            <button class="btn btn-ghost btn-sm"
                                onclick="POSPage.clearDiscount()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>

                        <div class="summary-row">
                            <span>Subtotal</span>
                            <span id="summary-subtotal">₵0.00</span>
                        </div>
                        <div class="summary-row" id="discount-summary-row"
                            style="display:none;">
                            <span style="color:var(--success);">Discount</span>
                            <span id="summary-discount"
                                style="color:var(--success);">-₵0.00</span>
                        </div>
                        <div class="summary-row">
                            <span>Tax</span>
                            <span id="summary-tax">₵0.00</span>
                        </div>
                        <div class="summary-row total">
                            <span>TOTAL</span>
                            <span id="summary-total">₵0.00</span>
                        </div>

                        <!-- Payment Methods -->
                        <div class="payment-methods" style="margin-top:14px;">
                            <button class="pay-method-btn active"
                                data-method="cash"
                                onclick="POSPage.setPayment('cash')">
                                <i class="fas fa-money-bill-wave"></i> Cash
                            </button>
                            <button class="pay-method-btn"
                                data-method="momo"
                                onclick="POSPage.setPayment('momo')">
                                <i class="fas fa-mobile-alt"></i> MoMo
                            </button>
                            <button class="pay-method-btn"
                                data-method="card"
                                onclick="POSPage.setPayment('card')">
                                <i class="fas fa-credit-card"></i> Card
                            </button>
                            <button class="pay-method-btn"
                                data-method="split"
                                onclick="POSPage.setPayment('split')">
                                <i class="fas fa-random"></i> Split
                            </button>
                        </div>

                        <!-- Checkout -->
                        <button class="checkout-btn" id="checkout-btn"
                            onclick="POSPage.checkout()" disabled>
                            <i class="fas fa-check-circle"></i>
                            <span id="checkout-label">Charge ₵0.00</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Load store settings for receipts
        // Ensure OfflineDB is ready
        if (typeof OfflineDB !== 'undefined' && !OfflineDB.ready) {
            await OfflineDB.init();
        }

        // Load store settings for receipts
        await this.loadStoreSettings();

        // Setup offline banner
        this.updateOfflineBanner();
        window.addEventListener('online',  () => this.updateOfflineBanner());
        window.addEventListener('offline', () => this.updateOfflineBanner());

        await this.fetchData();
        this.setupSearch();
    },

    updateOfflineBanner() {
        const banner = document.getElementById('pos-offline-banner');
        if (banner) {
            banner.style.display = navigator.onLine ? 'none' : 'flex';
        }
    },

    async loadStoreSettings() {
        try {
            if (navigator.onLine) {
                const res = await API.get('/settings');
                if (res?.success) {
                    this.storeSettings = res.data;
                    if (OfflineDB.db) await OfflineDB.saveSettings(res.data);
                }
            } else {
                if (OfflineDB.db) {
                    this.storeSettings = await OfflineDB.getSettings();
                }
            }
        } catch (e) {
            console.warn('[POS] Failed to load store settings:', e);
        }
    },

    async fetchData() {
        if (navigator.onLine) {
            const [catRes, prodRes] = await Promise.all([
                API.get('/categories'),
                API.get('/products')
            ]);

            if (catRes?.success) {
                this.categories = catRes.data;
                await OfflineDB.cacheCategories(catRes.data);
            }
            if (prodRes?.success) {
                this.products = prodRes.data;
                await OfflineDB.cacheProducts(prodRes.data);
            }
        } else {
            this.categories = await OfflineDB.getCachedCategories();
            this.products   = await OfflineDB.getCachedProducts();
            Toast.show('Loaded from offline cache', 'info', 2000);
        }

        this.renderCategories();
        this.renderProducts();
    },

    renderCategories() {
        const el = document.getElementById('category-tabs');
        if (!el) return;

        el.innerHTML = `
            <button class="cat-tab active" data-cat="all"
                onclick="POSPage.filterCategory('all')">
                <i class="fas fa-th"></i> All
            </button>
            ${this.categories.map(c => `
                <button class="cat-tab" data-cat="${c.id}"
                    onclick="POSPage.filterCategory('${c.id}')"
                    style="--cat-color:${c.color};">
                    <i class="fas fa-${c.icon}"></i> ${c.name}
                </button>
            `).join('')}
        `;
    },

    renderProducts(filter = '') {
        const el = document.getElementById('products-grid');
        if (!el) return;

        let list = this.products;

        if (this.selectedCategory !== 'all') {
            list = list.filter(p => p.category_id == this.selectedCategory);
        }

        if (filter) {
            const q = filter.toLowerCase();
            list = list.filter(p =>
                p.name.toLowerCase().includes(q) ||
                (p.barcode && p.barcode.includes(q)) ||
                (p.sku && p.sku.toLowerCase().includes(q))
            );
        }

        if (!list.length) {
            el.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;">
                    <i class="fas fa-box-open"></i>
                    <h3>No products found</h3>
                    <p>Try a different search or category</p>
                </div>`;
            return;
        }

        const CHUNK     = 80;
        const visible   = list.slice(0, CHUNK);
        const remaining = list.length - CHUNK;

        el.innerHTML = visible.map(p => {
            const outOfStock = p.track_stock && parseFloat(p.stock_qty) <= 0;
            return `
                <div class="product-card ${outOfStock ? 'out-of-stock' : ''}"
                    onclick="${outOfStock ? '' : `POSPage.addToCart(${p.id})`}"
                    title="${outOfStock ? 'Out of stock' : p.name}">
                    <div class="product-icon"
                        style="background:${p.category_color
                            ? p.category_color + '22'
                            : 'var(--accent-light)'};
                        color:${p.category_color || 'var(--accent)'};">
                        <i class="fas fa-box"></i>
                    </div>
                    <div class="product-name">${p.name}</div>
                    <div class="product-price">${formatCurrency(p.price)}</div>
                    ${p.track_stock ? `
                        <div class="product-stock"
                            style="${parseFloat(p.stock_qty) <= p.low_stock_alert
                                ? 'color:var(--danger)' : ''}">
                            ${outOfStock
                                ? 'Out of stock'
                                : `${parseFloat(p.stock_qty)} ${p.unit}`}
                        </div>` : ''}
                </div>
            `;
        }).join('');

        if (remaining > 0) {
            el.innerHTML += `
                <div style="grid-column:1/-1;text-align:center;padding:16px;">
                    <button class="btn btn-ghost"
                        onclick="POSPage.loadMoreProducts(${CHUNK}, '${filter}')">
                        <i class="fas fa-chevron-down"></i>
                        Load ${Math.min(remaining, CHUNK)} more
                        (${remaining} remaining)
                    </button>
                </div>`;
        }
    },

    loadMoreProducts(offset, filter = '') {
        const el = document.getElementById('products-grid');
        if (!el) return;

        let list = this.products;
        if (this.selectedCategory !== 'all') {
            list = list.filter(p => p.category_id == this.selectedCategory);
        }
        if (filter) {
            const q = filter.toLowerCase();
            list = list.filter(p =>
                p.name.toLowerCase().includes(q) ||
                (p.barcode && p.barcode.includes(q)) ||
                (p.sku && p.sku.toLowerCase().includes(q))
            );
        }

        const CHUNK     = 80;
        const nextChunk = list.slice(offset, offset + CHUNK);
        const remaining = list.length - offset - CHUNK;

        const loadMoreDiv = el.querySelector('div[style*="grid-column"]');
        if (loadMoreDiv) loadMoreDiv.remove();

        el.innerHTML += nextChunk.map(p => {
            const outOfStock = p.track_stock && parseFloat(p.stock_qty) <= 0;
            return `
                <div class="product-card ${outOfStock ? 'out-of-stock' : ''}"
                    onclick="${outOfStock ? '' : `POSPage.addToCart(${p.id})`}">
                    <div class="product-icon"
                        style="background:${p.category_color
                            ? p.category_color + '22'
                            : 'var(--accent-light)'};
                        color:${p.category_color || 'var(--accent)'};">
                        <i class="fas fa-box"></i>
                    </div>
                    <div class="product-name">${p.name}</div>
                    <div class="product-price">${formatCurrency(p.price)}</div>
                    ${p.track_stock ? `
                        <div class="product-stock">
                            ${outOfStock
                                ? 'Out of stock'
                                : `${parseFloat(p.stock_qty)} ${p.unit}`}
                        </div>` : ''}
                </div>
            `;
        }).join('');

        if (remaining > 0) {
            el.innerHTML += `
                <div style="grid-column:1/-1;text-align:center;padding:16px;">
                    <button class="btn btn-ghost"
                        onclick="POSPage.loadMoreProducts(
                            ${offset + CHUNK}, '${filter}')">
                        <i class="fas fa-chevron-down"></i>
                        Load ${Math.min(remaining, CHUNK)} more
                        (${remaining} remaining)
                    </button>
                </div>`;
        }
    },

    filterCategory(catId) {
        this.selectedCategory = catId;
        document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.cat-tab[data-cat="${catId}"]`)?.classList.add('active');
        this.renderProducts(document.getElementById('pos-search')?.value || '');
    },

    setupSearch() {
        const input = document.getElementById('pos-search');
        if (!input) return;
        input.addEventListener('input', debounce(e => {
            this.renderProducts(e.target.value);
        }, 250));
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                const val = e.target.value.trim();
                if (val) {
                    const product = this.products.find(p => p.barcode === val);
                    if (product) {
                        this.addToCart(product.id);
                        e.target.value = '';
                        this.renderProducts('');
                        Toast.show(`${product.name} added`, 'success', 1500);
                    }
                }
            }
        });
    },

    addToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        const existing = this.cart.find(i => i.product_id === productId);
        if (existing) {
            if (product.track_stock &&
                existing.quantity >= parseFloat(product.stock_qty)) {
                Toast.show('Not enough stock', 'warning');
                return;
            }
            existing.quantity++;
            existing.total = existing.quantity * existing.unit_price;
        } else {
            this.cart.push({
                product_id:  product.id,
                name:        product.name,
                unit_price:  parseFloat(product.price),
                quantity:    1,
                total:       parseFloat(product.price),
                unit:        product.unit,
                stock_qty:   parseFloat(product.stock_qty),
                track_stock: product.track_stock,
            });
        }

        this.renderCart();
    },

    removeFromCart(productId) {
        this.cart = this.cart.filter(i => i.product_id !== productId);
        this.renderCart();
    },

    updateQty(productId, delta) {
        const item = this.cart.find(i => i.product_id === productId);
        if (!item) return;

        const newQty = item.quantity + delta;
        if (newQty <= 0) {
            this.removeFromCart(productId);
            return;
        }

        if (item.track_stock && newQty > item.stock_qty) {
            Toast.show('Not enough stock', 'warning');
            return;
        }

        item.quantity = newQty;
        item.total    = newQty * item.unit_price;
        this.renderCart();
    },

    renderCart() {
        const itemsEl = document.getElementById('cart-items');
        const countEl = document.getElementById('cart-count');
        if (!itemsEl) return;

        const totalItems = this.cart.reduce((s, i) => s + i.quantity, 0);
        if (countEl) countEl.textContent = totalItems;

        if (!this.cart.length) {
            itemsEl.innerHTML = `
                <div class="cart-empty">
                    <i class="fas fa-shopping-basket"></i>
                    <p>Cart is empty</p>
                    <p style="font-size:12px;">Tap a product to add it</p>
                </div>`;
            this.updateSummary();
            return;
        }

        itemsEl.innerHTML = this.cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">
                        ${formatCurrency(item.unit_price)} each
                    </div>
                </div>
                <div class="qty-control">
                    <button class="qty-btn"
                        onclick="POSPage.updateQty(${item.product_id}, -1)">
                        <i class="fas fa-minus"></i>
                    </button>
                    <span class="qty-value">${item.quantity}</span>
                    <button class="qty-btn"
                        onclick="POSPage.updateQty(${item.product_id}, 1)">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div class="cart-item-total">${formatCurrency(item.total)}</div>
                <button class="cart-item-remove"
                    onclick="POSPage.removeFromCart(${item.product_id})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        this.updateSummary();
    },

    getSubtotal() {
        return this.cart.reduce((s, i) => s + i.total, 0);
    },

    getDiscountAmount() {
        const subtotal = this.getSubtotal();
        if (!this.discount) return 0;
        if (this.discountType === 'percent') {
            return subtotal * (this.discount / 100);
        }
        return Math.min(this.discount, subtotal);
    },

    getTax() {
        const taxRate = parseFloat(this.storeSettings?.tax_rate || 0);
        if (!taxRate) return 0;
        return (this.getSubtotal() - this.getDiscountAmount()) * (taxRate / 100);
    },

    getTotal() {
        return Math.max(
            0,
            this.getSubtotal() - this.getDiscountAmount() + this.getTax()
        );
    },

    updateSummary() {
        const subtotal = this.getSubtotal();
        const discount = this.getDiscountAmount();
        const tax      = this.getTax();
        const total    = this.getTotal();
        const hasItems = this.cart.length > 0;

        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        set('summary-subtotal', formatCurrency(subtotal));
        set('summary-discount', '-' + formatCurrency(discount));
        set('summary-tax',      formatCurrency(tax));
        set('summary-total',    formatCurrency(total));
        set('checkout-label',   `Charge ${formatCurrency(total)}`);

        const discountRow = document.getElementById('discount-summary-row');
        if (discountRow) discountRow.style.display = discount > 0 ? 'flex' : 'none';

        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) checkoutBtn.disabled = !hasItems;
    },

    updateDiscount(val) {
        this.discount = parseFloat(val) || 0;
        this.updateSummary();
    },

    updateDiscountType(val) {
        this.discountType = val;
        this.updateSummary();
    },

    clearDiscount() {
        this.discount     = 0;
        this.discountType = 'fixed';
        const inp = document.getElementById('discount-input');
        const sel = document.getElementById('discount-type');
        if (inp) inp.value = '';
        if (sel) sel.value = 'fixed';
        this.updateSummary();
    },

    clearCart() {
        if (!this.cart.length) return;
        Modal.confirm('Clear all items from the cart?', () => {
            this.cart             = [];
            this.selectedCustomer = null;
            this.clearDiscount();
            this.renderCart();
            this.updateCustomerUI();
        }, 'Clear Cart');
    },

    setPayment(method) {
        this.paymentMethod = method;
        document.querySelectorAll('.pay-method-btn').forEach(b =>
            b.classList.remove('active'));
        document.querySelector(
            `.pay-method-btn[data-method="${method}"]`)?.classList.add('active');
    },

    openCustomerPicker() {
        Modal.show(`
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title">Select Customer</h3>
                        <button class="btn-icon" onclick="Modal.close()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="search-box" style="margin-bottom:16px;">
                            <i class="fas fa-search"></i>
                            <input type="text" id="customer-picker-search"
                                placeholder="Search customers..."
                                oninput="POSPage.searchCustomers(this.value)">
                        </div>
                        <div id="customer-picker-list">
                            <div class="empty-state">
                                <i class="fas fa-spinner fa-spin"></i>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost"
                            onclick="POSPage.setCustomer(null)">
                            <i class="fas fa-user-slash"></i> Guest / No Customer
                        </button>
                    </div>
                </div>
            </div>
        `);
        this.searchCustomers('');
    },

    async searchCustomers(query) {
        let customers = [];

        if (navigator.onLine) {
            const res = await API.get(
                `/customers?search=${encodeURIComponent(query)}`
            );
            if (res?.success) customers = res.data;
        } else {
            const cached = await OfflineDB.getCachedCustomers();
            customers = query
                ? cached.filter(c =>
                    c.name.toLowerCase().includes(query.toLowerCase()) ||
                    (c.phone && c.phone.includes(query)))
                : cached;
        }

        const el = document.getElementById('customer-picker-list');
        if (!el) return;

        if (!customers.length) {
            el.innerHTML = `
                <div class="empty-state" style="padding:20px;">
                    <i class="fas fa-users"></i>
                    <p>No customers found</p>
                </div>`;
            return;
        }

        el.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:4px;
                max-height:280px;overflow-y:auto;">
                ${customers.map(c => `
                    <div onclick="POSPage.setCustomer(${
                        JSON.stringify(c).replace(/"/g, '&quot;')})"
                        style="display:flex;align-items:center;gap:12px;
                        padding:10px;border-radius:8px;cursor:pointer;
                        transition:var(--transition);"
                        onmouseover="this.style.background='var(--bg-tertiary)'"
                        onmouseout="this.style.background='transparent'">
                        <div class="user-avatar"
                            style="width:36px;height:36px;
                            font-size:12px;flex-shrink:0;">
                            ${c.name.split(' ').map(n => n[0]).join('')
                                .substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight:600;font-size:14px;">
                                ${c.name}
                            </div>
                            <div style="font-size:12px;color:var(--text-muted);">
                                ${c.phone || c.email || ''}
                            </div>
                        </div>
                        <div style="margin-left:auto;font-size:12px;
                            color:var(--success);font-weight:600;">
                            ${formatCurrency(c.total_spent)}
                        </div>
                    </div>
                `).join('')}
            </div>`;
    },

    setCustomer(customer) {
        this.selectedCustomer = customer;
        this.updateCustomerUI();
        Modal.close();
        if (customer) Toast.show(`Customer: ${customer.name}`, 'info', 2000);
    },

    updateCustomerUI() {
        const label       = document.getElementById('customer-label');
        const summaryRow  = document.getElementById('customer-summary-row');
        const summaryName = document.getElementById('customer-summary-name');

        if (label)       label.textContent       = this.selectedCustomer?.name || 'Guest';
        if (summaryRow)  summaryRow.style.display = this.selectedCustomer ? 'flex' : 'none';
        if (summaryName) summaryName.textContent  = this.selectedCustomer?.name || '';
    },

    async checkout() {
        if (!this.cart.length) return;

        const total    = this.getTotal();
        const subtotal = this.getSubtotal();
        const discount = this.getDiscountAmount();
        const tax      = this.getTax();

        if (this.paymentMethod === 'cash') {
            this.showCashModal(total, subtotal, discount, tax);
        } else {
            this.processOrder(total, subtotal, discount, tax, total, 0);
        }
    },

    showCashModal(total, subtotal, discount, tax) {
        Modal.show(`
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title">Cash Payment</h3>
                        <button class="btn-icon" onclick="Modal.close()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div style="text-align:center;margin-bottom:24px;">
                            <div style="font-size:13px;color:var(--text-muted);
                                margin-bottom:4px;">Amount Due</div>
                            <div style="font-size:42px;font-weight:800;
                                color:var(--accent);">${formatCurrency(total)}</div>
                        </div>
                        <div class="form-group">
                            <label>Amount Tendered (₵)</label>
                            <input type="number" id="cash-tendered"
                                placeholder="0.00" min="${total}" step="0.01"
                                style="font-size:20px;text-align:center;padding:14px;"
                                oninput="POSPage.updateChange(${total})">
                        </div>
                        <div style="display:flex;justify-content:space-between;
                            align-items:center;background:var(--success-light);
                            border-radius:var(--radius-sm);padding:14px 18px;
                            margin-top:8px;">
                            <span style="font-size:14px;color:var(--success);
                                font-weight:600;">Change Due</span>
                            <span style="font-size:24px;font-weight:800;
                                color:var(--success);"
                                id="change-display">₵0.00</span>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(4,1fr);
                            gap:8px;margin-top:16px;">
                            ${[
                                total,
                                Math.ceil(total / 10)  * 10,
                                Math.ceil(total / 50)  * 50,
                                Math.ceil(total / 100) * 100
                            ]
                            .filter((v, i, a) => a.indexOf(v) === i)
                            .map(amt => `
                                <button class="btn btn-ghost btn-sm"
                                    onclick="POSPage.setTendered(${amt}, ${total})">
                                    ${formatCurrency(amt)}
                                </button>`
                            ).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="Modal.close()">
                            Cancel
                        </button>
                        <button class="btn btn-success btn-lg"
                            id="complete-cash-btn"
                            onclick="POSPage.completeCashPayment(
                                ${total}, ${subtotal}, ${discount}, ${tax})"
                            disabled>
                            <i class="fas fa-check"></i> Complete Sale
                        </button>
                    </div>
                </div>
            </div>
        `);
        setTimeout(() => document.getElementById('cash-tendered')?.focus(), 100);
    },

    setTendered(amount, total) {
        const input = document.getElementById('cash-tendered');
        if (input) {
            input.value = amount.toFixed(2);
            this.updateChange(total);
        }
    },

    updateChange(total) {
        const tendered = parseFloat(
            document.getElementById('cash-tendered')?.value) || 0;
        const change   = Math.max(0, tendered - total);
        const display  = document.getElementById('change-display');
        const btn      = document.getElementById('complete-cash-btn');
        if (display) display.textContent = formatCurrency(change);
        if (btn)     btn.disabled        = tendered < total;
    },

    completeCashPayment(total, subtotal, discount, tax) {
        const tendered = parseFloat(
            document.getElementById('cash-tendered')?.value) || 0;
        const change   = Math.max(0, tendered - total);
        Modal.close();
        this.processOrder(total, subtotal, discount, tax, tendered, change);
    },

    async processOrder(total, subtotal, discount, tax, tendered, change) {
        const btn = document.getElementById('checkout-btn');
        if (btn) btn.disabled = true;

        const orderData = {
            customer_id:     this.selectedCustomer?.id || null,
            items:           this.cart.map(i => ({
                product_id:   i.product_id,
                product_name: i.name,
                unit_price:   i.unit_price,
                quantity:     i.quantity,
                total:        i.total,
            })),
            subtotal:        subtotal,
            discount_amount: discount,
            discount_type:   this.discountType,
            tax_amount:      tax,
            total_amount:    total,
            amount_tendered: tendered,
            change_due:      change,
            payment_method:  this.paymentMethod,
        };

        if (navigator.onLine) {
            const res = await API.post('/orders', orderData);
            if (res?.success) {
                this.showReceipt(res.data, tendered, change);
                await this.resetAfterSale();
            } else {
                Toast.show(res?.message || 'Failed to process order', 'error');
                if (btn) btn.disabled = false;
            }
        } else {
            try {
                const offlineOrder = await OfflineDB.queueOrder(orderData);

                for (const item of this.cart) {
                    await OfflineDB.deductStock(item.product_id, item.quantity);
                }

                await SyncManager.updatePendingBadge();

                const s = this.storeSettings || {};
                const fakeOrder = {
                    ...orderData,
                    id:            'offline_' + Date.now(),
                    order_number:  offlineOrder.order_number,
                    cashier_name:  Auth.user.name,
                    customer_name: this.selectedCustomer?.name || null,
                    items:         orderData.items,
                    created_at:    new Date().toISOString(),
                    store_name:    s.store_name,
                    store_address: s.address,
                    store_phone:   s.phone,
                    store_email:   s.email,
                    receipt_footer:s.receipt_footer,
                    is_offline:    true,
                };

                this.showReceipt(fakeOrder, tendered, change);
                Toast.show(
                    'Sale saved offline. Will sync when connected.',
                    'warning', 5000
                );
                await this.resetAfterSale();
            } catch (err) {
                Toast.show(
                    'Failed to save offline order: ' + err.message,
                    'error'
                );
                if (btn) btn.disabled = false;
            }
        }
    },

    async resetAfterSale() {
        this.cart             = [];
        this.selectedCustomer = null;
        this.discount         = 0;
        this.discountType     = 'fixed';
        this.renderCart();
        this.updateCustomerUI();
        this.clearDiscount();

        if (navigator.onLine) {
            const prodRes = await API.get('/products');
            if (prodRes?.success) {
                this.products = prodRes.data;
                await OfflineDB.cacheProducts(prodRes.data);
            }
        } else {
            this.products = await OfflineDB.getCachedProducts();
        }
        this.renderProducts(
            document.getElementById('pos-search')?.value || ''
        );
    },

    showReceipt(order, tendered, change) {
        Modal.show(`
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-check-circle"
                                style="color:var(--success);"></i>
                            Sale Complete!
                            ${order.is_offline
                                ? '<span class="badge badge-warning" style="margin-left:8px;">OFFLINE</span>'
                                : ''}
                        </h3>
                        <button class="btn-icon" onclick="Modal.close()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div id="receipt-content">
                            ${POSPage.buildReceiptHTML(order, tendered, change)}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="Modal.close()">
                            <i class="fas fa-times"></i> Close
                        </button>
                        <button class="btn btn-primary"
                            onclick="POSPage.printReceipt()">
                            <i class="fas fa-print"></i> Print Receipt
                        </button>
                    </div>
                </div>
            </div>
        `);
    },

    buildReceiptHTML(order, tendered, change) {
        const s = this.storeSettings || {};
        return `
            <div class="thermal-receipt">
                <div class="receipt-header">
                    <div class="receipt-store-name">
                        ${s.store_name || order.store_name || 'BEST COBB'}
                    </div>
                    ${(s.address || order.store_address) ? `
                        <div class="receipt-store-info">
                            ${s.address || order.store_address}
                        </div>` : ''}
                    ${(s.phone || order.store_phone) ? `
                        <div class="receipt-store-info">
                            ${s.phone || order.store_phone}
                        </div>` : ''}
                    ${(s.email || order.store_email) ? `
                        <div class="receipt-store-info">
                            ${s.email || order.store_email}
                        </div>` : ''}
                    <div class="receipt-divider">================================</div>
                </div>
                <div class="receipt-meta">
                    <div class="receipt-row">
                        <span>Receipt #</span>
                        <span>${order.order_number}</span>
                    </div>
                    <div class="receipt-row">
                        <span>Date</span>
                        <span>${new Date(order.created_at)
                            .toLocaleDateString('en-GB')}</span>
                    </div>
                    <div class="receipt-row">
                        <span>Time</span>
                        <span>${new Date(order.created_at)
                            .toLocaleTimeString()}</span>
                    </div>
                    <div class="receipt-row">
                        <span>Cashier</span>
                        <span>${order.cashier_name || Auth.user.name}</span>
                    </div>
                    ${order.customer_name ? `
                    <div class="receipt-row">
                        <span>Customer</span>
                        <span>${order.customer_name}</span>
                    </div>` : ''}
                    ${order.is_offline ? `
                    <div class="receipt-row">
                        <span>Mode</span>
                        <span>OFFLINE</span>
                    </div>` : ''}
                    <div class="receipt-divider">================================</div>
                </div>
                <div class="receipt-items">
                    <div class="receipt-items-header">
                        <span>ITEM</span>
                        <span>QTY</span>
                        <span>PRICE</span>
                        <span>TOTAL</span>
                    </div>
                    <div class="receipt-divider">--------------------------------</div>
                    ${order.items.map(i => `
                    <div class="receipt-item">
                        <span class="receipt-item-name">${i.product_name}</span>
                        <span>${i.quantity}</span>
                        <span>${formatCurrency(i.unit_price)}</span>
                        <span>${formatCurrency(i.total)}</span>
                    </div>`).join('')}
                    <div class="receipt-divider">--------------------------------</div>
                </div>
                <div class="receipt-totals">
                    <div class="receipt-row">
                        <span>Subtotal</span>
                        <span>${formatCurrency(order.subtotal)}</span>
                    </div>
                    ${parseFloat(order.discount_amount) > 0 ? `
                    <div class="receipt-row">
                        <span>Discount</span>
                        <span>-${formatCurrency(order.discount_amount)}</span>
                    </div>` : ''}
                    ${parseFloat(order.tax_amount) > 0 ? `
                    <div class="receipt-row">
                        <span>Tax</span>
                        <span>${formatCurrency(order.tax_amount)}</span>
                    </div>` : ''}
                    <div class="receipt-divider">================================</div>
                    <div class="receipt-row receipt-total">
                        <span>TOTAL</span>
                        <span>${formatCurrency(order.total_amount)}</span>
                    </div>
                    <div class="receipt-divider">================================</div>
                    <div class="receipt-row">
                        <span>Tendered</span>
                        <span>${formatCurrency(tendered)}</span>
                    </div>
                    <div class="receipt-row">
                        <span>Change</span>
                        <span>${formatCurrency(change)}</span>
                    </div>
                    <div class="receipt-row">
                        <span>Payment</span>
                        <span>${order.payment_method.toUpperCase()}</span>
                    </div>
                </div>
                <div class="receipt-footer">
                    <div class="receipt-divider">================================</div>
                    <div class="receipt-footer-text">
                        ${s.receipt_footer
                            || order.receipt_footer
                            || 'Thank you for your purchase!'}
                    </div>
                    <div class="receipt-footer-text">Please keep this receipt</div>
                </div>
            </div>
        `;
    },

    printReceipt() {
        const content = document.getElementById('receipt-content')?.innerHTML;
        if (!content) return;

        const printWindow = window.open('', '_blank', 'width=320,height=600');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Receipt</title>
                <style>
                    * { margin:0; padding:0; box-sizing:border-box; }
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 12px;
                        width: 80mm;
                        padding: 4mm;
                        color: #000;
                        background: #fff;
                    }
                    .thermal-receipt { width: 100%; }
                    .receipt-store-name {
                        text-align: center;
                        font-size: 16px;
                        font-weight: bold;
                        margin-bottom: 4px;
                        text-transform: uppercase;
                    }
                    .receipt-store-info {
                        text-align: center;
                        font-size: 11px;
                        margin-bottom: 2px;
                    }
                    .receipt-divider {
                        text-align: center;
                        font-size: 11px;
                        margin: 4px 0;
                        letter-spacing: 0;
                    }
                    .receipt-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 3px;
                        font-size: 12px;
                    }
                    .receipt-items-header {
                        display: grid;
                        grid-template-columns: 2fr 0.5fr 1fr 1fr;
                        font-weight: bold;
                        font-size: 11px;
                        margin-bottom: 2px;
                    }
                    .receipt-item {
                        display: grid;
                        grid-template-columns: 2fr 0.5fr 1fr 1fr;
                        margin-bottom: 3px;
                        font-size: 11px;
                    }
                    .receipt-item-name {
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .receipt-total {
                        font-weight: bold;
                        font-size: 14px;
                    }
                    .receipt-footer { margin-top: 8px; }
                    .receipt-footer-text {
                        text-align: center;
                        font-size: 11px;
                        margin-bottom: 3px;
                    }
                    @media print {
                        body { width: 80mm; }
                        @page { size: 80mm auto; margin: 0; }
                    }
                </style>
            </head>
            <body>${content}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    },
};