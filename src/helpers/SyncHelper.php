<?php
class SyncHelper {

    private static array $syncTables = [
        'orders'          => 'orders',
        'products'        => 'products',
        'categories'      => 'categories',
        'customers'       => 'customers',
        'expenses'        => 'expenses',
        'stock_movements' => 'stock_movements',
        'order_items'     => 'order_items',
        'users'           => 'users',
    ];

    public static function upsert(string $entityType, array $record): bool {
        $conn = getDBConnection();

        if (!isset(self::$syncTables[$entityType])) {
            throw new Exception("Unknown entity type: {$entityType}");
        }

        switch ($entityType) {
            case 'orders':
                return self::upsertOrder($conn, $record);
            case 'order_items':
                return self::upsertOrderItem($conn, $record);
            case 'users':
                return self::upsertUser($conn, $record);
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


    private static function upsertOrder(mysqli $conn, array $r): bool {
        try {
            $checkStmt = $conn->prepare('SELECT id FROM orders WHERE uuid = ?');
            $checkStmt->bind_param('s', $r['uuid']);
            $checkStmt->execute();
            $existing = $checkStmt->get_result()->fetch_assoc();
            $checkStmt->close();

            if ($existing) {
                // Order already exists — just update status and mark synced
                $stmt = $conn->prepare('UPDATE orders SET status=?, is_synced=1, synced_at=NOW() WHERE id=?');
                $stmt->bind_param('si', $r['status'], $existing['id']);
                $stmt->execute();
                $orderId = $existing['id'];
                $stmt->close();
            } else {
                // ── Resolve cashier_id from cashier_uuid ──────────────────
                // IDs differ between local and live servers — always use UUID
                $cashierId = null;
                if (!empty($r['cashier_uuid'])) {
                    $cs = $conn->prepare('SELECT id FROM users WHERE uuid = ? LIMIT 1');
                    $cs->bind_param('s', $r['cashier_uuid']);
                    $cs->execute();
                    $cu = $cs->get_result()->fetch_assoc();
                    $cs->close();
                    $cashierId = $cu['id'] ?? null;
                }
                // Fall back to raw cashier_id if UUID lookup failed
                if (!$cashierId && !empty($r['cashier_id'])) {
                    $cashierId = (int)$r['cashier_id'];
                }

                // ── customer_id: NULL for guests ──────────────────────────
                // Inserting 0 breaks FK constraints on live server
                $customerId = (!empty($r['customer_id']) && $r['customer_id'] > 0)
                    ? (int)$r['customer_id'] : null;

                $notes          = $r['notes'] ?? null;
                $uuid           = $r['uuid'];
                $orderNumber    = $r['order_number'];
                $status         = $r['status'];
                $subtotal       = (float)$r['subtotal'];
                $discountAmount = (float)$r['discount_amount'];
                $discountType   = $r['discount_type'];
                $taxAmount      = (float)$r['tax_amount'];
                $totalAmount    = (float)$r['total_amount'];
                $amountTendered = (float)$r['amount_tendered'];
                $changeDue      = (float)$r['change_due'];
                $paymentMethod  = $r['payment_method'];
                $createdAt      = $r['created_at'];

                $stmt = $conn->prepare('
                    INSERT INTO orders (
                        uuid, order_number, customer_id, cashier_id,
                        status, subtotal, discount_amount, discount_type,
                        tax_amount, total_amount, amount_tendered, change_due,
                        payment_method, notes, is_synced, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                ');
                $stmt->bind_param(
                    'ssiisddsddddsss',
                    $uuid, $orderNumber,
                    $customerId, $cashierId,
                    $status,
                    $subtotal, $discountAmount, $discountType,
                    $taxAmount, $totalAmount,
                    $amountTendered, $changeDue,
                    $paymentMethod, $notes,
                    $createdAt
                );
                $stmt->execute();
                $orderId = $conn->insert_id;
                $stmt->close();
            }

            // ── Sync order items ──────────────────────────────────────────
            if (!empty($r['items']) && $orderId > 0) {
                $conn->query("DELETE FROM order_items WHERE order_id = {$orderId}");

                $itemStmt = $conn->prepare('
                    INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, total)
                    VALUES (?, ?, ?, ?, ?, ?)
                ');
                foreach ($r['items'] as $item) {
                    $itemStmt->bind_param('iisddd',
                        $orderId,
                        $item['product_id'],
                        $item['product_name'],
                        $item['unit_price'],
                        $item['quantity'],
                        $item['total']
                    );
                    $itemStmt->execute();
                }
                $itemStmt->close();
            }

            return true;
        } catch (Exception $e) {
            error_log('[SyncHelper] upsertOrder failed: ' . $e->getMessage());
            return false;
        }
    }


    private static function upsertOrderItem(mysqli $conn, array $r): bool {
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
                quantity = VALUES(quantity),
                total    = VALUES(total)
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

    private static function upsertProduct(mysqli $conn, array $r): bool {
        $checkStmt = $conn->prepare('SELECT id, is_synced FROM products WHERE uuid = ?');
        $checkStmt->bind_param('s', $r['uuid']);
        $checkStmt->execute();
        $existing = $checkStmt->get_result()->fetch_assoc();
        $checkStmt->close();

        $isSynced = $existing ? $existing['is_synced'] : 1;

        // Resolve category_id from category_uuid
        $categoryId = null;
        if (!empty($r['category_uuid'])) {
            $cstmt = $conn->prepare('SELECT id FROM categories WHERE uuid = ? LIMIT 1');
            $cstmt->bind_param('s', $r['category_uuid']);
            $cstmt->execute();
            $cat = $cstmt->get_result()->fetch_assoc();
            $cstmt->close();
            $categoryId = $cat['id'] ?? null;
        } elseif (!empty($r['category_id'])) {
            $categoryId = (int)$r['category_id'];
        }

        $stmt = $conn->prepare('
            INSERT INTO products (
                uuid, category_id, name, sku, barcode,
                description, price, cost_price, stock_qty,
                low_stock_alert, unit, is_active, track_stock,
                is_synced, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                name            = VALUES(name),
                category_id     = VALUES(category_id),
                price           = VALUES(price),
                cost_price      = VALUES(cost_price),
                stock_qty       = IF(VALUES(updated_at) > updated_at,
                                    VALUES(stock_qty), stock_qty),
                low_stock_alert = VALUES(low_stock_alert),
                unit            = VALUES(unit),
                is_active       = VALUES(is_active),
                is_synced       = VALUES(is_synced),
                synced_at       = NOW(),
                updated_at      = IF(VALUES(updated_at) > updated_at,
                                    VALUES(updated_at), updated_at)
        ');

        $uuid          = $r['uuid'];
        $name          = $r['name'];
        $sku           = $r['sku'];
        $barcode       = $r['barcode'];
        $description   = $r['description'];
        $price         = (float)$r['price'];
        $costPrice     = (float)$r['cost_price'];
        $stockQty      = (float)$r['stock_qty'];
        $lowStockAlert = (int)$r['low_stock_alert'];
        $unit          = $r['unit'];
        $isActive      = (int)$r['is_active'];
        $trackStock    = (int)$r['track_stock'];
        $updatedAt     = $r['updated_at'];

        $stmt->bind_param(
            'sissssdddiissis',
            $uuid, $categoryId, $name,
            $sku, $barcode, $description,
            $price, $costPrice, $stockQty,
            $lowStockAlert, $unit,
            $isActive, $trackStock,
            $isSynced,
            $updatedAt
        );

        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected >= 0;
    }

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

        $uuid     = $r['uuid'];
        $name     = $r['name'];
        $color    = $r['color'];
        $icon     = $r['icon'];
        $isActive = (int)$r['is_active'];

        $stmt->bind_param('ssssi', $uuid, $name, $color, $icon, $isActive);

        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected >= 0;
    }

    private static function upsertCustomer(mysqli $conn, array $r): bool {
        $stmt = $conn->prepare('
            INSERT INTO customers (
                uuid, name, phone, email, address,
                loyalty_points, total_spent, is_synced
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
                name           = VALUES(name),
                phone          = VALUES(phone),
                email          = VALUES(email),
                address        = VALUES(address),
                loyalty_points = VALUES(loyalty_points),
                total_spent    = VALUES(total_spent),
                is_synced      = 1,
                synced_at      = NOW()
        ');

        $uuid          = $r['uuid'];
        $name          = $r['name'];
        $phone         = $r['phone'];
        $email         = $r['email'];
        $address       = $r['address'];
        $loyaltyPoints = (int)$r['loyalty_points'];
        $totalSpent    = (float)$r['total_spent'];

        $stmt->bind_param(
            'sssssid',
            $uuid, $name, $phone,
            $email, $address,
            $loyaltyPoints, $totalSpent
        );

        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected >= 0;
    }

    private static function upsertExpense(mysqli $conn, array $r): bool {
        $stmt = $conn->prepare('
            INSERT INTO expenses (
                uuid, category, description, amount,
                notes, expense_date, is_synced
            ) VALUES (?, ?, ?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
                category    = VALUES(category),
                description = VALUES(description),
                amount      = VALUES(amount),
                notes       = VALUES(notes),
                is_synced   = 1,
                synced_at   = NOW()
        ');

        $uuid        = $r['uuid'];
        $category    = $r['category'];
        $description = $r['description'];
        $amount      = (float)$r['amount'];
        $notes       = $r['notes'];
        $expenseDate = $r['expense_date'];

        $stmt->bind_param(
            'sssdss',
            $uuid, $category, $description,
            $amount, $notes, $expenseDate
        );

        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected >= 0;
    }

    private static function upsertStockMovement(mysqli $conn, array $r): bool {
        $stmt = $conn->prepare('
            INSERT INTO stock_movements (
                uuid, product_id, user_id, type,
                qty_before, qty_change, qty_after,
                reference, notes, is_synced, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            ON DUPLICATE KEY UPDATE
                is_synced = 1,
                synced_at = NOW()
        ');

        $uuid      = $r['uuid'] ?? null;
        $productId = (int)$r['product_id'];
        $userId    = (int)$r['user_id'];
        $type      = $r['type'];
        $qtyBefore = (float)$r['qty_before'];
        $qtyChange = (float)$r['qty_change'];
        $qtyAfter  = (float)$r['qty_after'];
        $reference = $r['reference'];
        $notes     = $r['notes'];
        $createdAt = $r['created_at'];

        $stmt->bind_param(
            'siisdddsss',
            $uuid, $productId, $userId, $type,
            $qtyBefore, $qtyChange, $qtyAfter,
            $reference, $notes, $createdAt
        );

        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected >= 0;
    }

    public static function getUpdatedSince(
        string $entityType,
        ?string $since,
        int $limit = 500,
        bool $unsyncedOnly = false
    ): array {
        $conn  = getDBConnection();
        $since = $since ?? '1970-01-01 00:00:00';

        $queries = [
            'orders' => "
                SELECT o.*,
                    u.uuid AS cashier_uuid,
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
                LEFT JOIN users u ON u.id = o.cashier_id
                WHERE (o.updated_at > ? OR o.created_at > ?)
                " . ($unsyncedOnly ? 'AND o.is_synced = 0' : '') . "
                GROUP BY o.id
                ORDER BY o.created_at DESC
                LIMIT {$limit}
            ",
            'products' => "
                SELECT p.*, c.uuid AS category_uuid
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE p.updated_at > ?
                " . ($unsyncedOnly ? 'AND p.is_synced = 0' : '') . "
                ORDER BY p.updated_at DESC
                LIMIT {$limit}
            ",
            'categories' => "
                SELECT * FROM categories
                WHERE (created_at > ? OR updated_at > ?)
                " . ($unsyncedOnly ? 'AND is_synced = 0' : '') . "
                ORDER BY created_at DESC
                LIMIT {$limit}
            ",
            'customers' => "
                SELECT * FROM customers
                WHERE updated_at > ?
                " . ($unsyncedOnly ? 'AND is_synced = 0' : '') . "
                ORDER BY updated_at DESC
                LIMIT {$limit}
            ",
            'expenses' => "
                SELECT * FROM expenses
                WHERE created_at > ?
                " . ($unsyncedOnly ? 'AND is_synced = 0' : '') . "
                ORDER BY created_at DESC
                LIMIT {$limit}
            ",
            'stock_movements' => "
                SELECT * FROM stock_movements
                WHERE created_at > ?
                " . ($unsyncedOnly ? 'AND is_synced = 0' : '') . "
                ORDER BY created_at DESC
                LIMIT {$limit}
            ",
            'users' => "
                SELECT id, uuid, name, email, role, pin,
                    is_active, created_at, updated_at
                FROM users
                WHERE updated_at > ?
                " . ($unsyncedOnly ? 'AND is_synced = 0' : '') . "
                ORDER BY updated_at DESC
                LIMIT {$limit}
            ",
        ];

        if (!isset($queries[$entityType])) return [];

        $sql  = $queries[$entityType];
        $stmt = $conn->prepare($sql);

        if ($entityType === 'orders' || $entityType === 'categories') {
            $stmt->bind_param('ss', $since, $since);
        } else {
            $stmt->bind_param('s', $since);
        }

        $stmt->execute();
        $results = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        if ($entityType === 'orders') {
            foreach ($results as &$order) {
                if (!empty($order['items_json'])) {
                    $order['items'] = json_decode('[' . $order['items_json'] . ']', true) ?? [];
                } else {
                    $order['items'] = [];
                }
                unset($order['items_json']);
            }
        }

        return $results;
    }


    public static function markSynced(string $entityType, array $uuids): int {
        $conn  = getDBConnection();
        $table = self::$syncTables[$entityType] ?? null;
        if (!$table) return 0;
        if (empty($uuids)) return 0;

        try {
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
        } catch (Exception $e) {
            error_log('[SyncHelper] markSynced failed for ' . $table . ': ' . $e->getMessage());
            return 0;
        }
    }


    private static function upsertUser(mysqli $conn, array $r): bool {
        $stmt = $conn->prepare('
            INSERT INTO users (uuid, name, email, role, pin, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                name       = VALUES(name),
                role       = VALUES(role),
                pin        = VALUES(pin),
                is_active  = VALUES(is_active),
                updated_at = NOW()
        ');

        $uuid     = $r['uuid'];
        $name     = $r['name'];
        $email    = $r['email'];
        $role     = $r['role'];
        $pin      = $r['pin'];
        $isActive = (int)$r['is_active'];

        $stmt->bind_param(
            'sssssi',
            $uuid, $name, $email,
            $role, $pin, $isActive
        );

        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected >= 0;
    }


    public static function getRecordsByUuids(string $entityType, array $uuids): array {
        $conn  = getDBConnection();
        $table = self::$syncTables[$entityType] ?? null;

        if (!$table || empty($uuids)) return [];

        $placeholders = implode(',', array_fill(0, count($uuids), '?'));
        $types        = str_repeat('s', count($uuids));

        $query = match($entityType) {
            'orders' => "
                SELECT o.*,
                    u.uuid AS cashier_uuid,
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
                LEFT JOIN users u ON u.id = o.cashier_id
                WHERE o.uuid IN ({$placeholders})
                GROUP BY o.id
            ",
            'products' => "
                SELECT p.*, c.uuid AS category_uuid
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE p.uuid IN ({$placeholders})
            ",
            default => "SELECT * FROM {$table} WHERE uuid IN ({$placeholders})"
        };

        $stmt = $conn->prepare($query);
        $stmt->bind_param($types, ...$uuids);
        $stmt->execute();
        $results = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        if ($entityType === 'orders') {
            foreach ($results as &$order) {
                if (!empty($order['items_json'])) {
                    $order['items'] = json_decode('[' . $order['items_json'] . ']', true) ?? [];
                } else {
                    $order['items'] = [];
                }
                unset($order['items_json']);
            }
        }

        return $results;
    }
}