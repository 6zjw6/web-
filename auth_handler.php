<?php
header('Content-Type: application/json');
require_once 'users.php';

session_start();
$userManager = new UserManager();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $action = $data['action'] ?? '';
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';

    if (empty($username) || empty($password)) {
        echo json_encode(['success' => false, 'message' => '用户名和密码不能为空']);
        exit;
    }

    switch ($action) {
        case 'register':
            $result = $userManager->register($username, $password);
            if ($result['success']) {
                $_SESSION['user'] = $username;
                setcookie('user', $username, time() + 86400 * 30, '/');
                setcookie('auth_token', $result['token'], time() + 86400 * 30, '/');
            }
            echo json_encode($result);
            break;
            
        case 'login':
            $result = $userManager->login($username, $password);
            if ($result['success']) {
                $_SESSION['user'] = $username;
                setcookie('user', $username, time() + 86400 * 30, '/');
                setcookie('auth_token', $result['token'], time() + 86400 * 30, '/');
            }
            echo json_encode($result);
            break;
            
        case 'check':
            $token = $_COOKIE['auth_token'] ?? '';
            $result = $userManager->checkAuth($username, $token);
            echo json_encode($result);
            break;
            
        case 'logout':
            session_destroy();
            setcookie('user', '', time() - 3600, '/');
            setcookie('auth_token', '', time() - 3600, '/');
            echo json_encode(['success' => true]);
            break;
            
        default:
            echo json_encode(['success' => false, 'message' => '未知操作']);
    }
} 