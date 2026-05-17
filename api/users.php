<?php
require_once __DIR__ . '/../src/models/UserModel.php';

// GET all users
addRoute('GET', '/api/users', function () {
    AuthMiddleware::handle(['superadmin', 'admin']);
    Response::success(UserModel::all());
});

// GET single user
addRoute('GET', '/api/users/{id}', function ($params) {
    AuthMiddleware::handle(['superadmin', 'admin']);
    $user = UserModel::findById((int)$params['id']);
    if (!$user) Response::error('User not found', 404);
    unset($user['password_hash']);
    Response::success($user);
});

// POST create user
addRoute('POST', '/api/users', function () {
    AuthMiddleware::handle(['superadmin', 'admin']);
    $body = json_decode(file_get_contents('php://input'), true);

    if (empty($body['name']))     Response::error('Name is required', 422);
    if (empty($body['email']))    Response::error('Email is required', 422);
    if (empty($body['password'])) Response::error('Password is required', 422);
    if (empty($body['role']))     Response::error('Role is required', 422);

    // Check email unique
    $existing = UserModel::findByEmail($body['email']);
    if ($existing) Response::error('Email already exists', 422);

    // Check PIN unique
    if (!empty($body['pin'])) {
        $conn    = getDBConnection();
        $pinStmt = $conn->prepare(
            'SELECT id FROM users WHERE pin = ? LIMIT 1'
        );
        $pinStmt->bind_param('s', $body['pin']);
        $pinStmt->execute();
        if ($pinStmt->get_result()->fetch_assoc()) {
            Response::error(
                'This PIN is already used by another user.', 422
            );
        }
        $pinStmt->close();
    }

    $data = [
        'name'     => trim($body['name']),
        'email'    => trim($body['email']),
        'password' => $body['password'],
        'role'     => $body['role'],
        'pin'      => $body['pin'] ?? null,
    ];

    $id   = UserModel::create($data);
    $user = UserModel::findById($id);
    unset($user['password_hash']);
    Response::success($user, 'User created successfully', 201);
});

// PUT update user
addRoute('PUT', '/api/users/{id}', function ($params) {
    AuthMiddleware::handle(['superadmin', 'admin']);
    $body = json_decode(file_get_contents('php://input'), true);
    $user = UserModel::findById((int)$params['id']);
    if (!$user) Response::error('User not found', 404);

    if (empty($body['name']))  Response::error('Name is required', 422);
    if (empty($body['email'])) Response::error('Email is required', 422);

    // Check email unique (exclude current user)
    $existing = UserModel::findByEmail($body['email']);
    if ($existing && $existing['id'] != $params['id']) {
        Response::error('Email already taken by another user', 422);
    }

    // Check PIN unique (exclude current user)
    if (!empty($body['pin'])) {
        $conn    = getDBConnection();
        $pinStmt = $conn->prepare(
            'SELECT id FROM users WHERE pin = ? AND id != ? LIMIT 1'
        );
        $userId  = (int)$params['id'];
        $pinStmt->bind_param('si', $body['pin'], $userId);
        $pinStmt->execute();
        if ($pinStmt->get_result()->fetch_assoc()) {
            Response::error(
                'This PIN is already used by another user.', 422
            );
        }
        $pinStmt->close();
    }

    $data = [
        'name'      => trim($body['name']),
        'email'     => trim($body['email']),
        'role'      => $body['role']      ?? $user['role'],
        'pin'       => $body['pin']       ?? $user['pin'],
        'is_active' => $body['is_active'] ?? $user['is_active'],
    ];

    UserModel::update((int)$params['id'], $data);

    if (!empty($body['password'])) {
        UserModel::updatePassword((int)$params['id'], $body['password']);
    }

    $updated = UserModel::findById((int)$params['id']);
    unset($updated['password_hash']);
    Response::success($updated, 'User updated successfully');
});

// PUT toggle user active status
addRoute('PUT', '/api/users/{id}/toggle', function ($params) {
    AuthMiddleware::handle(['superadmin', 'admin']);
    $user = UserModel::findById((int)$params['id']);
    if (!$user) Response::error('User not found', 404);

    $newStatus = $user['is_active'] ? 0 : 1;
    UserModel::setActive((int)$params['id'], $newStatus);
    Response::success(null, $newStatus ? 'User activated' : 'User deactivated');
});

// PUT change own password
addRoute('PUT', '/api/users/change-password', function () {
    $auth = AuthMiddleware::handle();
    $body = json_decode(file_get_contents('php://input'), true);

    if (empty($body['current_password']))
        Response::error('Current password is required', 422);
    if (empty($body['new_password']))
        Response::error('New password is required', 422);
    if (strlen($body['new_password']) < 6)
        Response::error('Password must be at least 6 characters', 422);

    $user = UserModel::findById($auth['user_id']);
    if (!password_verify($body['current_password'], $user['password_hash'])) {
        Response::error('Current password is incorrect', 401);
    }

    UserModel::updatePassword($auth['user_id'], $body['new_password']);
    Response::success(null, 'Password changed successfully');
});

// DELETE user
addRoute('DELETE', '/api/users/{id}', function ($params) {
    $auth = AuthMiddleware::handle(['superadmin']);
    if ($auth['user_id'] == $params['id']) {
        Response::error('You cannot delete your own account', 400);
    }
    $user = UserModel::findById((int)$params['id']);
    if (!$user) Response::error('User not found', 404);
    UserModel::delete((int)$params['id']);
    Response::success(null, 'User deleted');
});