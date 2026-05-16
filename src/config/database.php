<?php
require_once __DIR__ . '/constants.php';

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', 'root'); // password
define('DB_NAME', 'pos_system');

function getDBConnection(): mysqli {
    static $conn = null;
    if ($conn === null) {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
        if ($conn->connect_error) {
            http_response_code(500);
            die(json_encode(['success' => false, 'error' => 'Database connection failed']));
        }
        $conn->set_charset('utf8mb4');
    }
    return $conn;
}