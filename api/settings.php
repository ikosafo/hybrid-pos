<?php
require_once __DIR__ . '/../src/models/SettingsModel.php';

// GET settings
addRoute('GET', '/api/settings', function () {
    AuthMiddleware::handle();
    Response::success(SettingsModel::get());
});

// PUT update settings
addRoute('PUT', '/api/settings', function () {
    AuthMiddleware::handle(['superadmin', 'admin']);
    $body = json_decode(file_get_contents('php://input'), true);
    SettingsModel::update($body);
    Response::success(SettingsModel::get(), 'Settings updated successfully');
});