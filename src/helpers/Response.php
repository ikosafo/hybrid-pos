<?php
class Response {

    // Normalize array keys to lowercase recursively
    public static function normalizeKeys(array $data): array {
        $result = [];
        foreach ($data as $key => $value) {
            $lowerKey = strtolower($key);
            if (is_array($value)) {
                $result[$lowerKey] = self::normalizeKeys($value);
            } else {
                $result[$lowerKey] = $value;
            }
        }
        return $result;
    }

    public static function json($data, int $statusCode = 200): void {
        http_response_code($statusCode);
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function success($data = null, string $message = 'Success', int $code = 200): void {
        // Normalize keys to lowercase
        if (is_array($data)) {
            $data = self::normalizeKeys($data);
        }

        self::json([
            'success' => true,
            'message' => $message,
            'data'    => $data,
        ], $code);
    }

    public static function error(string $message = 'Error', int $code = 400, $errors = null): void {
        self::json([
            'success' => false,
            'message' => $message,
            'errors'  => $errors,
        ], $code);
    }

    public static function paginated(array $data, int $total, int $page, int $perPage): void {
        $data = self::normalizeKeys($data);
        self::json([
            'success'    => true,
            'data'       => $data,
            'pagination' => [
                'total'        => $total,
                'per_page'     => $perPage,
                'current_page' => $page,
                'last_page'    => (int) ceil($total / $perPage),
            ],
        ]);
    }
}