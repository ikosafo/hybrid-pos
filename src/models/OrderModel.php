<?php
class OrderModel {
    public static function generateOrderNumber(): string {
        return 'ORD-' . strtoupper(substr(uniqid(), -6)) . '-' . date('Ymd');
    }

    public static function create(array $data, array $items): array {
        $conn        = getDBConnection();
        $uuid        = Uuid::generate();
        $orderNumber = self::generateOrderNumber();

        $conn->begin_transaction();

        try {
            // Insert order
            $stmt = $conn->prepare('
                INSERT INTO orders
                    (uuid, order_number, customer_id, cashier_id, subtotal, discount_amount,
                    discount_type, tax_amount, total_amount, amount_tendered, change_due,
                    payment_method, notes, status, is_synced)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "completed", 0)
            ');
            $stmt->bind_param(
                'ssiiddsddddss',
                $uuid, $orderNumber,
                $data['customer_id'], $data['cashier_id'],
                $data['subtotal'], $data['discount_amount'], $data['discount_type'],
                $data['tax_amount'], $data['total_amount'],
                $data['amount_tendered'], $data['change_due'],
                $data['payment_method'], $data['notes']
            );
            $stmt->execute();
            $orderId = $conn->insert_id;
            $stmt->close();

            // Insert items + update stock
            foreach ($items as $item) {
                $istmt = $conn->prepare('
                    INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, total)
                    VALUES (?, ?, ?, ?, ?, ?)
                ');
                $istmt->bind_param('iisddd',
                    $orderId, $item['product_id'], $item['product_name'],
                    $item['unit_price'], $item['quantity'], $item['total']
                );
                $istmt->execute();
                $istmt->close();

                // Deduct stock
                $sstmt = $conn->prepare('
                    UPDATE products SET stock_qty = stock_qty - ? WHERE id = ? AND track_stock = 1
                ');
                $sstmt->bind_param('di', $item['quantity'], $item['product_id']);
                $sstmt->execute();
                $sstmt->close();

                // Log stock movement
                $product = $conn->query("SELECT stock_qty FROM products WHERE id = {$item['product_id']}")->fetch_assoc();
                $before  = $product['stock_qty'] + $item['quantity'];
                $after   = $product['stock_qty'];
                $change  = -$item['quantity'];
                $stockUuid = Uuid::generate();
                $mstmt = $conn->prepare('
                    INSERT INTO stock_movements (uuid, product_id, user_id, type, qty_before, qty_change, qty_after, reference)
                    VALUES (?, ?, ?, "sale", ?, ?, ?, ?)
                ');
                $mstmt->bind_param('siiddds',
                    $stockUuid,
                    $item['product_id'], $data['cashier_id'],
                    $before, $change, $after, $orderNumber
                );
                $mstmt->execute();
                $mstmt->close();
            }

            // Update customer total spend
            if ($data['customer_id']) {
                $cstmt = $conn->prepare('UPDATE customers SET total_spent = total_spent + ? WHERE id = ?');
                $cstmt->bind_param('di', $data['total_amount'], $data['customer_id']);
                $cstmt->execute();
                $cstmt->close();
            }

            $conn->commit();
            return self::findById($orderId);

        } catch (Exception $e) {
            $conn->rollback();
            throw $e;
        }
    }

    public static function findById(int $id): ?array {
        $conn  = getDBConnection();
        $stmt  = $conn->prepare('
            SELECT o.*,
                   u.name AS cashier_name,
                   c.name AS customer_name
            FROM orders o
            LEFT JOIN users     u ON u.id = o.cashier_id
            LEFT JOIN customers c ON c.id = o.customer_id
            WHERE o.id = ? LIMIT 1
        ');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $order = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$order) return null;

        // Fetch items
        $istmt = $conn->prepare('SELECT * FROM order_items WHERE order_id = ?');
        $istmt->bind_param('i', $id);
        $istmt->execute();
        $order['items'] = $istmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $istmt->close();

        return $order;
    }

    public static function all(int $limit = 50, int $offset = 0): array {
        $conn   = getDBConnection();
        $stmt   = $conn->prepare('
            SELECT o.*,
                   u.name AS cashier_name,
                   c.name AS customer_name,
                   COUNT(oi.id) AS item_count
            FROM orders o
            LEFT JOIN users      u  ON u.id  = o.cashier_id
            LEFT JOIN customers  c  ON c.id  = o.customer_id
            LEFT JOIN order_items oi ON oi.order_id = o.id
            GROUP BY o.id
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->bind_param('ii', $limit, $offset);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        return $result;
    }

    public static function void(int $id): void {
        $conn = getDBConnection();
        $stmt = $conn->prepare('UPDATE orders SET status = "voided" WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
    }
}