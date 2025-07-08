<?php
header('Content-Type: application/json');
session_start();

class RoomManager {
    private $roomsFile = 'data/rooms.json';

    public function __construct() {
        if (!file_exists('data')) {
            mkdir('data', 0777, true);
        }
        if (!file_exists($this->roomsFile)) {
            file_put_contents($this->roomsFile, json_encode([]));
        }
    }

    public function createRoom($roomId, $data) {
        $rooms = $this->getRooms();
        $rooms[$roomId] = [
            'host' => $data['username'],
            'webdav' => [
                'url' => $data['webdavUrl'],
                'user' => $data['webdavUser'],
                'pass' => $data['webdavPass']
            ],
            'members' => [],
            'messages' => [],
            'currentVideo' => '',
            'currentTime' => 0,
            'lastUpdate' => time()
        ];
        $this->saveRooms($rooms);
        return ['success' => true];
    }

    public function joinRoom($roomId, $username) {
        $rooms = $this->getRooms();
        if (!isset($rooms[$roomId])) {
            return ['success' => false, 'message' => '房间不存在'];
        }
        
        // 如果用户已经在房间里，直接返回成功
        if (!in_array($username, $rooms[$roomId]['members'])) {
            $rooms[$roomId]['members'][] = $username;
            $this->saveRooms($rooms);
        }
        
        return [
            'success' => true,
            'webdav' => $rooms[$roomId]['webdav'],
            'currentVideo' => $rooms[$roomId]['currentVideo'],
            'currentTime' => $rooms[$roomId]['currentTime'],
            'messages' => $rooms[$roomId]['messages']
        ];
    }

    public function updateTime($roomId, $time) {
        $rooms = $this->getRooms();
        if (isset($rooms[$roomId])) {
            $rooms[$roomId]['currentTime'] = $time;
            $rooms[$roomId]['lastUpdate'] = time();
            $this->saveRooms($rooms);
        }
        return ['success' => true];
    }

    public function getRoomStatus($roomId, $lastUpdate = 0) {
        $rooms = $this->getRooms();
        if (!isset($rooms[$roomId])) {
            return ['success' => false];
        }

        if ($rooms[$roomId]['lastUpdate'] > $lastUpdate) {
            return [
                'success' => true,
                'currentTime' => $rooms[$roomId]['currentTime'],
                'currentVideo' => $rooms[$roomId]['currentVideo'],
                'messages' => $rooms[$roomId]['messages'],
                'members' => $rooms[$roomId]['members'],
                'lastUpdate' => $rooms[$roomId]['lastUpdate']
            ];
        }
        return ['success' => true, 'noChange' => true];
    }

    public function sendMessage($roomId, $username, $message) {
        $rooms = $this->getRooms();
        if (isset($rooms[$roomId])) {
            if (count($rooms[$roomId]['messages']) > 100) {
                array_shift($rooms[$roomId]['messages']);
            }
            $rooms[$roomId]['messages'][] = [
                'username' => $username,
                'message' => $message,
                'time' => date('H:i:s')
            ];
            $rooms[$roomId]['lastUpdate'] = time();
            $this->saveRooms($rooms);
            return [
                'success' => true,
                'message' => [
                    'username' => $username,
                    'message' => $message,
                    'time' => date('H:i:s')
                ]
            ];
        }
        return ['success' => false, 'message' => '房间不存在'];
    }

    private function getRooms() {
        return json_decode(file_get_contents($this->roomsFile), true);
    }

    private function saveRooms($rooms) {
        file_put_contents($this->roomsFile, json_encode($rooms));
    }
}

$roomManager = new RoomManager();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $action = $data['action'] ?? '';

    switch ($action) {
        case 'create':
            echo json_encode($roomManager->createRoom($data['roomId'], $data));
            break;
        case 'join':
            echo json_encode($roomManager->joinRoom($data['roomId'], $data['username']));
            break;
        case 'sync':
            echo json_encode($roomManager->updateTime($data['roomId'], $data['time']));
            break;
        case 'status':
            echo json_encode($roomManager->getRoomStatus($data['roomId'], $data['lastUpdate'] ?? 0));
            break;
        case 'message':
            echo json_encode($roomManager->sendMessage($data['roomId'], $data['username'], $data['message']));
            break;
        default:
            echo json_encode(['success' => false, 'message' => '未知操作']);
    }
} 