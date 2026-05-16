<?php
require_once __DIR__ . '/../src/models/UserModel.php';

// POST /api/auth/login
addRoute('POST', '/api/auth/login', function () {
    $body  = json_decode(file_get_contents('php://input'), true);
    $email = trim($body['email'] ?? '');
    $pass  = $body['password'] ?? '';

    if (!$email || !$pass) {
        Response::error('Email and password are required.', 422);
    }

    $user = UserModel::findByEmail($email);

    if (!$user || !password_verify($pass, $user['password_hash'])) {
        Response::error('Invalid credentials.', 401);
    }

    if (!$user['is_active']) {
        Response::error('Account is disabled. Contact your administrator.', 403);
    }

    $token = JWT::generate([
        'user_id' => $user['id'],
        'uuid'    => $user['uuid'],
        'name'    => $user['name'],
        'email'   => $user['email'],
        'role'    => $user['role'],
    ]);

    Response::success([
        'token' => $token,
        'user'  => [
            'id'    => $user['id'],
            'uuid'  => $user['uuid'],
            'name'  => $user['name'],
            'email' => $user['email'],
            'role'  => $user['role'],
        ],
    ], 'Login successful');
});

// GET /api/auth/me
addRoute('GET', '/api/auth/me', function () {
    $auth = AuthMiddleware::handle();
    $user = UserModel::findById($auth['user_id']);
    if (!$user) Response::error('User not found', 404);
    unset($user['password_hash']);
    Response::success($user);
});

// POST /api/auth/logout
addRoute('POST', '/api/auth/logout', function () {
    AuthMiddleware::handle();
    Response::success(null, 'Logged out successfully');
});


// POST /api/auth/forgot-password
addRoute('POST', '/api/auth/forgot-password', function () {
    $body  = json_decode(file_get_contents('php://input'), true);
    $email = trim($body['email'] ?? '');

    if (!$email) Response::error('Email is required.', 422);

    $user = UserModel::findByEmail($email);

    if (!$user) {
        Response::success(null, 'If this email exists, a reset request has been submitted.');
    }

    // Generate token
    $token     = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));

    $conn = getDBConnection();

    // Delete old tokens for this email
    $stmt = $conn->prepare('DELETE FROM password_resets WHERE email = ?');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $stmt->close();

    // Insert new token
    $stmt = $conn->prepare('
        INSERT INTO password_resets (email, token, expires_at)
        VALUES (?, ?, ?)
    ');
    $stmt->bind_param('sss', $email, $token, $expiresAt);
    $stmt->execute();
    $stmt->close();

    Response::success(null, 'Reset request submitted. Please contact your administrator.');
});


// GET /api/auth/reset-requests (admin only)
addRoute('GET', '/api/auth/reset-requests', function () {
    AuthMiddleware::handle(['superadmin', 'admin']);
    $conn   = getDBConnection();
    $result = $conn->query('
        SELECT pr.*, u.name as user_name
        FROM password_resets pr
        LEFT JOIN users u ON u.email = pr.email
        WHERE pr.used = 0 AND pr.expires_at > NOW()
        ORDER BY pr.created_at DESC
    ');
    Response::success($result->fetch_all(MYSQLI_ASSOC));
});

// DELETE /api/auth/reset-requests/{id} (dismiss request)
addRoute('DELETE', '/api/auth/reset-requests/{id}', function ($params) {
    AuthMiddleware::handle(['superadmin', 'admin']);
    $conn = getDBConnection();
    $stmt = $conn->prepare('DELETE FROM password_resets WHERE id = ?');
    $id   = (int)$params['id'];
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->close();
    Response::success(null, 'Request dismissed');
});

// POST /api/auth/reset-password
addRoute('POST', '/api/auth/reset-password', function () {
    $body     = json_decode(file_get_contents('php://input'), true);
    $token    = trim($body['token']    ?? '');
    $password = trim($body['password'] ?? '');

    if (!$token)    Response::error('Reset token is required.', 422);
    if (!$password) Response::error('New password is required.', 422);
    if (strlen($password) < 6) Response::error('Password must be at least 6 characters.', 422);

    $conn = getDBConnection();
    $stmt = $conn->prepare('
        SELECT * FROM password_resets
        WHERE token = ? AND used = 0 AND expires_at > NOW()
        LIMIT 1
    ');
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $reset = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$reset) Response::error('Invalid or expired reset token.', 400);

    // Update password
    $user = UserModel::findByEmail($reset['email']);
    if (!$user) Response::error('User not found.', 404);

    UserModel::updatePassword($user['id'], $password);

    // Mark token as used
    $ustmt = $conn->prepare('UPDATE password_resets SET used = 1 WHERE token = ?');
    $ustmt->bind_param('s', $token);
    $ustmt->execute();
    $ustmt->close();

    Response::success(null, 'Password reset successfully. You can now log in.');
});


// GET latest reset token for email (admin only)
addRoute('GET', '/api/password-resets/token', function () {
    AuthMiddleware::handle(['superadmin', 'admin']);
    $email = $_GET['email'] ?? '';
    if (!$email) Response::error('Email is required', 422);

    $conn = getDBConnection();
    $stmt = $conn->prepare('
        SELECT token FROM password_resets
        WHERE email = ? AND used = 0 AND expires_at > NOW()
        ORDER BY created_at DESC LIMIT 1
    ');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$result) Response::error('No active reset token found', 404);
    Response::success($result);
});

// GET all password reset requests (admin only)
addRoute('GET', '/api/password-resets', function () {
    AuthMiddleware::handle(['superadmin', 'admin']);
    $conn   = getDBConnection();
    $result = $conn->query('
        SELECT * FROM password_resets
        ORDER BY created_at DESC LIMIT 50
    ');
    Response::success($result->fetch_all(MYSQLI_ASSOC));
});