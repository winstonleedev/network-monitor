const controlsForm = document.getElementById('controls');
const timelineEl = document.getElementById('timeline');
const legendEl = document.getElementById('legend');
const presetSelect = document.getElementById('presetRange');
const startInput = document.getElementById('customStart');
const endInput = document.getElementById('customEnd');
const presetContainer = document.querySelector('.preset-picker');
const customContainer = document.querySelector('.custom-range');
const tooltip = createTooltip();

const PRESETS = {
  '1h': { label: 'Last 1 hour', hours: 1 },
  '6h': { label: 'Last 6 hours', hours: 6 },
  '24h': { label: 'Last 24 hours', hours: 24 },
  '7d': { label: 'Last 7 days', hours: 24 * 7 },
};

init();

function init() {
  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - PRESETS['6h'].hours * 60 * 60 * 1000);
  startInput.value = toLocalInputValue(sixHoursAgo);
  endInput.value = toLocalInputValue(now);

  controlsForm.addEventListener('change', handleModeChange);
  controlsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    loadTimeline();
  });

  loadTimeline();
}

function handleModeChange(event) {
  if (event.target.name === 'rangeMode') {
    const mode = event.target.value;
    presetContainer.dataset.visible = mode === 'preset';
    customContainer.dataset.visible = mode === 'custom';
  }
}

async function loadTimeline() {
  timelineEl.textContent = 'Loading ping history…';
  legendEl.textContent = '';
  try {
    const { start, end } = buildRangePayload();
    const response = await fetch(`/api/status?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch status');
    }
    const payload = await response.json();
    renderTimeline(payload);
    renderLegend(payload.intervalMinutes);
  } catch (error) {
    timelineEl.textContent = error.message;
  }
}

function buildRangePayload() {
  const selectedMode = controlsForm.elements['rangeMode'].value;
  if (selectedMode === 'preset') {
    const preset = PRESETS[presetSelect.value];
    const end = new Date();
    const start = new Date(end.getTime() - preset.hours * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  const startDate = startInput.value ? new Date(startInput.value) : null;
  const endDate = endInput.value ? new Date(endInput.value) : null;

  if (!startDate || !endDate || startDate >= endDate) {
    throw new Error('Select a valid custom time range.');
  }

  return { start: startDate.toISOString(), end: endDate.toISOString() };
}

function renderTimeline(payload) {
  const startMs = Date.parse(payload.start);
  const endMs = Date.parse(payload.end);
  const intervalMinutes = payload.intervalMinutes;

  const blocks = bucketize(payload.results, startMs, endMs, intervalMinutes);
  timelineEl.innerHTML = '';

  if (!blocks.length) {
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'No ping data yet for this window.';
    timelineEl.appendChild(placeholder);
    return;
  }

  blocks.forEach((block) => {
    const span = document.createElement('span');
    span.className = `block block-${block.state}`;
    span.textContent = block.emoji;
    const tooltipText = `${formatTimestamp(block.startMs)} → ${formatTimestamp(block.endMs)}`;
    span.dataset.tooltip = tooltipText;
    span.addEventListener('pointerenter', (event) => showTooltip(tooltipText, event));
    span.addEventListener('pointermove', positionTooltip);
    span.addEventListener('pointerleave', hideTooltip);
    timelineEl.appendChild(span);
  });
}

function bucketize(results, startMs, endMs, intervalMinutes) {
  const intervalMs = intervalMinutes * 60 * 1000;
  const bucketCount = Math.max(1, Math.ceil((endMs - startMs) / intervalMs));
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = startMs + index * intervalMs;
    return {
      startMs: bucketStart,
      endMs: Math.min(bucketStart + intervalMs, endMs),
      successes: 0,
      failures: 0,
    };
  });

  results.forEach((entry) => {
    const idx = Math.floor((entry.timestampMs - startMs) / intervalMs);
    if (idx < 0 || idx >= buckets.length) {
      return;
    }
    if (entry.success) {
      buckets[idx].successes += 1;
    } else {
      buckets[idx].failures += 1;
    }
  });

  return buckets.map((bucket) => {
    if (bucket.failures > 0) {
      return { ...bucket, state: 'fail', emoji: '🟥' };
    }
    if (bucket.successes > 0) {
      return { ...bucket, state: 'success', emoji: '🟩' };
    }
    return { ...bucket, state: 'idle', emoji: '⬜️' };
  });
}

function renderLegend(intervalMinutes) {
  legendEl.innerHTML = '';
  const blockDurationLabel = intervalMinutes === 1 ? '1 minute' : intervalMinutes === 10 ? '10 minutes' : '1 hour';

  const items = [
    { emoji: '🟩', text: 'Successful ping' },
    { emoji: '🟥', text: 'Ping failure logged' },
    { emoji: '⬜️', text: 'No samples recorded' },
    { emoji: '⏱️', text: `Each block = ${blockDurationLabel}` },
  ];

  items.forEach((item) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'legend-item';

    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.textContent = item.emoji;

    const text = document.createElement('span');
    text.textContent = item.text;

    wrapper.append(swatch, text);
    legendEl.appendChild(wrapper);
  });
}

function formatTimestamp(ms) {
  const date = new Date(ms);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function toLocalInputValue(date) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 16);
}

function createTooltip() {
  const el = document.createElement('div');
  el.className = 'tooltip';
  el.setAttribute('role', 'tooltip');
  el.style.opacity = '0';
  document.body.appendChild(el);
  return el;
}

function showTooltip(text, event) {
  tooltip.textContent = text;
  tooltip.style.opacity = '1';
  positionTooltip(event);
}

function positionTooltip(event) {
  const offset = 14;
  tooltip.style.left = `${event.clientX + offset}px`;
  tooltip.style.top = `${event.clientY + offset}px`;
}

function hideTooltip() {
  tooltip.style.opacity = '0';
}
