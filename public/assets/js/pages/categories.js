const CategoriesPage = {
    data: [],

    async load() {
        document.getElementById('page-content').innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Categories</h3>
                    <button class="btn btn-primary btn-sm" onclick="CategoriesPage.openModal()">
                        <i class="fas fa-plus"></i> Add Category
                    </button>
                </div>
                <div class="card-body" style="padding:0">
                    <div id="categories-table">
                        <div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>
                    </div>
                </div>
            </div>
        `;
        await this.fetchAndRender();
    },

    async fetchAndRender() {
        const res = await API.get('/categories');
        if (!res?.success) { Toast.show('Failed to load categories', 'error'); return; }
        this.data = res.data;
        this.render();
    },

    render() {
        const el = document.getElementById('categories-table');
        if (!this.data.length) {
            el.innerHTML = `<div class="empty-state">
                <i class="fas fa-tags"></i>
                <h3>No categories yet</h3>
                <p>Add your first category to get started</p>
            </div>`;
            return;
        }
        el.innerHTML = `
            <div class="table-wrapper">
                <table>
                    <thead><tr>
                        <th>Name</th><th>Color</th><th>Icon</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                        ${this.data.map(c => `
                        <tr>
                            <td><strong>${c.name}</strong></td>
                            <td>
                                <span style="display:inline-flex;align-items:center;gap:8px;">
                                    <span style="width:16px;height:16px;border-radius:4px;background:${c.color};display:inline-block;"></span>
                                    ${c.color}
                                </span>
                            </td>
                            <td><i class="fas fa-${c.icon}"></i> ${c.icon}</td>
                            <td>
                                <div style="display:flex;gap:6px;">
                                    <button class="btn btn-ghost btn-sm" onclick="CategoriesPage.openModal(${c.id})">
                                        <i class="fas fa-edit"></i> Edit
                                    </button>
                                    <button class="btn btn-danger btn-sm" onclick="CategoriesPage.delete(${c.id}, '${c.name}')">
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
        const cat = id ? this.data.find(c => c.id === id) : null;
        Modal.show(`
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title">${cat ? 'Edit' : 'Add'} Category</h3>
                        <button class="btn-icon" onclick="Modal.close()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Category Name *</label>
                            <input type="text" id="cat-name" value="${cat?.name || ''}" placeholder="e.g. Beverages">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Color</label>
                                <input type="color" id="cat-color" value="${cat?.color || '#6366f1'}"
                                    style="height:42px;padding:4px 8px;cursor:pointer;">
                            </div>
                            <div class="form-group">
                                <label>Icon (FontAwesome)</label>
                                <input type="text" id="cat-icon" value="${cat?.icon || 'tag'}" placeholder="e.g. coffee">
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
                        <button class="btn btn-primary" onclick="CategoriesPage.save(${id || 'null'})">
                            <i class="fas fa-save"></i> ${cat ? 'Update' : 'Create'}
                        </button>
                    </div>
                </div>
            </div>
        `);
        setTimeout(() => document.getElementById('cat-name')?.focus(), 100);
    },

    async save(id) {
        const data = {
            name:  document.getElementById('cat-name').value.trim(),
            color: document.getElementById('cat-color').value,
            icon:  document.getElementById('cat-icon').value.trim() || 'tag',
        };
        if (!data.name) { Toast.show('Category name is required', 'warning'); return; }

        const res = id
            ? await API.put(`/categories/${id}`, data)
            : await API.post('/categories', data);

        if (res?.success) {
            Modal.close();
            Toast.show(`Category ${id ? 'updated' : 'created'} successfully`, 'success');
            await this.fetchAndRender();
        } else {
            Toast.show(res?.message || 'Failed to save category', 'error');
        }
    },

    delete(id, name) {
        Modal.confirm(`Delete category "<strong>${name}</strong>"? This cannot be undone.`, async () => {
            const res = await API.delete(`/categories/${id}`);
            if (res?.success) {
                Toast.show('Category deleted', 'success');
                await this.fetchAndRender();
            } else {
                Toast.show(res?.message || 'Failed to delete', 'error');
            }
        }, 'Delete Category');
    }
};