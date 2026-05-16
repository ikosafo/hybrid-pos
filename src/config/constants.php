<?php
define('APP_NAME', 'HybridPOS');
define('APP_VERSION', '1.0.0');
define('APP_ENV', 'development'); // change to 'production' on live server

define('JWT_SECRET', 'your-super-secret-jwt-key-change-this-in-production');
define('JWT_EXPIRY', 86400); // 24 hours

// CORS origins allowed
define('ALLOWED_ORIGINS', [
    'http://hybridpos.local',
    'https://yourliveurl.com', // replace with your live domain
]);