<?php
require_once __DIR__ . '/constants.php';

// ── Detect Environment by URL ─────────────────
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';

if (str_contains($host, 'bestcobb.shop')) {
    define('DB_HOST', 'localhost');
    define('DB_USER', 'u349494272_bestcobbuser2');
    define('DB_PASS', 'Bestcobb@2026');
    define('DB_NAME', 'u349494272_bestcobbnew');
    define('DB_MODE', 'live');
    define('IS_LIVE_SERVER', true);

} elseif (str_contains($host, 'hybridpos.local')) {
    define('DB_HOST', 'localhost');
    define('DB_USER', 'root');
    define('DB_PASS', 'root');
    define('DB_NAME', 'pos_system');
    define('DB_MODE', 'local');
    define('IS_LIVE_SERVER', false);

} else {
    define('DB_HOST', 'localhost');
    define('DB_USER', 'root');
    define('DB_PASS', '');
    define('DB_NAME', 'pos_system');
    define('DB_MODE', 'unknown');
    define('IS_LIVE_SERVER', false);
}

function getDBConnection(): mysqli {
    static $conn = null;
    if ($conn !== null) return $conn;

    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

    if ($conn->connect_error) {
        http_response_code(500);
        die(json_encode([
            'success' => false,
            'error'   => 'Database connection failed: ' . $conn->connect_error,
            'mode'    => DB_MODE,
        ]));
    }

    $conn->set_charset('utf8mb4');
    return $conn;
}

function getDBMode(): string {
    return DB_MODE;
}