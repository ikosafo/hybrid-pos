<?php
class SyncHelper {

    // Tables that support sync
    private static array $syncTables = [
        'orders'          => 'orders',
        'products'        => 'products',
        'categories'      => 'categories',
        'customers'       => 'customers',
        'expenses'        => 'expenses',
        'stock_movements' => 'stock_movements',
        'order_items'     => 'order_items',
    ];

    // ── Upsert a record ──────────────────────
    public static function upsert(string $entityType, array $record): bool {
        $conn = getDBConnection();

        if (!isset(self::$syncTables[$entityType])) {
            throw new Exception("Unknown entity type: {$entityType}");
        }

        $table = self::$syncTables[$entityType];

        switch ($entityType) {
            case 'orders':
                return self::upsertOrder($conn, $record);
            case 'order_items':
                return self::upsertOrderItem($conn, $record);
            case 'products':
                return self::upsertProduct($conn, $record);
            case 'categories':
                return self::upsertCategory($conn, $record);
            case 'customers':
                return self::upsertCustomer($conn, $record);
            case 'expenses':
                return self::upsertExpense($conn, $record);
            case 'stock_movements':
                return self::upsertStockMovement($conn, $record);
            default:
                throw new Exception("No upsert handler for: {$entityType}");
        }
    }

    // ── Orders ───────────────────────────────
    private static function upsertOrder(mysqli $conn, array $r): bool {
        $stmt = $conn->prepare('
            INSERT INTO orders (
                uuid, order_number, customer_id, cashier_id,
                status, subtotal, discount_amount, discount_type,
                tax_amount, total_amount, amount_tendered, change_due,
                payment_method, notes, is_synced, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            ON DUPLICATE KEY UPDATE
                status          = VALUES(status),
                is_synced       = 1,
                synced_at       = NOW()
        ');

        $stmt->bind_param(
            'ssiisddsddddssss',
            $r['uuid'], $r['order_number'],
            $r['customer_id'], $r['cashier_id'],
            $r['status'], $r['subtotal'],
            $r['discount_amount'], $r['discount_type'],
            $r['tax_amount'], $r['total_amount'],
            $r['amount_tendered'], $r['change_due'],
            $r['payment_method'], $r['notes'],
            $r['created_at']
        );

        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected >= 0;
    }

    // ── Order Items ──────────────────────────
    private static function upsertOrderItem(mysqli $conn, array $r): bool {
        // Find order_id from uuid
        $ostmt = $conn->prepare('SELECT id FROM orders WHERE uuid = ? LIMIT 1');
        $ostmt->bind_param('s', $r['order_uuid']);
        $ostmt->execute();
        $order = $ostmt->get_result()->fetch_assoc();
        $ostmt->close();

        if (!$order) return false;

        $orderId = $order['id'];
        $stmt    = $conn->prepare('
            INSERT INTO order_items (
                order_id, product_id, product_name,
                unit_price, quantity, total
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                quantity   = VALUES(quantity),
                total      = VALUES(total)
        ');

        $stmt->bind_param(
            'iisddd',
            $orderId, $r['product_id'], $r['product_name'],
            $r['unit_price'], $r['quantity'], $r['total']
        );
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected >= 0;
    }

    // ── Products ─────────────────────────────
    private static function upsertProduct(mysqli $conn, array $r): bool {
        $stmt = $conn->prepare('
            INSERT INTO products (
                uuid, category_id, name, sku, barcode,
                description, price, cost_price, stock_qty,
                low_stock_alert, unit, is_active, track_stock,
                is_synced, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            ON DUPLICATE KEY UPDATE
                name            = VALUES(name),
                price           = VALUES(price),
                cost_price      = VALUES(cost_price),
                stock_qty       = IF(VALUES(updated_at) > updated_at,
                                    VALUES(stock_qty), stock_qty),
                low_stock_alert = VALUES(low_stock_alert),
                unit            = VALUES(unit),
                is_active       = VALUES(is_active),
                is_synced       = 1,
                synced_at       = NOW(),
                updated_at      = IF(VALUES(updated_at) > updated_at,
                                    VALUES(updated_at), updated_at)
        ');

        $stmt->bind_param(
            'sissssdddissis',
            $r['uuid'], $r['category_id'], $r['name'],
            $r['sku'], $r['barcode'], $r['description'],
            $r['price'], $r['cost_price'], $r['stock_qty'],
            $r['low_stock_alert'], $r['unit'],
            $r['is_active'], $r['track_stock'],
            $r['updated_at']
        );

        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected >= 0;
    }

    // ── Categories ───────────────────────────
    private static function upsertCategory(mysqli $conn, array $r): bool {
        $stmt = $conn->prepare('
            INSERT INTO categories (uuid, name, color, icon, is_active, is_synced)
            VALUES (?, ?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
                name      = VALUES(name),
                color     = VALUES(color),
                icon      = VALUES(icon),
                is_active = VALUES(is_active),
                is_synced = 1,
                synced_at = NOW()
        ');

        $stmt->bind_param(
            'ssssi',
            $r['uuid'], $r['name'], $r['color'],
            $r['icon'], $r['is_active']
        );

        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected >= 0;
    }

    // ── Customers ────────────────────────────
    private static function upsertCustomer(mysqli $conn, array $r): bool {
        $stmt = $conn->prepare('
            INSERT INTO customers (
                uuid, name, phone, email, address,
                loyalty_points, total_spent, is_synced
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
                name          = VALUES(name),
                phone         = VALUES(phone),
                email         = VALUES(email),
                address       = VALUES(address),
                loyalty_points= VALUES(loyalty_points),
                total_spent   = VALUES(total_spent),
                is_synced     = 1,
                synced_at     = NOW()
        ');

        $stmt->bind_param(
            'sssssid',
            $r['uuid'], $r['name'], $r['phone'],
            $r['email'], $r['address'],
            $r['loyalty_points'], $r['total_spent']
        );

        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected >= 0;
    }

    // ── Expenses ─────────────────────────────
    private static function upsertExpense(mysqli $conn, array $r): bool {
        $stmt = $conn->prepare('
            INSERT INTO expenses (
                uuid, category, description, amount,
                notes, expense_date, is_synced
            ) VALUES (?, ?, ?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
                category     = VALUES(category),
                description  = VALUES(description),
                amount       = VALUES(amount),
                notes        = VALUES(notes),
                is_synced    = 1,
                synced_at    = NOW()
        ');

        $stmt->bind_param(
            'sssdss',
            $r['uuid'], $r['category'], $r['description'],
            $r['amount'], $r['notes'], $r['expense_date']
        );

        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected >= 0;
    }

    // ── Stock Movements ──────────────────────
    private static function upsertStockMovement(mysqli $conn, array $r): bool {
        $stmt = $conn->prepare('
            INSERT INTO stock_movements (
                product_id, user_id, type,
                qty_before, qty_change, qty_after,
                reference, notes, is_synced, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            ON DUPLICATE KEY UPDATE
                is_synced = 1,
                synced_at = NOW()
        ');

        $stmt->bind_param(
            'iisdddsss',
            $r['product_id'], $r['user_id'], $r['type'],
            $r['qty_before'], $r['qty_change'], $r['qty_after'],
            $r['reference'], $r['notes'], $r['created_at']
        );

        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected >= 0;
    }

    // ── Get Updated Since ────────────────────
    public static function getUpdatedSince(
        string $entityType,
        ?string $since,
        int $limit = 500
    ): array {
        $conn  = getDBConnection();
        $since = $since ?? '1970-01-01 00:00:00';

        $queries = [
            'orders' => "
                SELECT o.*,
                       GROUP_CONCAT(
                           JSON_OBJECT(
                               'product_id',   oi.product_id,
                               'product_name', oi.product_name,
                               'unit_price',   oi.unit_price,
                               'quantity',     oi.quantity,
                               'total',        oi.total
                           )
                       ) AS items_json
                FROM orders o
                LEFT JOIN order_items oi ON oi.order_id = o.id
                WHERE o.updated_at > ? OR o.created_at > ?
                GROUP BY o.id
                ORDER BY o.created_at DESC
                LIMIT {$limit}
            ",
            'products' => "
                SELECT p.*, c.uuid AS category_uuid
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE p.updated_at > ?
                ORDER BY p.updated_at DESC
                LIMIT {$limit}
            ",
            'categories' => "
                SELECT * FROM categories
                WHERE created_at > ?
                ORDER BY created_at DESC
                LIMIT {$limit}
            ",
            'customers' => "
                SELECT * FROM customers
                WHERE updated_at > ?
                ORDER BY updated_at DESC
                LIMIT {$limit}
            ",
            'expenses' => "
                SELECT * FROM expenses
                WHERE created_at > ?
                ORDER BY created_at DESC
                LIMIT {$limit}
            ",
            'stock_movements' => "
                SELECT * FROM stock_movements
                WHERE created_at > ?
                ORDER BY created_at DESC
                LIMIT {$limit}
            ",
        ];

        if (!isset($queries[$entityType])) return [];

        $sql  = $queries[$entityType];
        $stmt = $conn->prepare($sql);

        // Some queries need two params (orders)
        if ($entityType === 'orders') {
            $stmt->bind_param('ss', $since, $since);
        } else {
            $stmt->bind_param('s', $since);
        }

        $stmt->execute();
        $results = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        // Parse items_json for orders
        if ($entityType === 'orders') {
            foreach ($results as &$order) {
                if ($order['items_json']) {
                    $order['items'] = array_map(
                        fn($i) => json_decode($i, true),
                        explode('},{', str_replace(
                            ['[', ']'], '',
                            '[' . $order['items_json'] . ']'
                        ))
                    );
                    // Clean parse
                    $decoded = json_decode(
                        '[' . $order['items_json'] . ']', true
                    );
                    $order['items'] = $decoded ?? [];
                } else {
                    $order['items'] = [];
                }
                unset($order['items_json']);
            }
        }

        return $results;
    }

    // ── Mark records as synced ───────────────
    public static function markSynced(string $entityType, array $uuids): int {
        $conn  = getDBConnection();
        $table = self::$syncTables[$entityType] ?? null;
        if (!$table) return 0;

        $placeholders = implode(',', array_fill(0, count($uuids), '?'));
        $types        = str_repeat('s', count($uuids));

        $stmt = $conn->prepare("
            UPDATE {$table}
            SET is_synced = 1, synced_at = NOW()
            WHERE uuid IN ({$placeholders})
        ");
        $stmt->bind_param($types, ...$uuids);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected;
    }
}