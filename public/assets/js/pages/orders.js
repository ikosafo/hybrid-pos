// ═══════════════════════════════════════════════════════════════════
//  HybridPOS — Orders History & Audit Report Page
//  v2: Cashier "My Sales" self-filter + All Orders toggle
// ═══════════════════════════════════════════════════════════════════

const OrdersHistoryPage = {
    orders:          [],
    _filteredOrders: [],
    page:            1,
    limit:           25,

    // ─────────────────────────────────────────────────────────────
    //  LOAD
    // ─────────────────────────────────────────────────────────────
    async load() {

        // Inject Select2 CSS + JS if not already present
        if (!document.getElementById('select2-css')) {
            const lnk = document.createElement('link');
            lnk.id   = 'select2-css';
            lnk.rel  = 'stylesheet';
            lnk.href = 'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css';
            document.head.appendChild(lnk);
        }
        if (!window.jQuery) {
            await this._loadScript('https://code.jquery.com/jquery-3.7.1.min.js');
        }
        if (!window.jQuery?.fn?.select2) {
            await this._loadScript('https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js');
        }

        // Determine if the current user is a cashier-only role
        const isCashierOnly = Auth.hasRole('cashier') &&
            !Auth.hasRole('superadmin', 'admin', 'manager');

        // Get current user's display name for self-filter
        const currentUserName = Auth.user?.name || Auth.currentUser?.name || '';

        document.getElementById('page-content').innerHTML = `

        <!-- ══ PAGE STYLES ══════════════════════════════════════ -->
        <style>
            /* ── Select2 dark-theme overrides ── */
            .select2-container--default .select2-selection--single {
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                height: 38px;
                display: flex;
                align-items: center;
                padding: 0 10px;
            }
            .select2-container--default .select2-selection--single
                .select2-selection__rendered {
                color: var(--text-primary);
                font-size: 13px;
                line-height: 36px;
                padding-left: 0;
            }
            .select2-container--default .select2-selection--single
                .select2-selection__arrow {
                height: 36px;
                right: 8px;
            }
            .select2-container--default .select2-selection--single
                .select2-selection__arrow b {
                border-color: var(--text-muted) transparent transparent transparent;
            }
            .select2-dropdown {
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                box-shadow: 0 8px 24px rgba(0,0,0,.35);
            }
            .select2-container--default .select2-results__option {
                color: var(--text-primary);
                font-size: 13px;
                padding: 8px 14px;
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
            }
            .select2-search--dropdown .select2-search__field {
                background: var(--bg-primary);
                border: 1px solid var(--border);
                color: var(--text-primary);
                border-radius: var(--radius-sm);
                padding: 6px 10px;
                font-size: 13px;
            }
            .select2-container { width: 100% !important; }

            /* ── View-as toggle ── */
            .oh-view-toggle {
                display: inline-flex;
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                overflow: hidden;
                background: var(--bg-primary);
            }
            .oh-view-toggle button {
                padding: 8px 16px;
                font-size: 12px;
                font-weight: 700;
                letter-spacing: .4px;
                border: none;
                background: transparent;
                color: var(--text-muted);
                cursor: pointer;
                transition: all .15s;
                display: flex;
                align-items: center;
                gap: 6px;
                white-space: nowrap;
            }
            .oh-view-toggle button.active {
                background: var(--accent);
                color: #fff;
            }
            .oh-view-toggle button:not(.active):hover {
                background: var(--bg-secondary);
                color: var(--text-primary);
            }
            /* My Sales pill badge */
            .oh-my-sales-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 5px 12px;
                background: var(--accent)22;
                border: 1px solid var(--accent)44;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 700;
                color: var(--accent);
                letter-spacing: .3px;
            }
            .oh-my-sales-badge i { font-size: 10px; }

            /* ── Filter card ── */
            .oh-filter-card {
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 24px 28px 20px;
                margin-bottom: 20px;
            }
            .oh-filter-title {
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 1.2px;
                color: var(--text-muted);
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .oh-filter-title i { color: var(--accent); }
            .oh-filter-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 14px;
                align-items: end;
            }
            .oh-filter-group label {
                display: block;
                font-size: 11px;
                font-weight: 600;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: .6px;
                margin-bottom: 6px;
            }
            .oh-filter-group input[type=date],
            .oh-filter-group input[type=text] {
                width: 100%;
                padding: 8px 12px;
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                color: var(--text-primary);
                font-size: 13px;
                height: 38px;
            }
            .oh-filter-group input:focus {
                outline: none;
                border-color: var(--accent);
            }
            .oh-filter-actions {
                display: flex;
                gap: 10px;
                margin-top: 18px;
                padding-top: 16px;
                border-top: 1px solid var(--border);
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
            }

            /* ── KPI strip ── */
            .oh-kpi-strip {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 12px;
                margin-bottom: 16px;
            }
            .oh-kpi {
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 16px 18px;
                border-top: 3px solid var(--accent);
                transition: transform .15s ease, box-shadow .15s ease;
            }
            .oh-kpi:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0,0,0,.18);
            }
            .oh-kpi-icon {
                width: 32px; height: 32px;
                border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                font-size: 14px;
                margin-bottom: 10px;
            }
            .oh-kpi-val {
                font-size: 22px;
                font-weight: 800;
                line-height: 1;
                margin-bottom: 4px;
            }
            .oh-kpi-lbl {
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: .6px;
                color: var(--text-muted);
            }
            .oh-kpi-sub {
                font-size: 11px;
                color: var(--text-muted);
                margin-top: 4px;
            }

            /* ── Payment breakdown ── */
            .oh-pay-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 12px;
                margin-bottom: 20px;
            }
            .oh-pay-card {
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 16px 18px;
                display: flex;
                align-items: center;
                gap: 14px;
            }
            .oh-pay-icon {
                width: 40px; height: 40px;
                border-radius: 10px;
                display: flex; align-items: center; justify-content: center;
                font-size: 16px;
                flex-shrink: 0;
            }
            .oh-pay-details { flex: 1; min-width: 0; }
            .oh-pay-method { font-size: 13px; font-weight: 700; }
            .oh-pay-amount { font-size: 18px; font-weight: 800; color: var(--success); }
            .oh-pay-meta { font-size: 11px; color: var(--text-muted); }
            .oh-pay-bar-wrap {
                height: 4px;
                background: var(--border);
                border-radius: 2px;
                margin-top: 6px;
                overflow: hidden;
            }
            .oh-pay-bar {
                height: 100%;
                border-radius: 2px;
                background: var(--accent);
                transition: width .5s cubic-bezier(.4,0,.2,1);
            }

            /* ── Section header ── */
            .oh-section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            .oh-section-title {
                font-size: 13px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: .8px;
                color: var(--text-muted);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .oh-section-title i { color: var(--accent); }

            /* ── Export buttons ── */
            .oh-export-btn {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                padding: 8px 16px;
                border-radius: var(--radius-sm);
                font-size: 12px;
                font-weight: 700;
                letter-spacing: .4px;
                cursor: pointer;
                border: 1px solid var(--border);
                background: var(--bg-secondary);
                color: var(--text-primary);
                transition: all .15s;
            }
            .oh-export-btn:hover {
                background: var(--accent);
                border-color: var(--accent);
                color: #fff;
            }
            .oh-export-btn.csv { border-color: #16a34a; color: #16a34a; }
            .oh-export-btn.csv:hover { background: #16a34a; color: #fff; }
            .oh-export-btn.pdf { border-color: #dc2626; color: #dc2626; }
            .oh-export-btn.pdf:hover { background: #dc2626; color: #fff; }

            /* ── Table ── */
            .oh-table-card {
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                overflow: hidden;
                margin-bottom: 16px;
            }
            .oh-table-card table { width: 100%; border-collapse: collapse; }
            .oh-table-card thead th {
                background: var(--bg-primary);
                padding: 11px 14px;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: .7px;
                color: var(--text-muted);
                border-bottom: 2px solid var(--border);
                white-space: nowrap;
            }
            .oh-table-card tbody td {
                padding: 11px 14px;
                font-size: 13px;
                border-bottom: 1px solid var(--border);
                vertical-align: middle;
            }
            .oh-table-card tbody tr:last-child td { border-bottom: none; }
            .oh-table-card tbody tr:hover td {
                background: var(--bg-primary);
            }

            /* ── Pagination ── */
            .oh-pagination {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 14px 20px;
                border-top: 1px solid var(--border);
                background: var(--bg-secondary);
                border-radius: 0 0 var(--radius) var(--radius);
            }

            /* ── Placeholder ── */
            .oh-placeholder {
                text-align: center;
                padding: 80px 24px;
                color: var(--text-muted);
            }
            .oh-placeholder i {
                font-size: 48px;
                margin-bottom: 16px;
                opacity: .3;
                display: block;
            }
            .oh-placeholder h3 {
                font-size: 18px;
                margin-bottom: 8px;
                color: var(--text-primary);
            }
            .oh-placeholder p { font-size: 13px; }

            /* ── Animate-in ── */
            @keyframes oh-fadein {
                from { opacity:0; transform:translateY(12px); }
                to   { opacity:1; transform:translateY(0); }
            }
            .oh-animate { animation: oh-fadein .3s ease both; }
            .oh-animate-d1 { animation-delay: .05s; }
            .oh-animate-d2 { animation-delay: .10s; }
            .oh-animate-d3 { animation-delay: .15s; }

            /* ── Disabled date inputs ── */
            .oh-date-disabled input[type=date] {
                opacity: .35;
                cursor: not-allowed;
                pointer-events: none;
                background: var(--bg-primary) !important;
            }
            .oh-date-disabled label {
                opacity: .4;
            }

            /* ── Totals summary card (below table) ── */
            .oh-totals-card {
                display: flex;
                gap: 0;
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                overflow: hidden;
                margin-bottom: 16px;
            }
            .oh-totals-item {
                flex: 1;
                padding: 16px 20px;
                border-right: 1px solid var(--border);
                text-align: center;
            }
            .oh-totals-item:last-child { border-right: none; }
            .oh-totals-item .t-label {
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: .8px;
                color: var(--text-muted);
                margin-bottom: 6px;
            }
            .oh-totals-item .t-value {
                font-size: 18px;
                font-weight: 800;
            }
            .oh-totals-item .t-sub {
                font-size: 11px;
                color: var(--text-muted);
                margin-top: 3px;
            }
            .oh-totals-grand {
                background: var(--bg-primary);
                border-left: 3px solid var(--accent) !important;
            }
            .oh-totals-grand .t-label { color: var(--accent); }
            .oh-totals-grand .t-value { color: var(--success); font-size: 22px; }

            /* ── Chip / badge ── */
            .oh-chip {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 3px 9px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: .3px;
                text-transform: uppercase;
            }
        </style>

        <!-- ══ FILTER CARD ════════════════════════════════════════ -->
        <div class="oh-filter-card oh-animate">
            <div class="oh-filter-title">
                <i class="fas fa-sliders-h"></i>
                Search & Filter Orders
            </div>

            <!-- ── View-as toggle (visible to all; cashiers default to My Sales) ── -->
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;
                padding-bottom:16px;border-bottom:1px solid var(--border);flex-wrap:wrap;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                    letter-spacing:.8px;color:var(--text-muted);">
                    <i class="fas fa-user-circle" style="color:var(--accent);margin-right:5px;"></i>
                    View
                </div>
                <div class="oh-view-toggle">
                    <button id="oh-view-all"
                        class="${isCashierOnly ? '' : 'active'}"
                        onclick="OrdersHistoryPage._setView('all')">
                        <i class="fas fa-users"></i> All Cashiers
                    </button>
                    <button id="oh-view-mine"
                        class="${isCashierOnly ? 'active' : ''}"
                        onclick="OrdersHistoryPage._setView('mine')">
                        <i class="fas fa-user-check"></i> My Sales Only
                    </button>
                </div>
                <div id="oh-cashier-badge" style="display:${isCashierOnly ? 'flex' : 'none'};">
                    <span class="oh-my-sales-badge">
                        <i class="fas fa-id-badge"></i>
                        ${currentUserName || 'You'}
                    </span>
                </div>
                ${!isCashierOnly ? `
                <div style="font-size:12px;color:var(--text-muted);">
                    <i class="fas fa-info-circle" style="margin-right:3px;"></i>
                    Switch to <strong>My Sales Only</strong> to see just your transactions
                </div>` : `
                <div style="font-size:12px;color:var(--text-muted);">
                    Showing only your transactions — switch to <strong>All Cashiers</strong> to compare
                </div>`}
            </div>

            <div class="oh-filter-grid">
                <!-- Quick Period -->
                <div class="oh-filter-group">
                    <label><i class="fas fa-calendar-alt" style="margin-right:4px;"></i>Period</label>
                    <select id="oh-period">
                        <option value="">— Select Period —</option>
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="this_week">This Week</option>
                        <option value="last_week">Last Week</option>
                        <option value="this_month">This Month</option>
                        <option value="last_month">Last Month</option>
                        <option value="this_year">This Year</option>
                        <option value="custom">Custom Range…</option>
                    </select>
                </div>

                <!-- Date From -->
                <div class="oh-filter-group oh-date-disabled" id="oh-date-from-wrap">
                    <label><i class="fas fa-calendar" style="margin-right:4px;"></i>Date From</label>
                    <input type="date" id="oh-date-from" disabled>
                </div>

                <!-- Date To -->
                <div class="oh-filter-group oh-date-disabled" id="oh-date-to-wrap">
                    <label><i class="fas fa-calendar" style="margin-right:4px;"></i>Date To</label>
                    <input type="date" id="oh-date-to" disabled>
                </div>

                <!-- Status -->
                <div class="oh-filter-group">
                    <label><i class="fas fa-tag" style="margin-right:4px;"></i>Status</label>
                    <select id="oh-status">
                        <option value="">All Statuses</option>
                        <option value="completed">Completed</option>
                        <option value="voided">Voided</option>
                        <option value="refunded">Refunded</option>
                    </select>
                </div>

                <!-- Payment Method -->
                <div class="oh-filter-group">
                    <label><i class="fas fa-credit-card" style="margin-right:4px;"></i>Payment Method</label>
                    <select id="oh-payment">
                        <option value="">All Methods</option>
                        <option value="cash">Cash</option>
                        <option value="momo">MoMo</option>
                        <option value="card">Card</option>
                        <option value="split">Split</option>
                        <option value="credit">Credit</option>
                    </select>
                </div>

                <!-- Search -->
                <div class="oh-filter-group">
                    <label><i class="fas fa-search" style="margin-right:4px;"></i>Search</label>
                    <input type="text" id="oh-search"
                        placeholder="Customer name or order #…"
                        style="width:100%;padding:8px 12px;
                            background:var(--bg-secondary);
                            border:1px solid var(--border);
                            border-radius:var(--radius-sm);
                            color:var(--text-primary);font-size:13px;height:38px;">
                </div>
            </div>

            <div class="oh-filter-actions">
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <button class="btn btn-primary" id="oh-run-btn"
                        onclick="OrdersHistoryPage.runReport()">
                        <i class="fas fa-search"></i>&nbsp; Generate Report
                    </button>
                    <button class="btn btn-ghost btn-sm"
                        onclick="OrdersHistoryPage.resetFilters()">
                        <i class="fas fa-undo"></i> Reset
                    </button>
                </div>
                <div style="font-size:12px;color:var(--text-muted);">
                    <i class="fas fa-info-circle" style="margin-right:4px;"></i>
                    Select filters then click <strong>Generate Report</strong>
                </div>
            </div>
        </div>

        <!-- ══ RESULTS AREA (hidden until report runs) ═══════════ -->
        <div id="oh-results" style="display:none;"></div>
        `;

        // Store isCashierOnly and currentUserName on the object for use in runReport
        this._isCashierOnly   = isCashierOnly;
        this._currentUserName = currentUserName;
        // Default view mode
        this._viewMode = isCashierOnly ? 'mine' : 'all';

        this.page = 1;
        this._initSelect2();
        this._bindFilters();

        // Pre-fetch all orders silently
        const res = await API.get('/orders?limit=2000&offset=0');
        if (res?.success) this.orders = res.data;
    },

    // ─────────────────────────────────────────────────────────────
    //  VIEW TOGGLE
    // ─────────────────────────────────────────────────────────────
    _setView(mode) {
        this._viewMode = mode;

        const allBtn  = document.getElementById('oh-view-all');
        const mineBtn = document.getElementById('oh-view-mine');
        const badge   = document.getElementById('oh-cashier-badge');

        if (allBtn)  allBtn.classList.toggle('active',  mode === 'all');
        if (mineBtn) mineBtn.classList.toggle('active', mode === 'mine');
        if (badge)   badge.style.display = mode === 'mine' ? 'flex' : 'none';
    },

    // ─────────────────────────────────────────────────────────────
    _loadScript(src) {
        return new Promise((res, rej) => {
            const s   = document.createElement('script');
            s.src     = src;
            s.onload  = res;
            s.onerror = rej;
            document.head.appendChild(s);
        });
    },

    _initSelect2() {
        if (!window.jQuery?.fn?.select2) return;
        const $ = window.jQuery;
        const theme = {
            theme: 'default',
            minimumResultsForSearch: 6,
        };
        $('#oh-period').select2({ ...theme, placeholder: '— Select Period —' });
        $('#oh-status').select2({ ...theme, placeholder: 'All Statuses'      });
        $('#oh-payment').select2({ ...theme, placeholder: 'All Methods'      });

        // Custom range toggle — enable date inputs only when "custom" selected
        const toggleDates = (isCustom) => {
            ['oh-date-from-wrap','oh-date-to-wrap'].forEach(id => {
                const wrap  = document.getElementById(id);
                const input = wrap?.querySelector('input');
                if (!wrap || !input) return;
                if (isCustom) {
                    wrap.classList.remove('oh-date-disabled');
                    input.disabled = false;
                } else {
                    wrap.classList.add('oh-date-disabled');
                    input.disabled = true;
                    input.value = '';
                }
            });
        };
        toggleDates(false);
        $('#oh-period').on('change', function() {
            toggleDates($(this).val() === 'custom');
        });
    },

    _bindFilters() {
        document.getElementById('oh-search')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') this.runReport();
        });
    },

    resetFilters() {
        if (window.jQuery?.fn?.select2) {
            window.jQuery('#oh-period').val('').trigger('change');
            window.jQuery('#oh-status').val('').trigger('change');
            window.jQuery('#oh-payment').val('').trigger('change');
        } else {
            ['oh-period','oh-status','oh-payment'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }
        ['oh-date-from-wrap','oh-date-to-wrap'].forEach(id => {
            const wrap  = document.getElementById(id);
            const input = wrap?.querySelector('input');
            if (!wrap || !input) return;
            wrap.classList.add('oh-date-disabled');
            input.disabled = true;
            input.value = '';
        });
        document.getElementById('oh-search').value = '';
        document.getElementById('oh-results').style.display = 'none';
        // Reset view to default for role
        this._setView(this._isCashierOnly ? 'mine' : 'all');
    },

    // ─────────────────────────────────────────────────────────────
    //  RUN REPORT
    // ─────────────────────────────────────────────────────────────
    async runReport() {
        const btn = document.getElementById('oh-run-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>&nbsp; Loading…'; }

        const res = await API.get('/orders?limit=2000&offset=0');
        if (res?.success) this.orders = res.data;

        const period  = window.jQuery ? window.jQuery('#oh-period').val()  : document.getElementById('oh-period').value;
        const status  = window.jQuery ? window.jQuery('#oh-status').val()  : document.getElementById('oh-status').value;
        const payment = window.jQuery ? window.jQuery('#oh-payment').val() : document.getElementById('oh-payment').value;
        const search  = (document.getElementById('oh-search')?.value || '').toLowerCase().trim();
        const dfrom   = document.getElementById('oh-date-from')?.value;
        const dto     = document.getElementById('oh-date-to')?.value;

        let filtered = [...this.orders];

        // ── My Sales filter ────────────────────────────────────
        if (this._viewMode === 'mine' && this._currentUserName) {
            filtered = filtered.filter(o =>
                (o.cashier_name || '').toLowerCase() ===
                this._currentUserName.toLowerCase()
            );
        }

        // ── Search (customer name or order number only; NOT cashier name
        //    when in "mine" mode to avoid confusion) ─────────────
        if (search) filtered = filtered.filter(o =>
            o.order_number.toLowerCase().includes(search) ||
            (o.customer_name && o.customer_name.toLowerCase().includes(search)) ||
            // Only search cashier name when viewing all
            (this._viewMode === 'all' && o.cashier_name &&
             o.cashier_name.toLowerCase().includes(search))
        );

        // ── Status ─────────────────────────────────────────────
        if (status) filtered = filtered.filter(o => o.status === status);

        // ── Payment ────────────────────────────────────────────
        if (payment) filtered = filtered.filter(o => o.payment_method === payment);

        // ── Period ─────────────────────────────────────────────
        if (period && period !== 'custom') {
            filtered = filtered.filter(o => {
                const d     = new Date(o.created_at);
                const now   = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                switch (period) {
                    case 'today':     return d >= today;
                    case 'yesterday': {
                        const y = new Date(today); y.setDate(today.getDate()-1);
                        return d >= y && d < today;
                    }
                    case 'this_week': {
                        const ws = new Date(today); ws.setDate(today.getDate()-today.getDay());
                        return d >= ws;
                    }
                    case 'last_week': {
                        const lwe = new Date(today); lwe.setDate(today.getDate()-today.getDay());
                        const lws = new Date(lwe);   lws.setDate(lwe.getDate()-7);
                        return d >= lws && d < lwe;
                    }
                    case 'this_month':
                        return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
                    case 'last_month': {
                        const lm = new Date(now.getFullYear(), now.getMonth()-1, 1);
                        const tm = new Date(now.getFullYear(), now.getMonth(),   1);
                        return d >= lm && d < tm;
                    }
                    case 'this_year':
                        return d.getFullYear() === now.getFullYear();
                    default: return true;
                }
            });
        }
        if (period === 'custom' || (!period && (dfrom || dto))) {
            const from = dfrom ? new Date(dfrom + 'T00:00:00') : null;
            const to   = dto   ? new Date(dto   + 'T23:59:59') : null;
            filtered = filtered.filter(o => {
                const d = new Date(o.created_at);
                if (from && d < from) return false;
                if (to   && d > to)   return false;
                return true;
            });
        }

        this._filteredOrders = filtered;
        this.page = 1;

        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-search"></i>&nbsp; Generate Report'; }

        this._renderResults(filtered, { period, status, payment, search, dfrom, dto,
            viewMode: this._viewMode, cashierName: this._currentUserName });
    },

    // ─────────────────────────────────────────────────────────────
    //  RENDER RESULTS
    // ─────────────────────────────────────────────────────────────
    _renderResults(orders, filters) {
        const el = document.getElementById('oh-results');
        if (!el) return;
        el.style.display = 'block';

        if (!orders.length) {
            el.innerHTML = `
                <div class="oh-placeholder oh-animate">
                    <i class="fas fa-search"></i>
                    <h3>No orders match your filters</h3>
                    <p>Try adjusting the date range, status, or payment method.</p>
                </div>`;
            return;
        }

        const completed = orders.filter(o => o.status === 'completed');
        const voided    = orders.filter(o => o.status === 'voided');
        const refunded  = orders.filter(o => o.status === 'refunded');

        const totalRevenue   = completed.reduce((s,o) => s + parseFloat(o.total_amount    ||0), 0);
        const totalSubtotal  = completed.reduce((s,o) => s + parseFloat(o.subtotal        ||0), 0);
        const totalDiscount  = completed.reduce((s,o) => s + parseFloat(o.discount_amount ||0), 0);
        const totalTax       = completed.reduce((s,o) => s + parseFloat(o.tax_amount      ||0), 0);
        const totalItems     = completed.reduce((s,o) => s + parseInt(o.item_count        ||0), 0);
        const avgOrder       = completed.length ? totalRevenue / completed.length : 0;
        const voidedAmount   = voided.reduce((s,o)   => s + parseFloat(o.total_amount     ||0), 0);

        const pmethods = {};
        completed.forEach(o => {
            const m = o.payment_method || 'unknown';
            if (!pmethods[m]) pmethods[m] = { total: 0, count: 0 };
            pmethods[m].total += parseFloat(o.total_amount || 0);
            pmethods[m].count++;
        });
        const pmList = Object.entries(pmethods).sort((a,b) => b[1].total - a[1].total);
        const maxPm  = pmList[0]?.[1]?.total || 1;

        const periodLabel = this._periodLabel(filters);

        // Is this a "My Sales" report?
        const isMineReport = filters.viewMode === 'mine' && filters.cashierName;

        el.innerHTML = `
            <!-- ══ REPORT HEADER ════════════════════════════════ -->
            <div class="oh-animate" style="
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 20px 24px;
                margin-bottom: 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 12px;">
                <div>
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                        letter-spacing:1px;color:var(--text-muted);margin-bottom:4px;">
                        <i class="fas fa-chart-bar" style="color:var(--accent);margin-right:6px;"></i>
                        ${isMineReport ? 'My Sales Report' : 'Audit & Sales Report'}
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                        <div style="font-size:20px;font-weight:800;color:var(--text-primary);">
                            ${periodLabel}
                        </div>
                        ${isMineReport ? `
                        <span class="oh-my-sales-badge">
                            <i class="fas fa-user-check"></i>
                            ${filters.cashierName}
                        </span>` : ''}
                    </div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:3px;">
                        Generated ${new Date().toLocaleString('en-GB')}
                        &nbsp;·&nbsp; ${orders.length} order${orders.length!==1?'s':''} in selection
                        ${isMineReport ? `&nbsp;·&nbsp; <span style="color:var(--accent);font-weight:600;">Your transactions only</span>` : ''}
                    </div>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <button class="oh-export-btn csv"
                        onclick="OrdersHistoryPage.exportCSV()">
                        <i class="fas fa-file-csv"></i> Export CSV
                    </button>
                    <button class="oh-export-btn pdf"
                        onclick="OrdersHistoryPage.exportPDF()">
                        <i class="fas fa-file-pdf"></i> Export PDF
                    </button>
                </div>
            </div>

            <!-- ══ KPI STRIP ═════════════════════════════════════ -->
            <div class="oh-kpi-strip oh-animate oh-animate-d1">
                ${this._kpi('coins',         'var(--success)', '#16a34a22',
                    formatCurrency(totalRevenue), 'Net Revenue',
                    `${completed.length} completed order${completed.length!==1?'s':''}`)}
                ${this._kpi('receipt',        'var(--accent)',  'var(--accent)22',
                    completed.length, 'Completed Orders',
                    `Avg ${formatCurrency(avgOrder)}`)}
                ${this._kpi('shopping-bag',   '#8b5cf6',  '#8b5cf622',
                    totalItems, 'Items Sold',
                    `Across ${completed.length} orders`)}
                ${this._kpi('chart-line',     'var(--accent)',  'var(--accent)22',
                    formatCurrency(avgOrder), 'Avg Order Value',
                    'Per completed order')}
                ${this._kpi('tag',            '#f59e0b',  '#f59e0b22',
                    formatCurrency(totalDiscount), 'Total Discounts',
                    totalDiscount > 0 ? (totalRevenue > 0 ? ((totalDiscount/(totalRevenue+totalDiscount))*100).toFixed(1)+'% of gross' : '') : 'No discounts')}
                ${totalTax > 0 ? this._kpi('percent', '#06b6d4', '#06b6d422',
                    formatCurrency(totalTax), 'Total Tax Collected', '') : ''}
                ${voided.length > 0 ? this._kpi('ban', 'var(--danger)', 'var(--danger)22',
                    voided.length, 'Voided Orders',
                    formatCurrency(voidedAmount) + ' lost') : ''}
                ${refunded.length > 0 ? this._kpi('undo', '#f59e0b', '#f59e0b22',
                    refunded.length, 'Refunded Orders', '') : ''}
            </div>

            <!-- ══ PAYMENT BREAKDOWN ══════════════════════════════ -->
            ${pmList.length ? `
            <div class="oh-animate oh-animate-d2" style="margin-bottom:20px;">
                <div class="oh-section-header">
                    <div class="oh-section-title">
                        <i class="fas fa-wallet"></i> Revenue by Payment Method
                    </div>
                    <div style="font-size:12px;color:var(--text-muted);">
                        Completed orders only
                    </div>
                </div>
                <div class="oh-pay-grid">
                    ${pmList.map(([m, d]) => `
                    <div class="oh-pay-card">
                        <div class="oh-pay-icon"
                            style="background:${this._pmColor(m)}22;color:${this._pmColor(m)};">
                            <i class="fas fa-${this._pmIcon(m)}"></i>
                        </div>
                        <div class="oh-pay-details">
                            <div class="oh-pay-method">${m.toUpperCase()}</div>
                            <div class="oh-pay-amount">${formatCurrency(d.total)}</div>
                            <div class="oh-pay-meta">
                                ${d.count} order${d.count!==1?'s':''}&nbsp;·&nbsp;
                                ${totalRevenue > 0 ? ((d.total/totalRevenue)*100).toFixed(1) : 0}% of revenue
                            </div>
                            <div class="oh-pay-bar-wrap">
                                <div class="oh-pay-bar"
                                    style="width:${Math.round((d.total/maxPm)*100)}%;
                                    background:${this._pmColor(m)};"></div>
                            </div>
                        </div>
                    </div>`).join('')}
                </div>
            </div>` : ''}

            <!-- ══ TABLE ══════════════════════════════════════════ -->
            <div class="oh-animate oh-animate-d3">
                <div class="oh-section-header">
                    <div class="oh-section-title">
                        <i class="fas fa-table"></i> Order Details
                        <span style="background:var(--bg-primary);
                            border:1px solid var(--border);
                            border-radius:20px;padding:2px 10px;
                            font-size:11px;margin-left:4px;">
                            ${orders.length} orders
                        </span>
                    </div>
                </div>

                <div class="oh-table-card" id="oh-table-card">
                    ${this._renderTable(
                        orders.slice((this.page-1)*this.limit, this.page*this.limit),
                        orders, totalRevenue, filters.viewMode
                    )}
                </div>

                <!-- Pagination -->
                <div class="oh-pagination">
                    <span style="font-size:13px;color:var(--text-muted);">
                        Showing ${Math.min((this.page-1)*this.limit+1, orders.length)}–${Math.min(this.page*this.limit, orders.length)}
                        of ${orders.length}
                    </span>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <button class="btn btn-ghost btn-sm" id="oh-prev"
                            onclick="OrdersHistoryPage.prevPage()"
                            ${this.page <= 1 ? 'disabled' : ''}>
                            <i class="fas fa-chevron-left"></i> Prev
                        </button>
                        <span id="oh-page-lbl" style="font-size:13px;
                            color:var(--text-muted);padding:0 8px;">
                            Page ${this.page} of ${Math.max(1,Math.ceil(orders.length/this.limit))}
                        </span>
                        <button class="btn btn-ghost btn-sm" id="oh-next"
                            onclick="OrdersHistoryPage.nextPage()"
                            ${this.page*this.limit >= orders.length ? 'disabled' : ''}>
                            Next <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    // ─────────────────────────────────────────────────────────────
    //  KPI HELPER
    // ─────────────────────────────────────────────────────────────
    _kpi(icon, color, bg, val, label, sub) {
        return `
        <div class="oh-kpi" style="border-top-color:${color};">
            <div class="oh-kpi-icon" style="background:${bg};color:${color};">
                <i class="fas fa-${icon}"></i>
            </div>
            <div class="oh-kpi-val" style="color:${color};">${val}</div>
            <div class="oh-kpi-lbl">${label}</div>
            ${sub ? `<div class="oh-kpi-sub">${sub}</div>` : ''}
        </div>`;
    },

    // ─────────────────────────────────────────────────────────────
    //  TABLE RENDER
    //  viewMode: 'all' shows Cashier column; 'mine' hides it (redundant)
    // ─────────────────────────────────────────────────────────────
    _renderTable(paged, all, totalRevenue, viewMode) {
        if (!paged.length) return `
            <div class="oh-placeholder">
                <i class="fas fa-receipt"></i>
                <h3>No orders on this page</h3>
            </div>`;

        const showCashier  = viewMode !== 'mine';
        const pageTotal    = paged.reduce((s,o) => s+parseFloat(o.total_amount||0),0);
        const pageItems    = paged.reduce((s,o) => s+parseInt(o.item_count    ||0),0);
        const allItems     = all.reduce((s,o)   => s+parseInt(o.item_count    ||0),0);
        const allCompleted = all.filter(o => o.status==='completed').length;

        return `
        <table>
            <thead><tr>
                <th>#</th>
                <th>Order No.</th>
                <th>Customer</th>
                ${showCashier ? '<th>Cashier</th>' : ''}
                <th style="text-align:center;">Items</th>
                <th>Payment</th>
                <th style="text-align:right;">Total</th>
                <th style="text-align:center;">Status</th>
                <th>Date & Time</th>
                <th style="text-align:center;">Actions</th>
            </tr></thead>
            <tbody>
                ${paged.map((o, idx) => {
                    const rowNum = (this.page-1)*this.limit + idx + 1;
                    return `
                <tr>
                    <td style="color:var(--text-muted);font-size:11px;">${rowNum}</td>
                    <td>
                        <strong style="color:var(--accent);cursor:pointer;"
                            onclick="OrdersHistoryPage.viewOrder(${o.id})">
                            ${o.order_number}
                        </strong>
                    </td>
                    <td>${o.customer_name ||
                        '<span style="color:var(--text-muted);font-style:italic;">Guest</span>'}</td>
                    ${showCashier ? `<td style="font-size:12px;">${o.cashier_name}</td>` : ''}
                    <td style="text-align:center;">
                        <span class="oh-chip"
                            style="background:var(--accent)22;color:var(--accent);">
                            ${o.item_count}
                        </span>
                    </td>
                    <td>
                        <span class="oh-chip"
                            style="background:${this._pmColor(o.payment_method)}22;
                            color:${this._pmColor(o.payment_method)};">
                            <i class="fas fa-${this._pmIcon(o.payment_method)}"
                                style="font-size:10px;"></i>
                            ${o.payment_method.toUpperCase()}
                        </span>
                    </td>
                    <td style="text-align:right;font-weight:800;
                        color:${o.status==='voided'?'var(--danger)':'var(--success)'};">
                        ${formatCurrency(o.total_amount)}
                    </td>
                    <td style="text-align:center;">
                        <span class="oh-chip" style="
                            background:${o.status==='completed'?'#16a34a22':o.status==='voided'?'#dc262622':'#f59e0b22'};
                            color:${o.status==='completed'?'#16a34a':o.status==='voided'?'#dc2626':'#f59e0b'};">
                            ${o.status}
                        </span>
                    </td>
                    <td style="font-size:11px;color:var(--text-muted);white-space:nowrap;">
                        ${formatDateTime(o.created_at)}
                    </td>
                    <td style="text-align:center;">
                        <div style="display:flex;gap:5px;justify-content:center;">
                            <button class="btn btn-ghost btn-sm"
                                onclick="OrdersHistoryPage.viewOrder(${o.id})"
                                title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-ghost btn-sm"
                                onclick="OrdersHistoryPage.printOrder(${o.id})"
                                title="Print Receipt">
                                <i class="fas fa-print"></i>
                            </button>
                            ${o.status!=='voided' && Auth.hasRole('superadmin','admin','manager') ? `
                            <button class="btn btn-danger btn-sm"
                                onclick="OrdersHistoryPage.voidOrder(${o.id},'${o.order_number}')"
                                title="Void">
                                <i class="fas fa-ban"></i>
                            </button>` : ''}
                        </div>
                    </td>
                </tr>`;
                }).join('')}
            </tbody>
        </table>

        <!-- ── Totals summary card ── -->
        <div class="oh-totals-card">
            <div class="oh-totals-item">
                <div class="t-label">
                    <i class="fas fa-file-alt" style="margin-right:4px;"></i>
                    Filtered Orders
                </div>
                <div class="t-value" style="color:var(--text-primary);">${paged.length}</div>
                <div class="t-sub"></div>
            </div>
            <div class="oh-totals-item">
                <div class="t-label">
                    <i class="fas fa-shopping-bag" style="margin-right:4px;"></i>
                    Filtered Items
                </div>
                <div class="t-value" style="color:var(--accent);">${pageItems}</div>
                <div class="t-sub"></div>
            </div>
            <div class="oh-totals-item">
                <div class="t-label">
                    <i class="fas fa-coins" style="margin-right:4px;"></i>
                    Filtered Revenue
                </div>
                <div class="t-value" style="color:var(--success);">${formatCurrency(pageTotal)}</div>
                <div class="t-sub"></div>
            </div>
            <div class="oh-totals-item" style="border-right:1px solid var(--border);">
                <div class="t-label">
                    <i class="fas fa-list-ol" style="margin-right:4px;"></i>
                    Total Orders
                </div>
                <div class="t-value" style="color:var(--text-primary);">${all.length}</div>
                <div class="t-sub">${allCompleted} completed</div>
            </div>
            <div class="oh-totals-item" style="border-right:1px solid var(--border);">
                <div class="t-label">
                    <i class="fas fa-box" style="margin-right:4px;"></i>
                    Total Items
                </div>
                <div class="t-value" style="color:var(--accent);">${allItems}</div>
                <div class="t-sub">all orders</div>
            </div>
            <div class="oh-totals-item oh-totals-grand">
                <div class="t-label">
                    <i class="fas fa-sigma" style="margin-right:4px;"></i>
                    Grand Total
                </div>
                <div class="t-value">${formatCurrency(totalRevenue)}</div>
                <div class="t-sub">completed orders</div>
            </div>
        </div>`;
    },

    // ─────────────────────────────────────────────────────────────
    //  PAGINATION
    // ─────────────────────────────────────────────────────────────
    prevPage() { if (this.page > 1) { this.page--; this._refreshTable(); } },
    nextPage()  { this.page++; this._refreshTable(); },

    _refreshTable() {
        const orders = this._filteredOrders || [];
        const completed    = orders.filter(o => o.status === 'completed');
        const totalRevenue = completed.reduce((s,o)=>s+parseFloat(o.total_amount||0),0);

        const card = document.getElementById('oh-table-card');
        if (card) card.innerHTML = this._renderTable(
            orders.slice((this.page-1)*this.limit, this.page*this.limit),
            orders, totalRevenue, this._viewMode
        );

        const prevBtn = document.getElementById('oh-prev');
        const nextBtn = document.getElementById('oh-next');
        const lbl     = document.getElementById('oh-page-lbl');
        if (prevBtn) prevBtn.disabled = this.page <= 1;
        if (nextBtn) nextBtn.disabled = this.page*this.limit >= orders.length;
        if (lbl)     lbl.textContent  = `Page ${this.page} of ${Math.max(1,Math.ceil(orders.length/this.limit))}`;
    },

    // ─────────────────────────────────────────────────────────────
    //  HELPERS
    // ─────────────────────────────────────────────────────────────
    _pmColor(m) {
        const map = { cash:'#16a34a', momo:'#f59e0b', card:'#3b82f6',
                      split:'#8b5cf6', credit:'#ef4444', unknown:'#6b7280' };
        return map[m] || '#6b7280';
    },
    _pmIcon(m) {
        const map = { cash:'money-bill-wave', momo:'mobile-alt',
                      card:'credit-card', split:'random', credit:'file-invoice-dollar' };
        return map[m] || 'money-bill';
    },
    _periodLabel(f) {
        const map = { today:'Today', yesterday:'Yesterday', this_week:'This Week',
                      last_week:'Last Week', this_month:'This Month',
                      last_month:'Last Month', this_year:'This Year' };
        if (f.period && f.period !== 'custom' && map[f.period]) return map[f.period];
        if (f.dfrom || f.dto) {
            const from = f.dfrom ? new Date(f.dfrom).toLocaleDateString('en-GB') : '—';
            const to   = f.dto   ? new Date(f.dto).toLocaleDateString('en-GB')   : '—';
            return `${from} → ${to}`;
        }
        const parts = [];
        if (f.status)  parts.push(f.status.charAt(0).toUpperCase()+f.status.slice(1));
        if (f.payment) parts.push(f.payment.toUpperCase());
        if (f.search)  parts.push(`"${f.search}"`);
        return parts.length ? parts.join(' · ') : 'All Orders';
    },

    // ─────────────────────────────────────────────────────────────
    //  EXPORT CSV  (includes "My Sales" context in header)
    // ─────────────────────────────────────────────────────────────
    exportCSV() {
        const orders = this._filteredOrders || [];
        if (!orders.length) { Toast.show('No data to export', 'warning'); return; }

        const isMine    = this._viewMode === 'mine';
        const completed = orders.filter(o => o.status==='completed');
        const voided    = orders.filter(o => o.status==='voided');
        const totalRev  = completed.reduce((s,o)=>s+parseFloat(o.total_amount   ||0),0);
        const totalDisc = completed.reduce((s,o)=>s+parseFloat(o.discount_amount||0),0);
        const totalTax  = completed.reduce((s,o)=>s+parseFloat(o.tax_amount     ||0),0);
        const totalItem = completed.reduce((s,o)=>s+parseInt(o.item_count       ||0),0);

        const pmethods = {};
        completed.forEach(o => {
            const m = o.payment_method||'unknown';
            if (!pmethods[m]) pmethods[m] = { total:0, count:0 };
            pmethods[m].total += parseFloat(o.total_amount||0);
            pmethods[m].count++;
        });

        const q = v => `"${String(v==null?'':v).replace(/"/g,'""')}"`;
        const rows = [];

        rows.push(['HYBRIDPOS - ORDERS AUDIT REPORT']);
        if (isMine) rows.push([`Cashier: ${this._currentUserName} (My Sales Only)`]);
        rows.push([`Generated: ${new Date().toLocaleString('en-GB')}`]);
        rows.push([]);
        rows.push(['=== SUMMARY ===']);
        rows.push(['Metric','Value']);
        rows.push(['Total Orders (all statuses)', orders.length]);
        rows.push(['Completed Orders', completed.length]);
        rows.push(['Voided Orders',    voided.length]);
        rows.push(['Refunded Orders',  orders.filter(o=>o.status==='refunded').length]);
        rows.push(['Total Revenue (completed)', totalRev.toFixed(2)]);
        rows.push(['Total Discounts',           totalDisc.toFixed(2)]);
        rows.push(['Total Tax Collected',       totalTax.toFixed(2)]);
        rows.push(['Total Items Sold',          totalItem]);
        rows.push(['Average Order Value',       completed.length ? (totalRev/completed.length).toFixed(2) : '0.00']);
        rows.push([]);
        rows.push(['=== PAYMENT BREAKDOWN ===']);
        rows.push(['Method','Orders','Revenue','% of Revenue']);
        Object.entries(pmethods).sort((a,b)=>b[1].total-a[1].total).forEach(([m,d]) => {
            rows.push([m.toUpperCase(), d.count, d.total.toFixed(2),
                totalRev>0 ? ((d.total/totalRev)*100).toFixed(1)+'%' : '0%']);
        });
        rows.push([]);
        rows.push(['=== ORDER DETAILS ===']);
        rows.push(['#','Order Number','Customer','Cashier','Item Count',
                   'Payment Method','Discount','Tax','Subtotal','Total','Status','Date & Time']);
        orders.forEach((o,i) => {
            rows.push([
                i+1, o.order_number, o.customer_name||'Guest', o.cashier_name,
                o.item_count, o.payment_method.toUpperCase(),
                parseFloat(o.discount_amount||0).toFixed(2),
                parseFloat(o.tax_amount     ||0).toFixed(2),
                parseFloat(o.subtotal       ||0).toFixed(2),
                parseFloat(o.total_amount   ||0).toFixed(2),
                o.status, formatDateTime(o.created_at)
            ]);
        });

        const csv      = rows.map(r => r.map(q).join(',')).join('\n');
        const blob     = new Blob(['\uFEFF' + csv], { type:'text/csv;charset=utf-8;' });
        const url      = URL.createObjectURL(blob);
        const a        = document.createElement('a');
        a.href         = url;
        const suffix   = isMine ? `_${this._currentUserName.replace(/\s+/g,'_')}` : '';
        a.download     = `orders_report${suffix}_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        Toast.show('CSV exported successfully', 'success');
    },

    // ─────────────────────────────────────────────────────────────
    //  EXPORT PDF  (includes "My Sales" badge when applicable)
    // ─────────────────────────────────────────────────────────────
    exportPDF() {
        const orders = this._filteredOrders || [];
        if (!orders.length) { Toast.show('No data to export', 'warning'); return; }

        const isMine    = this._viewMode === 'mine';
        const completed = orders.filter(o => o.status==='completed');
        const voided    = orders.filter(o => o.status==='voided');
        const refunded  = orders.filter(o => o.status==='refunded');
        const totalRev  = completed.reduce((s,o)=>s+parseFloat(o.total_amount   ||0),0);
        const totalDisc = completed.reduce((s,o)=>s+parseFloat(o.discount_amount||0),0);
        const totalTax  = completed.reduce((s,o)=>s+parseFloat(o.tax_amount     ||0),0);
        const totalItem = completed.reduce((s,o)=>s+parseInt(o.item_count       ||0),0);
        const avgOrder  = completed.length ? totalRev/completed.length : 0;

        const pmethods = {};
        completed.forEach(o => {
            const m = o.payment_method||'unknown';
            if (!pmethods[m]) pmethods[m] = { total:0, count:0 };
            pmethods[m].total += parseFloat(o.total_amount||0);
            pmethods[m].count++;
        });

        const w = window.open('', '_blank', 'width=1000,height=750');
        w.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>${isMine ? `My Sales — ${this._currentUserName}` : 'Orders Audit Report'} — ${new Date().toLocaleDateString('en-GB')}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size:12px;
         color:#1a1a2e; background:#fff; padding:24px 32px; }
  .page-header { display:flex; justify-content:space-between;
                 align-items:flex-start; margin-bottom:24px;
                 padding-bottom:16px; border-bottom:3px solid #1a1a2e; }
  .page-header h1 { font-size:22px; font-weight:800; margin-bottom:4px; }
  .page-header .sub { font-size:11px; color:#555; }
  .cashier-badge { display:inline-block; background:#eff6ff; border:1px solid #bfdbfe;
                   color:#2563eb; font-size:11px; font-weight:700; padding:3px 10px;
                   border-radius:20px; margin-top:6px; }
  .section-title { font-size:11px; font-weight:800; text-transform:uppercase;
                   letter-spacing:1.2px; color:#555; margin:20px 0 10px;
                   padding-bottom:5px; border-bottom:2px solid #eee;
                   display:flex; align-items:center; gap:6px; }
  .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:4px; }
  .kpi { border:1px solid #e5e7eb; border-radius:8px; padding:14px;
         border-left:4px solid #2563eb; }
  .kpi.green  { border-left-color:#16a34a; }
  .kpi.blue   { border-left-color:#2563eb; }
  .kpi.amber  { border-left-color:#f59e0b; }
  .kpi.red    { border-left-color:#dc2626; }
  .kpi.purple { border-left-color:#8b5cf6; }
  .kpi .val { font-size:20px; font-weight:800; color:#111; }
  .kpi .lbl { font-size:10px; font-weight:700; text-transform:uppercase;
               letter-spacing:.6px; color:#666; margin-top:3px; }
  .kpi .sub { font-size:10px; color:#888; margin-top:2px; }
  table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:4px; }
  th { background:#f3f4f6; padding:8px 10px; text-align:left; font-weight:700;
       font-size:10px; text-transform:uppercase; letter-spacing:.5px;
       border-bottom:2px solid #d1d5db; color:#555; }
  td { padding:7px 10px; border-bottom:1px solid #f0f0f0; vertical-align:middle; }
  tr:nth-child(even) td { background:#fafafa; }
  .tfoot-sub td { background:#f9fafb !important; font-weight:700;
                  border-top:2px solid #d1d5db !important; }
  .badge { display:inline-block; padding:2px 8px; border-radius:20px;
           font-size:10px; font-weight:700; text-transform:uppercase; }
  .badge-completed { background:#dcfce7; color:#16a34a; }
  .badge-voided    { background:#fee2e2; color:#dc2626; }
  .badge-refunded  { background:#fef3c7; color:#f59e0b; }
  .pay-table td { padding:8px 10px; }
  .bar-wrap { height:5px; background:#e5e7eb; border-radius:3px; margin-top:4px; }
  .bar      { height:100%; border-radius:3px; background:#2563eb; }
  .footer { margin-top:32px; padding-top:12px; border-top:1px solid #eee;
            display:flex; justify-content:space-between;
            font-size:10px; color:#888; }
  @media print { body { padding:12mm; }
    @page { margin:12mm; size:A4 landscape; } }
</style></head><body>

<div class="page-header">
  <div>
    <h1>${isMine ? 'My Sales Report' : 'Orders Audit Report'}</h1>
    ${isMine ? `<div><span class="cashier-badge">&#x1F464; ${this._currentUserName} — My Sales Only</span></div>` : ''}
    <div class="sub" style="margin-top:6px;">Generated: ${new Date().toLocaleString('en-GB')}
      &nbsp;·&nbsp; ${orders.length} orders in selection
      &nbsp;·&nbsp; HybridPOS</div>
  </div>
  <div style="text-align:right;font-size:11px;color:#555;line-height:1.6;">
    <strong>Total Revenue</strong><br>
    <span style="font-size:24px;font-weight:800;color:#16a34a;">
      ${formatCurrency(totalRev)}
    </span>
  </div>
</div>

<div class="section-title">Key Performance Indicators</div>
<div class="kpis">
  <div class="kpi green">
    <div class="val">${formatCurrency(totalRev)}</div>
    <div class="lbl">Net Revenue</div>
    <div class="sub">${completed.length} completed orders</div>
  </div>
  <div class="kpi blue">
    <div class="val">${completed.length}</div>
    <div class="lbl">Completed Orders</div>
    <div class="sub">Avg ${formatCurrency(avgOrder)}</div>
  </div>
  <div class="kpi purple">
    <div class="val">${totalItem}</div>
    <div class="lbl">Items Sold</div>
    <div class="sub">Across ${completed.length} orders</div>
  </div>
  <div class="kpi amber">
    <div class="val">${formatCurrency(totalDisc)}</div>
    <div class="lbl">Total Discounts</div>
    <div class="sub">${totalRev>0?((totalDisc/(totalRev+totalDisc))*100).toFixed(1):0}% of gross</div>
  </div>
  <div class="kpi red">
    <div class="val">${voided.length}</div>
    <div class="lbl">Voided Orders</div>
    <div class="sub">${formatCurrency(voided.reduce((s,o)=>s+parseFloat(o.total_amount||0),0))} lost</div>
  </div>
  <div class="kpi blue">
    <div class="val">${refunded.length}</div>
    <div class="lbl">Refunded Orders</div>
    <div class="sub">&nbsp;</div>
  </div>
  <div class="kpi green">
    <div class="val">${formatCurrency(totalTax)}</div>
    <div class="lbl">Tax Collected</div>
    <div class="sub">&nbsp;</div>
  </div>
  <div class="kpi blue">
    <div class="val">${orders.length}</div>
    <div class="lbl">Total Orders</div>
    <div class="sub">All statuses</div>
  </div>
</div>

<div class="section-title">Revenue by Payment Method</div>
<table class="pay-table">
  <thead><tr>
    <th>Payment Method</th><th>Orders</th><th>Revenue</th>
    <th>% of Revenue</th><th style="width:200px;">Breakdown</th>
  </tr></thead>
  <tbody>
    ${Object.entries(pmethods).sort((a,b)=>b[1].total-a[1].total).map(([m,d]) => `
    <tr>
      <td><strong>${m.toUpperCase()}</strong></td>
      <td>${d.count}</td>
      <td><strong style="color:#16a34a;">${formatCurrency(d.total)}</strong></td>
      <td>${totalRev>0?((d.total/totalRev)*100).toFixed(1):0}%</td>
      <td>
        <div class="bar-wrap">
          <div class="bar"
            style="width:${totalRev>0?Math.round((d.total/totalRev)*100):0}%;"></div>
        </div>
      </td>
    </tr>`).join('')}
    <tr style="border-top:2px solid #d1d5db;">
      <td><strong>TOTAL</strong></td>
      <td><strong>${completed.length}</strong></td>
      <td><strong style="color:#16a34a;">${formatCurrency(totalRev)}</strong></td>
      <td><strong>100%</strong></td>
      <td></td>
    </tr>
  </tbody>
</table>

<div class="section-title">Order Details</div>
<table>
  <thead><tr>
    <th>#</th><th>Order No.</th><th>Customer</th>
    ${isMine ? '' : '<th>Cashier</th>'}
    <th>Items</th><th>Payment</th><th>Discount</th><th>Tax</th>
    <th>Total</th><th>Status</th><th>Date & Time</th>
  </tr></thead>
  <tbody>
    ${orders.map((o,i) => `
    <tr>
      <td style="color:#999;">${i+1}</td>
      <td><strong>${o.order_number}</strong></td>
      <td>${o.customer_name||'<em style="color:#999;">Guest</em>'}</td>
      ${isMine ? '' : `<td>${o.cashier_name}</td>`}
      <td style="text-align:center;">${o.item_count}</td>
      <td>${o.payment_method.toUpperCase()}</td>
      <td>${parseFloat(o.discount_amount)>0?formatCurrency(o.discount_amount):'—'}</td>
      <td>${parseFloat(o.tax_amount)>0?formatCurrency(o.tax_amount):'—'}</td>
      <td style="font-weight:700;color:${o.status==='voided'?'#dc2626':'#16a34a'};">
        ${formatCurrency(o.total_amount)}</td>
      <td><span class="badge badge-${o.status}">${o.status}</span></td>
      <td style="color:#555;">${formatDateTime(o.created_at)}</td>
    </tr>`).join('')}
  </tbody>
  <tfoot>
    <tr class="tfoot-sub">
      <td colspan="${isMine ? 3 : 4}" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;">
        Grand Total
      </td>
      <td style="text-align:center;">${totalItem}</td>
      <td></td>
      <td>${totalDisc>0?formatCurrency(totalDisc):'—'}</td>
      <td>${totalTax>0?formatCurrency(totalTax):'—'}</td>
      <td style="color:#16a34a;font-weight:800;">${formatCurrency(totalRev)}</td>
      <td colspan="2"></td>
    </tr>
  </tfoot>
</table>

<div class="footer">
  <span>HybridPOS · ${isMine ? `My Sales — ${this._currentUserName}` : 'Orders Audit Report'}</span>
  <span>Generated ${new Date().toLocaleString('en-GB')} · ${orders.length} orders</span>
</div>

</body></html>`);
        w.document.close();
        w.focus();
        setTimeout(() => { w.print(); }, 700);
    },

    // ─────────────────────────────────────────────────────────────
    //  VIEW ORDER MODAL
    // ─────────────────────────────────────────────────────────────
    async viewOrder(id) {
        const res = await API.get(`/orders/${id}`);
        if (!res?.success) { Toast.show('Failed to load order', 'error'); return; }
        const o = res.data;
        Modal.show(`
            <div class="modal-overlay">
                <div class="modal modal-lg">
                    <div class="modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-receipt"
                                style="color:var(--accent);margin-right:8px;"></i>
                            ${o.order_number}
                        </h3>
                        <button class="btn-icon" onclick="Modal.close()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div style="display:grid;grid-template-columns:1fr 1fr;
                            gap:16px;margin-bottom:20px;">
                            ${[
                                ['CASHIER',      o.cashier_name],
                                ['CUSTOMER',     o.customer_name || 'Guest'],
                                ['PAYMENT',      `<span class="badge ${DashboardPage.paymentBadge(o.payment_method)}">${o.payment_method.toUpperCase()}</span>`],
                                ['STATUS',       `<span class="badge ${o.status==='completed'?'badge-success':o.status==='voided'?'badge-danger':'badge-warning'}">${o.status}</span>`],
                                ['DATE & TIME',  formatDateTime(o.created_at)],
                                ['CHANGE GIVEN', `<span style="color:var(--success);font-weight:700;">${formatCurrency(o.change_due)}</span>`],
                            ].map(([lbl, val]) => `
                            <div style="background:var(--bg-primary);
                                border-radius:var(--radius-sm);padding:14px;">
                                <div style="font-size:11px;color:var(--text-muted);
                                    margin-bottom:4px;">${lbl}</div>
                                <div style="font-weight:600;">${val}</div>
                            </div>`).join('')}
                        </div>
                        <div class="table-wrapper" style="margin-bottom:16px;">
                            <table>
                                <thead><tr>
                                    <th>Product</th><th>Unit Price</th>
                                    <th>Qty</th><th>Total</th>
                                </tr></thead>
                                <tbody>
                                    ${o.items.map(i => `
                                    <tr>
                                        <td><strong>${i.product_name}</strong></td>
                                        <td>${formatCurrency(i.unit_price)}</td>
                                        <td><span class="badge badge-info">${i.quantity}</span></td>
                                        <td style="font-weight:700;">
                                            ${formatCurrency(i.total)}</td>
                                    </tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                        <div style="background:var(--bg-primary);
                            border-radius:var(--radius-sm);padding:16px;">
                            <div class="summary-row">
                                <span>Subtotal</span>
                                <span>${formatCurrency(o.subtotal)}</span>
                            </div>
                            ${parseFloat(o.discount_amount)>0?`
                            <div class="summary-row">
                                <span style="color:var(--success);">Discount</span>
                                <span style="color:var(--success);">
                                    -${formatCurrency(o.discount_amount)}</span>
                            </div>`:''}
                            ${parseFloat(o.tax_amount)>0?`
                            <div class="summary-row">
                                <span>Tax</span>
                                <span>${formatCurrency(o.tax_amount)}</span>
                            </div>`:''}
                            <div class="summary-row total">
                                <span>TOTAL</span>
                                <span>${formatCurrency(o.total_amount)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
                        <button class="btn btn-primary"
                            onclick="OrdersHistoryPage.printOrder(${o.id})">
                            <i class="fas fa-print"></i> Print Receipt
                        </button>
                        ${o.status!=='voided' && Auth.hasRole('superadmin','admin','manager') ? `
                        <button class="btn btn-danger"
                            onclick="Modal.close();
                                OrdersHistoryPage.voidOrder(${o.id},'${o.order_number}')">
                            <i class="fas fa-ban"></i> Void Order
                        </button>` : ''}
                    </div>
                </div>
            </div>
        `);
    },

    // ─────────────────────────────────────────────────────────────
    //  PRINT RECEIPT
    // ─────────────────────────────────────────────────────────────
    async printOrder(id) {
        const res = await API.get(`/orders/${id}`);
        if (!res?.success) { Toast.show('Failed to load order', 'error'); return; }
        const o = res.data;
        const settingsRes = await API.get('/settings');
        const s = settingsRes?.data || {};

        const content = `
            <div class="thermal-receipt">
                <div class="receipt-header">
                    <div class="receipt-store-name">${s.store_name||'STORE'}</div>
                    ${s.address?`<div class="receipt-store-info">${s.address}</div>`:''}
                    ${s.phone  ?`<div class="receipt-store-info">${s.phone}</div>`:''}
                    ${s.email  ?`<div class="receipt-store-info">${s.email}</div>`:''}
                    <div class="receipt-divider">================================</div>
                </div>
                <div class="receipt-meta">
                    <div class="receipt-row"><span>Receipt #</span><span>${o.order_number}</span></div>
                    <div class="receipt-row"><span>Date</span>
                        <span>${new Date(o.created_at).toLocaleDateString('en-GB')}</span></div>
                    <div class="receipt-row"><span>Time</span>
                        <span>${new Date(o.created_at).toLocaleTimeString()}</span></div>
                    <div class="receipt-row"><span>Cashier</span><span>${o.cashier_name}</span></div>
                    ${o.customer_name?`<div class="receipt-row"><span>Customer</span>
                        <span>${o.customer_name}</span></div>`:''}
                    <div class="receipt-divider">================================</div>
                </div>
                <div class="receipt-items">
                    <div class="receipt-items-header">
                        <span>ITEM</span><span>QTY</span>
                        <span>PRICE</span><span>TOTAL</span>
                    </div>
                    <div class="receipt-divider">--------------------------------</div>
                    ${o.items.map(i=>`
                    <div class="receipt-item">
                        <span class="receipt-item-name">${i.product_name}</span>
                        <span>${i.quantity}</span>
                        <span>${formatCurrency(i.unit_price)}</span>
                        <span>${formatCurrency(i.total)}</span>
                    </div>`).join('')}
                    <div class="receipt-divider">--------------------------------</div>
                </div>
                <div class="receipt-totals">
                    <div class="receipt-row"><span>Subtotal</span>
                        <span>${formatCurrency(o.subtotal)}</span></div>
                    ${parseFloat(o.discount_amount)>0?`<div class="receipt-row">
                        <span>Discount</span>
                        <span>-${formatCurrency(o.discount_amount)}</span></div>`:''}
                    ${parseFloat(o.tax_amount)>0?`<div class="receipt-row">
                        <span>Tax</span><span>${formatCurrency(o.tax_amount)}</span></div>`:''}
                    <div class="receipt-divider">================================</div>
                    <div class="receipt-row receipt-total">
                        <span>TOTAL</span><span>${formatCurrency(o.total_amount)}</span></div>
                    <div class="receipt-divider">================================</div>
                    <div class="receipt-row"><span>Tendered</span>
                        <span>${formatCurrency(o.amount_tendered)}</span></div>
                    <div class="receipt-row"><span>Change</span>
                        <span>${formatCurrency(o.change_due)}</span></div>
                    <div class="receipt-row"><span>Payment</span>
                        <span>${o.payment_method.toUpperCase()}</span></div>
                </div>
                <div class="receipt-footer">
                    <div class="receipt-divider">================================</div>
                    <div class="receipt-footer-text">
                        ${s.receipt_footer||'Thank you for choosing Best Cobb!'}</div>
                    <div class="receipt-footer-text">We look forward to serving you again.</div>
                </div>
            </div>`;

        const pw = window.open('','_blank','width=320,height=600');
        pw.document.write(`<!DOCTYPE html><html><head>
            <meta charset="UTF-8"><title>Receipt - ${o.order_number}</title>
            <style>
                *{margin:0;padding:0;box-sizing:border-box}
                body{font-family:'Courier New',Courier,monospace;font-size:13px;
                    width:80mm;padding:5mm;color:#000 !important;background:#fff;
                    -webkit-print-color-adjust:exact;print-color-adjust:exact;}
                .thermal-receipt{width:100%}
                .receipt-store-name{text-align:center;font-size:18px;font-weight:900;
                    margin-bottom:5px;text-transform:uppercase;color:#000;letter-spacing:1px;}
                .receipt-store-info{text-align:center;font-size:12px;margin-bottom:3px;
                    color:#000;font-weight:600;}
                .receipt-divider{text-align:center;font-size:12px;margin:5px 0;
                    color:#000;font-weight:700;letter-spacing:1px;}
                .receipt-row{display:flex;justify-content:space-between;
                    margin-bottom:5px;font-size:13px;color:#000;font-weight:600;}
                .receipt-items-header{display:grid;
                    grid-template-columns:2fr 0.5fr 1fr 1fr;font-weight:900;
                    font-size:12px;margin-bottom:4px;color:#000;
                    text-transform:uppercase;letter-spacing:.5px;}
                .receipt-item{display:grid;grid-template-columns:2fr 0.5fr 1fr 1fr;
                    margin-bottom:5px;font-size:12px;color:#000;font-weight:600;}
                .receipt-item-name{white-space:nowrap;overflow:hidden;
                    text-overflow:ellipsis;font-weight:700;}
                .receipt-total{font-weight:900;font-size:16px;color:#000;}
                .receipt-footer{margin-top:10px;}
                .receipt-footer-text{text-align:center;font-size:12px;
                    margin-bottom:4px;color:#000;font-weight:700;}
                @media print{*{color:#000 !important;}body{width:80mm;}
                    @page{size:80mm auto;margin:0;}}
            </style>
        </head><body>${content}</body></html>`);
        pw.document.close(); pw.focus();
        setTimeout(() => { pw.print(); pw.close(); }, 500);
    },

    // ─────────────────────────────────────────────────────────────
    //  VOID ORDER
    // ─────────────────────────────────────────────────────────────
    voidOrder(id, orderNumber) {
        Modal.confirm(
            `Void order <strong>${orderNumber}</strong>? Stock will NOT be automatically restored.`,
            async () => {
                const res = await API.put(`/orders/${id}/void`, {});
                if (res?.success) {
                    Toast.show('Order voided successfully', 'success');
                    await this.runReport();
                } else {
                    Toast.show(res?.message || 'Failed to void order', 'error');
                }
            },
            'Void Order'
        );
    }
};