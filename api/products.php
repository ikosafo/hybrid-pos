<?php
require_once __DIR__ . '/../src/models/ProductModel.php';

// GET all products
addRoute('GET', '/api/products', function () {
    AuthMiddleware::handle();
    $filters = [
        'category_id' => $_GET['category_id'] ?? null,
        'search'      => $_GET['search'] ?? null,
    ];
    Response::success(ProductModel::all($filters));
});

// GET low stock products
addRoute('GET', '/api/products/low-stock', function () {
    AuthMiddleware::handle();
    Response::success(ProductModel::lowStock());
});

// GET product by barcode
addRoute('GET', '/api/products/barcode/{barcode}', function ($params) {
    AuthMiddleware::handle();
    $product = ProductModel::findByBarcode($params['barcode']);
    if (!$product) Response::error('Product not found', 404);
    Response::success($product);
});

// GET single product
addRoute('GET', '/api/products/{id}', function ($params) {
    AuthMiddleware::handle();
    $product = ProductModel::findById((int)$params['id']);
    if (!$product) Response::error('Product not found', 404);
    Response::success($product);
});

// POST create product
addRoute('POST', '/api/products', function () {
    AuthMiddleware::handle(['superadmin', 'admin', 'manager']);
    $body = json_decode(file_get_contents('php://input'), true);

    if (empty($body['name']))  Response::error('Product name is required.', 422);
    if (!isset($body['price'])) Response::error('Price is required.', 422);

    $data = [
        'category_id'     => $body['category_id']     ?? null,
        'name'            => trim($body['name']),
        'sku'             => $body['sku']              ?? null,
        'barcode'         => $body['barcode']          ?? null,
        'description'     => $body['description']      ?? null,
        'price'           => (float)$body['price'],
        'cost_price'      => (float)($body['cost_price'] ?? 0),
        'stock_qty'       => (float)($body['stock_qty']  ?? 0),
        'low_stock_alert' => (int)($body['low_stock_alert'] ?? 5),
        'unit'            => $body['unit']             ?? 'pcs',
        'track_stock'     => (int)($body['track_stock']  ?? 1),
    ];

    $id      = ProductModel::create($data);
    $product = ProductModel::findById($id);
    Response::success($product, 'Product created', 201);
});

// PUT update product
addRoute('PUT', '/api/products/{id}', function ($params) {
    AuthMiddleware::handle(['superadmin', 'admin', 'manager']);
    $body    = json_decode(file_get_contents('php://input'), true);
    $product = ProductModel::findById((int)$params['id']);
    if (!$product) Response::error('Product not found', 404);

    if (empty($body['name']))   Response::error('Product name is required.', 422);
    if (!isset($body['price'])) Response::error('Price is required.', 422);

    $data = [
        'category_id'     => $body['category_id']        ?? $product['category_id'],
        'name'            => trim($body['name']),
        'sku'             => $body['sku']                 ?? $product['sku'],
        'barcode'         => $body['barcode']             ?? $product['barcode'],
        'description'     => $body['description']         ?? $product['description'],
        'price'           => (float)$body['price'],
        'cost_price'      => (float)($body['cost_price']  ?? $product['cost_price']),
        'stock_qty'       => (float)($body['stock_qty']   ?? $product['stock_qty']),
        'low_stock_alert' => (int)($body['low_stock_alert'] ?? $product['low_stock_alert']),
        'unit'            => $body['unit']                ?? $product['unit'],
        'track_stock'     => (int)($body['track_stock']   ?? $product['track_stock']),
    ];

    ProductModel::update((int)$params['id'], $data);
    Response::success(ProductModel::findById((int)$params['id']), 'Product updated');
});

// DELETE product
addRoute('DELETE', '/api/products/{id}', function ($params) {
    AuthMiddleware::handle(['superadmin', 'admin']);
    $product = ProductModel::findById((int)$params['id']);
    if (!$product) Response::error('Product not found', 404);
    ProductModel::delete((int)$params['id']);
    Response::success(null, 'Product deleted');
});


addRoute('POST', '/api/products', function () {
    AuthMiddleware::handle(['superadmin', 'admin', 'manager']);
    $body = json_decode(file_get_contents('php://input'), true);

    if (empty($body['name']))   Response::error('Product name is required.', 422);
    if (!isset($body['price'])) Response::error('Price is required.', 422);

    $conn = getDBConnection();

    // Check duplicate name in same category
    $dupStmt = $conn->prepare('
        SELECT id FROM products
        WHERE name = ? AND category_id <=> ? AND is_active = 1 LIMIT 1
    ');
    $dupStmt->bind_param('si', $body['name'], $body['category_id']);
    $dupStmt->execute();
    if ($dupStmt->get_result()->fetch_assoc()) {
        Response::error('A product with this name already exists in this category.', 422);
    }
    $dupStmt->close();

    // Check duplicate barcode
    if (!empty($body['barcode'])) {
        $barStmt = $conn->prepare('SELECT id FROM products WHERE barcode = ? AND is_active = 1 LIMIT 1');
        $barStmt->bind_param('s', $body['barcode']);
        $barStmt->execute();
        if ($barStmt->get_result()->fetch_assoc()) {
            Response::error('A product with this barcode already exists.', 422);
        }
        $barStmt->close();
    }

    // Check duplicate SKU
    if (!empty($body['sku'])) {
        $skuStmt = $conn->prepare('SELECT id FROM products WHERE sku = ? AND is_active = 1 LIMIT 1');
        $skuStmt->bind_param('s', $body['sku']);
        $skuStmt->execute();
        if ($skuStmt->get_result()->fetch_assoc()) {
            Response::error('A product with this SKU already exists.', 422);
        }
        $skuStmt->close();
    }

    $data = [
        'category_id'     => $body['category_id']     ?? null,
        'name'            => trim($body['name']),
        'sku'             => $body['sku']              ?? null,
        'barcode'         => $body['barcode']          ?? null,
        'description'     => $body['description']      ?? null,
        'price'           => (float)$body['price'],
        'cost_price'      => (float)($body['cost_price'] ?? 0),
        'stock_qty'       => (float)($body['stock_qty']  ?? 0),
        'low_stock_alert' => (int)($body['low_stock_alert'] ?? 5),
        'unit'            => $body['unit']             ?? 'pcs',
        'track_stock'     => (int)($body['track_stock']  ?? 1),
    ];

    $id      = ProductModel::create($data);
    $product = ProductModel::findById($id);
    Response::success($product, 'Product created', 201);
});