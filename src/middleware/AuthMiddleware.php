<?php
require_once __DIR__ . '/../helpers/JWT.php';
require_once __DIR__ . '/../helpers/Response.php';

class AuthMiddleware {
    public static function handle(array $allowedRoles = []): array {
        $payload = JWT::fromRequest();

        if (!$payload) {
            Response::error('Unauthorized. Please log in.', 401);
        }

        if (!empty($allowedRoles) && !in_array($payload['role'], $allowedRoles)) {
            Response::error('Forbidden. You do not have permission.', 403);
        }

        return $payload;
    }
}