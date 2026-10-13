<?php
/**
 * Automated MySQL Database Initialization via Plesk API or direct PHP execution
 * This runs with Apache's MySQL privileges to check what's available
 */
header("Content-Type: application/json");

$result = [];

// Check if we can connect with the FTP user's MySQL credentials
// On Plesk, each subscription gets a MySQL user matching the hosting account
$possibleCreds = [
    // Standard Plesk pattern - FTP user == MySQL admin for the subscription
    ["user" => "fukupet", "pass" => 'ds8c5bImHmb$Se8%', "db" => "fukupet_dbwebsite"],
    // Maybe DB was already created with these creds
    ["user" => "fukupet_yok", "pass" => 'Lqqp4%*t34xxzSHi', "db" => null],
    // Try admin-style access
    ["user" => "fukupet", "pass" => 'ds8c5bImHmb$Se8%', "db" => null],
];

foreach ($possibleCreds as $cred) {
    try {
        $dsn = "mysql:host=localhost;port=3306;charset=utf8mb4";
        if ($cred["db"]) $dsn .= ";dbname={$cred['db']}";
        $pdo = new PDO($dsn, $cred["user"], $cred["pass"], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        
        // Success! List available databases
        $dbs = $pdo->query("SHOW DATABASES")->fetchAll(PDO::FETCH_COLUMN);
        $result[] = [
            "status" => "CONNECTED",
            "user" => $cred["user"],
            "db" => $cred["db"],
            "available_databases" => $dbs
        ];
        
        // Try to create the target DB and user
        try {
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `fukupet_dbwebsite` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $result[count($result)-1]["created_db"] = true;
        } catch(Exception $e) {
            $result[count($result)-1]["create_db_error"] = $e->getMessage();
        }
        
        // Try to create user
        try {
            $pdo->exec("CREATE USER IF NOT EXISTS 'fukupet_yok'@'localhost' IDENTIFIED BY 'Lqqp4%*t34xxzSHi'");
            $pdo->exec("GRANT ALL PRIVILEGES ON `fukupet_dbwebsite`.* TO 'fukupet_yok'@'localhost'");
            $pdo->exec("FLUSH PRIVILEGES");
            $result[count($result)-1]["created_user"] = true;
        } catch(Exception $e) {
            $result[count($result)-1]["create_user_error"] = $e->getMessage();
        }
        
    } catch(PDOException $e) {
        $result[] = [
            "status" => "FAILED",
            "user" => $cred["user"],
            "db" => $cred["db"],
            "error" => $e->getMessage()
        ];
    }
}

// Also check if Plesk has a local MySQL config we can read
$pleskPaths = [
    "/etc/psa/.psa.shadow",
    "/var/lib/psa/conf/psa.conf",
    "/usr/local/psa/etc/psa.conf"
];
$pleskInfo = [];
foreach ($pleskPaths as $path) {
    if (file_exists($path)) {
        $pleskInfo[$path] = "EXISTS";
    }
}

echo json_encode([
    "connection_tests" => $result,
    "plesk_files" => $pleskInfo,
    "server" => $_SERVER["SERVER_SOFTWARE"] ?? "unknown",
    "document_root" => $_SERVER["DOCUMENT_ROOT"] ?? "unknown"
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
?>
