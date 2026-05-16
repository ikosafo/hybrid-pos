<?php
require_once __DIR__ . '/../src/models/ReportModel.php';

// GET sales report
addRoute('GET', '/api/reports/sales', function () {
    AuthMiddleware::handle(['superadmin', 'admin', 'manager']);
    $filters = [
        'period'     => $_GET['period']     ?? 'this_month',
        'start_date' => $_GET['start_date'] ?? null,
        'end_date'   => $_GET['end_date']   ?? null,
    ];
    Response::success(ReportModel::getSalesReport($filters));
});

// GET profit & loss report
addRoute('GET', '/api/reports/profit-loss', function () {
    AuthMiddleware::handle(['superadmin', 'admin', 'manager']);
    $filters = [
        'period'     => $_GET['period']     ?? 'this_month',
        'start_date' => $_GET['start_date'] ?? null,
        'end_date'   => $_GET['end_date']   ?? null,
    ];
    Response::success(ReportModel::getProfitLoss($filters));
});

// GET top products report
addRoute('GET', '/api/reports/top-products', function () {
    AuthMiddleware::handle(['superadmin', 'admin', 'manager']);
    $filters = [
        'period' => $_GET['period'] ?? 'this_month',
        'limit'  => (int)($_GET['limit'] ?? 10),
    ];
    Response::success(ReportModel::getTopProducts($filters));
});

// GET cashier performance
addRoute('GET', '/api/reports/cashiers', function () {
    AuthMiddleware::handle(['superadmin', 'admin', 'manager']);
    $filters = [
        'period' => $_GET['period'] ?? 'this_month',
    ];
    Response::success(ReportModel::getCashierPerformance($filters));
});

// GET daily sales chart data
addRoute('GET', '/api/reports/daily-sales', function () {
    AuthMiddleware::handle(['superadmin', 'admin', 'manager']);
    $filters = [
        'period' => $_GET['period'] ?? 'this_month',
    ];
    Response::success(ReportModel::getDailySales($filters));
});

// GET export data
addRoute('GET', '/api/reports/export', function () {
    AuthMiddleware::handle(['superadmin', 'admin', 'manager']);
    $type    = $_GET['type']   ?? 'sales';
    $period  = $_GET['period'] ?? 'this_month';
    $format  = $_GET['format'] ?? 'csv';

    $data = ReportModel::getExportData($type, $period);

    if ($format === 'csv') {
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="' . $type . '_report_' . date('Y-m-d') . '.csv"');
        echo $data['csv'];
        exit;
    }

    Response::success($data);
});