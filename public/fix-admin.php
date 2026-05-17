<?php
require_once __DIR__ . '/../src/config/database.php';

$password = 'Admin@1234';
$hash     = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

$conn  = getDBConnection();
$stmt  = $conn->prepare('UPDATE users SET password_hash = ? WHERE email = ?');
$email = 'admin@bestcobb.shop';
$stmt->bind_param('ss', $hash, $email);
$stmt->execute();

if ($stmt->affected_rows > 0) {
    echo json_encode([
        'success' => true,
        'message' => 'Password updated successfully. DELETE THIS FILE NOW!',
        'email'   => $email,
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'No user found with that email.',
        'email'   => $email,
    ]);
}

$stmt->close();