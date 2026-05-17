<?php
class CustomerModel {
    public static function all(string $search = ''): array {
        $conn = getDBConnection();
        if ($search) {
            $stmt = $conn->prepare('SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? ORDER BY name');
            $term = '%' . $search . '%';
            $stmt->bind_param('sss', $term, $term, $term);
            $stmt->execute();
            $result = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            $stmt->close();
            return $result;
        }
        return $conn->query('SELECT * FROM customers ORDER BY name')->fetch_all(MYSQLI_ASSOC);
    }

    public static function findById(int $id): ?array {
        $conn = getDBConnection();
        $stmt = $conn->prepare('SELECT * FROM customers WHERE id = ? LIMIT 1');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $result ?: null;
    }

    public static function create(array $d): int {
        $conn = getDBConnection();
        $uuid = Uuid::generate();
        $stmt = $conn->prepare('INSERT INTO customers (uuid, name, phone, email, address, is_synced) VALUES (?, ?, ?, ?, ?, 0)');
        $stmt->bind_param('sssss', $uuid, $d['name'], $d['phone'], $d['email'], $d['address']);
        $stmt->execute();
        $id = $conn->insert_id;
        $stmt->close();
        return $id;
    }

    public static function update(int $id, array $d): bool {
        $conn = getDBConnection();
        $stmt = $conn->prepare('UPDATE customers SET name=?, phone=?, email=?, address=?, is_synced=0 WHERE id=?');
        $stmt->bind_param('ssssi', $d['name'], $d['phone'], $d['email'], $d['address'], $id);
        $stmt->execute();
        $stmt->close();
        return true;
    }

    public static function updateSpend(int $id, float $amount): void {
        $conn = getDBConnection();
        $stmt = $conn->prepare('UPDATE customers SET total_spent = total_spent + ?, is_synced = 0 WHERE id = ?');
        $stmt->bind_param('di', $amount, $id);
        $stmt->execute();
        $stmt->close();
    }
}