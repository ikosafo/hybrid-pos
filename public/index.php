<?php
// ── Parse URI ─────────────────────────────────
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = preg_replace('#^/public#', '', $uri);

// ── Serve manifest directly ───────────────────
if ($uri === '/manifest.json') {
    header('Content-Type: application/manifest+json');
    header('Cache-Control: public, max-age=604800');
    readfile(__DIR__ . '/manifest.json');
    exit;
}

// ── Serve service worker directly ─────────────
if ($uri === '/service-worker.js') {
    header('Content-Type: text/javascript');
    header('Service-Worker-Allowed: /');
    readfile(__DIR__ . '/service-worker.js');
    exit;
}

// ── API Router ────────────────────────────────
if (str_starts_with($uri, '/api/')) {

    require_once __DIR__ . '/../src/config/database.php';
    require_once __DIR__ . '/../src/config/constants.php';
    require_once __DIR__ . '/../src/helpers/Response.php';
    require_once __DIR__ . '/../src/helpers/JWT.php';
    require_once __DIR__ . '/../src/helpers/Uuid.php';
    require_once __DIR__ . '/../src/middleware/AuthMiddleware.php';
    require_once __DIR__ . '/../src/helpers/SyncHelper.php';

    // ── CORS ──────────────────────────────────
    $allowedOrigins = [
        'http://hybridpos.local',
        'https://bestcobb.shop',
        'http://bestcobb.shop',
    ];

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (in_array($origin, $allowedOrigins)) {
        header("Access-Control-Allow-Origin: {$origin}");
    } else {
        header('Access-Control-Allow-Origin: https://bestcobb.shop');
    }

    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Allow-Credentials: true');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    header('Content-Type: application/json; charset=UTF-8');
    header('X-DB-Mode: ' . getDBMode());

    $requestMethod = $_SERVER['REQUEST_METHOD'];
    $routes = ['GET' => [], 'POST' => [], 'PUT' => [], 'DELETE' => []];

    function addRoute(string $method, string $pattern, callable $handler): void {
        global $routes;
        $routes[$method][$pattern] = $handler;
    }

    function matchRoute(string $method, string $uri): ?array {
        global $routes;
        foreach ($routes[$method] ?? [] as $pattern => $handler) {
            $regex = preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $pattern);
            if (preg_match("#^$regex$#", $uri, $matches)) {
                return [
                    'handler' => $handler,
                    'params'  => array_filter(
                        $matches, 'is_string', ARRAY_FILTER_USE_KEY
                    )
                ];
            }
        }
        return null;
    }

    // ── System status route ───────────────────
    addRoute('GET', '/api/system/status', function () {
        Response::success([
            'db_mode'   => getDBMode(),
            'is_live'   => IS_LIVE_SERVER,
            'server'    => $_SERVER['HTTP_HOST'],
            'timestamp' => date('Y-m-d H:i:s'),
            'version'   => APP_VERSION,
        ]);
    });

    // ── Load route files ──────────────────────
    require_once __DIR__ . '/../api/auth.php';
    require_once __DIR__ . '/../api/categories.php';
    require_once __DIR__ . '/../api/products.php';
    require_once __DIR__ . '/../api/customers.php';
    require_once __DIR__ . '/../api/orders.php';
    require_once __DIR__ . '/../api/settings.php';
    require_once __DIR__ . '/../api/users.php';
    require_once __DIR__ . '/../api/stock.php';
    require_once __DIR__ . '/../api/expenses.php';
    require_once __DIR__ . '/../api/reports.php';
    require_once __DIR__ . '/../api/sync.php';

    // ── Dispatch ──────────────────────────────
    $match = matchRoute($requestMethod, $uri);
    if ($match) {
        call_user_func($match['handler'], $match['params']);
    } else {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Route not found'
        ]);
    }
    exit;
}

// ── Serve SPA ─────────────────────────────────
require_once __DIR__ . '/app.php';