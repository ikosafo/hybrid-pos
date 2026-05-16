<?php
require_once __DIR__ . '/../src/models/ExpenseModel.php';

// GET all expenses
addRoute('GET', '/api/expenses', function () {
    AuthMiddleware::handle();
    $filters = [
        'category' => $_GET['category'] ?? null,
        'period'   => $_GET['period']   ?? null,
        'limit'    => (int)($_GET['limit']  ?? 100),
        'offset'   => (int)($_GET['offset'] ?? 0),
    ];
    Response::success(ExpenseModel::all($filters));
});

// GET expense summary
addRoute('GET', '/api/expenses/summary', function () {
    AuthMiddleware::handle();
    Response::success(ExpenseModel::getSummary());
});

// GET expense categories
addRoute('GET', '/api/expenses/categories', function () {
    AuthMiddleware::handle();
    Response::success(ExpenseModel::getCategories());
});

// POST create expense
addRoute('POST', '/api/expenses', function () {
    $auth = AuthMiddleware::handle();
    $body = json_decode(file_get_contents('php://input'), true);

    if (empty($body['description'])) Response::error('Description is required', 422);
    if (empty($body['amount']))      Response::error('Amount is required', 422);
    if ($body['amount'] <= 0)        Response::error('Amount must be greater than 0', 422);

    $data = [
        'category'    => $body['category']    ?? 'General',
        'description' => trim($body['description']),
        'amount'      => (float)$body['amount'],
        'recorded_by' => $auth['user_id'],
        'notes'       => $body['notes'] ?? null,
        'expense_date'=> $body['expense_date'] ?? date('Y-m-d'),
    ];

    $id      = ExpenseModel::create($data);
    $expense = ExpenseModel::findById($id);
    Response::success($expense, 'Expense recorded successfully', 201);
});

// PUT update expense
addRoute('PUT', '/api/expenses/{id}', function ($params) {
    AuthMiddleware::handle(['superadmin', 'admin', 'manager']);
    $body    = json_decode(file_get_contents('php://input'), true);
    $expense = ExpenseModel::findById((int)$params['id']);
    if (!$expense) Response::error('Expense not found', 404);

    if (empty($body['description'])) Response::error('Description is required', 422);
    if (empty($body['amount']))      Response::error('Amount is required', 422);

    $data = [
        'category'    => $body['category']    ?? $expense['category'],
        'description' => trim($body['description']),
        'amount'      => (float)$body['amount'],
        'notes'       => $body['notes']        ?? $expense['notes'],
        'expense_date'=> $body['expense_date'] ?? $expense['expense_date'],
    ];

    ExpenseModel::update((int)$params['id'], $data);
    Response::success(ExpenseModel::findById((int)$params['id']), 'Expense updated');
});

// DELETE expense
addRoute('DELETE', '/api/expenses/{id}', function ($params) {
    AuthMiddleware::handle(['superadmin', 'admin']);
    $expense = ExpenseModel::findById((int)$params['id']);
    if (!$expense) Response::error('Expense not found', 404);
    ExpenseModel::delete((int)$params['id']);
    Response::success(null, 'Expense deleted');
});