// ═══════════════════════════════════════════
//  HybridPOS — POS Page
// ═══════════════════════════════════════════

const POSPage = {
    products:   [],
    categories: [],
    cart:       [],
    selectedCategory: 'all',
    paymentMethod: 'cash',
    discount: 0,
    discountType: 'fixed',
    selectedCustomer: null,

    async load() {
        document.getElementById('page-content').innerHTML = `
            <div class="pos-layout">

                <!-- Left: Products -->
                <div class="pos-products">

                    <!-- Search + Category Tabs -->
                    <div style="display:flex;flex-direction:column;gap:12px;">
                        <div style="display:flex;gap:10px;align-items:center;">
                            <div class="search-box" style="flex:1;">
                                <i class="fas fa-search"></i>
                                <input type="text" id="pos-search" placeholder="Search products or scan barcode...">
                            </div>
                            <button class="btn btn-ghost" onclick="POSPage.openCustomerPicker()" id="customer-btn" title="Select Customer">
                                <i class="fas fa-user"></i>
                                <span id="customer-label">Guest</span>
                            </button>
                        </div>
                        <div class="category-tabs" id="category-tabs">
                            <div class="skeleton" style="height:34px;width:70px;border-radius:99px;"></div>
                            <div class="skeleton" style="height:34px;width:90px;border-radius:99px;"></div>
                            <div class="skeleton" style="height:34px;width:80px;border-radius:99px;"></div>
                        </div>
                    </div>

                    <!-- Products Grid -->
                    <div class="products-grid" id="products-grid">
                        ${[1,2,3,4,5,6].map(() => `
                            <div class="skeleton" style="height:130px;border-radius:12px;"></div>
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
                        <button class="btn btn-ghost btn-sm" onclick="POSPage.clearCart()" title="Clear cart">
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
                        <div class="summary-row" id="customer-summary-row" style="display:none;">
                            <span><i class="fas fa-user" style="margin-right:4px;"></i> Customer</span>
                            <span id="customer-summary-name" style="color:var(--accent);font-weight:600;"></span>
                        </div>

                        <!-- Discount -->
                        <div class="discount-row">
                            <input type="number" id="discount-input" placeholder="Discount" min="0"
                                oninput="POSPage.updateDiscount(this.value)" style="max-width:100px;">
                            <select id="discount-type" onchange="POSPage.updateDiscountType(this.value)"
                                style="flex:1;padding:7px 10px;">
                                <option value="fixed">₵ Fixed</option>
                                <option value="percent">% Percent</option>
                            </select>
                            <button class="btn btn-ghost btn-sm" onclick="POSPage.clearDiscount()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>

                        <div class="summary-row">
                            <span>Subtotal</span>
                            <span id="summary-subtotal">₵0.00</span>
                        </div>
                        <div class="summary-row" id="discount-summary-row" style="display:none;">
                            <span style="color:var(--success);">Discount</span>
                            <span id="summary-discount" style="color:var(--success);">-₵0.00</span>
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
                            <button class="pay-method-btn active" data-method="cash" onclick="POSPage.setPayment('cash')">
                                <i class="fas fa-money-bill-wave"></i> Cash
                            </button>
                            <button class="pay-method-btn" data-method="momo" onclick="POSPage.setPayment('momo')">
                                <i class="fas fa-mobile-alt"></i> MoMo
                            </button>
                            <button class="pay-method-btn" data-method="card" onclick="POSPage.setPayment('card')">
                                <i class="fas fa-credit-card"></i> Card
                            </button>
                            <button class="pay-method-btn" data-method="split" onclick="POSPage.setPayment('split')">
                                <i class="fas fa-random"></i> Split
                            </button>
                        </div>

                        <!-- Checkout -->
                        <button class="checkout-btn" id="checkout-btn" onclick="POSPage.checkout()" disabled>
                            <i class="fas fa-check-circle"></i>
                            <span id="checkout-label">Charge ₵0.00</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        await this.fetchData();
        this.setupSearch();
    },

    async fetchData() {
        const [catRes, prodRes] = await Promise.all([
            API.get('/categories'),
            API.get('/products')
        ]);

        if (catRes?.success)  this.categories = catRes.data;
        if (prodRes?.success) this.products   = prodRes.data;

        this.renderCategories();
        this.renderProducts();
    },

    renderCategories() {
        const el = document.getElementById('category-tabs');
        if (!el) return;

        el.innerHTML = `
            <button class="cat-tab active" data-cat="all" onclick="POSPage.filterCategory('all')">
                <i class="fas fa-th"></i> All
            </button>
            ${this.categories.map(c => `
                <button class="cat-tab" data-cat="${c.id}" onclick="POSPage.filterCategory('${c.id}')"
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

        el.innerHTML = list.map(p => {
            const outOfStock = p.track_stock && parseFloat(p.stock_qty) <= 0;
            return `
                <div class="product-card ${outOfStock ? 'out-of-stock' : ''}"
                    onclick="${outOfStock ? '' : `POSPage.addToCart(${p.id})`}"
                    title="${outOfStock ? 'Out of stock' : p.name}">
                    <div class="product-icon" style="background:${p.category_color ? p.category_color + '22' : 'var(--accent-light)'};
                        color:${p.category_color || 'var(--accent)'};">
                        <i class="fas fa-${p.category_color ? 'box' : 'box'}"></i>
                    </div>
                    <div class="product-name">${p.name}</div>
                    <div class="product-price">${formatCurrency(p.price)}</div>
                    ${p.track_stock
                        ? `<div class="product-stock ${parseFloat(p.stock_qty) <= p.low_stock_alert ? 'style="color:var(--danger)"' : ''}">
                                ${outOfStock ? 'Out of stock' : `${parseFloat(p.stock_qty)} ${p.unit}`}
                           </div>`
                        : ''}
                </div>
            `;
        }).join('');
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
        // Barcode scan — Enter key
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
            if (product.track_stock && existing.quantity >= parseFloat(product.stock_qty)) {
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
                    <div class="cart-item-price">${formatCurrency(item.unit_price)} each</div>
                </div>
                <div class="qty-control">
                    <button class="qty-btn" onclick="POSPage.updateQty(${item.product_id}, -1)">
                        <i class="fas fa-minus"></i>
                    </button>
                    <span class="qty-value">${item.quantity}</span>
                    <button class="qty-btn" onclick="POSPage.updateQty(${item.product_id}, 1)">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div class="cart-item-total">${formatCurrency(item.total)}</div>
                <button class="cart-item-remove" onclick="POSPage.removeFromCart(${item.product_id})">
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
        // Tax rate from settings — hardcoded 0 for now
        return 0;
    },

    getTotal() {
        return Math.max(0, this.getSubtotal() - this.getDiscountAmount() + this.getTax());
    },

    updateSummary() {
        const subtotal  = this.getSubtotal();
        const discount  = this.getDiscountAmount();
        const tax       = this.getTax();
        const total     = this.getTotal();
        const hasItems  = this.cart.length > 0;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

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
        document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.pay-method-btn[data-method="${method}"]`)?.classList.add('active');
    },

    openCustomerPicker() {
        Modal.show(`
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title">Select Customer</h3>
                        <button class="btn-icon" onclick="Modal.close()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body">
                        <div class="search-box" style="margin-bottom:16px;">
                            <i class="fas fa-search"></i>
                            <input type="text" id="customer-picker-search" placeholder="Search customers..."
                                oninput="POSPage.searchCustomers(this.value)">
                        </div>
                        <div id="customer-picker-list">
                            <div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="POSPage.setCustomer(null)">
                            <i class="fas fa-user-slash"></i> Guest / No Customer
                        </button>
                    </div>
                </div>
            </div>
        `);
        this.searchCustomers('');
    },

    async searchCustomers(query) {
        const res = await API.get(`/customers?search=${encodeURIComponent(query)}`);
        const el  = document.getElementById('customer-picker-list');
        if (!el) return;

        if (!res?.success || !res.data.length) {
            el.innerHTML = `<div class="empty-state" style="padding:20px;">
                <i class="fas fa-users"></i><p>No customers found</p>
            </div>`;
            return;
        }

        el.innerHTML = `<div style="display:flex;flex-direction:column;gap:4px;max-height:280px;overflow-y:auto;">
            ${res.data.map(c => `
                <div onclick="POSPage.setCustomer(${JSON.stringify(c).replace(/"/g, '&quot;')})"
                    style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:8px;
                    cursor:pointer;transition:var(--transition);"
                    onmouseover="this.style.background='var(--bg-tertiary)'"
                    onmouseout="this.style.background='transparent'">
                    <div class="user-avatar" style="width:36px;height:36px;font-size:12px;flex-shrink:0;">
                        ${c.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight:600;font-size:14px;">${c.name}</div>
                        <div style="font-size:12px;color:var(--text-muted);">${c.phone || c.email || ''}</div>
                    </div>
                    <div style="margin-left:auto;font-size:12px;color:var(--success);font-weight:600;">
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
        const label      = document.getElementById('customer-label');
        const summaryRow = document.getElementById('customer-summary-row');
        const summaryName= document.getElementById('customer-summary-name');

        if (label)       label.textContent = this.selectedCustomer?.name || 'Guest';
        if (summaryRow)  summaryRow.style.display = this.selectedCustomer ? 'flex' : 'none';
        if (summaryName) summaryName.textContent  = this.selectedCustomer?.name || '';
    },

    async checkout() {
        if (!this.cart.length) return;

        const total    = this.getTotal();
        const subtotal = this.getSubtotal();
        const discount = this.getDiscountAmount();
        const tax      = this.getTax();

        // Show payment modal for cash (to enter amount tendered)
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
                        <button class="btn-icon" onclick="Modal.close()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body">
                        <div style="text-align:center;margin-bottom:24px;">
                            <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">Amount Due</div>
                            <div style="font-size:42px;font-weight:800;color:var(--accent);">${formatCurrency(total)}</div>
                        </div>
                        <div class="form-group">
                            <label>Amount Tendered (₵)</label>
                            <input type="number" id="cash-tendered" placeholder="0.00" min="${total}"
                                step="0.01" style="font-size:20px;text-align:center;padding:14px;"
                                oninput="POSPage.updateChange(${total})">
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;
                            background:var(--success-light);border-radius:var(--radius-sm);padding:14px 18px;margin-top:8px;">
                            <span style="font-size:14px;color:var(--success);font-weight:600;">Change Due</span>
                            <span style="font-size:24px;font-weight:800;color:var(--success);" id="change-display">₵0.00</span>
                        </div>
                        <!-- Quick amounts -->
                        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px;">
                            ${[total, Math.ceil(total/10)*10, Math.ceil(total/50)*50, Math.ceil(total/100)*100]
                                .filter((v, i, a) => a.indexOf(v) === i)
                                .map(amt => `
                                <button class="btn btn-ghost btn-sm" onclick="POSPage.setTendered(${amt}, ${total})">
                                    ${formatCurrency(amt)}
                                </button>`
                            ).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
                        <button class="btn btn-success btn-lg" id="complete-cash-btn"
                            onclick="POSPage.completeCashPayment(${total}, ${subtotal}, ${discount}, ${tax})" disabled>
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
        const tendered = parseFloat(document.getElementById('cash-tendered')?.value) || 0;
        const change   = Math.max(0, tendered - total);
        const display  = document.getElementById('change-display');
        const btn      = document.getElementById('complete-cash-btn');
        if (display) display.textContent = formatCurrency(change);
        if (btn)     btn.disabled = tendered < total;
    },

    completeCashPayment(total, subtotal, discount, tax) {
        const tendered = parseFloat(document.getElementById('cash-tendered')?.value) || 0;
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

        const res = await API.post('/orders', orderData);

        if (res?.success) {
            this.showReceipt(res.data, tendered, change);
            this.cart             = [];
            this.selectedCustomer = null;
            this.discount         = 0;
            this.discountType     = 'fixed';
            this.renderCart();
            this.updateCustomerUI();
            this.clearDiscount();
            // Refresh products to update stock
            const prodRes = await API.get('/products');
            if (prodRes?.success) {
                this.products = prodRes.data;
                this.renderProducts(document.getElementById('pos-search')?.value || '');
            }
        } else {
            Toast.show(res?.message || 'Failed to process order', 'error');
            if (btn) btn.disabled = false;
        }
    },

    showReceipt(order, tendered, change) {
        Modal.show(`
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-check-circle" style="color:var(--success);"></i> Sale Complete!</h3>
                        <button class="btn-icon" onclick="Modal.close()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body">
                        <!-- Receipt -->
                        <div id="receipt-content" style="background:var(--bg-primary);border-radius:var(--radius);
                            padding:20px;font-family:monospace;font-size:13px;line-height:1.8;">
                            <div style="text-align:center;margin-bottom:12px;">
                                <strong style="font-size:16px;">BEST COBB</strong><br>
                                <span style="color:var(--text-muted);">Point of Sale System</span><br>
                                <span style="color:var(--text-muted);font-size:11px;">${new Date().toLocaleString()}</span>
                            </div>
                            <div style="border-top:1px dashed var(--border);margin:10px 0;"></div>
                            <div style="display:flex;justify-content:space-between;">
                                <span>Order #</span><strong>${order.order_number}</strong>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span>Cashier</span><span>${Auth.user.name}</span>
                            </div>
                            ${order.customer_name ? `<div style="display:flex;justify-content:space-between;">
                                <span>Customer</span><span>${order.customer_name}</span>
                            </div>` : ''}
                            <div style="border-top:1px dashed var(--border);margin:10px 0;"></div>
                            ${order.items.map(i => `
                                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                                    <span>${i.product_name} x${i.quantity}</span>
                                    <span>${formatCurrency(i.total)}</span>
                                </div>
                            `).join('')}
                            <div style="border-top:1px dashed var(--border);margin:10px 0;"></div>
                            <div style="display:flex;justify-content:space-between;">
                                <span>Subtotal</span><span>${formatCurrency(order.subtotal)}</span>
                            </div>
                            ${parseFloat(order.discount_amount) > 0 ? `
                            <div style="display:flex;justify-content:space-between;color:var(--success);">
                                <span>Discount</span><span>-${formatCurrency(order.discount_amount)}</span>
                            </div>` : ''}
                            <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;
                                margin-top:8px;color:var(--accent);">
                                <span>TOTAL</span><span>${formatCurrency(order.total_amount)}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;margin-top:4px;">
                                <span>Tendered</span><span>${formatCurrency(tendered)}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;color:var(--success);font-weight:700;">
                                <span>Change</span><span>${formatCurrency(change)}</span>
                            </div>
                            <div style="border-top:1px dashed var(--border);margin:10px 0;"></div>
                            <div style="text-align:center;color:var(--text-muted);font-size:11px;">
                                Thank you for your purchase!<br>
                                Payment: ${order.payment_method.toUpperCase()}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="Modal.close()">
                            <i class="fas fa-times"></i> Close
                        </button>
                        <button class="btn btn-primary" onclick="window.print()">
                            <i class="fas fa-print"></i> Print Receipt
                        </button>
                    </div>
                </div>
            </div>
        `);
    }
};