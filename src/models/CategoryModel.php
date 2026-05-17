<?php
class CategoryModel {
    public static function all(): array {
        $conn = getDBConnection();
        $result = $conn->query('SELECT * FROM categories WHERE is_active = 1 ORDER BY name');
        return $result->fetch_all(MYSQLI_ASSOC);
    }

    public static function findById(int $id): ?array {
        $conn = getDBConnection();
        $stmt = $conn->prepare('SELECT * FROM categories WHERE id = ? LIMIT 1');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $result ?: null;
    }

    public static function create(array $data): int {
        $conn = getDBConnection();
        $uuid = Uuid::generate();
        $stmt = $conn->prepare('INSERT INTO categories (uuid, name, color, icon, is_synced) VALUES (?, ?, ?, ?, 0)');
        $stmt->bind_param('ssss', $uuid, $data['name'], $data['color'], $data['icon']);
        $stmt->execute();
        $id = $conn->insert_id;
        $stmt->close();
        return $id;
    }

    public static function update(int $id, array $data): bool {
        $conn = getDBConnection();
        $stmt = $conn->prepare('UPDATE categories SET name=?, color=?, icon=?, is_synced=0 WHERE id=?');
        $stmt->bind_param('sssi', $data['name'], $data['color'], $data['icon'], $id);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected >= 0;
    }

    public static function delete(int $id): bool {
        $conn = getDBConnection();
        $stmt = $conn->prepare('UPDATE categories SET is_active = 0, is_synced = 0 WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected > 0;
    }
}