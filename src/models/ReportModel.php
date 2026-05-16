<?php
class ReportModel {
    private static function getDateRange(string $period, ?string $start = null, ?string $end = null): array {
        $now   = new DateTime();
        $today = $now->format('Y-m-d');

        if ($start && $end) {
            return ['start' => $start, 'end' => $end];
        }

        switch ($period) {
            case 'today':
                return ['start' => $today, 'end' => $today];
            case 'yesterday':
                $y = (clone $now)->modify('-1 day')->format('Y-m-d');
                return ['start' => $y, 'end' => $y];
            case 'this_week':
                $start = (clone $now)->modify('monday this week')->format('Y-m-d');
                return ['start' => $start, 'end' => $today];
            case 'last_week':
                $start = (clone $now)->modify('monday last week')->format('Y-m-d');
                $end   = (clone $now)->modify('sunday last week')->format('Y-m-d');
                return ['start' => $start, 'end' => $end];
            case 'this_month':
                return ['start' => $now->format('Y-m-01'), 'end' => $today];
            case 'last_month':
                $start = (clone $now)->modify('first day of last month')->format('Y-m-d');
                $end   = (clone $now)->modify('last day of last month')->format('Y-m-d');
                return ['start' => $start, 'end' => $end];
            case 'this_year':
                return ['start' => $now->format('Y-01-01'), 'end' => $today];
            case 'last_year':
                $year = (int)$now->format('Y') - 1;
                return ['start' => "{$year}-01-01", 'end' => "{$year}-12-31"];
            default:
                return ['start' => $now->format('Y-m-01'), 'end' => $today];
        }
    }

    public static function getSalesReport(array $filters): array {
        $conn  = getDBConnection();
        $range = self::getDateRange(
            $filters['period'],
            $filters['start_date'] ?? null,
            $filters['end_date']   ?? null
        );

        $stmt = $conn->prepare("
            SELECT
                COUNT(*)                                    AS total_orders,
                COUNT(CASE WHEN status='completed' THEN 1 END) AS completed_orders,
                COUNT(CASE WHEN status='voided'    THEN 1 END) AS voided_orders,
                SUM(CASE WHEN status='completed' THEN total_amount  ELSE 0 END) AS total_revenue,
                SUM(CASE WHEN status='completed' THEN discount_amount ELSE 0 END) AS total_discounts,
                SUM(CASE WHEN status='completed' THEN tax_amount    ELSE 0 END) AS total_tax,
                AVG(CASE WHEN status='completed' THEN total_amount  END) AS avg_order_value,
                SUM(CASE WHEN status='completed' AND payment_method='cash' THEN total_amount ELSE 0 END) AS cash_revenue,
                SUM(CASE WHEN status='completed' AND payment_method='momo' THEN total_amount ELSE 0 END) AS momo_revenue,
                SUM(CASE WHEN status='completed' AND payment_method='card' THEN total_amount ELSE 0 END) AS card_revenue,
                SUM(CASE WHEN status='completed' AND payment_method='split' THEN total_amount ELSE 0 END) AS split_revenue
            FROM orders
            WHERE DATE(created_at) BETWEEN ? AND ?
        ");
        $stmt->bind_param('ss', $range['start'], $range['end']);
        $stmt->execute();
        $summary = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        return [
            'period'  => $range,
            'summary' => $summary,
        ];
    }

    public static function getProfitLoss(array $filters): array {
        $conn  = getDBConnection();
        $range = self::getDateRange(
            $filters['period'],
            $filters['start_date'] ?? null,
            $filters['end_date']   ?? null
        );

        // Revenue from sales
        $salesStmt = $conn->prepare("
            SELECT
                SUM(oi.total)                        AS gross_revenue,
                SUM(oi.quantity * p.cost_price)      AS cost_of_goods,
                SUM(oi.total) - SUM(oi.quantity * p.cost_price) AS gross_profit
            FROM order_items oi
            JOIN orders  o ON o.id  = oi.order_id
            JOIN products p ON p.id = oi.product_id
            WHERE o.status = 'completed'
              AND DATE(o.created_at) BETWEEN ? AND ?
        ");
        $salesStmt->bind_param('ss', $range['start'], $range['end']);
        $salesStmt->execute();
        $sales = $salesStmt->get_result()->fetch_assoc();
        $salesStmt->close();

        // Expenses
        $expStmt = $conn->prepare("
            SELECT SUM(amount) AS total_expenses
            FROM expenses
            WHERE expense_date BETWEEN ? AND ?
        ");
        $expStmt->bind_param('ss', $range['start'], $range['end']);
        $expStmt->execute();
        $expenses = $expStmt->get_result()->fetch_assoc();
        $expStmt->close();

        $grossRevenue  = (float)($sales['gross_revenue']  ?? 0);
        $costOfGoods   = (float)($sales['cost_of_goods']  ?? 0);
        $grossProfit   = (float)($sales['gross_profit']   ?? 0);
        $totalExpenses = (float)($expenses['total_expenses'] ?? 0);
        $netProfit     = $grossProfit - $totalExpenses;

        return [
            'period'         => $range,
            'gross_revenue'  => $grossRevenue,
            'cost_of_goods'  => $costOfGoods,
            'gross_profit'   => $grossProfit,
            'total_expenses' => $totalExpenses,
            'net_profit'     => $netProfit,
            'profit_margin'  => $grossRevenue > 0
                ? round(($netProfit / $grossRevenue) * 100, 2)
                : 0,
        ];
    }

    public static function getTopProducts(array $filters): array {
        $conn  = getDBConnection();
        $range = self::getDateRange($filters['period']);
        $limit = $filters['limit'] ?? 10;

        $stmt = $conn->prepare("
            SELECT
                p.name,
                p.unit,
                c.name                  AS category_name,
                SUM(oi.quantity)        AS total_qty,
                SUM(oi.total)           AS total_revenue,
                SUM(oi.quantity * p.cost_price) AS total_cost,
                SUM(oi.total) - SUM(oi.quantity * p.cost_price) AS total_profit,
                COUNT(DISTINCT o.id)    AS order_count
            FROM order_items oi
            JOIN orders   o ON o.id  = oi.order_id
            JOIN products p ON p.id  = oi.product_id
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE o.status = 'completed'
              AND DATE(o.created_at) BETWEEN ? AND ?
            GROUP BY p.id, p.name, p.unit, c.name
            ORDER BY total_revenue DESC
            LIMIT {$limit}
        ");
        $stmt->bind_param('ss', $range['start'], $range['end']);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        return $result;
    }

    public static function getCashierPerformance(array $filters): array {
        $conn  = getDBConnection();
        $range = self::getDateRange($filters['period']);

        $stmt = $conn->prepare("
            SELECT
                u.name                  AS cashier_name,
                COUNT(o.id)             AS total_orders,
                SUM(o.total_amount)     AS total_revenue,
                AVG(o.total_amount)     AS avg_order_value,
                SUM(o.discount_amount)  AS total_discounts,
                COUNT(CASE WHEN o.status='voided' THEN 1 END) AS voided_orders
            FROM orders o
            JOIN users u ON u.id = o.cashier_id
            WHERE o.status IN ('completed','voided')
              AND DATE(o.created_at) BETWEEN ? AND ?
            GROUP BY u.id, u.name
            ORDER BY total_revenue DESC
        ");
        $stmt->bind_param('ss', $range['start'], $range['end']);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        return $result;
    }

    public static function getDailySales(array $filters): array {
        $conn  = getDBConnection();
        $range = self::getDateRange($filters['period']);

        $stmt = $conn->prepare("
            SELECT
                DATE(created_at)        AS sale_date,
                COUNT(*)                AS order_count,
                SUM(total_amount)       AS revenue,
                SUM(discount_amount)    AS discounts
            FROM orders
            WHERE status = 'completed'
              AND DATE(created_at) BETWEEN ? AND ?
            GROUP BY DATE(created_at)
            ORDER BY sale_date ASC
        ");
        $stmt->bind_param('ss', $range['start'], $range['end']);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        return $result;
    }

    public static function getExportData(string $type, string $period): array {
        $conn  = getDBConnection();
        $range = self::getDateRange($period);
        $csv   = '';
        $data  = [];

        switch ($type) {
            case 'sales':
                $result = $conn->query("
                    SELECT
                        o.order_number, o.created_at,
                        COALESCE(c.name, 'Guest') AS customer,
                        u.name AS cashier,
                        o.subtotal, o.discount_amount, o.tax_amount,
                        o.total_amount, o.payment_method, o.status,
                        o.amount_tendered, o.change_due
                    FROM orders o
                    LEFT JOIN customers c ON c.id = o.customer_id
                    LEFT JOIN users     u ON u.id = o.cashier_id
                    WHERE DATE(o.created_at) BETWEEN '{$range['start']}' AND '{$range['end']}'
                    ORDER BY o.created_at DESC
                ");
                $data = $result->fetch_all(MYSQLI_ASSOC);
                $csv  = self::arrayToCSV($data, [
                    'Order #', 'Date', 'Customer', 'Cashier',
                    'Subtotal', 'Discount', 'Tax', 'Total',
                    'Payment', 'Status', 'Tendered', 'Change'
                ]);
                break;

            case 'products':
                $result = $conn->query("
                    SELECT
                        p.name, p.sku, p.barcode,
                        c.name AS category,
                        p.price, p.cost_price, p.stock_qty,
                        p.unit, p.low_stock_alert,
                        CASE WHEN p.is_active=1 THEN 'Active' ELSE 'Inactive' END AS status
                    FROM products p
                    LEFT JOIN categories c ON c.id = p.category_id
                    ORDER BY p.name
                ");
                $data = $result->fetch_all(MYSQLI_ASSOC);
                $csv  = self::arrayToCSV($data, [
                    'Product', 'SKU', 'Barcode', 'Category',
                    'Price', 'Cost Price', 'Stock', 'Unit',
                    'Low Stock Alert', 'Status'
                ]);
                break;

            case 'expenses':
                $result = $conn->query("
                    SELECT
                        e.expense_date, e.category, e.description,
                        e.amount, e.notes,
                        u.name AS recorded_by, e.created_at
                    FROM expenses e
                    LEFT JOIN users u ON u.id = e.recorded_by
                    WHERE e.expense_date BETWEEN '{$range['start']}' AND '{$range['end']}'
                    ORDER BY e.expense_date DESC
                ");
                $data = $result->fetch_all(MYSQLI_ASSOC);
                $csv  = self::arrayToCSV($data, [
                    'Date', 'Category', 'Description',
                    'Amount', 'Notes', 'Recorded By', 'Created At'
                ]);
                break;

            case 'stock':
                $result = $conn->query("
                    SELECT
                        sm.created_at, p.name AS product,
                        sm.type, sm.qty_before, sm.qty_change,
                        sm.qty_after, u.name AS user, sm.notes
                    FROM stock_movements sm
                    JOIN products p ON p.id = sm.product_id
                    JOIN users    u ON u.id = sm.user_id
                    WHERE DATE(sm.created_at) BETWEEN '{$range['start']}' AND '{$range['end']}'
                    ORDER BY sm.created_at DESC
                ");
                $data = $result->fetch_all(MYSQLI_ASSOC);
                $csv  = self::arrayToCSV($data, [
                    'Date', 'Product', 'Type', 'Before',
                    'Change', 'After', 'User', 'Notes'
                ]);
                break;
        }

        return ['data' => $data, 'csv' => $csv, 'period' => $range];
    }

    private static function arrayToCSV(array $data, array $headers): string {
        $output = fopen('php://temp', 'r+');
        fputcsv($output, $headers);
        foreach ($data as $row) {
            fputcsv($output, array_values($row));
        }
        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);
        return $csv;
    }
}