<?php
require_once __DIR__ . '/../src/models/CustomerModel.php';

addRoute('GET', '/api/customers', function () {
    AuthMiddleware::handle();
    $search = $_GET['search'] ?? '';
    Response::success(CustomerModel::all($search));
});

addRoute('GET', '/api/customers/{id}', function ($params) {
    AuthMiddleware::handle();
    $customer = CustomerModel::findById((int)$params['id']);
    if (!$customer) Response::error('Customer not found', 404);
    Response::success($customer);
});

addRoute('POST', '/api/customers', function () {
    AuthMiddleware::handle();
    $body = json_decode(file_get_contents('php://input'), true);
    if (empty($body['name'])) Response::error('Customer name is required.', 422);

    $data = [
        'name'    => trim($body['name']),
        'phone'   => $body['phone']   ?? null,
        'email'   => $body['email']   ?? null,
        'address' => $body['address'] ?? null,
    ];

    $id       = CustomerModel::create($data);
    $customer = CustomerModel::findById($id);
    Response::success($customer, 'Customer created', 201);
});

addRoute('PUT', '/api/customers/{id}', function ($params) {
    AuthMiddleware::handle();
    $body     = json_decode(file_get_contents('php://input'), true);
    $customer = CustomerModel::findById((int)$params['id']);
    if (!$customer) Response::error('Customer not found', 404);
    if (empty($body['name'])) Response::error('Customer name is required.', 422);

    $data = [
        'name'    => trim($body['name']),
        'phone'   => $body['phone']   ?? $customer['phone'],
        'email'   => $body['email']   ?? $customer['email'],
        'address' => $body['address'] ?? $customer['address'],
    ];

    CustomerModel::update((int)$params['id'], $data);
    Response::success(CustomerModel::findById((int)$params['id']), 'Customer updated');
});

addRoute('DELETE', '/api/customers/{id}', function ($params) {
    AuthMiddleware::handle(['superadmin', 'admin']);
    $customer = CustomerModel::findById((int)$params['id']);
    if (!$customer) Response::error('Customer not found', 404);
    $conn = getDBConnection();
    $stmt = $conn->prepare('DELETE FROM customers WHERE id = ?');
    $id   = (int)$params['id'];
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->close();
    Response::success(null, 'Customer deleted');
});