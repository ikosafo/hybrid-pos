<?php
class ExpenseModel {
    public static function all(array $filters = []): array {
        $conn  = getDBConnection();
        $where = ['1=1'];
        $types = '';
        $vals  = [];

        if (!empty($filters['category'])) {
            $where[] = 'e.category = ?';
            $types  .= 's';
            $vals[]  = $filters['category'];
        }

        if (!empty($filters['period'])) {
            $period = self::getPeriodDates($filters['period']);
            if ($period) {
                $where[] = 'e.expense_date BETWEEN ? AND ?';
                $types  .= 'ss';
                $vals[]  = $period['start'];
                $vals[]  = $period['end'];
            }
        }

        $limit  = $filters['limit']  ?? 100;
        $offset = $filters['offset'] ?? 0;

        $sql = "
            SELECT e.*, u.name AS recorded_by_name
            FROM expenses e
            LEFT JOIN users u ON u.id = e.recorded_by
            WHERE " . implode(' AND ', $where) . "
            ORDER BY e.expense_date DESC, e.created_at DESC
            LIMIT {$limit} OFFSET {$offset}
        ";

        $stmt = $conn->prepare($sql);
        if ($types) $stmt->bind_param($types, ...$vals);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        return $result;
    }

    public static function findById(int $id): ?array {
        $conn = getDBConnection();
        $stmt = $conn->prepare('
            SELECT e.*, u.name AS recorded_by_name
            FROM expenses e
            LEFT JOIN users u ON u.id = e.recorded_by
            WHERE e.id = ? LIMIT 1
        ');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $result ?: null;
    }

    public static function create(array $d): int {
        $conn = getDBConnection();
        $uuid = Uuid::generate();
        $stmt = $conn->prepare('
            INSERT INTO expenses (uuid, category, description, amount, notes, recorded_by, expense_date, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
        ');
        $stmt->bind_param('sssdsss',
            $uuid, $d['category'], $d['description'],
            $d['amount'], $d['notes'], $d['recorded_by'],
            $d['expense_date']
        );
        $stmt->execute();
        $id = $conn->insert_id;
        $stmt->close();
        return $id;
    }

    public static function update(int $id, array $d): void {
        $conn = getDBConnection();
        $stmt = $conn->prepare('
            UPDATE expenses SET
                category=?, description=?, amount=?, notes=?, expense_date=?, is_synced=0
            WHERE id=?
        ');
        $stmt->bind_param('ssdssi',
            $d['category'], $d['description'],
            $d['amount'], $d['notes'],
            $d['expense_date'], $id
        );
        $stmt->execute();
        $stmt->close();
    }

    public static function delete(int $id): void {
        $conn = getDBConnection();
        $stmt = $conn->prepare('DELETE FROM expenses WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
    }

    public static function getSummary(): array {
        $conn   = getDBConnection();
        $result = $conn->query("
            SELECT
                COUNT(*)                                           AS total_count,
                SUM(amount)                                        AS total_amount,
                SUM(CASE WHEN expense_date = CURDATE()
                    THEN amount ELSE 0 END)                        AS today_amount,
                SUM(CASE WHEN MONTH(expense_date) = MONTH(NOW())
                    AND YEAR(expense_date) = YEAR(NOW())
                    THEN amount ELSE 0 END)                        AS month_amount,
                SUM(CASE WHEN YEARWEEK(expense_date, 1) = YEARWEEK(NOW(), 1)
                    THEN amount ELSE 0 END)                        AS week_amount
            FROM expenses
        ");
        return $result->fetch_assoc();
    }

    public static function getCategories(): array {
        $conn   = getDBConnection();
        $result = $conn->query("
            SELECT category, COUNT(*) AS count, SUM(amount) AS total
            FROM expenses
            GROUP BY category
            ORDER BY total DESC
        ");
        return $result->fetch_all(MYSQLI_ASSOC);
    }

    private static function getPeriodDates(string $period): ?array {
        $now   = new DateTime();
        $today = $now->format('Y-m-d');

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
                $start = $now->format('Y-m-01');
                return ['start' => $start, 'end' => $today];
            case 'last_month':
                $start = (clone $now)->modify('first day of last month')->format('Y-m-d');
                $end   = (clone $now)->modify('last day of last month')->format('Y-m-d');
                return ['start' => $start, 'end' => $end];
            case 'this_year':
                return ['start' => $now->format('Y-01-01'), 'end' => $today];
            default:
                return null;
        }
    }
}