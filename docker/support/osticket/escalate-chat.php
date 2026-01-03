<?php
// Chat to Ticket Escalation Script for ThaliumX
// This script is called by Live Helper Chat to create osTicket tickets

require_once('include/config.php');

header('Content-Type: application/json');

// Optional API key validation (recommended for production)
$provided_key = $_SERVER['HTTP_X_LHC_API_KEY'] ?? '';
if (defined('LHC_API_KEY') && LHC_API_KEY && hash_equals(LHC_API_KEY, $provided_key) === false) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    error_log("Escalation: Invalid JSON input received");
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON input']);
    exit;
}

error_log("Escalation: Received request with chat_id: " . ($input['chat_id'] ?? 'missing'));

// Validate required fields
$required_fields = ['chat_id', 'user_id', 'subject', 'message', 'priority'];
foreach ($required_fields as $field) {
    if (!isset($input[$field]) || empty($input[$field])) {
        error_log("Escalation: Missing required field: $field");
        http_response_code(400);
        echo json_encode(['error' => "Missing required field: $field"]);
        exit;
    }
}

$chat_id = $input['chat_id'];
$user_id = $input['user_id'];
$subject = substr(trim((string)$input['subject']), 0, 200);
$message = substr(trim((string)$input['message']), 0, 8000);

// Fintech workflow enrichment
$issue_type = $input['issue_type'] ?? 'trading_general';
$sla_level = $input['sla_level'] ?? null; // critical/high/normal/low

// Priority mapping: accept numeric or named priorities
$priority_raw = $input['priority'];
$priority_map = [
    'critical' => 1,
    'high' => 2,
    'normal' => 3,
    'low' => 4,
];
$priority = is_numeric($priority_raw)
    ? (int)$priority_raw
    : ($priority_map[strtolower((string)$priority_raw)] ?? 3);

// Department routing (fintech custom)
$department_map = [
    'trade_execution' => 'Trading Support',
    'market_data' => 'Trading Support',
    'deposit_withdrawal' => 'Payments & Settlements',
    'chargeback' => 'Payments & Settlements',
    'kyc' => 'Compliance',
    'aml' => 'Compliance',
    'account_access' => 'Account Support',
    'security' => 'Security',
];
$department = $input['department'] ?? ($department_map[$issue_type] ?? 'Trading Support');
$attachments = $input['attachments'] ?? [];

// Additional trading-specific fields
$trading_pair = $input['trading_pair'] ?? '';
$order_id = $input['order_id'] ?? '';
$transaction_hash = $input['transaction_hash'] ?? '';
$exchange = $input['exchange'] ?? '';

try {
    error_log("Escalation: Connecting to database: " . DBHOST . "/" . DBNAME . " as " . DBUSER);
    // Connect to database
    $pdo = new PDO(
        "pgsql:host=" . DBHOST . ";dbname=" . DBNAME,
        DBUSER,
        DBPASS,
        [PDO::ATTR_ERRMODE => PDO::ATTR_ERRMODE_EXCEPTION]
    );
    error_log("Escalation: Database connection successful");

    // Start transaction
    $pdo->beginTransaction();

    // Idempotency: if this chat_id was already escalated, return the existing ticket
    try {
        $idem_stmt = $pdo->prepare("SELECT object_id FROM ost_audit_log WHERE type = 'escalation' AND data LIKE ? ORDER BY created DESC LIMIT 1");
        $idem_stmt->execute(['%"chat_id":"' . $chat_id . '"%']);
        $idem = $idem_stmt->fetch(PDO::FETCH_ASSOC);
        if ($idem && isset($idem['object_id'])) {
            $ticket_lookup = $pdo->prepare("SELECT id, number FROM ost_ticket WHERE id = ? LIMIT 1");
            $ticket_lookup->execute([(int)$idem['object_id']]);
            $t = $ticket_lookup->fetch(PDO::FETCH_ASSOC);
            if ($t) {
                $pdo->commit();
                echo json_encode([
                    'success' => true,
                    'ticket_id' => (int)$t['id'],
                    'ticket_number' => $t['number'],
                    'message' => 'Chat already escalated (idempotent replay)'
                ]);
                exit;
            }
        }
    } catch (Exception $e) {
        // Ignore idempotency errors if audit table/schema differs.
    }

    // Get or create user in osTicket
    $user_stmt = $pdo->prepare("
        SELECT id FROM ost_user WHERE email = ?
        UNION
        SELECT user_id FROM ost_user_email WHERE address = ?
    ");
    $user_stmt->execute([$user_id . '@thaliumx.com', $user_id . '@thaliumx.com']);
    $existing_user = $user_stmt->fetch(PDO::FETCH_ASSOC);

    if (!$existing_user) {
        // Create new user
        $user_insert = $pdo->prepare("
            INSERT INTO ost_user (name, email, created, updated)
            VALUES (?, ?, NOW(), NOW())
        ");
        $user_insert->execute([$user_id, $user_id . '@thaliumx.com']);
        $user_id_db = $pdo->lastInsertId();
    } else {
        $user_id_db = $existing_user['id'];
    }

    // Get department ID
    $dept_stmt = $pdo->prepare("SELECT id FROM ost_department WHERE name = ?");
    $dept_stmt->execute([$department]);
    $dept = $dept_stmt->fetch(PDO::FETCH_ASSOC);

    if (!$dept) {
        // Create department if it doesn't exist
        $dept_insert = $pdo->prepare("
            INSERT INTO ost_department (name, created, updated)
            VALUES (?, NOW(), NOW())
        ");
        $dept_insert->execute([$department]);
        $dept_id = $pdo->lastInsertId();
    } else {
        $dept_id = $dept['id'];
    }

    // Create ticket
    $ticket_insert = $pdo->prepare("
        INSERT INTO ost_ticket (
            number, user_id, dept_id, topic_id, staff_id, subject,
            status, priority, created, updated, source
        ) VALUES (
            ?, ?, ?, 1, NULL, ?,
            'open', ?, NOW(), NOW(), 'chat'
        )
    ");

    // Generate ticket number
    $ticket_number = 'CHAT-' . strtoupper(substr(md5(uniqid()), 0, 8));

    $ticket_insert->execute([
        $ticket_number,
        $user_id_db,
        $dept_id,
        $subject,
        $priority
    ]);

    $ticket_id = $pdo->lastInsertId();

    // Best-effort insert into custom data table (osTicket convention). Ignore if table doesn't exist.
    try {
        $cdata_insert = $pdo->prepare("
            INSERT INTO ost_ticket__cdata (ticket_id, subject, trading_pair, order_id, transaction_hash, exchange, issue_type, sla_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $cdata_insert->execute([
            $ticket_id,
            $subject,
            $trading_pair,
            $order_id,
            $transaction_hash,
            $exchange,
            $issue_type,
            $sla_level
        ]);
    } catch (Exception $e) {
        // noop
    }

    // Add ticket message
    $message_body = $message . "\n\n--- Chat Details ---\n";
    $message_body .= "Chat ID: $chat_id\n";
    $message_body .= "Escalated from Live Helper Chat\n";

    if ($trading_pair) $message_body .= "Trading Pair: $trading_pair\n";
    if ($order_id) $message_body .= "Order ID: $order_id\n";
    if ($transaction_hash) $message_body .= "Transaction Hash: $transaction_hash\n";
    if ($exchange) $message_body .= "Exchange: $exchange\n";

    $message_insert = $pdo->prepare("
        INSERT INTO ost_thread (object_type, object_id, created)
        VALUES ('T', ?, NOW())
    ");
    $message_insert->execute([$ticket_id]);
    $thread_id = $pdo->lastInsertId();

    $entry_insert = $pdo->prepare("
        INSERT INTO ost_thread_entry (
            thread_id, staff_id, user_id, type, body, created
        ) VALUES (?, NULL, ?, 'M', ?, NOW())
    ");
    $entry_insert->execute([$thread_id, $user_id_db, $message_body]);

    // Handle attachments if any
    if (!empty($attachments)) {
        foreach ($attachments as $attachment) {
            // In a real implementation, you'd save the file and create attachment records
            // This is a simplified version
            $attach_insert = $pdo->prepare("
                INSERT INTO ost_thread_entry (thread_id, user_id, type, body, created)
                VALUES (?, ?, 'N', ?, NOW())
            ");
            $attach_insert->execute([
                $thread_id,
                $user_id_db,
                "Attachment: " . ($attachment['name'] ?? 'Unknown')
            ]);
        }
    }

    // Create audit log entry
    $audit_data = json_encode([
        'source' => 'live_helper_chat',
        'chat_id' => $chat_id,
        'escalated_by' => 'system',
        'issue_type' => $issue_type,
        'sla_level' => $sla_level,
        'timestamp' => date('c')
    ]);
    try {
        $audit_insert = $pdo->prepare("
            INSERT INTO ost_audit_log (type, object_type, object_id, data, created)
            VALUES ('escalation', 'T', ?, ?, NOW())
        ");
        $audit_insert->execute([$ticket_id, $audit_data]);
    } catch (Exception $e) {
        // ignore
    }

    // Commit transaction
    $pdo->commit();

    // Log successful escalation
    error_log("Chat $chat_id escalated to ticket $ticket_number (ID: $ticket_id)");

    // Return success response
    echo json_encode([
        'success' => true,
        'ticket_id' => $ticket_id,
        'ticket_number' => $ticket_number,
        'department' => $department,
        'priority' => $priority,
        'message' => 'Chat successfully escalated to ticket'
    ]);

} catch (Exception $e) {
    // Rollback on error
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log("Failed to escalate chat $chat_id: " . $e->getMessage());

    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to create ticket',
        'details' => $e->getMessage()
    ]);
}
?>
