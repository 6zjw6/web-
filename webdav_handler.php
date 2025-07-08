<?php
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

class WebDAVClient {
    private $baseUrl;
    private $username;
    private $password;

    public function __construct($url, $username, $password) {
        $this->baseUrl = rtrim($url, '/') . '/';
        $this->username = $username;
        $this->password = $password;
    }

    public function listFiles() {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $this->baseUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PROPFIND');
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Depth: 1',
            'Content-Type: application/xml'
        ]);
        curl_setopt($ch, CURLOPT_USERPWD, $this->username . ':' . $this->password);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // 如果需要的话
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 207) {
            return [];
        }

        $xml = new SimpleXMLElement($response);
        $xml->registerXPathNamespace('d', 'DAV:');
        
        $files = [];
        foreach ($xml->xpath('//d:response') as $item) {
            $href = (string)$item->xpath('d:href')[0];
            $name = basename($href);
            if ($name && $this->isVideoFile($name)) {
                $files[] = [
                    'name' => $name,
                    'url' => $this->getStreamUrl($name)
                ];
            }
        }

        return $files;
    }

    private function isVideoFile($filename) {
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        return in_array($ext, ['mp4', 'webm', 'ogg', 'mkv', 'm3u8']);
    }

    private function getStreamUrl($filename) {
        return $this->baseUrl . $filename;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    try {
        $client = new WebDAVClient(
            $data['url'],
            $data['username'],
            $data['password']
        );

        $files = $client->listFiles();
        
        echo json_encode([
            'success' => true,
            'files' => $files
        ]);
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
} 