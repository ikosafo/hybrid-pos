<?php
define('APP_NAME', 'BestCobb');
define('APP_VERSION', '1.0.0');
define('APP_ENV', 'development'); // change to 'production' on live server

define('JWT_SECRET', 'your-super-secret-jwt-key-change-this-in-production');
define('JWT_EXPIRY', 86400); // 24 hours

// ── NEW: Server detection ──────────────────
define('IS_LIVE_SERVER', $_SERVER['HTTP_HOST'] === 'bestcobb.shop');
define('IS_LOCAL_SERVER', $_SERVER['HTTP_HOST'] === 'hybridpos.local');
define('LOCAL_SERVER_URL', 'http://hybridpos.local/public/api');
define('LIVE_SERVER_URL', 'https://bestcobb.shop/public/api');

// Sync security key — must match on both local and live
define('SYNC_API_KEY', 'hybridpos-sync-key-bestcobb-2026');

// CORS origins allowed
define('ALLOWED_ORIGINS', [
    'http://hybridpos.local',
    'https://bestcobb.shop',
]);