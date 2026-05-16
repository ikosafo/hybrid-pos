const ProductsPage = {
    data: [],
    categories: [],
    search: '',
    categoryFilter: '',

    async load() {
        document.getElementById('page-content').innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div class="toolbar" style="flex:1;">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" placeholder="Search products..." id="product-search">
                        </div>
                        <select id="category-filter">
                            <option value="">All Categories</option>
                        </select>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="ProductsPage.openModal()">
                        <i class="fas fa-plus"></i> Add Product
                    </button>
                </div>
                <div class="card-body" style="padding:0">
                    <div id="products-table">
                        <div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>
                    </div>
                </div>
            </div>
        `;

        await this.fetchCategories();
        await this.fetchAndRender();

        document.getElementById('product-search').addEventListener('input',
            debounce(e => { this.search = e.target.value; this.fetchAndRender(); }, 400)
        );

        document.getElementById('category-filter').addEventListener('change', e => {
            this.categoryFilter = e.target.value;
            this.fetchAndRender();
        });
    },

    async fetchCategories() {
        const res = await API.get('/categories');
        if (res?.success) {
            this.categories = res.data;
            const sel = document.getElementById('category-filter');
            if (sel) {
                this.categories.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id; opt.textContent = c.name;
                    sel.appendChild(opt);
                });
            }
        }
    },

    async fetchAndRender() {
        let url = '/products?';
        if (this.search)         url += `search=${encodeURIComponent(this.search)}&`;
        if (this.categoryFilter) url += `category_id=${this.categoryFilter}`;
        const res = await API.get(url);
        if (!res?.success) { Toast.show('Failed to load products', 'error'); return; }
        this.data = res.data;
        this.render();
    },

    render() {
        const el = document.getElementById('products-table');
        if (!this.data.length) {
            el.innerHTML = `<div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>No products found</h3>
                <p>Add your first product or adjust your search</p>
            </div>`;
            return;
        }

        el.innerHTML = `
            <div class="table-wrapper">
                <table>
                    <thead><tr>
                        <th>Product</th><th>Category</th><th>Price</th>
                        <th>Cost</th><th>Stock</th><th>Unit</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                        ${this.data.map(p => `
                        <tr>
                            <td>
                                <div style="font-weight:600;">${p.name}</div>
                                ${p.sku ? `<div style="font-size:11px;color:var(--text-muted);">SKU: ${p.sku}</div>` : ''}
                                ${p.barcode ? `<div style="font-size:11px;color:var(--text-muted);">Barcode: ${p.barcode}</div>` : ''}
                            </td>
                            <td>
                                ${p.category_name
                                    ? `<span class="badge badge-purple" style="background:${p.category_color}22;color:${p.category_color};">${p.category_name}</span>`
                                    : '<span class="badge">—</span>'}
                            </td>
                            <td style="font-weight:700;color:var(--accent);">${formatCurrency(p.price)}</td>
                            <td style="color:var(--text-muted);">${formatCurrency(p.cost_price)}</td>
                            <td>
                                <span class="${parseFloat(p.stock_qty) <= p.low_stock_alert ? 'badge badge-danger' : 'badge badge-success'}">
                                    ${parseFloat(p.stock_qty)} ${p.unit}
                                </span>
                            </td>
                            <td style="color:var(--text-muted);">${p.unit}</td>
                            <td>
                                <div style="display:flex;gap:6px;">
                                    <button class="btn btn-ghost btn-sm" onclick="ProductsPage.openModal(${p.id})">
                                        <i class="fas fa-edit"></i> Edit
                                    </button>
                                    <button class="btn btn-danger btn-sm" onclick="ProductsPage.delete(${p.id}, '${p.name.replace(/'/g, "\\'")}')">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    },

    openModal(id = null) {
        const p = id ? this.data.find(x => x.id === id) : null;
        const catOptions = this.categories.map(c =>
            `<option value="${c.id}" ${p?.category_id == c.id ? 'selected' : ''}>${c.name}</option>`
        ).join('');

        Modal.show(`
            <div class="modal-overlay">
                <div class="modal modal-lg">
                    <div class="modal-header">
                        <h3 class="modal-title">${p ? 'Edit' : 'Add'} Product</h3>
                        <button class="btn-icon" onclick="Modal.close()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Product Name *</label>
                            <input type="text" id="p-name" value="${p?.name || ''}" placeholder="e.g. Coca Cola 500ml">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Category</label>
                                <select id="p-category"><option value="">No Category</option>${catOptions}</select>
                            </div>
                            <div class="form-group">
                                <label>Unit</label>
                                <input type="text" id="p-unit" value="${p?.unit || 'pcs'}" placeholder="pcs, kg, bottle...">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Selling Price (₵) *</label>
                                <input type="number" id="p-price" value="${p?.price || ''}" placeholder="0.00" step="0.01" min="0">
                            </div>
                            <div class="form-group">
                                <label>Cost Price (₵)</label>
                                <input type="number" id="p-cost" value="${p?.cost_price || ''}" placeholder="0.00" step="0.01" min="0">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>SKU</label>
                                <input type="text" id="p-sku" value="${p?.sku || ''}" placeholder="Optional">
                            </div>
                            <div class="form-group">
                                <label>Barcode</label>
                                <input type="text" id="p-barcode" value="${p?.barcode || ''}" placeholder="Optional">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Stock Quantity</label>
                                <input type="number" id="p-stock" value="${p?.stock_qty || 0}" step="0.01" min="0">
                            </div>
                            <div class="form-group">
                                <label>Low Stock Alert</label>
                                <input type="number" id="p-low-stock" value="${p?.low_stock_alert || 5}" min="0">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea id="p-description" placeholder="Optional product description">${p?.description || ''}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
                        <button class="btn btn-primary" onclick="ProductsPage.save(${id || 'null'})">
                            <i class="fas fa-save"></i> ${p ? 'Update' : 'Create'} Product
                        </button>
                    </div>
                </div>
            </div>
        `);
        setTimeout(() => document.getElementById('p-name')?.focus(), 100);
    },

    async save(id) {
        const data = {
            name:            document.getElementById('p-name').value.trim(),
            category_id:     document.getElementById('p-category').value || null,
            unit:            document.getElementById('p-unit').value.trim() || 'pcs',
            price:           parseFloat(document.getElementById('p-price').value) || 0,
            cost_price:      parseFloat(document.getElementById('p-cost').value) || 0,
            sku:             document.getElementById('p-sku').value.trim() || null,
            barcode:         document.getElementById('p-barcode').value.trim() || null,
            stock_qty:       parseFloat(document.getElementById('p-stock').value) || 0,
            low_stock_alert: parseInt(document.getElementById('p-low-stock').value) || 5,
            description:     document.getElementById('p-description').value.trim() || null,
            track_stock:     1,
        };

        if (!data.name)  { Toast.show('Product name is required', 'warning'); return; }
        if (!data.price) { Toast.show('Selling price is required', 'warning'); return; }

        const res = id
            ? await API.put(`/products/${id}`, data)
            : await API.post('/products', data);

        if (res?.success) {
            Modal.close();
            Toast.show(`Product ${id ? 'updated' : 'created'} successfully`, 'success');
            await this.fetchAndRender();
        } else {
            Toast.show(res?.message || 'Failed to save product', 'error');
        }
    },

    delete(id, name) {
        Modal.confirm(`Delete "<strong>${name}</strong>"? This cannot be undone.`, async () => {
            const res = await API.delete(`/products/${id}`);
            if (res?.success) {
                Toast.show('Product deleted', 'success');
                await this.fetchAndRender();
            } else {
                Toast.show(res?.message || 'Failed to delete', 'error');
            }
        }, 'Delete Product');
    }
};