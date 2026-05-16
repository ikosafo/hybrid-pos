<?php
require_once __DIR__ . '/../src/models/CategoryModel.php';

// GET all categories
addRoute('GET', '/api/categories', function () {
    AuthMiddleware::handle();
    Response::success(CategoryModel::all());
});

// GET single category
addRoute('GET', '/api/categories/{id}', function ($params) {
    AuthMiddleware::handle();
    $cat = CategoryModel::findById((int)$params['id']);
    if (!$cat) Response::error('Category not found', 404);
    Response::success($cat);
});

// POST create category
addRoute('POST', '/api/categories', function () {
    AuthMiddleware::handle(['superadmin', 'admin', 'manager']);
    $body = json_decode(file_get_contents('php://input'), true);

    if (empty($body['name'])) Response::error('Category name is required.', 422);

    $data = [
        'name'  => trim($body['name']),
        'color' => $body['color'] ?? '#6366f1',
        'icon'  => $body['icon']  ?? 'tag',
    ];

    $id  = CategoryModel::create($data);
    $cat = CategoryModel::findById($id);
    Response::success($cat, 'Category created', 201);
});

// PUT update category
addRoute('PUT', '/api/categories/{id}', function ($params) {
    AuthMiddleware::handle(['superadmin', 'admin', 'manager']);
    $body = json_decode(file_get_contents('php://input'), true);
    $cat  = CategoryModel::findById((int)$params['id']);
    if (!$cat) Response::error('Category not found', 404);

    if (empty($body['name'])) Response::error('Category name is required.', 422);

    $data = [
        'name'  => trim($body['name']),
        'color' => $body['color'] ?? $cat['color'],
        'icon'  => $body['icon']  ?? $cat['icon'],
    ];

    CategoryModel::update((int)$params['id'], $data);
    Response::success(CategoryModel::findById((int)$params['id']), 'Category updated');
});

// DELETE category
addRoute('DELETE', '/api/categories/{id}', function ($params) {
    AuthMiddleware::handle(['superadmin', 'admin']);
    $cat = CategoryModel::findById((int)$params['id']);
    if (!$cat) Response::error('Category not found', 404);
    CategoryModel::delete((int)$params['id']);
    Response::success(null, 'Category deleted');
});