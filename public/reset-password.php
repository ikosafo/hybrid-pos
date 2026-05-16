<?php
$token = $_GET['token'] ?? '';
?>
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password — Best Cobb POS</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link rel="stylesheet" href="/public/assets/css/main.css">
</head>
<body>
<div id="app">
    <div class="auth-screen">
        <div class="auth-bg">
            <div class="auth-orb orb-1"></div>
            <div class="auth-orb orb-2"></div>
            <div class="auth-orb orb-3"></div>
        </div>
        <div class="auth-card">
            <div class="auth-logo">
                <div class="logo-icon"><i class="fas fa-key"></i></div>
                <h1>Reset Password</h1>
                <p>Enter your new password below</p>
            </div>
            <div id="reset-content">
                <?php if (!$token): ?>
                    <div class="alert alert-error">
                        Invalid reset link. Please request a new one.
                    </div>
                    <a href="/public/" class="btn btn-primary btn-full">Back to Login</a>
                <?php else: ?>
                    <div class="form-group">
                        <label>New Password</label>
                        <div class="input-icon">
                            <i class="fas fa-lock"></i>
                            <input type="password" id="new-password" placeholder="Min 6 characters">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Confirm Password</label>
                        <div class="input-icon">
                            <i class="fas fa-lock"></i>
                            <input type="password" id="confirm-password" placeholder="Repeat new password">
                        </div>
                    </div>
                    <div id="reset-error" class="alert alert-error hidden"></div>
                    <div id="reset-success" class="alert alert-success hidden"></div>
                    <button class="btn btn-primary btn-full" onclick="resetPassword()">
                        <i class="fas fa-key"></i> Reset Password
                    </button>
                    <div style="text-align:center;margin-top:16px;">
                        <a href="/public/" style="color:var(--accent);font-size:13px;">
                            Back to Login
                        </a>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>

<script>
async function resetPassword() {
    const password = document.getElementById('new-password').value;
    const confirm  = document.getElementById('confirm-password').value;
    const errBox   = document.getElementById('reset-error');
    const sucBox   = document.getElementById('reset-success');

    errBox.classList.add('hidden');
    sucBox.classList.add('hidden');

    if (!password) { errBox.textContent = 'Password is required.'; errBox.classList.remove('hidden'); return; }
    if (password.length < 6) { errBox.textContent = 'Password must be at least 6 characters.'; errBox.classList.remove('hidden'); return; }
    if (password !== confirm) { errBox.textContent = 'Passwords do not match.'; errBox.classList.remove('hidden'); return; }

    const res = await fetch('/public/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: '<?= htmlspecialchars($token) ?>', password })
    });

    const data = await res.json();
    if (data.success) {
        sucBox.textContent = 'Password reset successfully! Redirecting to login...';
        sucBox.classList.remove('hidden');
        setTimeout(() => window.location.href = '/public/', 2000);
    } else {
        errBox.textContent = data.message || 'Failed to reset password.';
        errBox.classList.remove('hidden');
    }
}
</script>
</body>
</html>