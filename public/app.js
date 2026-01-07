/**
 * System Log Event Aggregator - Dashboard Logic
 * Handles real-time updates, visualizations, and API interactions.
 */

// --- Global Constants & State ---
const API_BASE = 'http://localhost:3000/api';
const REFRESH_INTERVAL = 2000; // 2 seconds

// State to track previous values for animation
const state = {
    counts: {
        ERROR: 0,
        WARNING: 0,
        INFO: 0,
        DEBUG: 0
    },
    recentEvents: [],
    isFetching: false
};

// --- DOM Elements ---
const elements = {
    counters: {
        ERROR: document.getElementById('count-ERROR'),
        WARNING: document.getElementById('count-WARNING'),
        INFO: document.getElementById('count-INFO'),
        DEBUG: document.getElementById('count-DEBUG'),
    },
    recentEventsList: document.getElementById('event-list'),

    // Query Form
    queryBtn: document.getElementById('btn-query'),
    queryType: document.getElementById('query-type'),
    queryStart: document.getElementById('query-start'),
    queryEnd: document.getElementById('query-end'),
    queryResults: document.getElementById('query-results'),

    // Performance
    perfBtn: document.getElementById('btn-performance'),
    perfResults: document.getElementById('performance-results'),

    // Loading
    loadingOverlay: document.getElementById('loading-overlay')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    init();
});

function init() {
    // Set default query time range (Past 24 hours)
    setDefaultQueryDates();

    // Start polling
    fetchStats();
    setInterval(fetchStats, REFRESH_INTERVAL);

    // Event Listeners
    elements.queryBtn.addEventListener('click', handleQuery);
    elements.perfBtn.addEventListener('click', runPerformanceTest);
}

// --- Core Functions ---

/**
 * 1. Fetch Stats
 * Polls the server for current counts and recent events.
 */
async function fetchStats() {
    if (state.isFetching) return;
    state.isFetching = true;

    try {
        const response = await fetch(`${API_BASE}/stats`);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const data = await response.json();

        // Update UI
        updateCounters(data.counts);
        updateRecentEvents(data.recentEvents);

    } catch (error) {
        console.error('Failed to fetch stats:', error);
    } finally {
        state.isFetching = false;
    }
}

/**
 * 2. Update Counters
 * Animates counter changes.
 */
function updateCounters(newCounts) {
    if (!newCounts) return;

    Object.keys(elements.counters).forEach(type => {
        const el = elements.counters[type];
        if (el) {
            const startVal = state.counts[type] || 0;
            const endVal = newCounts[type] || 0;

            if (startVal !== endVal) {
                animateValue(el, startVal, endVal, 1000);
                state.counts[type] = endVal; // Update state
            }
        }
    });
}

/**
 * 3. Update Recent Events
 * Displays the last 10-20 events with formatting.
 */
function updateRecentEvents(events) {
    if (!events || !Array.isArray(events)) return;

    const list = elements.recentEventsList;
    list.innerHTML = ''; // Clear current

    // Take last 15
    const showEvents = events.slice(0, 15);

    showEvents.forEach(evt => {
        const li = document.createElement('li');
        li.className = 'event-item';

        // Parse date for relative time
        const dateObj = new Date(evt.date);
        const relTime = formatRelativeTime(dateObj);

        li.innerHTML = `
            <div style="display:flex; align-items:center; gap: 1rem;">
                <span class="badge ${evt.type}">${evt.type}</span>
                <span style="font-size: 0.85rem; color: var(--text-primary); opacity: 0.8;">Event ID: ${Math.floor(Math.random() * 10000)}</span>
            </div>
            <span class="time" title="${dateObj.toLocaleString()}">${relTime}</span>
        `;
        list.appendChild(li);
    });
}

/**
 * 4. Handle Query
 * Performs a range query on the backend.
 */
async function handleQuery(e) {
    if (e) e.preventDefault();

    const type = elements.queryType.value;
    const startTimeStr = elements.queryStart.value;
    const endTimeStr = elements.queryEnd.value;

    // Validation
    if (!startTimeStr || !endTimeStr) {
        alert('Please select a valid time range.');
        return;
    }

    const startTime = new Date(startTimeStr).getTime();
    const endTime = new Date(endTimeStr).getTime();

    if (startTime > endTime) {
        alert('Start time cannot be after end time.');
        return;
    }

    showLoading();
    elements.queryResults.classList.add('hidden');

    try {
        const url = `${API_BASE}/query?type=${type}&startTime=${startTime}&endTime=${endTime}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
            renderQueryResultError(data.error);
        } else {
            renderQueryResult(data);
        }
    } catch (err) {
        console.error('Query Error:', err);
        renderQueryResultError('Failed to execute query. Check console.');
    } finally {
        hideLoading();
    }
}

function renderQueryResult(data) {
    const { type, count, timeMs, range } = data;

    // Safety check for undefined
    const safeCount = count !== undefined ? count : 0;
    const safeTime = timeMs !== undefined ? timeMs.toFixed(3) : '0.000';

    elements.queryResults.innerHTML = `
        <div class="result-summary">
            <h3 style="color: var(--color-accent); margin-bottom: 0.5rem;">Query Results</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                    <p class="description">Event Type</p>
                    <strong style="font-size: 1.2rem; color: var(--text-primary)">${type}</strong>
                </div>
                <div>
                     <p class="description">Total Count</p>
                    <strong style="font-size: 1.5rem; color: var(--color-${type.toLowerCase()})">${formatNumber(safeCount)}</strong>
                </div>
                <div>
                    <p class="description">Execution Time</p>
                    <strong style="font-family: monospace; color: var(--color-debug)">${safeTime} ms</strong>
                </div>
                <div>
                     <p class="description">Internal index range</p>
                    <code style="background: rgba(0,0,0,0.3); padding: 2px 5px; border-radius: 4px;">[${range.lIndex}, ${range.rIndex}]</code>
                </div>
            </div>
        </div>
    `;
    elements.queryResults.classList.remove('hidden');
}

function renderQueryResultError(msg) {
    elements.queryResults.innerHTML = `<p style="color: var(--color-error); font-weight: bold;">Error: ${msg}</p>`;
    elements.queryResults.classList.remove('hidden');
}

/**
 * 5. Run Performance Test
 * Compares Fenwick Tree vs Naive approach.
 */
async function runPerformanceTest() {
    showLoading();
    elements.perfResults.classList.add('hidden');

    try {
        const res = await fetch(`${API_BASE}/performance`);
        const data = await res.json();

        elements.perfResults.innerHTML = '';

        Object.keys(data).forEach(type => {
            const metrics = data[type];
            const card = document.createElement('div');
            card.className = 'perf-card';

            // Calculate improvement just for display logic if not provided
            // Speedup is usually (naive / fenwick)

            card.innerHTML = `
                <h4>${type}</h4>
                <div class="perf-metric">
                    <span>Fenwick Tree (O(log n)):</span>
                    <strong style="color: var(--color-accent)">${metrics.fenwickTimeMs.toFixed(4)} ms</strong>
                </div>
                <div class="perf-metric">
                    <span>Naive Loop (O(n)):</span>
                    <strong style="color: var(--text-secondary)">${metrics.naiveTimeMs.toFixed(4)} ms</strong>
                </div>
                <div class="speedup">
                    ${metrics.speedup} Faster
                    <i class="fas fa-bolt"></i>
                </div>
                <div style="margin-top: 5px; font-size: 0.75rem; opacity: 0.5; text-align: right;">
                    ${formatNumber(metrics.iterations)} iterations
                </div>
            `;
            elements.perfResults.appendChild(card);
        });

        elements.perfResults.classList.remove('hidden');

    } catch (err) {
        console.error('Performance Test Error:', err);
        alert('Failed to run performance test.');
    } finally {
        hideLoading();
    }
}

// --- Helper Functions ---

/**
 * 6. Format Relative Time
 * e.g., "5 seconds ago", "2 minutes ago"
 */
function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec} seconds ago`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
}

/**
 * 7. Format Number
 * Adds commas to numbers
 */
function formatNumber(num) {
    return num.toLocaleString('en-US');
}

/**
 * 8. Animate Value
 * Smoothly transitions a number from start to end
 */
function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);

        // Easing (optional, simple linear for now)
        // const ease = 1 - Math.pow(1 - progress, 3); // cubicOut

        const currentVal = Math.floor(progress * (end - start) + start);
        obj.innerHTML = formatNumber(currentVal);

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = formatNumber(end); // Ensure final value is exact
        }
    };
    window.requestAnimationFrame(step);
}

/**
 * 9. Get Event Color
 */
function getEventColor(type) {
    switch (type) {
        case 'ERROR': return 'var(--color-error)';
        case 'WARNING': return 'var(--color-warning)';
        case 'INFO': return 'var(--color-info)';
        case 'DEBUG': return 'var(--color-debug)';
        default: return 'var(--text-primary)';
    }
}

/**
 * 10. Loaders
 */
function showLoading() {
    if (elements.loadingOverlay) elements.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    if (elements.loadingOverlay) elements.loadingOverlay.classList.add('hidden');
}

/**
 * Set Default Query Date Inputs
 */
function setDefaultQueryDates() {
    const now = new Date();
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    const toLocalISO = (d) => {
        const pad = n => n < 10 ? '0' + n : n;
        return d.getFullYear() + '-' +
            pad(d.getMonth() + 1) + '-' +
            pad(d.getDate()) + 'T' +
            pad(d.getHours()) + ':' +
            pad(d.getMinutes());
    };

    if (elements.queryStart) elements.queryStart.value = toLocalISO(past);
    if (elements.queryEnd) elements.queryEnd.value = toLocalISO(now);
}
