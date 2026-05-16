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