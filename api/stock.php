<?php
require_once __DIR__ . '/../src/models/StockModel.php';

// GET stock movements
addRoute('GET', '/api/stock/movements', function () {
    AuthMiddleware::handle(['superadmin', 'admin', 'manager']);
    $product_id = $_GET['product_id'] ?? null;
    $limit      = (int)($_GET['limit']  ?? 50);
    $offset     = (int)($_GET['offset'] ?? 0);
    Response::success(StockModel::getMovements($product_id, $limit, $offset));
});

// POST restock
addRoute('POST', '/api/stock/restock', function () {
    $auth = AuthMiddleware::handle(['superadmin', 'admin', 'manager']);
    $body = json_decode(file_get_contents('php://input'), true);

    if (empty($body['product_id'])) Response::error('Product is required', 422);
    if (empty($body['quantity']))   Response::error('Quantity is required', 422);
    if ($body['quantity'] <= 0)     Response::error('Quantity must be greater than 0', 422);

    $result = StockModel::restock(
        (int)$body['product_id'],
        (float)$body['quantity'],
        $auth['user_id'],
        $body['notes'] ?? null
    );

    Response::success($result, 'Stock updated successfully');
});

// POST adjustment
addRoute('POST', '/api/stock/adjust', function () {
    $auth = AuthMiddleware::handle(['superadmin', 'admin', 'manager']);
    $body = json_decode(file_get_contents('php://input'), true);

    if (empty($body['product_id']))       Response::error('Product is required', 422);
    if (!isset($body['new_quantity']))     Response::error('New quantity is required', 422);
    if ($body['new_quantity'] < 0)        Response::error('Quantity cannot be negative', 422);

    $result = StockModel::adjust(
        (int)$body['product_id'],
        (float)$body['new_quantity'],
        $auth['user_id'],
        $body['notes'] ?? null
    );

    Response::success($result, 'Stock adjusted successfully');
});

// POST damage/return
addRoute('POST', '/api/stock/damage', function () {
    $auth = AuthMiddleware::handle(['superadmin', 'admin', 'manager']);
    $body = json_decode(file_get_contents('php://input'), true);

    if (empty($body['product_id'])) Response::error('Product is required', 422);
    if (empty($body['quantity']))   Response::error('Quantity is required', 422);
    if ($body['quantity'] <= 0)     Response::error('Quantity must be greater than 0', 422);

    $type   = $body['type'] ?? 'damage';
    $result = StockModel::damage(
        (int)$body['product_id'],
        (float)$body['quantity'],
        $auth['user_id'],
        $type,
        $body['notes'] ?? null
    );

    Response::success($result, ucfirst($type) . ' recorded successfully');
});

// GET stock summary
addRoute('GET', '/api/stock/summary', function () {
    AuthMiddleware::handle();
    Response::success(StockModel::getSummary());
});