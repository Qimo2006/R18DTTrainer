// ===================================================================
// 获取页面元素
// ===================================================================
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const statusDiv = document.getElementById('status');
const startButton = document.getElementById('startButton');
const brightnessValueSpan = document.getElementById('brightnessValue');
const smoothedValueSpan = document.getElementById('smoothedValue');
const cameraIndicator = document.getElementById('cameraIndicator');

// ===================================================================
// 全局状态变量
// ===================================================================
let isDetecting = false;
let brightnessHistory = [];

// ===================================================================
// 配置参数 (请根据您的环境进行调整)
// ===================================================================
const CONFIG = {
    // 亮度阈值：当中心区域平滑后的亮度低于此值时，判定为物体靠近。
    // 【重要】每次更换环境或设备后，都需要重新校准此值！
    BRIGHTNESS_THRESHOLD: 90, 

    // 平滑窗口大小：用于计算移动平均值的样本数量。
    // 增大此值可以让检测结果更平滑，抗干扰性更强，但会增加响应延迟。
    AVERAGING_WINDOW_SIZE: 10,

    // 检测间隔（毫秒）：多久进行一次亮度检测。
    CHECK_INTERVAL: 100,

    // 检测区域比例：取画面中心多少比例的区域进行亮度计算。
    // 0.5 表示取中心 50% x 50% 的区域。
    DETECTION_ZONE_SIZE_RATIO: 0.5,

    // 摄像头约束：用于请求特定的摄像头和功能。
    VIDEO_CONSTRAINTS: {
        video: {
            facingMode: 'user', // 'user'为前置摄像头, 'environment'为后置摄像头
            // 【警告】尝试禁用自动对焦以提升稳定性。
            // 并非所有浏览器和设备都支持此功能，如果无效，浏览器会忽略它。
            focusMode: 'manual'
        }
    }
};

// ===================================================================
// 事件监听器
// ===================================================================
startButton.addEventListener('click', () => {
    if (!isDetecting) {
        startDetection();
    } else {
        stopDetection();
    }
});

// ===================================================================
// 核心功能函数
// ===================================================================

/**
 * 启动摄像头和检测流程
 */
async function startDetection() {
    try {
        // 请求摄像头权限并应用约束
        const stream = await navigator.mediaDevices.getUserMedia(CONFIG.VIDEO_CONSTRAINTS);
        video.srcObject = stream;
        
        // 等待视频元数据加载完成
        video.onloadedmetadata = () => {
            isDetecting = true;
            startButton.textContent = '停止检测';
            statusDiv.textContent = '状态：正在检测...';
            statusDiv.className = '';
            brightnessHistory = []; // 重置历史记录
            
            // 点亮摄像头状态指示灯
            cameraIndicator.classList.add('active');
            
            // 开始检测循环
            detectBrightness();
        };
    } catch (err) {
        console.error("无法访问摄像头: ", err);
        let errorMessage = '状态：无法访问摄像头。';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDismissedError') {
            errorMessage += '请在浏览器和手机系统设置中允许摄像头权限。';
        } else if (err.name === 'NotFoundError') {
            errorMessage += '未找到可用的摄像头设备。';
        } else {
            errorMessage += `错误: ${err.message}`;
        }
        statusDiv.textContent = errorMessage;
        statusDiv.style.backgroundColor = '#ffc107';
    }
}

/**
 * 停止检测并释放摄像头资源
 */
function stopDetection() {
    isDetecting = false;
    startButton.textContent = '开始检测';
    statusDiv.textContent = '状态：已停止';
    statusDiv.className = '';
    
    // 熄灭摄像头状态指示灯
    cameraIndicator.classList.remove('active');
    
    // 停止所有视频轨道
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    
    // 重置数据和显示
    brightnessHistory = [];
    brightnessValueSpan.textContent = '-';
    smoothedValueSpan.textContent = '-';
}

/**
 * 核心检测函数：计算中心区域亮度并判断
 */
function detectBrightness() {
    // 如果检测已停止，则退出循环
    if (!isDetecting) {
        return;
    }

    // 1. 将当前视频帧绘制到画布上
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // 2. 计算中心检测区域的坐标和尺寸
    const zoneWidth = canvas.width * CONFIG.DETECTION_ZONE_SIZE_RATIO;
    const zoneHeight = canvas.height * CONFIG.DETECTION_ZONE_SIZE_RATIO;
    const startX = (canvas.width - zoneWidth) / 2;
    const startY = (canvas.height - zoneHeight) / 2;

    // 3. 只获取中心区域的图像数据
    const imageData = context.getImageData(startX, startY, zoneWidth, zoneHeight);
    const data = imageData.data;

    // 4. 计算当前帧的平均亮度
    let totalBrightness = 0;
    const pixelCount = data.length / 4;
    for (let i = 0; i < pixelCount; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        // 使用更符合人眼感知的亮度计算公式
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        totalBrightness += brightness;
    }
    const currentBrightness = totalBrightness / pixelCount;
    brightnessValueSpan.textContent = currentBrightness.toFixed(2);

    // 5. 使用移动平均法平滑亮度数据
    brightnessHistory.push(currentBrightness);
    if (brightnessHistory.length > CONFIG.AVERAGING_WINDOW_SIZE) {
        brightnessHistory.shift(); // 移除最旧的记录
    }

    let smoothedBrightness = 0;
    for (const value of brightnessHistory) {
        smoothedBrightness += value;
    }
    smoothedBrightness /= brightnessHistory.length;
    smoothedValueSpan.textContent = smoothedBrightness.toFixed(2);

    // 6. 判断平滑后的亮度是否低于阈值，并更新状态
    if (smoothedBrightness < CONFIG.BRIGHTNESS_THRESHOLD && brightnessHistory.length >= CONFIG.AVERAGING_WINDOW_SIZE) {
        statusDiv.textContent = `状态：检测到物体靠近！ (中心亮度: ${smoothedBrightness.toFixed(2)})`;
        statusDiv.className = 'approaching';
    } else {
        statusDiv.textContent = `状态：环境正常 (中心亮度: ${smoothedBrightness.toFixed(2)})`;
        statusDiv.className = '';
    }

    // 7. 设置下一次检测
    setTimeout(detectBrightness, CONFIG.CHECK_INTERVAL);
}
