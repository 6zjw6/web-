<?php
class UserManager {
    private $usersFile = 'data/users.json';

    public function __construct() {
        if (!file_exists('data')) {
            mkdir('data', 0777, true);
        }
        if (!file_exists($this->usersFile)) {
            file_put_contents($this->usersFile, json_encode([]));
        }
    }

    public function register($username, $password) {
        $users = $this->getUsers();
        
        if (isset($users[$username])) {
            return ['success' => false, 'message' => '用户名已存在'];
        }

        $token = $this->generateToken($username);
        $users[$username] = [
            'password' => password_hash($password, PASSWORD_DEFAULT),
            'token' => $token,
            'created_at' => date('Y-m-d H:i:s')
        ];

        $this->saveUsers($users);
        return ['success' => true, 'message' => '注册成功', 'token' => $token];
    }

    public function login($username, $password) {
        $users = $this->getUsers();
        
        if (!isset($users[$username])) {
            return ['success' => false, 'message' => '用户名不存在'];
        }

        if (!password_verify($password, $users[$username]['password'])) {
            return ['success' => false, 'message' => '密码错误'];
        }

        $token = $this->generateToken($username);
        $users[$username]['token'] = $token;
        $this->saveUsers($users);

        return ['success' => true, 'message' => '登录成功', 'token' => $token];
    }

    public function checkAuth($username, $token) {
        $users = $this->getUsers();
        if (isset($users[$username]) && $users[$username]['token'] === $token) {
            return ['success' => true, 'username' => $username];
        }
        return ['success' => false];
    }

    private function generateToken($username) {
        return hash('sha256', $username . time() . rand(1000, 9999));
    }

    private function getUsers() {
        return json_decode(file_get_contents($this->usersFile), true);
    }

    private function saveUsers($users) {
        file_put_contents($this->usersFile, json_encode($users, JSON_PRETTY_PRINT));
    }
} 