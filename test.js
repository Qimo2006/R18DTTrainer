// 获取页面元素
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const statusDiv = document.getElementById('status');
const startButton = document.getElementById('startButton');
const brightnessValueSpan = document.getElementById('brightnessValue');
const smoothedValueSpan = document.getElementById('smoothedValue');
const cameraIndicator = document.getElementById('cameraIndicator'); // 获取指示灯

let isDetecting = false;
let brightnessHistory = [];

// --- 配置参数 ---
const BRIGHTNESS_THRESHOLD = 40; // 亮度阈值，需要根据环境光调整！
const AVERAGING_WINDOW_SIZE = 10; // 用于平滑亮度的历史数据窗口大小
const CHECK_INTERVAL = 100; // 检测间隔（毫秒）

// 点击按钮开始/停止检测
startButton.addEventListener('click', () => {
    if (!isDetecting) {
        startDetection();
    } else {
        stopDetection();
    }
});

// 启动摄像头和检测
async function startDetection() {
    try {
        // --- 修改部分 ---
        // 明确请求前置摄像头，这在移动端更可靠
        const constraints = {
            video: {
                facingMode: 'user' // 'user' 是前置, 'environment' 是后置
            }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        // --- 修改结束 ---

        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
            isDetecting = true;
            startButton.textContent = '停止检测';
            statusDiv.textContent = '状态：正在检测...';
            statusDiv.className = '';
            brightnessHistory = [];
            
            cameraIndicator.classList.add('active');
            
            detectBrightness();
        };
    } catch (err) {
        console.error("无法访问摄像头: ", err);
        
        // --- 增强错误提示 ---
        let errorMessage = '状态：无法访问摄像头。';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDismissedError') {
            errorMessage += '请检查浏览器地址栏的权限设置，或手机的系统权限设置。';
        } else if (err.name === 'NotFoundError') {
            errorMessage += '未找到可用的摄像头设备。';
        } else {
            errorMessage += `错误: ${err.message}`;
        }
        statusDiv.textContent = errorMessage;
        statusDiv.style.backgroundColor = '#ffc107';
        // --- 增强结束 ---
    }
}


// 停止检测
function stopDetection() {
    isDetecting = false;
    startButton.textContent = '开始检测';
    statusDiv.textContent = '状态：已停止';
    statusDiv.className = '';
    
    // --- 新增：熄灭指示灯 ---
    cameraIndicator.classList.remove('active');
    
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    brightnessHistory = [];
    brightnessValueSpan.textContent = '-';
    smoothedValueSpan.textContent = '-';
}

// 核心检测函数 (此函数与之前完全相同)
function detectBrightness() {
    if (!isDetecting) {
        return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let totalBrightness = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < pixelCount; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        totalBrightness += brightness;
    }
    const currentBrightness = totalBrightness / pixelCount;
    brightnessValueSpan.textContent = currentBrightness.toFixed(2);

    brightnessHistory.push(currentBrightness);
    if (brightnessHistory.length > AVERAGING_WINDOW_SIZE) {
        brightnessHistory.shift();
    }

    let smoothedBrightness = 0;
    for (const value of brightnessHistory) {
        smoothedBrightness += value;
    }
    smoothedBrightness /= brightnessHistory.length;
    smoothedValueSpan.textContent = smoothedBrightness.toFixed(2);

    if (smoothedBrightness < BRIGHTNESS_THRESHOLD && brightnessHistory.length >= AVERAGING_WINDOW_SIZE) {
        statusDiv.textContent = `状态：检测到物体靠近！ (亮度: ${smoothedBrightness.toFixed(2)})`;
        statusDiv.className = 'approaching';
    } else {
        statusDiv.textContent = `状态：环境正常 (亮度: ${smoothedBrightness.toFixed(2)})`;
        statusDiv.className = '';
    }

    setTimeout(detectBrightness, CHECK_INTERVAL);
}
// JavaScript Document