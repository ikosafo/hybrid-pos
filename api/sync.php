<?php
// ═══════════════════════════════════════════
//  HybridPOS — Sync API
// ═══════════════════════════════════════════

// Helper to authenticate sync requests
// Accepts X-Sync-Key (cross-server) OR JWT token (internal local calls)
function syncAuth(): void {
    // X-Sync-Key via $_SERVER — works on all Apache/CGI setups
    $syncKey = $_SERVER['HTTP_X_SYNC_KEY'] ?? '';
    if ($syncKey === SYNC_API_KEY) return;

    // Fall back to JWT — used when local server calls its own sync routes
    AuthMiddleware::handle();
}

// POST /api/sync/push
addRoute('POST', '/api/sync/push', function () {
    syncAuth();
    $body = json_decode(file_get_contents('php://input'), true);

    if (empty($body['entity_type'])) {
        Response::error('entity_type is required', 422);
    }
    if (empty($body['records'])) {
        Response::success(['synced' => 0], 'No records to sync');
    }

    $entityType = $body['entity_type'];
    $records    = $body['records'];
    $synced     = 0;
    $errors     = [];

    foreach ($records as $record) {
        try {
            $result = SyncHelper::upsert($entityType, $record);
            if ($result) $synced++;
        } catch (Exception $e) {
            $errors[] = [
                'uuid'  => $record['uuid'] ?? 'unknown',
                'error' => $e->getMessage(),
            ];
        }
    }

    Response::success([
        'synced' => $synced,
        'errors' => $errors,
        'total'  => count($records),
    ], "Synced {$synced} of " . count($records) . " records");
});

// GET /api/sync/pull
addRoute('GET', '/api/sync/pull', function () {
    syncAuth();

    $entityType   = $_GET['entity_type'] ?? null;
    $since        = $_GET['since']       ?? null;
    $limit        = (int)($_GET['limit'] ?? 500);
    $unsyncedOnly = ($_GET['unsynced_only'] ?? 'false') === 'true';

    if (!$entityType) Response::error('entity_type is required', 422);

    $records = SyncHelper::getUpdatedSince($entityType, $since, $limit, $unsyncedOnly);

    Response::success([
        'entity_type' => $entityType,
        'records'     => $records,
        'count'       => count($records),
        'timestamp'   => date('Y-m-d H:i:s'),
    ]);
});

// GET /api/sync/status
addRoute('GET', '/api/sync/status', function () {
    syncAuth();

    $conn   = getDBConnection();
    $tables = [
        'orders'          => 'created_at',
        'products'        => 'updated_at',
        'categories'      => 'created_at',
        'customers'       => 'updated_at',
        'expenses'        => 'created_at',
        'stock_movements' => 'created_at',
    ];

    $status = [];
    foreach ($tables as $table => $dateCol) {
        $result = $conn->query("
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN is_synced = 0 THEN 1 ELSE 0 END) AS pending,
                MAX({$dateCol}) AS last_updated
            FROM {$table}
        ");
        $status[$table] = $result->fetch_assoc();
    }

    Response::success([
        'status'    => $status,
        'server'    => $_SERVER['HTTP_HOST'],
        'timestamp' => date('Y-m-d H:i:s'),
        'db_mode'   => getDBMode(),
    ]);
});

// POST /api/sync/acknowledge
addRoute('POST', '/api/sync/acknowledge', function () {
    syncAuth();
    $body = json_decode(file_get_contents('php://input'), true);

    if (empty($body['entity_type'])) Response::error('entity_type required', 422);
    if (empty($body['uuids']))       Response::error('uuids required', 422);

    $synced = SyncHelper::markSynced($body['entity_type'], $body['uuids']);
    Response::success(['marked' => $synced], 'Records acknowledged');
});

// POST /api/sync/delete
addRoute('POST', '/api/sync/delete', function () {
    syncAuth();
    $body = json_decode(file_get_contents('php://input'), true);

    if (empty($body['entity_type'])) Response::error('entity_type required', 422);
    if (empty($body['uuid']))        Response::error('uuid required', 422);

    $conn       = getDBConnection();
    $entityType = $body['entity_type'];
    $uuid       = $body['uuid'];

    $tables = [
        'categories' => 'categories',
        'products'   => 'products',
        'customers'  => 'customers',
        'expenses'   => 'expenses',
    ];

    if (!isset($tables[$entityType])) {
        Response::error('Invalid entity type', 422);
    }

    $table = $tables[$entityType];
    $stmt  = $conn->prepare("
        UPDATE {$table}
        SET is_active = 0, is_synced = 1, synced_at = NOW()
        WHERE uuid = ?
    ");
    $stmt->bind_param('s', $uuid);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();

    Response::success(['affected' => $affected], 'Deletion synced');
});

// POST /api/sync/receive
addRoute('POST', '/api/sync/receive', function () {
    $syncKey = $_SERVER['HTTP_X_SYNC_KEY'] ?? '';
    if ($syncKey !== SYNC_API_KEY) {
        Response::error('Unauthorized', 401);
        exit;
    }

    $body = json_decode(file_get_contents('php://input'), true);
    if (empty($body['entity_type']) || empty($body['uuids'])) {
        Response::error('entity_type and uuids required', 422);
    }

    $entityType = $body['entity_type'];
    $uuids      = $body['uuids'];
    $records    = SyncHelper::getRecordsByUuids($entityType, $uuids);

    if (empty($records)) {
        Response::success(['synced' => 0], 'No records found on live');
        return;
    }

    $synced = 0;
    foreach ($records as $record) {
        $result = SyncHelper::upsert($entityType, $record);
        if ($result) $synced++;
    }

    Response::success([
        'synced' => $synced,
        'total'  => count($records),
    ], "Received and synced {$synced} records");
});