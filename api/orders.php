<?php
require_once __DIR__ . '/../src/models/OrderModel.php';

// POST create order
addRoute('POST', '/api/orders', function () {
    $auth = AuthMiddleware::handle();
    $body = json_decode(file_get_contents('php://input'), true);

    if (empty($body['items'])) Response::error('Order must have at least one item.', 422);
    if (!isset($body['total_amount'])) Response::error('Total amount is required.', 422);

    $orderData = [
        'customer_id'     => $body['customer_id']     ?? null,
        'cashier_id'      => $auth['user_id'],
        'subtotal'        => (float)($body['subtotal']        ?? 0),
        'discount_amount' => (float)($body['discount_amount'] ?? 0),
        'discount_type'   => $body['discount_type']   ?? 'fixed',
        'tax_amount'      => (float)($body['tax_amount']      ?? 0),
        'total_amount'    => (float)$body['total_amount'],
        'amount_tendered' => (float)($body['amount_tendered'] ?? $body['total_amount']),
        'change_due'      => (float)($body['change_due']      ?? 0),
        'payment_method'  => $body['payment_method']  ?? 'cash',
        'notes'           => $body['notes']            ?? null,
    ];

    $order = OrderModel::create($orderData, $body['items']);
    
    // 🔥 If on live server, push to local immediately
    if (IS_LIVE_SERVER && !empty($order['uuid'])) {
        require_once __DIR__ . '/../src/helpers/LiveSyncHelper.php';
        LiveSyncHelper::pushToLocal('orders', [$order['uuid']]);
    }
    
    Response::success($order, 'Order placed successfully', 201);
});

// GET all orders
addRoute('GET', '/api/orders', function () {
    AuthMiddleware::handle();
    $limit  = (int)($_GET['limit']  ?? 50);
    $offset = (int)($_GET['offset'] ?? 0);
    Response::success(OrderModel::all($limit, $offset));
});

// GET single order
addRoute('GET', '/api/orders/{id}', function ($params) {
    AuthMiddleware::handle();
    $order = OrderModel::findById((int)$params['id']);
    if (!$order) Response::error('Order not found', 404);
    Response::success($order);
});

// PUT void order
addRoute('PUT', '/api/orders/{id}/void', function ($params) {
    AuthMiddleware::handle(['superadmin', 'admin', 'manager']);
    $order = OrderModel::findById((int)$params['id']);
    if (!$order) Response::error('Order not found', 404);
    if ($order['status'] === 'voided') Response::error('Order already voided', 400);
    OrderModel::void((int)$params['id']);
    Response::success(null, 'Order voided successfully');
});