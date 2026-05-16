<?php
class ProductModel {
    private static string $baseQuery = '
        SELECT p.*, c.name AS category_name, c.color AS category_color
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
    ';

    public static function all(array $filters = []): array {
        $conn  = getDBConnection();
        $where = ['p.is_active = 1'];
        $types = '';
        $vals  = [];

        if (!empty($filters['category_id'])) {
            $where[] = 'p.category_id = ?';
            $types  .= 'i';
            $vals[]  = (int)$filters['category_id'];
        }

        if (!empty($filters['search'])) {
            $where[] = '(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
            $types  .= 'sss';
            $term    = '%' . $filters['search'] . '%';
            $vals[]  = $term;
            $vals[]  = $term;
            $vals[]  = $term;
        }

        $sql  = self::$baseQuery . ' WHERE ' . implode(' AND ', $where) . ' ORDER BY p.name';
        $stmt = $conn->prepare($sql);

        if ($types) $stmt->bind_param($types, ...$vals);

        $stmt->execute();
        $result = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        return $result;
    }

    public static function findById(int $id): ?array {
        $conn = getDBConnection();
        $stmt = $conn->prepare(self::$baseQuery . ' WHERE p.id = ? LIMIT 1');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $result ?: null;
    }

    public static function findByBarcode(string $barcode): ?array {
        $conn = getDBConnection();
        $stmt = $conn->prepare(self::$baseQuery . ' WHERE p.barcode = ? LIMIT 1');
        $stmt->bind_param('s', $barcode);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $result ?: null;
    }

    public static function create(array $d): int {
        $conn = getDBConnection();
        $uuid = Uuid::generate();
        $stmt = $conn->prepare('
            INSERT INTO products
                (uuid, category_id, name, sku, barcode, description, price, cost_price, stock_qty, low_stock_alert, unit, track_stock)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->bind_param(
            'sissssddisis',
            $uuid,
            $d['category_id'],
            $d['name'],
            $d['sku'],
            $d['barcode'],
            $d['description'],
            $d['price'],
            $d['cost_price'],
            $d['stock_qty'],
            $d['low_stock_alert'],
            $d['unit'],
            $d['track_stock']
        );
        $stmt->execute();
        $id = $conn->insert_id;
        $stmt->close();
        return $id;
    }

    public static function update(int $id, array $d): bool {
        $conn = getDBConnection();
        $stmt = $conn->prepare('
            UPDATE products SET
                category_id=?, name=?, sku=?, barcode=?, description=?,
                price=?, cost_price=?, stock_qty=?, low_stock_alert=?, unit=?, track_stock=?
            WHERE id=?
        ');
        $stmt->bind_param(
            'issssddisisi',
            $d['category_id'],
            $d['name'],
            $d['sku'],
            $d['barcode'],
            $d['description'],
            $d['price'],
            $d['cost_price'],
            $d['stock_qty'],
            $d['low_stock_alert'],
            $d['unit'],
            $d['track_stock'],
            $id
        );
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected >= 0;
    }

    public static function updateStock(int $id, float $qty): bool {
        $conn = getDBConnection();
        $stmt = $conn->prepare('UPDATE products SET stock_qty = ? WHERE id = ?');
        $stmt->bind_param('di', $qty, $id);
        $stmt->execute();
        $stmt->close();
        return true;
    }

    public static function delete(int $id): bool {
        $conn = getDBConnection();
        $stmt = $conn->prepare('UPDATE products SET is_active = 0 WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected > 0;
    }

    public static function lowStock(): array {
        $conn   = getDBConnection();
        $result = $conn->query('
            SELECT p.*, c.name AS category_name
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.is_active = 1 AND p.track_stock = 1 AND p.stock_qty <= p.low_stock_alert
            ORDER BY p.stock_qty ASC
        ');
        return $result->fetch_all(MYSQLI_ASSOC);
    }
}