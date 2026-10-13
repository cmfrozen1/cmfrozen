<?php
/**
 * Configuration & Database Connection
 * Host: localhost:3306
 * Database: fukupet_dbwebsite
 * User: fukupet_yok
 * Pass: Lqqp4%*t34xxzSHi
 */

define('DB_HOST', 'localhost');
define('DB_PORT', 3306);
define('DB_NAME', 'fukupet_dbwebsite');
define('DB_USER', 'fukupet_yok');
define('DB_PASS', 'Lqqp4%*t34xxzSHi');

// Admin default credentials (can also be saved in DB)
define('ADMIN_USER', 'admin');
define('ADMIN_PASS', 'fukupet2026');

// Image upload directory
define('UPLOAD_DIR', __DIR__ . '/images/');
define('UPLOAD_URL', 'images/');

// JSON Fallback / Data Storage file
define('DATA_FILE', __DIR__ . '/default_data.json');

// Google Drive Config
define('GOOGLE_CREDENTIALS_FILE', __DIR__ . '/service-account.json');
define('DRIVE_FOLDER_IMAGES', '1YpesKmkMa8exNwbbI5AObGffFGh-UaGj');
define('DRIVE_FOLDER_SLIPS', '15NGOv4eHhpYIJSqpFlmSOESUuDTrPHT1');

/**
 * Get PDO Database Connection
 */
function getDbConnection() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    try {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            DB_HOST,
            DB_PORT,
            DB_NAME
        );
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
    } catch (PDOException $e) {
        // Return null if MySQL connection failed, allowing fallback
        return null;
    }
}

/**
 * Check Database Status
 */
function checkDbStatus() {
    try {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            DB_HOST,
            DB_PORT,
            DB_NAME
        );
        $conn = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        return ['connected' => true, 'database' => DB_NAME, 'host' => DB_HOST];
    } catch (PDOException $e) {
        return ['connected' => false, 'error' => $e->getMessage()];
    }
}
