// 在文件开头定义所有变量和常量
let currentRoom = null;
let currentUser = null;
let isSeeking = false;
let lastSyncTime = 0;
const SYNC_INTERVAL = 500;
const POLL_INTERVAL = 1000;
let lastUpdate = 0;
let pollTimer = null;
let videoSelectorModal = null;
const CACHE_DURATION = 5 * 60 * 1000;
let lastCacheClear = Date.now();

// 表情包数据
const emojis = ['😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😜', '😎', '🤔', '🤗', '😴', '😷', '🤒', '🤮', '😱', '😤', '😭', '😡'];

// 首先定义所有工具函数
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function clearBrowserCache() {
    if (Date.now() - lastCacheClear < CACHE_DURATION) return;
    
    // 清理视频缓存
    const video = document.getElementById('videoPlayer');
    if (video) {
        video.src = '';
        video.load();
    }

    // 清理fetch缓存
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(name => {
                caches.delete(name);
            });
        });
    }

    // 添加no-cache头到所有fetch请求
    const fetchWithNoCache = (url, options = {}) => {
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    };

    // 替换全局fetch
    window.originalFetch = window.originalFetch || window.fetch;
    window.fetch = fetchWithNoCache;

    lastCacheClear = Date.now();
    console.log('Browser cache cleared');
}

// 视频选择器相关函数
function initVideoSelector() {
    videoSelectorModal = new bootstrap.Modal(document.getElementById('videoSelectorModal'));
}

function showVideoSelector() {
    refreshVideoList();
    videoSelectorModal.show();
}

function refreshVideoList() {
    const room = getRoomData();
    if (!room) return;

    fetch('webdav_handler.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            url: room.webdav.url,
            username: room.webdav.user,
            password: room.webdav.pass
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const videoList = document.getElementById('videoSelectorList');
            videoList.innerHTML = '';
            
            data.files.forEach(file => {
                const item = document.createElement('a');
                item.href = '#';
                item.className = 'list-group-item list-group-item-action';
                item.innerHTML = `
                    <i class="fas fa-film"></i>
                    <span>${file.name}</span>
                `;
                item.onclick = (e) => {
                    e.preventDefault();
                    playVideo(file.url);
                    videoSelectorModal.hide();
                };
                videoList.appendChild(item);
            });
        }
    });
}

// 创建房间
function createRoom() {
    if (!currentUser) {
        alert('请先登录');
        return;
    }
    const roomId = document.getElementById('roomId').value;
    const webdavUrl = document.getElementById('webdavUrl').value;
    const webdavUser = document.getElementById('webdavUser').value;
    const webdavPass = document.getElementById('webdavPass').value;

    fetch('server.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'create',
            roomId: roomId,
            username: currentUser,
            webdavUrl: webdavUrl,
            webdavUser: webdavUser,
            webdavPass: webdavPass
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentRoom = roomId;
            showVideoRoom();
            initWebDAV(webdavUrl, webdavUser, webdavPass);
            startPolling();
        } else {
            alert(data.message || '创建房间失败');
        }
    });
}

// 加入房间
function joinRoom() {
    if (!currentUser) {
        alert('请先登录');
        return;
    }
    const roomId = document.getElementById('roomId').value;
    
    fetch('server.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'join',
            roomId: roomId,
            username: currentUser
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentRoom = roomId;
            showVideoRoom();
            initWebDAV(data.webdav.url, data.webdav.user, data.webdav.pass);
            startPolling();
            
            if (data.currentVideo) {
                const video = document.getElementById('videoPlayer');
                video.src = data.currentVideo;
                video.currentTime = data.currentTime || 0;
            }
            
            if (data.messages) {
                data.messages.forEach(msg => {
                    addChatMessage(msg.username, msg.message, msg.time);
                });
            }
        } else {
            alert(data.message || '加入房间失败');
        }
    });
}

// 显示视频房间
function showVideoRoom() {
    document.getElementById('roomForm').style.display = 'none';
    document.getElementById('videoRoom').style.display = 'block';
}

// 初始化WebDAV
function initWebDAV(url, username, password) {
    fetch('webdav_handler.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            url: url,
            username: username,
            password: password
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const filesList = document.querySelector('#filesList .list-group');
            filesList.innerHTML = '';
            
            data.files.forEach(file => {
                const item = document.createElement('a');
                item.href = '#';
                item.className = 'list-group-item list-group-item-action';
                item.textContent = file.name;
                item.onclick = (e) => {
                    e.preventDefault();
                    playVideo(file.url);
                };
                filesList.appendChild(item);
            });
        }
    });
}

// 播放视频
function playVideo(url) {
    clearBrowserCache(); // 播放新视频前清理缓存
    
    const video = document.getElementById('videoPlayer');
    // 添加时间戳防止缓存
    const nocacheUrl = `${url}?t=${Date.now()}`;
    video.src = nocacheUrl;
    const videoName = url.split('/').pop();
    document.getElementById('currentVideo').textContent = videoName;
    
    fetch('server.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
            action: 'updateVideo',
            roomId: currentRoom,
            videoUrl: url,
            videoName: videoName
        })
    });
}

// 发送消息
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    fetch('server.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'message',
            roomId: currentRoom,
            username: currentUser,
            message: message
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            addChatMessage(data.message.username, data.message.message, data.message.time);
            messageInput.value = '';
        }
    });
}

// 处理回车发送消息
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// 同步进度
function syncWithHost() {
    fetch('server.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'status',
            roomId: currentRoom,
            lastUpdate: 0
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const video = document.getElementById('videoPlayer');
            video.currentTime = data.currentTime;
        }
    });
}

// 添加聊天消息
function addChatMessage(username, message, time) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.innerHTML = `
        <div class="username">${username}</div>
        <div class="time">${time}</div>
        <div class="content">${message}</div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 开始轮询
function startPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
    }
    pollTimer = setInterval(pollRoomStatus, POLL_INTERVAL);
}

// 轮询房间状态
function pollRoomStatus() {
    if (!currentRoom) return;

    fetch('server.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
            action: 'status',
            roomId: currentRoom,
            lastUpdate: lastUpdate
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && !data.noChange) {
            lastUpdate = data.lastUpdate;
            
            if (data.currentVideo) {
                const video = document.getElementById('videoPlayer');
                const currentVideoUrl = video.src.split('?')[0]; // 移除时间戳参数
                if (data.currentVideo !== currentVideoUrl) {
                    clearBrowserCache();
                    video.src = `${data.currentVideo}?t=${Date.now()}`;
                    document.getElementById('currentVideo').textContent = 
                        data.currentVideo.split('/').pop();
                }
            }
            
            if (data.messages) {
                const chatMessages = document.getElementById('chatMessages');
                chatMessages.innerHTML = '';
                data.messages.forEach(msg => {
                    addChatMessage(msg.username, msg.message, msg.time);
                });
            }
            
            if (data.members) {
                document.getElementById('onlineCount').textContent = 
                    `在线: ${data.members.length}`;
            }
        }
    })
    .catch(error => {
        console.error('轮询失败:', error);
    });
}

// 切换侧边栏
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
}

// 初始化表情选择器
function initEmojiPicker() {
    const emojiGrid = document.getElementById('emojiGrid');
    emojis.forEach(emoji => {
        const span = document.createElement('span');
        span.className = 'emoji-item';
        span.textContent = emoji;
        span.onclick = () => {
            const messageInput = document.getElementById('messageInput');
            messageInput.value += emoji;
            const modal = bootstrap.Modal.getInstance(document.getElementById('emojiModal'));
            modal.hide();
        };
        emojiGrid.appendChild(span);
    });

    const emojiModal = new bootstrap.Modal(document.getElementById('emojiModal'));
    document.getElementById('emojiButton').onclick = () => emojiModal.show();
}

// 获取当前房间数据
function getRoomData() {
    if (!currentRoom) return null;
    
    return {
        webdav: {
            url: document.getElementById('webdavUrl').value,
            user: document.getElementById('webdavUser').value,
            pass: document.getElementById('webdavPass').value
        }
    };
}

// 页面加载时的初始化
document.addEventListener('DOMContentLoaded', function() {
    // 确保在DOM加载完成后初始化所有模态框和功能
    initEmojiPicker();
    initVideoSelector();
    
    // 检查自动登录
    const savedUser = getCookie('user');
    if (savedUser) {
        fetch('auth_handler.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'check',
                username: savedUser
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentUser = data.username;
                document.getElementById('authForm').style.display = 'none';
                document.getElementById('roomForm').style.display = 'block';
                document.getElementById('username').value = currentUser;
                document.getElementById('username').readOnly = true;
            }
        });
    }
    
    // 添加视频错误处理
    const video = document.getElementById('videoPlayer');
    video.addEventListener('error', function(e) {
        console.error('Video error:', e);
        clearBrowserCache();
        // 尝试重新加载视频
        if (video.src) {
            const currentSrc = video.src.split('?')[0];
            video.src = `${currentSrc}?t=${Date.now()}`;
        }
    });
});

// 页面关闭时的清理
window.addEventListener('beforeunload', function() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    currentRoom = null;
    lastUpdate = 0;
});

// 定期清理缓存
setInterval(clearBrowserCache, CACHE_DURATION);

// 用户注册
function register() {
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value.trim();

    if (!username || !password) {
        alert('用户名和密码不能为空');
        return;
    }

    fetch('auth_handler.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'register',
            username: username,
            password: password
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('注册成功');
            currentUser = username;
            document.getElementById('authForm').style.display = 'none';
            document.getElementById('roomForm').style.display = 'block';
            document.getElementById('username').value = currentUser;
            document.getElementById('username').readOnly = true;
        } else {
            alert(data.message || '注册失败');
        }
    });
}

// 用户登录
function login() {
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value.trim();

    if (!username || !password) {
        alert('用户名和密码不能为空');
        return;
    }

    fetch('auth_handler.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'login',
            username: username,
            password: password
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('登录成功');
            currentUser = username;
            document.getElementById('authForm').style.display = 'none';
            document.getElementById('roomForm').style.display = 'block';
            document.getElementById('username').value = currentUser;
            document.getElementById('username').readOnly = true;
        } else {
            alert(data.message || '登录失败');
        }
    });
} 