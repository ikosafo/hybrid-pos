<?php
session_start();
?>
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#0f172a">
    <title>Best Cobb</title>
    <link rel="manifest" href="/public/manifest.json">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link rel="stylesheet" href="/public/assets/css/main.css">
</head>
<body>

<!-- App Shell -->
<div id="app">

    <!-- LOGIN SCREEN -->
    <div id="login-screen" class="auth-screen">
        <div class="auth-bg">
            <div class="auth-orb orb-1"></div>
            <div class="auth-orb orb-2"></div>
            <div class="auth-orb orb-3"></div>
        </div>
        <div class="auth-card">
            <div class="auth-logo">
                <div class="logo-icon"><i class="fas fa-bolt"></i></div>
                <h1>Best Cobb</h1>
                <p>Point of Sale System</p>
            </div>
            <form id="login-form" class="auth-form">
                <div class="form-group">
                    <label>Email Address</label>
                    <div class="input-icon">
                        <i class="fas fa-envelope"></i>
                        <input type="email" id="login-email" placeholder="admin@bestcobb.local" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <div class="input-icon">
                        <i class="fas fa-lock"></i>
                        <input type="password" id="login-password" placeholder="••••••••" required>
                        <button type="button" class="toggle-password" onclick="togglePassword()">
                            <i class="fas fa-eye" id="eye-icon"></i>
                        </button>
                    </div>
                </div>
                <div id="login-error" class="alert alert-error hidden"></div>
                <button type="submit" class="btn btn-primary btn-full" id="login-btn">
                    <span class="btn-text">Sign In</span>
                    <span class="btn-loader hidden"><i class="fas fa-spinner fa-spin"></i></span>
                </button>
                <div style="text-align:center;margin-top:16px;">
                    <a href="#" onclick="showForgotPassword()" 
                        style="color:var(--accent);font-size:13px;font-weight:500;">
                        Forgot your password?
                    </a>
                </div>
            </form>
            <div class="auth-footer">
                <span class="online-badge" id="connection-badge">
                    <i class="fas fa-circle"></i> Online
                </span>
                <span>v1.0.0</span>
            </div>
        </div>
    </div>

    <!-- MAIN APP -->
    <div id="main-app" class="hidden">

        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-logo">
                    <div class="logo-icon sm"><i class="fas fa-bolt"></i></div>
                    <span class="logo-text">Best Cobb</span>
                </div>
                <button class="sidebar-toggle" onclick="toggleSidebar()">
                    <i class="fas fa-bars"></i>
                </button>
            </div>

            <nav class="sidebar-nav">
                <div class="nav-section">
                    <span class="nav-label">Main</span>
                    <a href="#" class="nav-item active" data-page="pos">
                        <i class="fas fa-cash-register"></i>
                        <span>Point of Sale</span>
                    </a>
                    <a href="#" class="nav-item" data-page="orders">
                        <i class="fas fa-receipt"></i>
                        <span>Orders</span>
                        <span class="nav-badge" id="pending-badge" style="display:none">0</span>
                    </a>
                    <a href="#" class="nav-item" data-page="dashboard">
                        <i class="fas fa-chart-line"></i>
                        <span>Dashboard</span>
                    </a>
                </div>
                <div class="nav-section">
                    <span class="nav-label">Inventory</span>
                    <a href="#" class="nav-item" data-page="products">
                        <i class="fas fa-box"></i>
                        <span>Products</span>
                    </a>
                    <a href="#" class="nav-item" data-page="categories">
                        <i class="fas fa-tags"></i>
                        <span>Categories</span>
                    </a>
                    <a href="#" class="nav-item" data-page="customers">
                        <i class="fas fa-users"></i>
                        <span>Customers</span>
                    </a>
                    <a href="#" class="nav-item" data-page="stock">
                        <i class="fas fa-warehouse"></i>
                        <span>Stock</span>
                    </a>
                    <a href="#" class="nav-item" data-page="expenses">
                        <i class="fas fa-file-invoice-dollar"></i>
                        <span>Expenses</span>
                    </a>
                    <a href="#" class="nav-item" data-page="reports">
                        <i class="fas fa-chart-bar"></i>
                        <span>Reports</span>
                    </a>
                </div>
                <div class="nav-section">
                    <span class="nav-label">System</span>
                    <a href="#" class="nav-item" data-page="settings">
                        <i class="fas fa-cog"></i>
                        <span>Settings</span>
                    </a>
                </div>
            </nav>

            <div class="sidebar-footer">
                <div class="user-card">
                    <div class="user-avatar" id="user-avatar">SA</div>
                    <div class="user-info">
                        <span class="user-name" id="sidebar-user-name">Super Admin</span>
                        <span class="user-role" id="sidebar-user-role">superadmin</span>
                    </div>
                    <button class="btn-icon" onclick="logout()" title="Logout">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            </div>
        </aside>

        <!-- Main Content -->
        <div class="main-content" id="main-content">

            <!-- Top Bar -->
            <header class="topbar">
                <div class="topbar-left">
                    <button class="btn-icon mobile-menu-btn" onclick="toggleSidebar()">
                        <i class="fas fa-bars"></i>
                    </button>
                    <div class="page-title" id="page-title">Point of Sale</div>
                </div>
                <div class="topbar-right">
                    <div class="sync-status" id="sync-status">
                        <i class="fas fa-check-circle"></i>
                        <span>Synced</span>
                    </div>
                    <button class="btn-icon" onclick="toggleTheme()" title="Toggle theme">
                        <i class="fas fa-moon" id="theme-icon"></i>
                    </button>
                    <div class="topbar-time" id="topbar-time"></div>
                </div>
            </header>

            <!-- Page Content -->
            <main class="page-content" id="page-content">
                <!-- Pages load here dynamically -->
            </main>

        </div>
    </div>

</div>

<!-- MODALS CONTAINER -->
<div id="modals-container"></div>

<!-- TOAST CONTAINER -->
<div id="toast-container"></div>

<script src="/public/assets/js/app.js"></script>
<script src="/public/assets/js/api.js"></script>
<script src="/public/assets/js/pages/pos.js"></script>
<script src="/public/assets/js/pages/products.js"></script>
<script src="/public/assets/js/pages/categories.js"></script>
<script src="/public/assets/js/pages/customers.js"></script>
<script src="/public/assets/js/pages/dashboard.js"></script>
<script src="/public/assets/js/pages/orders.js"></script>
<script src="/public/assets/js/offline.js"></script>
<script src="/public/assets/js/pages/settings.js"></script>
<script src="/public/assets/js/pages/stock.js"></script>
<script src="/public/assets/js/pages/expenses.js"></script>
<script src="/public/assets/js/pages/reports.js"></script>

<script>
// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const reg = await navigator.serviceWorker.register('/public/service-worker.js');
            console.log('[SW] Registered:', reg.scope);

            // Listen for sync messages from SW
            navigator.serviceWorker.addEventListener('message', event => {
                if (event.data?.type === 'SYNC_START') {
                    SyncManager.syncPendingOrders();
                }
            });
        } catch (err) {
            console.warn('[SW] Registration failed:', err);
        }
    });
}
</script>
</body>
</html>