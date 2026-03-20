import { VoiceRecorder } from 'capacitor-voice-recorder';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
// ── DOM refs ──────────────────────────────────────────────────────────────────
const btnRecord = document.getElementById('btn-record');
const btnLabel = document.getElementById('btn-label');
const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const recordingsList = document.getElementById('recordings-list');
const emptyHint = document.getElementById('empty-hint');

// ── State ─────────────────────────────────────────────────────────────────────
let isRecording = false;
let timerInterval = null;
let elapsedSeconds = 0;

const recordings = [];

// ── Timer helpers ─────────────────────────────────────────────────────────────
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function startTimer() {
  elapsedSeconds = 0;
  timerEl.textContent = '00:00';
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    timerEl.textContent = formatTime(elapsedSeconds);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ── UI state ──────────────────────────────────────────────────────────────────
function setRecordingUI(recording) {
  isRecording = recording;
  btnRecord.textContent = recording ? '⏹' : '🎙';
  btnRecord.classList.toggle('recording', recording);
  btnLabel.textContent = recording ? '点击停止录音' : '点击开始录音';
  document.body.classList.toggle('recording', recording);
  statusEl.textContent = recording ? '正在录音...' : '准备就绪';
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

// ── Recordings list ───────────────────────────────────────────────────────────
function addRecordingToList(entry) {
  const li = document.createElement('li');
  li.className = 'recording-item';

  const durationSec = Math.round(entry.duration / 1000);
  const info = document.createElement('span');
  info.className = 'recording-info';
  info.textContent = `${entry.name}  (${formatTime(durationSec)})`;

  // Play button
  const btnPlay = document.createElement('button');
  btnPlay.textContent = '▶ 播放';
  btnPlay.className = 'btn-small';
  btnPlay.addEventListener('click', () => {
    const audio = new Audio(`data:${entry.mimeType};base64,${entry.base64}`);
    audio.play();
  });

  // Save button — writes to Documents and opens share sheet so user can save to Files app
  const btnSave = document.createElement('button');
  btnSave.textContent = '💾 保存';
  btnSave.className = 'btn-small btn-save';
  btnSave.addEventListener('click', () => saveRecording(entry));

  li.appendChild(info);
  li.appendChild(btnPlay);
  li.appendChild(btnSave);
  recordingsList.appendChild(li);
}

async function saveRecording(entry) {
  try {
    setStatus('正在保存...');

    // Write to app's Documents directory
    const result = await Filesystem.writeFile({
      path: entry.name,
      data: entry.base64,
      directory: Directory.Documents,
      recursive: true,
    });

    // Open iOS share sheet so user can save to Files / AirDrop / etc.
    await Share.share({
      title: entry.name,
      url: result.uri,
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
  const { value: canRecord } = await VoiceRecorder.canDeviceVoiceRecord();
  if (!canRecord) {
    setStatus('此设备不支持录音');
    return false;
  }

  const { value: hasPermission } = await VoiceRecorder.hasAudioRecordingPermission();
  if (hasPermission) return true;

  const { value: granted } = await VoiceRecorder.requestAudioRecordingPermission();
  if (!granted) {
    setStatus('麦克风权限被拒绝，请在设置中开启');
    return false;
  }
  return true;
}

// ── Record / Stop ─────────────────────────────────────────────────────────────
async function startRecording() {
  const ok = await ensurePermission();
  if (!ok) return;

  try {
    await VoiceRecorder.startRecording();
    setRecordingUI(true);
    startTimer();
  } catch (err) {
    console.error('startRecording error:', err);
    setStatus(`录音启动失败: ${err?.message ?? err}`);
  }
}

async function stopRecording() {
  stopTimer();
  setStatus('处理中...');

  try {
    const { value } = await VoiceRecorder.stopRecording();
    setRecordingUI(false);

    if (!value.recordDataBase64) {
      setStatus('录音数据为空');
      return;
    }

    // Derive file extension from mime type
    const ext = value.mimeType.includes('mp4') || value.mimeType.includes('m4a')
      ? 'm4a'
      : 'aac';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `recording-${timestamp}.${ext}`;

    const entry = {
      name: filename,
      base64: value.recordDataBase64,
      mimeType: value.mimeType,
      duration: value.msDuration,
    };

    recordings.push(entry);
    emptyHint.style.display = 'none';
    addRecordingToList(entry);
    setStatus('录音完成');
  } catch (err) {
    console.error('stopRecording error:', err);
    setRecordingUI(false);
    setStatus(`录音停止失败: ${err?.message ?? err}`);
  }
}

// ── Interruption listeners ────────────────────────────────────────────────────
VoiceRecorder.addListener('voiceRecordingInterrupted', () => {
  stopTimer();
  setStatus('录音被中断（如来电），点击继续或停止');
  btnRecord.textContent = '⏹ 停止录音';
});

VoiceRecorder.addListener('voiceRecordingInterruptionEnded', () => {
  setStatus('中断结束，点击停止以保存录音');
});

// ── Button handler ────────────────────────────────────────────────────────────
btnRecord.addEventListener('click', () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});
