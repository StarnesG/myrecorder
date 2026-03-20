// 通过 window.Capacitor.Plugins 访问插件，无需 import
// Capacitor 在 iOS WebView 初始化时会将所有原生插件注册到此对象
// 这样完全绕开 Vite/Rollup 的模块解析，也不依赖插件的 dist 构建产物

function getPlugins() {
  const plugins = window?.Capacitor?.Plugins;
  if (!plugins) {
    console.warn('Capacitor Plugins not available — running in browser without native support');
    return null;
  }
  return plugins;
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const btnRecord  = document.getElementById('btn-record');
const btnLabel   = document.getElementById('btn-label');
const statusEl   = document.getElementById('status');
const timerEl    = document.getElementById('timer');
const recList    = document.getElementById('recordings-list');
const emptyHint  = document.getElementById('empty-hint');

// ── State ─────────────────────────────────────────────────────────────────────
let isRecording    = false;
let timerInterval  = null;
let elapsedSeconds = 0;
const recordings   = [];

// ── Timer ─────────────────────────────────────────────────────────────────────
function fmt(sec) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

function startTimer() {
  elapsedSeconds = 0;
  timerEl.textContent = '00:00';
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    timerEl.textContent = fmt(elapsedSeconds);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

// ── UI ────────────────────────────────────────────────────────────────────────
function setRecordingUI(recording) {
  isRecording = recording;
  btnRecord.textContent = recording ? '⏹' : '🎙';
  btnRecord.classList.toggle('recording', recording);
  btnLabel.textContent  = recording ? '点击停止录音' : '点击开始录音';
  document.body.classList.toggle('recording', recording);
  statusEl.textContent  = recording ? '正在录音...' : '准备就绪';
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

// ── Recordings list ───────────────────────────────────────────────────────────
function addToList(entry) {
  emptyHint.style.display = 'none';

  const li   = document.createElement('li');
  li.className = 'recording-item';

  const info = document.createElement('span');
  info.className   = 'recording-info';
  info.textContent = `${entry.name}  (${fmt(Math.round(entry.duration / 1000))})`;

  const btnPlay = document.createElement('button');
  btnPlay.textContent = '▶ 播放';
  btnPlay.className   = 'btn-small';
  btnPlay.onclick = () => {
    const audio = new Audio(`data:${entry.mimeType};base64,${entry.base64}`);
    audio.play();
  };

  const btnSave = document.createElement('button');
  btnSave.textContent = '💾 保存';
  btnSave.className   = 'btn-small btn-save';
  btnSave.onclick = () => saveRecording(entry);

  li.append(info, btnPlay, btnSave);
  recList.appendChild(li);
}

// ── Save via share sheet ──────────────────────────────────────────────────────
async function saveRecording(entry) {
  const plugins = getPlugins();
  if (!plugins) { setStatus('原生功能不可用'); return; }

  try {
    setStatus('正在保存...');

    const { uri } = await plugins.Filesystem.writeFile({
      path:      entry.name,
      data:      entry.base64,
      directory: 'DOCUMENTS',
      recursive: true,
    });

    await plugins.Share.share({
      title:      entry.name,
      url:        uri,
      dialogTitle: '保存录音文件',
    });

    setStatus('准备就绪');
  } catch (err) {
    console.error('Save failed:', err);
    setStatus('保存失败，请重试');
  }
}

// ── Permission ────────────────────────────────────────────────────────────────
async function ensurePermission() {
  const plugins = getPlugins();
  if (!plugins) {
    setStatus('原生功能不可用（请在 iOS 设备上运行）');
    return false;
  }

  const { value: canRecord } = await plugins.VoiceRecorder.canDeviceVoiceRecord();
  if (!canRecord) { setStatus('此设备不支持录音'); return false; }

  const { value: hasPerm } = await plugins.VoiceRecorder.hasAudioRecordingPermission();
  if (hasPerm) return true;

  const { value: granted } = await plugins.VoiceRecorder.requestAudioRecordingPermission();
  if (!granted) { setStatus('麦克风权限被拒绝，请在设置中开启'); return false; }
  return true;
}

// ── Record / Stop ─────────────────────────────────────────────────────────────
async function startRecording() {
  const ok = await ensurePermission();
  if (!ok) return;

  const plugins = getPlugins();
  try {
    await plugins.VoiceRecorder.startRecording();
    setRecordingUI(true);
    startTimer();
  } catch (err) {
    console.error('startRecording:', err);
    setStatus(`录音启动失败: ${err?.message ?? err}`);
  }
}

async function stopRecording() {
  stopTimer();
  setStatus('处理中...');

  const plugins = getPlugins();
  try {
    const { value } = await plugins.VoiceRecorder.stopRecording();
    setRecordingUI(false);

    if (!value.recordDataBase64) { setStatus('录音数据为空'); return; }

    const ext = (value.mimeType.includes('mp4') || value.mimeType.includes('m4a')) ? 'm4a' : 'aac';
    const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    const entry = {
      name:     `recording-${ts}.${ext}`,
      base64:   value.recordDataBase64,
      mimeType: value.mimeType,
      duration: value.msDuration,
    };

    recordings.push(entry);
    addToList(entry);
    setStatus('录音完成');
  } catch (err) {
    console.error('stopRecording:', err);
    setRecordingUI(false);
    setStatus(`录音停止失败: ${err?.message ?? err}`);
  }
}

// ── Interruption listeners ────────────────────────────────────────────────────
function registerListeners() {
  const plugins = getPlugins();
  if (!plugins?.VoiceRecorder) return;

  plugins.VoiceRecorder.addListener('voiceRecordingInterrupted', () => {
    stopTimer();
    setStatus('录音被中断（如来电），点击停止以保存');
    btnRecord.textContent = '⏹';
  });

  plugins.VoiceRecorder.addListener('voiceRecordingInterruptionEnded', () => {
    setStatus('中断结束，点击停止以保存录音');
  });
}

// Capacitor 7 在 iOS WebView 中就绪后插件才可用，兜底立即尝试一次
if (window.Capacitor) {
  registerListeners();
}

// ── Button ────────────────────────────────────────────────────────────────────
btnRecord.addEventListener('click', () => {
  isRecording ? stopRecording() : startRecording();
});
