<?php
class Response {
    public static function json($data, int $statusCode = 200): void {
        http_response_code($statusCode);
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function success($data = null, string $message = 'Success', int $code = 200): void {
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
        self::json([
            'success'     => true,
            'data'        => $data,
            'pagination'  => [
                'total'        => $total,
                'per_page'     => $perPage,
                'current_page' => $page,
                'last_page'    => (int) ceil($total / $perPage),
            ],
        ]);
    }
}