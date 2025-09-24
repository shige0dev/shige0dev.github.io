const bpmSlider = document.getElementById('bpm-slider');
const bpmDisplay = document.getElementById('bpm-display');
const toggleBtn = document.getElementById('toggle-btn');

let bpm = parseInt(bpmSlider.value);
let isRunning = false;
let intervalId = null;
let audioContext = null;

function updateDisplay() {
  bpmDisplay.textContent = `BPM: ${bpm}`;
}

function playClick() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  const osc = audioContext.createOscillator();
  const envelope = audioContext.createGain();

  osc.frequency.value = 1000;
  envelope.gain.setValueAtTime(1, audioContext.currentTime);
  envelope.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);

  osc.connect(envelope);
  envelope.connect(audioContext.destination);

  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + 0.1);
}

function startMetronome() {
  const interval = (60 / bpm) * 1000;
  intervalId = setInterval(playClick, interval);
}

function stopMetronome() {
  clearInterval(intervalId);
}

bpmSlider.addEventListener('input', () => {
  bpm = parseInt(bpmSlider.value);
  updateDisplay();

  if (isRunning) {
    stopMetronome();
    startMetronome();
  }
});

toggleBtn.addEventListener('click', () => {
  isRunning = !isRunning;
  toggleBtn.textContent = isRunning ? 'STOP' : 'START';

  if (isRunning) {
    startMetronome();
  } else {
    stopMetronome();
  }
});

updateDisplay(); // 初期表示
