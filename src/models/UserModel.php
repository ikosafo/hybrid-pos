<?php
class UserModel {
    public static function findByEmail(string $email): ?array {
        $conn  = getDBConnection();
        $stmt  = $conn->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $result ?: null;
    }

    public static function findById(int $id): ?array {
        $conn  = getDBConnection();
        $stmt  = $conn->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $result ?: null;
    }

    public static function all(): array {
        $conn   = getDBConnection();
        $result = $conn->query('
            SELECT id, uuid, name, email, role, pin, is_active, created_at, updated_at
            FROM users ORDER BY name
        ');
        return $result->fetch_all(MYSQLI_ASSOC);
    }

    public static function create(array $data): int {
        $conn = getDBConnection();
        $uuid = Uuid::generate();
        $hash = password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt = $conn->prepare('
            INSERT INTO users (uuid, name, email, password_hash, role, pin, is_synced) VALUES (?, ?, ?, ?, ?, ?, 0)
        ');
        $stmt->bind_param('ssssss',
            $uuid, $data['name'], $data['email'],
            $hash, $data['role'], $data['pin']
        );
        $stmt->execute();
        $id = $conn->insert_id;
        $stmt->close();
        return $id;
    }

    public static function update(int $id, array $data): void {
        $conn = getDBConnection();
        $stmt = $conn->prepare('
            UPDATE users SET name=?, email=?, role=?, pin=?, is_active=?, is_synced=0
            WHERE id=?
        ');
        $stmt->bind_param('ssssii',
            $data['name'], $data['email'],
            $data['role'], $data['pin'],
            $data['is_active'], $id
        );
        $stmt->execute();
        $stmt->close();
    }

    public static function updatePassword(int $id, string $password): void {
        $conn = getDBConnection();
        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt = $conn->prepare('UPDATE users SET password_hash = ?, is_synced = 0 WHERE id = ?');
        $stmt->bind_param('si', $hash, $id);
        $stmt->execute();
        $stmt->close();
    }

    public static function setActive(int $id, int $status): void {
        $conn = getDBConnection();
        $stmt = $conn->prepare('UPDATE users SET is_active = ?, is_synced = 0 WHERE id = ?');
        $stmt->bind_param('ii', $status, $id);
        $stmt->execute();
        $stmt->close();
    }

    public static function delete(int $id): void {
        $conn = getDBConnection();
        $stmt = $conn->prepare('DELETE FROM users WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
    }
}