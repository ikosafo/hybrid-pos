<?php
session_start();

// ── Handle AJAX actions (no HTML output) ─────
if (isset($_GET['action'])) {
    header('Content-Type: application/json');
    $body   = json_decode(file_get_contents('php://input'), true);
    $action = $_GET['action'];

    switch ($action) {
        case 'create_db':
            try {
                $conn = new mysqli(
                    $body['db_host'],
                    $body['db_user'],
                    $body['db_pass']
                );
                if ($conn->connect_error) {
                    echo json_encode(['success' => false, 'error' => $conn->connect_error]);
                    exit;
                }
                $conn->query("CREATE DATABASE IF NOT EXISTS `{$body['db_name']}`
                    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                $conn->select_db($body['db_name']);
                $conn->set_charset('utf8mb4');
                $schema = file_get_contents(__DIR__ . '/../database/schema.sql');
                $conn->multi_query($schema);
                do { $conn->store_result(); } while ($conn->next_result());
                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
            exit;

        case 'write_config':
            try {
                $liveHost = parse_url($body['live_url'], PHP_URL_HOST);
                $config   = "<?php\nrequire_once __DIR__ . '/constants.php';\n\n";
                $config  .= "\$host = \$_SERVER['HTTP_HOST'] ?? 'localhost';\n\n";
                $config  .= "if (str_contains(\$host, '{$liveHost}')) {\n";
                $config  .= "    define('DB_HOST', 'localhost');\n";
                $config  .= "    define('DB_USER', '{$body['db_user']}');\n";
                $config  .= "    define('DB_PASS', '{$body['db_pass']}');\n";
                $config  .= "    define('DB_NAME', '{$body['db_name']}');\n";
                $config  .= "    define('DB_MODE', 'live');\n";
                $config  .= "    define('IS_LIVE_SERVER', true);\n";
                $config  .= "} else {\n";
                $config  .= "    define('DB_HOST', '{$body['db_host']}');\n";
                $config  .= "    define('DB_USER', '{$body['db_user']}');\n";
                $config  .= "    define('DB_PASS', '{$body['db_pass']}');\n";
                $config  .= "    define('DB_NAME', '{$body['db_name']}');\n";
                $config  .= "    define('DB_MODE', 'local');\n";
                $config  .= "    define('IS_LIVE_SERVER', false);\n";
                $config  .= "}\n\n";
                $config  .= "function getDBConnection(): mysqli {\n";
                $config  .= "    static \$conn = null;\n";
                $config  .= "    if (\$conn !== null) return \$conn;\n";
                $config  .= "    \$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);\n";
                $config  .= "    if (\$conn->connect_error) {\n";
                $config  .= "        http_response_code(500);\n";
                $config  .= "        die(json_encode(['success' => false, 'error' => 'DB failed']));\n";
                $config  .= "    }\n";
                $config  .= "    \$conn->set_charset('utf8mb4');\n";
                $config  .= "    return \$conn;\n";
                $config  .= "}\n\n";
                $config  .= "function getDBMode(): string { return DB_MODE; }\n";
                file_put_contents(__DIR__ . '/../src/config/database.php', $config);
                $syncConfig = [
                    'live_url'      => $body['live_url'],
                    'live_email'    => $body['live_email'],
                    'live_password' => $body['live_password'],
                ];
                file_put_contents(
                    __DIR__ . '/../src/config/sync.json',
                    json_encode($syncConfig, JSON_PRETTY_PRINT)
                );
                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
            exit;

        case 'sync_users':
            try {
                $ch = curl_init("{$body['live_url']}/public/api/users");
                curl_setopt_array($ch, [
                    CURLOPT_HTTPHEADER     => [
                        'Authorization: Bearer ' . $body['live_token'],
                        'Content-Type: application/json',
                    ],
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_SSL_VERIFYPEER => false,
                ]);
                $response = json_decode(curl_exec($ch), true);
                curl_close($ch);
                if (!$response['success']) {
                    echo json_encode(['success' => false, 'error' => 'Could not fetch users']);
                    exit;
                }
                $conn  = new mysqli(
                    $body['db_host'], $body['db_user'],
                    $body['db_pass'], $body['db_name']
                );
                $count = 0;
                foreach ($response['data'] as $user) {
                    $conn->query("
                        INSERT INTO users (uuid, name, email, password_hash, role, pin, is_active)
                        VALUES (
                            '{$user['uuid']}',
                            '{$conn->real_escape_string($user['name'])}',
                            '{$conn->real_escape_string($user['email'])}',
                            'PLACEHOLDER',
                            '{$user['role']}',
                            " . ($user['pin'] ? "'{$user['pin']}'" : 'NULL') . ",
                            {$user['is_active']}
                        )
                        ON DUPLICATE KEY UPDATE
                            name      = VALUES(name),
                            role      = VALUES(role),
                            is_active = VALUES(is_active)
                    ");
                    $count++;
                }
                echo json_encode(['success' => true, 'count' => $count]);
            } catch (Exception $e) {
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
            exit;

        case 'sync_settings':
            try {
                $ch = curl_init("{$body['live_url']}/public/api/settings");
                curl_setopt_array($ch, [
                    CURLOPT_HTTPHEADER     => [
                        'Authorization: Bearer ' . $body['live_token'],
                    ],
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_SSL_VERIFYPEER => false,
                ]);
                $response = json_decode(curl_exec($ch), true);
                curl_close($ch);
                if (!$response['success']) {
                    echo json_encode(['success' => false]);
                    exit;
                }
                $s    = $response['data'];
                $conn = new mysqli(
                    $body['db_host'], $body['db_user'],
                    $body['db_pass'], $body['db_name']
                );
                $storeName      = $conn->real_escape_string($s['store_name'] ?? 'Best Cobb');
                $address        = $conn->real_escape_string($s['address'] ?? '');
                $phone          = $conn->real_escape_string($s['phone'] ?? '');
                $email          = $conn->real_escape_string($s['email'] ?? '');
                $currencyCode   = $conn->real_escape_string($s['currency_code'] ?? 'GHS');
                $currencySymbol = $conn->real_escape_string($s['currency_symbol'] ?? '₵');
                $taxRate        = (float)($s['tax_rate'] ?? 0);
                $receiptFooter  = $conn->real_escape_string($s['receipt_footer'] ?? '');
                $timezone       = $conn->real_escape_string($s['timezone'] ?? 'Africa/Accra');
                $conn->query("
                    INSERT INTO store_settings (
                        store_name, address, phone, email,
                        currency_code, currency_symbol, tax_rate,
                        receipt_footer, timezone
                    ) VALUES (
                        '{$storeName}', '{$address}', '{$phone}', '{$email}',
                        '{$currencyCode}', '{$currencySymbol}', {$taxRate},
                        '{$receiptFooter}', '{$timezone}'
                    )
                    ON DUPLICATE KEY UPDATE
                        store_name      = VALUES(store_name),
                        address         = VALUES(address),
                        phone           = VALUES(phone),
                        currency_code   = VALUES(currency_code),
                        currency_symbol = VALUES(currency_symbol),
                        tax_rate        = VALUES(tax_rate),
                        receipt_footer  = VALUES(receipt_footer),
                        timezone        = VALUES(timezone)
                ");
                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
            exit;

        case 'sync_entity':
            try {
                $entity = $body['entity'];
                $ch     = curl_init(
                    "{$body['live_url']}/public/api/sync/pull" .
                    "?entity_type={$entity}&since=1970-01-01%2000:00:00&limit=1000"
                );
                curl_setopt_array($ch, [
                    CURLOPT_HTTPHEADER     => [
                        'Authorization: Bearer ' . $body['live_token'],
                    ],
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_SSL_VERIFYPEER => false,
                ]);
                $response = json_decode(curl_exec($ch), true);
                curl_close($ch);
                if (!$response['success']) {
                    echo json_encode(['success' => false, 'error' => 'Pull failed', 'count' => 0]);
                    exit;
                }
                $records = $response['data']['records'] ?? [];
                $count   = count($records);
                if ($count > 0) {
                    // Get local token
                    $authCh = curl_init('http://hybridpos.local/public/api/auth/login');
                    curl_setopt_array($authCh, [
                        CURLOPT_POST           => true,
                        CURLOPT_POSTFIELDS     => json_encode([
                            'email'    => $body['live_email'],
                            'password' => $body['live_password'],
                        ]),
                        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
                        CURLOPT_RETURNTRANSFER => true,
                    ]);
                    $authRes   = json_decode(curl_exec($authCh), true);
                    $localToken = $authRes['data']['token'] ?? null;
                    curl_close($authCh);

                    if ($localToken) {
                        $localCh = curl_init('http://hybridpos.local/public/api/sync/push');
                        curl_setopt_array($localCh, [
                            CURLOPT_POST           => true,
                            CURLOPT_POSTFIELDS     => json_encode([
                                'entity_type' => $entity,
                                'records'     => $records,
                            ]),
                            CURLOPT_HTTPHEADER     => [
                                'Content-Type: application/json',
                                'Authorization: Bearer ' . $localToken,
                            ],
                            CURLOPT_RETURNTRANSFER => true,
                        ]);
                        curl_exec($localCh);
                        curl_close($localCh);
                    }
                }
                echo json_encode(['success' => true, 'count' => $count]);
            } catch (Exception $e) {
                echo json_encode(['success' => false, 'error' => $e->getMessage(), 'count' => 0]);
            }
            exit;

        case 'finalize':
            try {
                file_put_contents(__DIR__ . '/../.installed', date('Y-m-d H:i:s'));
                $syncJs  = "// Auto-generated by installer\n";
                $syncJs .= "const SYNC_CONFIG = " . json_encode([
                    'live_url'   => $body['live_url'],
                    'live_email' => $body['live_email'],
                ]) . ";\n";
                file_put_contents(__DIR__ . '/assets/js/sync-config.js', $syncJs);
                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
            exit;
    }
    exit;
}

// ── Block if already installed ────────────────
if (file_exists(__DIR__ . '/../.installed')) {
    header('Location: /public/');
    exit;
}

// ── Handle form submissions ───────────────────
$step  = $_POST['step'] ?? $_GET['step'] ?? 'welcome';
$error = '';

if ($step === 'database' && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['db_user'])) {
    $dbHost   = $_POST['db_host']      ?? 'localhost';
    $dbUser   = $_POST['db_user']      ?? 'root';
    $dbPass   = $_POST['db_pass']      ?? '';
    $dbName   = $_POST['db_name']      ?? 'pos_system';
    $liveUrl  = rtrim($_POST['live_url'] ?? 'https://bestcobb.shop', '/');
    $liveUser = $_POST['live_email']   ?? '';
    $livePass = $_POST['live_password']?? '';

    // Test local DB
    $conn = @new mysqli($dbHost, $dbUser, $dbPass);
    if ($conn->connect_error) {
        $error = 'Cannot connect to MySQL: ' . $conn->connect_error;
    } else {
        // Test live server
        $ch = curl_init("{$liveUrl}/public/api/auth/login");
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode([
                'email'    => $liveUser,
                'password' => $livePass,
            ]),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => false,
        ]);
        $response = curl_exec($ch);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            $error = 'Cannot reach live server: ' . $curlErr;
        } else {
            $data = json_decode($response, true);
            if (!$data || !$data['success']) {
                $error = 'Live server login failed: ' . ($data['message'] ?? 'Unknown error');
            } else {
                $_SESSION['install'] = [
                    'db_host'       => $dbHost,
                    'db_user'       => $dbUser,
                    'db_pass'       => $dbPass,
                    'db_name'       => $dbName,
                    'live_url'      => $liveUrl,
                    'live_email'    => $liveUser,
                    'live_password' => $livePass,
                    'live_token'    => $data['data']['token'],
                ];
                header('Location: /public/install.php?step=install');
                exit;
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HybridPOS — Installer</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        :root {
            --bg:      #0f172a;
            --card:    #1e293b;
            --border:  #334155;
            --accent:  #6366f1;
            --text:    #f1f5f9;
            --muted:   #94a3b8;
            --success: #10b981;
            --danger:  #ef4444;
            --warning: #f59e0b;
            --radius:  12px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        .installer { width: 100%; max-width: 560px; }
        .installer-header { text-align: center; margin-bottom: 32px; }
        .logo {
            width: 64px; height: 64px;
            background: linear-gradient(135deg, var(--accent), #3b82f6);
            border-radius: 16px;
            display: flex; align-items: center; justify-content: center;
            font-size: 28px; margin: 0 auto 16px;
            box-shadow: 0 8px 24px rgba(99,102,241,0.4);
        }
        h1 { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
        .subtitle { color: var(--muted); font-size: 14px; }
        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 32px; margin-bottom: 16px;
        }
        .steps { display: flex; gap: 8px; margin-bottom: 32px; }
        .step-dot {
            flex: 1; height: 4px; border-radius: 99px;
            background: var(--border);
        }
        .step-dot.active   { background: var(--accent); }
        .step-dot.complete { background: var(--success); }
        h2 { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
        .step-desc { color: var(--muted); font-size: 13px; margin-bottom: 24px; }
        .form-group { margin-bottom: 16px; }
        label {
            display: block; font-size: 13px; font-weight: 500;
            color: var(--muted); margin-bottom: 6px;
        }
        input, select {
            width: 100%; padding: 10px 14px;
            background: var(--bg); border: 1px solid var(--border);
            border-radius: 8px; color: var(--text);
            font-size: 14px; font-family: inherit; outline: none;
        }
        input:focus, select:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
        }
        .btn {
            display: inline-flex; align-items: center;
            justify-content: center; gap: 8px;
            width: 100%; padding: 12px 24px;
            border-radius: 8px; font-size: 15px;
            font-weight: 600; cursor: pointer;
            border: none; font-family: inherit; transition: all 0.2s;
        }
        .btn-primary {
            background: linear-gradient(135deg, var(--accent), #4f46e5);
            color: white;
        }
        .btn-primary:hover { transform: translateY(-1px); }
        .btn-success {
            background: linear-gradient(135deg, var(--success), #059669);
            color: white;
        }
        .alert {
            padding: 12px 16px; border-radius: 8px;
            font-size: 13px; margin-bottom: 16px;
            display: flex; align-items: center; gap: 8px;
        }
        .alert-error   { background: rgba(239,68,68,0.12);  color: var(--danger);  border: 1px solid rgba(239,68,68,0.2); }
        .alert-success { background: rgba(16,185,129,0.12); color: var(--success); border: 1px solid rgba(16,185,129,0.2); }
        .alert-info    { background: rgba(99,102,241,0.12); color: var(--accent);  border: 1px solid rgba(99,102,241,0.2); }
        .check-list { list-style: none; margin-bottom: 20px; }
        .check-list li {
            display: flex; align-items: center; gap: 10px;
            padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 14px;
        }
        .check-list li:last-child { border: none; }
        .ok   { color: var(--success); }
        .fail { color: var(--danger); }
        .section-label {
            font-size: 13px; font-weight: 600; color: var(--accent);
            margin-bottom: 12px; text-transform: uppercase;
            letter-spacing: 0.06em;
        }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .divider { border-top: 1px solid var(--border); margin: 20px 0 16px; }
        .progress-bar {
            background: var(--border); border-radius: 99px;
            height: 8px; overflow: hidden; margin: 16px 0;
        }
        .progress-fill {
            height: 100%; border-radius: 99px;
            background: linear-gradient(90deg, var(--accent), var(--success));
            transition: width 0.5s ease;
        }
        .log {
            background: var(--bg); border: 1px solid var(--border);
            border-radius: 8px; padding: 16px;
            font-family: monospace; font-size: 12px;
            color: var(--muted); max-height: 200px;
            overflow-y: auto; margin-bottom: 16px;
        }
        .log-line { margin-bottom: 4px; }
        .log-line.ok   { color: var(--success); }
        .log-line.fail { color: var(--danger); }
        .log-line.info { color: var(--accent); }
    </style>
</head>
<body>
<div class="installer">
    <div class="installer-header">
        <div class="logo">
            <!-- <i class="fas fa-bolt"></i> -->
            <img src="/public/assets/images/logo.png" alt="Best Cobb Logo" style="width:48px;height:48px;margin-bottom:8px;">
        </div>
        <h1>Best Cobb</h1>
        <p class="subtitle">Installation Wizard</p>
    </div>

    <?php if ($step === 'welcome'): ?>
    <div class="steps">
        <div class="step-dot active"></div>
        <div class="step-dot"></div>
        <div class="step-dot"></div>
        <div class="step-dot"></div>
    </div>
    <div class="card">
        <h2><i class="fas fa-rocket" style="color:var(--accent);margin-right:8px;"></i>Welcome</h2>
        <p class="step-desc">
            This wizard will set up HybridPOS on this computer.
            It will create a local database and sync all data
            from the live server automatically.
        </p>
        <div class="alert alert-info">
            <i class="fas fa-info-circle"></i>
            Make sure WAMP is running and MySQL is active before continuing.
        </div>
        <form method="POST">
            <input type="hidden" name="step" value="requirements">
            <button type="submit" class="btn btn-primary">
                <i class="fas fa-arrow-right"></i> Start Installation
            </button>
        </form>
    </div>

    <?php elseif ($step === 'requirements'): ?>
    <?php
        $checks = [];
        $phpOk  = version_compare(PHP_VERSION, '8.0.0', '>=');
        $checks[] = ['label' => 'PHP ' . PHP_VERSION, 'ok' => $phpOk, 'note' => $phpOk ? 'PHP 8.0+ ✓' : 'PHP 8.0+ required'];
        $mysqliOk = extension_loaded('mysqli');
        $checks[] = ['label' => 'MySQLi Extension', 'ok' => $mysqliOk, 'note' => $mysqliOk ? 'Available ✓' : 'Not installed'];
        $curlOk   = extension_loaded('curl');
        $checks[] = ['label' => 'cURL Extension', 'ok' => $curlOk, 'note' => $curlOk ? 'Available ✓' : 'Required for sync'];
        $jsonOk   = extension_loaded('json');
        $checks[] = ['label' => 'JSON Extension', 'ok' => $jsonOk, 'note' => $jsonOk ? 'Available ✓' : 'Not installed'];
        $writable = is_writable(__DIR__ . '/../src/config/');
        $checks[] = ['label' => 'Config Writable', 'ok' => $writable, 'note' => $writable ? 'Writable ✓' : 'Check permissions'];
        $allOk    = array_reduce($checks, fn($c, $i) => $c && $i['ok'], true);
    ?>
    <div class="steps">
        <div class="step-dot complete"></div>
        <div class="step-dot active"></div>
        <div class="step-dot"></div>
        <div class="step-dot"></div>
    </div>
    <div class="card">
        <h2><i class="fas fa-clipboard-check" style="color:var(--accent);margin-right:8px;"></i>Requirements</h2>
        <p class="step-desc">Checking your system...</p>
        <ul class="check-list">
            <?php foreach ($checks as $c): ?>
            <li>
                <span class="<?= $c['ok'] ? 'ok' : 'fail' ?>">
                    <i class="fas fa-<?= $c['ok'] ? 'check-circle' : 'times-circle' ?>"></i>
                </span>
                <span style="flex:1;"><?= $c['label'] ?></span>
                <span style="font-size:12px;color:var(--muted);"><?= $c['note'] ?></span>
            </li>
            <?php endforeach; ?>
        </ul>
        <?php if ($allOk): ?>
        <div class="alert alert-success">
            <i class="fas fa-check-circle"></i> All requirements met!
        </div>
        <form method="POST">
            <input type="hidden" name="step" value="database">
            <button type="submit" class="btn btn-primary">
                <i class="fas fa-arrow-right"></i> Configure Database
            </button>
        </form>
        <?php else: ?>
        <div class="alert alert-error">
            <i class="fas fa-times-circle"></i> Fix the issues above and refresh.
        </div>
        <?php endif; ?>
    </div>

    <?php elseif ($step === 'database'): ?>
    <div class="steps">
        <div class="step-dot complete"></div>
        <div class="step-dot complete"></div>
        <div class="step-dot active"></div>
        <div class="step-dot"></div>
    </div>
    <div class="card">
        <h2><i class="fas fa-database" style="color:var(--accent);margin-right:8px;"></i>Configuration</h2>
        <p class="step-desc">Enter your local MySQL and live server details.</p>
        <?php if ($error): ?>
        <div class="alert alert-error">
            <i class="fas fa-times-circle"></i> <?= htmlspecialchars($error) ?>
        </div>
        <?php endif; ?>
        <form method="POST">
            <input type="hidden" name="step" value="database">
            <p class="section-label">Local Database</p>
            <div class="grid-2">
                <div class="form-group">
                    <label>MySQL Host</label>
                    <input type="text" name="db_host" value="<?= $_POST['db_host'] ?? 'localhost' ?>">
                </div>
                <div class="form-group">
                    <label>Database Name</label>
                    <input type="text" name="db_name" value="<?= $_POST['db_name'] ?? 'pos_system' ?>">
                </div>
            </div>
            <div class="grid-2">
                <div class="form-group">
                    <label>MySQL Username</label>
                    <input type="text" name="db_user" value="<?= $_POST['db_user'] ?? 'root' ?>">
                </div>
                <div class="form-group">
                    <label>MySQL Password</label>
                    <input type="password" name="db_pass" placeholder="Leave blank if none">
                </div>
            </div>
            <div class="divider"></div>
            <p class="section-label">Live Server</p>
            <div class="form-group">
                <label>Live Server URL</label>
                <input type="text" name="live_url" value="<?= $_POST['live_url'] ?? 'https://bestcobb.shop' ?>">
            </div>
            <div class="grid-2">
                <div class="form-group">
                    <label>Admin Email</label>
                    <input type="email" name="live_email" value="<?= $_POST['live_email'] ?? 'admin@bestcobb.shop' ?>">
                </div>
                <div class="form-group">
                    <label>Admin Password</label>
                    <input type="password" name="live_password">
                </div>
            </div>
            <button type="submit" class="btn btn-primary">
                <i class="fas fa-plug"></i> Test & Continue
            </button>
        </form>
    </div>

    <?php elseif ($step === 'install'): ?>
    <?php
        $install = $_SESSION['install'] ?? null;
        if (!$install) {
            header('Location: /public/install.php');
            exit;
        }
    ?>
    <div class="steps">
        <div class="step-dot complete"></div>
        <div class="step-dot complete"></div>
        <div class="step-dot complete"></div>
        <div class="step-dot active"></div>
    </div>
    <div class="card">
        <h2>
            <i class="fas fa-cog fa-spin" style="color:var(--accent);margin-right:8px;"></i>
            Installing...
        </h2>
        <p class="step-desc">Setting up your local database and syncing data from live server.</p>
        <div class="progress-bar">
            <div class="progress-fill" id="progress" style="width:0%"></div>
        </div>
        <div class="log" id="log"></div>
        <div id="install-actions" style="display:none;">
            <a href="/public/" class="btn btn-success">
                <i class="fas fa-check"></i> Open HybridPOS
            </a>
        </div>
    </div>

    <script>
    const config  = <?= json_encode($install) ?>;
    const log     = document.getElementById('log');
    const progress= document.getElementById('progress');
    const actions = document.getElementById('install-actions');

    function addLog(msg, type = 'info') {
        const line       = document.createElement('div');
        line.className   = `log-line ${type}`;
        line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
    }

    function setProgress(pct) {
        progress.style.width = pct + '%';
    }

    async function post(action, extra = {}) {
        const res = await fetch(`/public/install.php?action=${action}`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ ...config, ...extra }),
        });
        return res.json();
    }

    async function install() {
        addLog('Starting installation...', 'info');
        setProgress(5);

        // Step 1
        addLog('Creating local database and tables...', 'info');
        const db = await post('create_db');
        if (!db.success) { addLog('❌ ' + db.error, 'fail'); return; }
        addLog('✅ Database created', 'ok');
        setProgress(20);

        // Step 2
        addLog('Writing configuration files...', 'info');
        const cfg = await post('write_config');
        if (!cfg.success) { addLog('❌ ' + cfg.error, 'fail'); return; }
        addLog('✅ Configuration saved', 'ok');
        setProgress(35);

        // Step 3
        addLog('Syncing users from live server...', 'info');
        const users = await post('sync_users');
        addLog(users.success ? `✅ ${users.count} users synced` : '⚠️ User sync issue', users.success ? 'ok' : 'fail');
        setProgress(45);

        // Step 4
        addLog('Syncing store settings...', 'info');
        await post('sync_settings');
        addLog('✅ Store settings synced', 'ok');
        setProgress(55);

        // Step 5 — Entities
        const entities = ['categories', 'products', 'customers', 'orders', 'expenses'];
        let prog = 55;
        const step = (90 - 55) / entities.length;

        for (const entity of entities) {
            addLog(`Syncing ${entity}...`, 'info');
            const r = await post('sync_entity', { entity });
            addLog(
                r.success ? `✅ ${r.count} ${entity} synced` : `⚠️ ${entity}: ${r.error || 'issue'}`,
                r.success ? 'ok' : 'fail'
            );
            prog += step;
            setProgress(Math.round(prog));
        }

        // Step 6
        addLog('Finalizing...', 'info');
        await post('finalize');
        setProgress(100);

        addLog('🎉 Installation complete!', 'ok');
        addLog('Login with your live server credentials.', 'ok');
        actions.style.display = 'block';
    }

    install();
    </script>

    <?php endif; ?>
</div>
</body>
</html>