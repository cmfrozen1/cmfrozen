<?php
/**
 * Backend API for Fukupet Storefront & Admin CMS
 * Handles Content Management, File Uploads, Database Connectivity, Orders, and System Status
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header("Content-Type: application/json; charset=utf-8");

require_once __DIR__ . '/config.php';

// Start session (used for admin authentication)
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Ensure upload directory exists
if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0755, true);
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$inputRaw = file_get_contents('php://input');
$input = json_decode($inputRaw, true) ?? [];

$pdo = getDbConnection();

switch ($action) {
    case 'get_content':
        handleGetContent($pdo);
        break;

    case 'save_section':
    case 'save_all':
    case 'upload_image':
    case 'delete_image':
        requireAdmin();
        if ($action === 'save_section') handleSaveSection($pdo, $input);
        elseif ($action === 'save_all') handleSaveAll($pdo, $input);
        elseif ($action === 'upload_image') handleUploadImage($pdo);
        else handleDeleteImage($input);
        break;

    case 'list_images':
        handleListImages();
        break;

    case 'create_order':
        handleCreateOrder($pdo, $input);
        break;

    case 'upload_slip':
        handleUploadSlip($pdo);
        break;

    case 'get_orders':
        requireAdmin();
        handleGetOrders($pdo);
        break;

    case 'update_order_status':
        requireAdmin();
        handleUpdateOrderStatus($pdo, $input);
        break;

    case 'lookup_order':
        handleOrderLookup($pdo, $input);
        break;

    case 'db_status':
        handleDbStatus();
        break;

    case 'init_db':
        requireAdmin();
        handleInitDb();
        break;

    case 'login':
        handleLogin($input);
        break;

    case 'logout':
        handleLogout();
        break;

    case 'check_auth':
        handleCheckAuth();
        break;

    default:
        echo json_encode(['error' => 'Invalid action', 'action' => $action]);
        break;
}

/**
 * 1. Get All Site Content
 */
function handleGetContent($pdo) {
    // Load default fallback from JSON
    $content = [];
    if (file_exists(DATA_FILE)) {
        $jsonStr = file_get_contents(DATA_FILE);
        $content = json_decode($jsonStr, true) ?? [];
    }

    $dbStatus = checkDbStatus();
    $source = 'file';

    if ($pdo && $dbStatus['connected']) {
        try {
            $stmt = $pdo->query("SELECT section_key, data_json FROM site_sections");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (!empty($rows)) {
                $source = 'mysql';
                foreach ($rows as $r) {
                    $decoded = json_decode($r['data_json'], true);
                    if ($decoded !== null) {
                        $content[$r['section_key']] = $decoded;
                    }
                }
            } else {
                // DB is connected but empty, seed from default_data.json
                seedDbFromData($pdo, $content);
            }
        } catch (Exception $e) {
            // If table doesn't exist yet, auto-attempt schema creation
            tryAutoInitDb($pdo);
        }
    }

    echo json_encode([
        'success' => true,
        'source' => $source,
        'db_status' => $dbStatus,
        'data' => $content
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}

/**
 * 2. Save a specific section
 */
function handleSaveSection($pdo, $input) {
    $sectionKey = $input['section_key'] ?? '';
    $data = $input['data'] ?? null;

    if (!$sectionKey || $data === null) {
        echo json_encode(['success' => false, 'error' => 'Missing section_key or data']);
        return;
    }

    $jsonEncoded = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    // 1. Update MySQL if available
    $mysqlSaved = false;
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO site_sections (section_key, section_name, data_json)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE data_json = VALUES(data_json), updated_at = CURRENT_TIMESTAMP
            ");
            $stmt->execute([$sectionKey, ucfirst(str_replace('_', ' ', $sectionKey)), $jsonEncoded]);
            $mysqlSaved = true;
        } catch (Exception $e) {
            // Ignore, proceed to file save
        }
    }

    // 2. Always sync to DATA_FILE
    $fileSaved = false;
    if (file_exists(DATA_FILE)) {
        $allData = json_decode(file_get_contents(DATA_FILE), true) ?? [];
        $allData[$sectionKey] = $data;
        file_put_contents(DATA_FILE, json_encode($allData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        $fileSaved = true;
    }

    echo json_encode([
        'success' => true,
        'section_key' => $sectionKey,
        'mysql_saved' => $mysqlSaved,
        'file_saved' => $fileSaved,
        'message' => 'บันทึกข้อมูลเรียบร้อยแล้ว'
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * 3. Save All Content
 */
function handleSaveAll($pdo, $input) {
    $data = $input['data'] ?? $input;
    if (empty($data) || !is_array($data)) {
        echo json_encode(['success' => false, 'error' => 'No data provided']);
        return;
    }

    $mysqlCount = 0;
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO site_sections (section_key, section_name, data_json)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE data_json = VALUES(data_json), updated_at = CURRENT_TIMESTAMP
            ");
            foreach ($data as $k => $v) {
                $encoded = json_encode($v, JSON_UNESCAPED_UNICODE);
                $stmt->execute([$k, ucfirst(str_replace('_', ' ', $k)), $encoded]);
                $mysqlCount++;
            }
        } catch (Exception $e) {
            // fallback
        }
    }

    // Save to JSON file
    file_put_contents(DATA_FILE, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    echo json_encode([
        'success' => true,
        'mysql_sections_updated' => $mysqlCount,
        'message' => 'บันทึกข้อมูลเว็บไซต์ทั้งหมดเรียบร้อยแล้ว'
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * 4. Upload Image to /images/
 */
function handleUploadImage($pdo) {
    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        $errorMsg = 'No file uploaded or upload error code: ' . ($_FILES['image']['error'] ?? 'none');
        echo json_encode(['success' => false, 'error' => $errorMsg]);
        return;
    }

    $file = $_FILES['image'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];

    if (!in_array($ext, $allowed)) {
        echo json_encode(['success' => false, 'error' => 'อนุญาตเฉพาะไฟล์ภาพ jpg, jpeg, png, gif, webp, svg']);
        return;
    }

    // Generate clean unique filename
    $baseName = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($file['name'], PATHINFO_FILENAME));
    $filename = $baseName . '_' . time() . '_' . substr(md5(uniqid()), 0, 6) . '.' . $ext;
    $targetPath = UPLOAD_DIR . $filename;

    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        echo json_encode(['success' => false, 'error' => 'ไม่สามารถบันทึกไฟล์ลงในไดเรกทอรี images ได้']);
        return;
    }

    $fileUrl = 'images/' . $filename;
    $fileSize = filesize($targetPath);
    $mime = mime_content_type($targetPath) ?: 'image/' . $ext;

    // Save to media_files table if DB is available
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO media_files (filename, original_name, file_path, file_size, mime_type)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$filename, $file['name'], $fileUrl, $fileSize, $mime]);
        } catch (Exception $e) {
            // media_files table might not exist, ignore
        }
    }

    echo json_encode([
        'success' => true,
        'filename' => $filename,
        'url' => $fileUrl,
        'size' => $fileSize,
        'mime' => $mime,
        'message' => 'อัปโหลดรูปภาพสำเร็จ'
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * 5. List all images in /images/
 */
function handleListImages() {
    $images = [];
    if (is_dir(UPLOAD_DIR)) {
        $files = scandir(UPLOAD_DIR);
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        foreach ($files as $f) {
            if ($f === '.' || $f === '..') continue;
            $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
            if (in_array($ext, $allowed)) {
                $fullPath = UPLOAD_DIR . $f;
                $images[] = [
                    'filename' => $f,
                    'url' => 'images/' . $f,
                    'size' => filesize($fullPath),
                    'size_formatted' => round(filesize($fullPath) / 1024, 1) . ' KB',
                    'updated_at' => date('Y-m-d H:i:s', filemtime($fullPath))
                ];
            }
        }
    }

    // Sort newest first
    usort($images, function($a, $b) {
        return strcmp($b['updated_at'], $a['updated_at']);
    });

    echo json_encode([
        'success' => true,
        'total' => count($images),
        'images' => $images
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * 6. Delete image from /images/
 */
function handleDeleteImage($input) {
    $filename = basename($input['filename'] ?? '');
    if (!$filename) {
        echo json_encode(['success' => false, 'error' => 'Missing filename']);
        return;
    }

    $targetPath = UPLOAD_DIR . $filename;
    if (file_exists($targetPath)) {
        unlink($targetPath);
        echo json_encode(['success' => true, 'message' => 'ลบรูปภาพเรียบร้อยแล้ว']);
    } else {
        echo json_encode(['success' => false, 'error' => 'ไม่พบไฟล์ภาพดังกล่าว']);
    }
}

/**
 * 7. Create Customer Order
 */
function handleCreateOrder($pdo, $input) {
    $customerName = trim($input['name'] ?? '');
    $customerPhone = trim($input['phone'] ?? '');
    $customerAddress = trim($input['address'] ?? '');
    $totalPrice = floatval($input['total_price'] ?? 0);
    $paymentMethod = trim($input['payment_method'] ?? 'cod');
    $colors = is_array($input['colors'] ?? null) ? $input['colors'] : [];
    $colors = array_values(array_filter(array_map(function ($color) {
        return is_string($color) ? trim($color) : '';
    }, $colors)));
    $colorSummary = empty($colors) ? '' : implode(', ', array_map(function ($color, $index) {
        return 'ชิ้นที่ ' . ($index + 1) . ': ' . $color;
    }, $colors, array_keys($colors)));

    if (!$customerName || !$customerPhone) {
        echo json_encode(['success' => false, 'error' => 'กรุณากรอกชื่อและเบอร์โทรศัพท์']);
        return;
    }

    $orderNo = 'ORD-' . date('Ymd') . '-' . strtoupper(substr(md5(uniqid()), 0, 4));
    $orderData = [
        'order_no' => $orderNo,
        'customer_name' => $customerName,
        'customer_phone' => $customerPhone,
        'customer_address' => $customerAddress,
        'product_title' => $input['product_title'] ?? 'หมอนโคซี่ Chowa',
        'size_name' => $input['size_name'] ?? 'มาตรฐาน (Standard)',
        'bundle_name' => $input['bundle_name'] ?? '1 ใบ',
        'quantity' => intval($input['quantity'] ?? 1),
        'colors' => $colors,
        // The existing orders table has a notes field, so this works for both
        // current MySQL installations and the local JSON backup without migration.
        'notes' => $colorSummary ? 'สีสินค้า: ' . $colorSummary : null,
        'upsell_included' => !empty($input['upsell_included']) ? 1 : 0,
        'total_price' => $totalPrice,
        'payment_method' => $paymentMethod,
        'status' => 'pending',
        'created_at' => date('Y-m-d H:i:s')
    ];

    $mysqlSaved = false;
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO orders (
                    order_no, customer_name, customer_phone, customer_address,
                    product_title, size_name, bundle_name, quantity, notes,
                    upsell_included, total_price, payment_method, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            ");
            $stmt->execute([
                $orderData['order_no'],
                $orderData['customer_name'],
                $orderData['customer_phone'],
                $orderData['customer_address'],
                $orderData['product_title'],
                $orderData['size_name'],
                $orderData['bundle_name'],
                $orderData['quantity'],
                $orderData['notes'],
                $orderData['upsell_included'],
                $orderData['total_price'],
                $orderData['payment_method']
            ]);
            $mysqlSaved = true;
        } catch (Exception $e) {
            // save to file
        }
    }

    // Backup to local orders.json file
    $ordersFile = __DIR__ . '/orders.json';
    $orders = file_exists($ordersFile) ? json_decode(file_get_contents($ordersFile), true) ?? [] : [];
    array_unshift($orders, $orderData);
    file_put_contents($ordersFile, json_encode($orders, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    echo json_encode([
        'success' => true,
        'order_no' => $orderNo,
        'mysql_saved' => $mysqlSaved,
        'message' => 'บันทึกคำสั่งซื้อเรียบร้อยแล้ว'
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * 8. Upload payment slip for an existing order.
 * The only schema change is the additive `slip_path` column, created only
 * when it is not already present.
 */
function handleUploadSlip($pdo) {
    $orderNo = trim($_POST['order_no'] ?? '');
    if (!$orderNo || !preg_match('/^[A-Za-z0-9-]{4,64}$/', $orderNo)) {
        echo json_encode(['success' => false, 'error' => 'ไม่พบเลขที่คำสั่งซื้อ']);
        return;
    }
    if (!isset($_FILES['slip']) || $_FILES['slip']['error'] !== UPLOAD_ERR_OK) {
        echo json_encode(['success' => false, 'error' => 'กรุณาเลือกไฟล์สลิป']);
        return;
    }

    $file = $_FILES['slip'];
    if ($file['size'] > 5 * 1024 * 1024) {
        echo json_encode(['success' => false, 'error' => 'ไฟล์สลิปต้องมีขนาดไม่เกิน 5 MB']);
        return;
    }

    $imageInfo = @getimagesize($file['tmp_name']);
    $allowedMimes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $mime = $imageInfo['mime'] ?? '';
    if (!isset($allowedMimes[$mime])) {
        echo json_encode(['success' => false, 'error' => 'รองรับเฉพาะไฟล์ JPG, PNG และ WebP']);
        return;
    }

    $ordersFile = __DIR__ . '/orders.json';
    $orders = file_exists($ordersFile) ? json_decode(file_get_contents($ordersFile), true) ?? [] : [];
    $fileOrderExists = false;
    foreach ($orders as $order) {
        if (($order['order_no'] ?? '') === $orderNo) {
            $fileOrderExists = true;
            break;
        }
    }

    $dbOrderExists = false;
    if ($pdo) {
        try {
            $check = $pdo->prepare('SELECT 1 FROM orders WHERE order_no = ? LIMIT 1');
            $check->execute([$orderNo]);
            $dbOrderExists = (bool)$check->fetchColumn();
        } catch (Exception $e) {
            // Local JSON remains available as a fallback.
        }
    }
    if (!$fileOrderExists && !$dbOrderExists) {
        echo json_encode(['success' => false, 'error' => 'ไม่พบคำสั่งซื้อนี้']);
        return;
    }

    $slipDir = __DIR__ . '/slips/';
    if (!is_dir($slipDir) && !mkdir($slipDir, 0755, true)) {
        echo json_encode(['success' => false, 'error' => 'ไม่สามารถสร้างโฟลเดอร์สลิปได้']);
        return;
    }
    $filename = preg_replace('/[^A-Za-z0-9-]/', '_', $orderNo) . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $allowedMimes[$mime];
    $targetPath = $slipDir . $filename;
    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        echo json_encode(['success' => false, 'error' => 'ไม่สามารถบันทึกไฟล์สลิปได้']);
        return;
    }
    $slipPath = 'slips/' . $filename;

    if ($pdo && $dbOrderExists) {
        try {
            $column = $pdo->query("SHOW COLUMNS FROM orders LIKE 'slip_path'")->fetch();
            if (!$column) {
                $pdo->exec('ALTER TABLE orders ADD COLUMN slip_path VARCHAR(255) NULL AFTER notes');
            }
            $stmt = $pdo->prepare('UPDATE orders SET slip_path = ? WHERE order_no = ?');
            $stmt->execute([$slipPath, $orderNo]);
        } catch (Exception $e) {
            // The local JSON copy still records the upload if MySQL is unavailable.
        }
    }

    foreach ($orders as &$order) {
        if (($order['order_no'] ?? '') === $orderNo) {
            $order['slip_path'] = $slipPath;
        }
    }
    unset($order);
    if ($fileOrderExists) {
        file_put_contents($ordersFile, json_encode($orders, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    echo json_encode(['success' => true, 'slip_path' => $slipPath, 'message' => 'แนบสลิปเรียบร้อยแล้ว'], JSON_UNESCAPED_UNICODE);
}

/**
 * 9. Get Orders for Admin
 */
function handleGetOrders($pdo) {
    $orders = [];
    if ($pdo) {
        try {
            ensureOrderTrackingColumn($pdo);
            $stmt = $pdo->query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100");
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            // fallback to file
        }
    }

    $ordersFile = __DIR__ . '/orders.json';
    $backupOrders = file_exists($ordersFile) ? json_decode(file_get_contents($ordersFile), true) ?? [] : [];
    if (empty($orders)) {
        $orders = $backupOrders;
    } elseif (!empty($backupOrders)) {
        // Keep the slip visible in Admin even if an older MySQL user does not
        // yet have ALTER permission for the optional slip_path column.
        $slipsByOrder = [];
        $trackingByOrder = [];
        foreach ($backupOrders as $backupOrder) {
            if (!empty($backupOrder['order_no']) && !empty($backupOrder['slip_path'])) {
                $slipsByOrder[$backupOrder['order_no']] = $backupOrder['slip_path'];
            }
            if (!empty($backupOrder['order_no']) && !empty($backupOrder['tracking_number'])) {
                $trackingByOrder[$backupOrder['order_no']] = $backupOrder['tracking_number'];
            }
        }
        foreach ($orders as &$order) {
            if (empty($order['slip_path']) && !empty($slipsByOrder[$order['order_no'] ?? ''])) {
                $order['slip_path'] = $slipsByOrder[$order['order_no']];
            }
            if (empty($order['tracking_number']) && !empty($trackingByOrder[$order['order_no'] ?? ''])) {
                $order['tracking_number'] = $trackingByOrder[$order['order_no']];
            }
        }
        unset($order);
    }

    echo json_encode([
        'success' => true,
        'total' => count($orders),
        'orders' => $orders
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * 9. Update Order Status
 */
function handleUpdateOrderStatus($pdo, $input) {
    $orderNo = $input['order_no'] ?? '';
    $status = $input['status'] ?? 'pending';
    $trackingNumber = trim($input['tracking_number'] ?? '');
    $allowedStatuses = ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'];

    if (!$orderNo) {
        echo json_encode(['success' => false, 'error' => 'Missing order_no']);
        return;
    }
    if (!in_array($status, $allowedStatuses, true)) {
        echo json_encode(['success' => false, 'error' => 'Invalid status']);
        return;
    }
    if ($status === 'shipping' && $trackingNumber === '') {
        echo json_encode(['success' => false, 'error' => 'กรุณากรอกเลข Tracking ก่อนเปลี่ยนเป็นกำลังจัดส่ง']);
        return;
    }

    if ($pdo) {
        try {
            ensureOrderTrackingColumn($pdo);
            if ($trackingNumber !== '') {
                $stmt = $pdo->prepare("UPDATE orders SET status = ?, tracking_number = ? WHERE order_no = ?");
                $stmt->execute([$status, $trackingNumber, $orderNo]);
            } else {
                $stmt = $pdo->prepare("UPDATE orders SET status = ? WHERE order_no = ?");
                $stmt->execute([$status, $orderNo]);
            }
        } catch (Exception $e) {}
    }

    // Also update orders.json
    $ordersFile = __DIR__ . '/orders.json';
    if (file_exists($ordersFile)) {
        $orders = json_decode(file_get_contents($ordersFile), true) ?? [];
        foreach ($orders as &$ord) {
            if ($ord['order_no'] === $orderNo) {
                $ord['status'] = $status;
                if ($trackingNumber !== '') {
                    $ord['tracking_number'] = $trackingNumber;
                }
            }
        }
        file_put_contents($ordersFile, json_encode($orders, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    echo json_encode(['success' => true, 'message' => 'อัปเดตสถานะสำเร็จ']);
}

function ensureOrderTrackingColumn($pdo) {
    if (!$pdo) return;
    $column = $pdo->query("SHOW COLUMNS FROM orders LIKE 'tracking_number'")->fetch();
    if (!$column) {
        $pdo->exec('ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(128) NULL AFTER status');
    }
}

function normalizeOrderPhone($phone) {
    return preg_replace('/\D+/', '', (string)$phone);
}

function publicOrderPayload($order) {
    return [
        'order_no' => $order['order_no'] ?? '',
        'created_at' => $order['created_at'] ?? '',
        'product_title' => $order['product_title'] ?? '',
        'size_name' => $order['size_name'] ?? '',
        'bundle_name' => $order['bundle_name'] ?? '',
        'quantity' => intval($order['quantity'] ?? 1),
        'total_price' => floatval($order['total_price'] ?? 0),
        'payment_method' => $order['payment_method'] ?? '',
        'status' => $order['status'] ?? 'pending',
        'tracking_number' => (($order['status'] ?? '') === 'shipping') ? ($order['tracking_number'] ?? '') : ''
    ];
}

/**
 * 10. Lookup customer orders by phone number
 */
function handleOrderLookup($pdo, $input) {
    $phone = trim($input['phone'] ?? $_GET['phone'] ?? '');
    $normalizedPhone = normalizeOrderPhone($phone);

    if ($normalizedPhone === '') {
        echo json_encode(['success' => false, 'error' => 'กรุณากรอกเบอร์โทรศัพท์ที่ใช้สั่งซื้อ']);
        return;
    }

    $matchedOrders = [];

    if ($pdo) {
        try {
            ensureOrderTrackingColumn($pdo);
            $stmt = $pdo->query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 300");
            $dbOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($dbOrders as $order) {
                if (normalizeOrderPhone($order['customer_phone'] ?? '') === $normalizedPhone) {
                    $matchedOrders[] = publicOrderPayload($order);
                }
            }
        } catch (Exception $e) {
            // Local JSON remains available as a fallback.
        }
    }

    $ordersFile = __DIR__ . '/orders.json';
    $backupOrders = file_exists($ordersFile) ? json_decode(file_get_contents($ordersFile), true) ?? [] : [];
    if (empty($matchedOrders) && !empty($backupOrders)) {
        foreach ($backupOrders as $order) {
            if (normalizeOrderPhone($order['customer_phone'] ?? '') === $normalizedPhone) {
                $matchedOrders[] = publicOrderPayload($order);
            }
        }
    }

    echo json_encode([
        'success' => true,
        'total' => count($matchedOrders),
        'orders' => $matchedOrders
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * 10. Database Status
 */
function handleDbStatus() {
    $status = checkDbStatus();
    echo json_encode($status, JSON_UNESCAPED_UNICODE);
}

/**
 * 11. Run Database Init
 */
function handleInitDb() {
    $sqlFile = __DIR__ . '/initdatabase.sql';
    if (!file_exists($sqlFile)) {
        echo json_encode(['success' => false, 'error' => 'Cannot find initdatabase.sql']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        echo json_encode([
            'success' => false,
            'error' => 'ไม่สามารถเชื่อมต่อ MySQL ได้ กรุณาตรวจสอบว่าสร้างฐานข้อมูล ' . DB_NAME . ' และผู้ใช้ ' . DB_USER . ' ใน Hosting หรือยัง'
        ]);
        return;
    }

    try {
        $sql = file_get_contents($sqlFile);
        $pdo->exec($sql);
        echo json_encode(['success' => true, 'message' => 'สร้างตารางและติดตั้งข้อมูลเริ่มต้นเรียบร้อยแล้ว']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

/**
 * 12. Admin Login (session-based)
 */
function handleLogin($input) {
    $username = trim($input['username'] ?? '');
    $password = trim($input['password'] ?? '');

    if ($username === ADMIN_USER && $password === ADMIN_PASS) {
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['admin_username'] = $username;
        $_SESSION['admin_token'] = bin2hex(random_bytes(16));
        echo json_encode([
            'success' => true,
            'token' => $_SESSION['admin_token'],
            'username' => $username,
            'message' => 'เข้าสู่ระบบสำเร็จ'
        ], JSON_UNESCAPED_UNICODE);
    } else {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
        ], JSON_UNESCAPED_UNICODE);
    }
}

/**
 * 13. Admin Logout
 */
function handleLogout() {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    echo json_encode(['success' => true, 'message' => 'ออกจากระบบเรียบร้อยแล้ว'], JSON_UNESCAPED_UNICODE);
}

/**
 * 14. Check Auth Status
 */
function handleCheckAuth() {
    echo json_encode([
        'logged_in' => !empty($_SESSION['admin_logged_in']),
        'username' => $_SESSION['admin_username'] ?? null
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * Helper: Require admin session, otherwise return 401 JSON and stop
 */
function requireAdmin() {
    if (empty($_SESSION['admin_logged_in'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'กรุณาเข้าสู่ระบบผู้ดูแลก่อนใช้งาน'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

/**
 * Helper: Seed DB from default array
 */
function seedDbFromData($pdo, $data) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO site_sections (section_key, section_name, data_json)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE data_json = VALUES(data_json)
        ");
        foreach ($data as $k => $v) {
            $stmt->execute([$k, ucfirst(str_replace('_', ' ', $k)), json_encode($v, JSON_UNESCAPED_UNICODE)]);
        }
    } catch (Exception $e) {}
}

/**
 * Helper: Try auto-init tables if missing
 */
function tryAutoInitDb($pdo) {
    $sqlFile = __DIR__ . '/initdatabase.sql';
    if (file_exists($sqlFile)) {
        try {
            $sql = file_get_contents($sqlFile);
            $pdo->exec($sql);
        } catch (Exception $e) {}
    }
}
