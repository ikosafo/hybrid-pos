<?php
class StockModel {
    public static function getMovements(?int $productId = null, int $limit = 50, int $offset = 0): array {
        $conn  = getDBConnection();
        $where = '';
        $types = '';
        $vals  = [];

        if ($productId) {
            $where  = 'WHERE sm.product_id = ?';
            $types  = 'i';
            $vals[] = $productId;
        }

        $sql = "
            SELECT
                sm.*,
                p.name  AS product_name,
                p.unit  AS product_unit,
                u.name  AS user_name
            FROM stock_movements sm
            LEFT JOIN products p ON p.id = sm.product_id
            LEFT JOIN users    u ON u.id = sm.user_id
            {$where}
            ORDER BY sm.created_at DESC
            LIMIT {$limit} OFFSET {$offset}
        ";

        $stmt = $conn->prepare($sql);
        if ($types) $stmt->bind_param($types, ...$vals);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        return $result;
    }

    public static function restock(int $productId, float $qty, int $userId, ?string $notes): array {
        $conn = getDBConnection();

        // Get current stock
        $stmt = $conn->prepare('SELECT stock_qty, name, unit FROM products WHERE id = ?');
        $stmt->bind_param('i', $productId);
        $stmt->execute();
        $product = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$product) throw new Exception('Product not found');

        $before = (float)$product['stock_qty'];
        $after  = $before + $qty;

        // Update stock
        $ustmt = $conn->prepare('UPDATE products SET stock_qty = ? WHERE id = ?');
        $ustmt->bind_param('di', $after, $productId);
        $ustmt->execute();
        $ustmt->close();

        // Log movement
        self::logMovement($productId, $userId, 'restock', $before, $qty, $after, $notes);

        return [
            'product_name' => $product['name'],
            'unit'         => $product['unit'],
            'qty_before'   => $before,
            'qty_added'    => $qty,
            'qty_after'    => $after,
        ];
    }

    public static function adjust(int $productId, float $newQty, int $userId, ?string $notes): array {
        $conn = getDBConnection();

        $stmt = $conn->prepare('SELECT stock_qty, name, unit FROM products WHERE id = ?');
        $stmt->bind_param('i', $productId);
        $stmt->execute();
        $product = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$product) throw new Exception('Product not found');

        $before = (float)$product['stock_qty'];
        $change = $newQty - $before;

        $ustmt = $conn->prepare('UPDATE products SET stock_qty = ? WHERE id = ?');
        $ustmt->bind_param('di', $newQty, $productId);
        $ustmt->execute();
        $ustmt->close();

        self::logMovement($productId, $userId, 'adjustment', $before, $change, $newQty, $notes);

        return [
            'product_name' => $product['name'],
            'unit'         => $product['unit'],
            'qty_before'   => $before,
            'qty_change'   => $change,
            'qty_after'    => $newQty,
        ];
    }

    public static function damage(int $productId, float $qty, int $userId, string $type, ?string $notes): array {
        $conn = getDBConnection();

        $stmt = $conn->prepare('SELECT stock_qty, name, unit FROM products WHERE id = ?');
        $stmt->bind_param('i', $productId);
        $stmt->execute();
        $product = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$product) throw new Exception('Product not found');

        $before = (float)$product['stock_qty'];
        $after  = max(0, $before - $qty);
        $change = -$qty;

        $ustmt = $conn->prepare('UPDATE products SET stock_qty = ? WHERE id = ?');
        $ustmt->bind_param('di', $after, $productId);
        $ustmt->execute();
        $ustmt->close();

        self::logMovement($productId, $userId, $type, $before, $change, $after, $notes);

        return [
            'product_name' => $product['name'],
            'unit'         => $product['unit'],
            'qty_before'   => $before,
            'qty_removed'  => $qty,
            'qty_after'    => $after,
        ];
    }

    public static function logMovement(
        int $productId, int $userId, string $type,
        float $before, float $change, float $after, ?string $notes
    ): void {
        $conn  = getDBConnection();
        $stmt  = $conn->prepare('
            INSERT INTO stock_movements
                (product_id, user_id, type, qty_before, qty_change, qty_after, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->bind_param('iisddds',
            $productId, $userId, $type,
            $before, $change, $after, $notes
        );
        $stmt->execute();
        $stmt->close();
    }

    public static function getSummary(): array {
        $conn   = getDBConnection();
        $result = $conn->query("
            SELECT
                COUNT(*) AS total_products,
                SUM(stock_qty) AS total_units,
                SUM(stock_qty * cost_price) AS total_cost_value,
                SUM(stock_qty * price) AS total_retail_value,
                SUM(CASE WHEN stock_qty <= low_stock_alert AND track_stock = 1 THEN 1 ELSE 0 END) AS low_stock_count,
                SUM(CASE WHEN stock_qty <= 0 AND track_stock = 1 THEN 1 ELSE 0 END) AS out_of_stock_count
            FROM products
            WHERE is_active = 1
        ");
        return $result->fetch_assoc();
    }
}