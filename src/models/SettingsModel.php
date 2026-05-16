<?php
class SettingsModel {
    public static function get(): ?array {
        $conn   = getDBConnection();
        $result = $conn->query('SELECT * FROM store_settings LIMIT 1');
        return $result->fetch_assoc();
    }

    public static function update(array $data): void {
        $conn = getDBConnection();
        $stmt = $conn->prepare('
            UPDATE store_settings SET
                store_name     = ?,
                address        = ?,
                phone          = ?,
                email          = ?,
                currency_code  = ?,
                currency_symbol= ?,
                tax_rate       = ?,
                receipt_footer = ?,
                timezone       = ?
            WHERE id = 1
        ');
        $stmt->bind_param('ssssssdss',
            $data['store_name'],
            $data['address'],
            $data['phone'],
            $data['email'],
            $data['currency_code'],
            $data['currency_symbol'],
            $data['tax_rate'],
            $data['receipt_footer'],
            $data['timezone']
        );
        $stmt->execute();
        $stmt->close();
    }
}