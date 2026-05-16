const CustomersPage = {
    data: [],

    async load() {
        document.getElementById('page-content').innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div class="search-box" style="flex:1;max-width:320px;">
                        <i class="fas fa-search"></i>
                        <input type="text" placeholder="Search customers..." id="customer-search">
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="CustomersPage.openModal()">
                        <i class="fas fa-plus"></i> Add Customer
                    </button>
                </div>
                <div class="card-body" style="padding:0">
                    <div id="customers-table">
                        <div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>
                    </div>
                </div>
            </div>
        `;
        await this.fetchAndRender();
        document.getElementById('customer-search').addEventListener('input',
            debounce(async e => {
                const res = await API.get(`/customers?search=${encodeURIComponent(e.target.value)}`);
                if (res?.success) { this.data = res.data; this.render(); }
            }, 400)
        );
    },

    async fetchAndRender() {
        const res = await API.get('/customers');
        if (!res?.success) { Toast.show('Failed to load customers', 'error'); return; }
        this.data = res.data;
        this.render();
    },

    render() {
        const el = document.getElementById('customers-table');
        if (!this.data.length) {
            el.innerHTML = `<div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>No customers yet</h3>
                <p>Add your first customer to get started</p>
            </div>`;
            return;
        }
        el.innerHTML = `
            <div class="table-wrapper">
                <table>
                    <thead><tr>
                        <th>Name</th><th>Phone</th><th>Email</th>
                        <th>Total Spent</th><th>Joined</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                        ${this.data.map(c => `
                        <tr>
                            <td>
                                <div style="display:flex;align-items:center;gap:10px;">
                                    <div class="user-avatar" style="width:32px;height:32px;font-size:11px;">
                                        ${c.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
                                    </div>
                                    <strong>${c.name}</strong>
                                </div>
                            </td>
                            <td>${c.phone || '—'}</td>
                            <td>${c.email || '—'}</td>
                            <td style="font-weight:700;color:var(--success);">${formatCurrency(c.total_spent)}</td>
                            <td style="color:var(--text-muted);">${formatDate(c.created_at)}</td>
                            <td>
                                <div style="display:flex;gap:6px;">
                                    <button class="btn btn-ghost btn-sm" onclick="CustomersPage.openModal(${c.id})">
                                        <i class="fas fa-edit"></i> Edit
                                    </button>
                                    <button class="btn btn-danger btn-sm" onclick="CustomersPage.delete(${c.id}, '${c.name.replace(/'/g, "\\'")}')">
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
        const c = id ? this.data.find(x => x.id == id) : null;
        Modal.show(`
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title">${c ? 'Edit' : 'Add'} Customer</h3>
                        <button class="btn-icon" onclick="Modal.close()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Full Name *</label>
                            <input type="text" id="c-name" value="${c?.name || ''}" placeholder="John Doe">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Phone</label>
                                <input type="tel" id="c-phone" value="${c?.phone || ''}" placeholder="024 000 0000">
                            </div>
                            <div class="form-group">
                                <label>Email</label>
                                <input type="email" id="c-email" value="${c?.email || ''}" placeholder="john@example.com">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Address</label>
                            <textarea id="c-address" placeholder="Optional address">${c?.address || ''}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
                        <button class="btn btn-primary" onclick="CustomersPage.save(${id || 'null'})">
                            <i class="fas fa-save"></i> ${c ? 'Update' : 'Create'} Customer
                        </button>
                    </div>
                </div>
            </div>
        `);
        setTimeout(() => document.getElementById('c-name')?.focus(), 100);
    },

    async save(id) {
        const data = {
            name:    document.getElementById('c-name').value.trim(),
            phone:   document.getElementById('c-phone').value.trim() || null,
            email:   document.getElementById('c-email').value.trim() || null,
            address: document.getElementById('c-address').value.trim() || null,
        };
        if (!data.name) { Toast.show('Customer name is required', 'warning'); return; }

        const res = id
            ? await API.put(`/customers/${id}`, data)
            : await API.post('/customers', data);

        if (res?.success) {
            Modal.close();
            Toast.show(`Customer ${id ? 'updated' : 'created'} successfully`, 'success');
            await this.fetchAndRender();
        } else {
            Toast.show(res?.message || 'Failed to save', 'error');
        }
    },

    delete(id, name) {
        Modal.confirm(`Delete customer "<strong>${name}</strong>"?`, async () => {
            const res = await API.delete(`/customers/${id}`);
            if (res?.success) {
                Toast.show('Customer deleted', 'success');
                await this.fetchAndRender();
            } else {
                Toast.show(res?.message || 'Failed to delete', 'error');
            }
        }, 'Delete Customer');
    }
};