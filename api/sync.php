<?php
// ═══════════════════════════════════════════
//  HybridPOS — Sync API
//  Handles bidirectional sync between
//  hybridpos.local and bestcobb.shop
// ═══════════════════════════════════════════

// POST /api/sync/push — Local pushes data to Live
addRoute('POST', '/api/sync/push', function () {
    $auth = AuthMiddleware::handle();
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

// GET /api/sync/pull — Local pulls data from Live
addRoute('GET', '/api/sync/pull', function () {
    AuthMiddleware::handle();

    $entityType = $_GET['entity_type'] ?? null;
    $since      = $_GET['since']       ?? null; // timestamp
    $limit      = (int)($_GET['limit'] ?? 500);
    $unsyncedOnly= ($_GET['unsynced_only'] ?? 'false') === 'true';

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
    AuthMiddleware::handle();

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

// POST /api/sync/acknowledge — Mark records as synced
addRoute('POST', '/api/sync/acknowledge', function () {
    AuthMiddleware::handle();
    $body = json_decode(file_get_contents('php://input'), true);

    if (empty($body['entity_type'])) Response::error('entity_type required', 422);
    if (empty($body['uuids']))       Response::error('uuids required', 422);

    $synced = SyncHelper::markSynced($body['entity_type'], $body['uuids']);
    Response::success(['marked' => $synced], 'Records acknowledged');
});


// POST /api/sync/delete — Sync a deletion
addRoute('POST', '/api/sync/delete', function () {
    AuthMiddleware::handle();
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



// POST /api/sync/receive — Local receives pushed data from Live
addRoute('POST', '/api/sync/receive', function () {
    // Verify sync secret key
    $headers = getallheaders();
    $syncKey = $headers['X-Sync-Key'] ?? '';
    
    if ($syncKey !== SYNC_API_KEY) {
        Response::error('Unauthorized', 401);
    }
    
    $body = json_decode(file_get_contents('php://input'), true);
    
    if (empty($body['entity_type']) || empty($body['uuids'])) {
        Response::error('entity_type and uuids required', 422);
    }
    
    $entityType = $body['entity_type'];
    $uuids      = $body['uuids'];
    
    // Pull specific records from live server and upsert locally
    $records = SyncHelper::getRecordsByUuids($entityType, $uuids);
    
    if (empty($records)) {
        Response::success(['synced' => 0], 'No records found on live');
        return;
    }
    
    // Insert/update locally
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