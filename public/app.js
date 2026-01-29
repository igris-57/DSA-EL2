/**
 * Advanced GitHub Analytics - Dashboard Logic
 * Powered by Fenwick Tree (BIT) on the backend.
 */

// --- Global Constants & State ---
const API_BASE = 'http://localhost:3000/api';
const REFRESH_INTERVAL = 10000; // Poll backend every 10s for UI updates

const state = {
    stats: null,
    liveEvents: [],
    chart: null,
    isFetching: false
};

// --- DOM Elements ---
const elements = {
    stats: {
        '5min': document.getElementById('stat-5min'),
        '15min': document.getElementById('stat-15min'),
        '60min': document.getElementById('stat-60min'),
        'peak': document.getElementById('stat-peak'),
        'peakTime': document.getElementById('peak-time')
    },
    eventList: document.getElementById('event-list'),
    chartCanvas: document.getElementById('distribution-chart')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initTabs();
    initChart();
    updateDashboard();
    setInterval(updateDashboard, REFRESH_INTERVAL);
});

/**
 * 1. Theme Management (Dark/Light Mode)
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    }
    updateThemeIcon(savedTheme);

    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const isLight = document.body.classList.toggle('light-theme');
            const newTheme = isLight ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
            updateChartTheme(newTheme);
        });
    }
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (icon) {
        icon.className = theme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

/**
 * 2. Tab Management
 */
function initTabs() {
    const tabLinks = document.querySelectorAll('.nav-item');
    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tabId = link.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    // Update Nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-link-${tabId}`).classList.add('active');

    // Update Content
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

/**
 * 3. Initialize Chart.js
 */
function initChart() {
    if (!elements.chartCanvas) return;

    const theme = localStorage.getItem('theme') || 'dark';
    const textColor = theme === 'light' ? '#64748b' : '#9ca3af';
    const gridColor = theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';

    state.chart = new Chart(elements.chartCanvas, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Event Count (Last Hour)',
                data: [],
                backgroundColor: 'rgba(139, 92, 246, 0.4)',
                borderColor: 'rgba(139, 92, 246, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function updateChartTheme(theme) {
    if (!state.chart) return;
    const textColor = theme === 'light' ? '#64748b' : '#9ca3af';
    const gridColor = theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';

    state.chart.options.scales.y.ticks.color = textColor;
    state.chart.options.scales.y.grid.color = gridColor;
    state.chart.options.scales.x.ticks.color = textColor;
    state.chart.update();
}

/**
 * 2. Update Dashboard - Fetch from Backend
 */
async function updateDashboard() {
    if (state.isFetching) return;
    state.isFetching = true;

    try {
        // Fetch Live Stream
        const streamRes = await fetch(`${API_BASE}/events/live`);
        const liveEvents = await streamRes.json();
        renderStream(liveEvents);

        // Fetch BIT Analytics
        const statsRes = await fetch(`${API_BASE}/stats/dashboard`);
        const stats = await statsRes.json();
        renderStats(stats);
        updateChart(stats.distribution);

    } catch (err) {
        console.error('Failed to update dashboard:', err);
    } finally {
        state.isFetching = false;
    }
}

/**
 * 3. Render BIT Stats
 */
function renderStats(stats) {
    if (elements.stats['5min']) elements.stats['5min'].textContent = stats.last5min;
    if (elements.stats['15min']) elements.stats['15min'].textContent = stats.last15min;
    if (elements.stats['60min']) elements.stats['60min'].textContent = stats.last60min;

    if (elements.stats['peak']) {
        elements.stats['peak'].textContent = stats.peak.count;
    }
    if (elements.stats['peakTime']) {
        elements.stats['peakTime'].textContent = `${stats.peak.minutesAgo} mins ago`;
    }

    // Handle Rate Limit Notice
    const disclaimer = document.querySelector('.disclaimer');
    if (disclaimer && stats.api) {
        if (stats.api.isRateLimited) {
            const resetTime = new Date(stats.api.resetTime * 1000).toLocaleTimeString();
            disclaimer.style.color = 'var(--color-error)';
            disclaimer.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Rate Limited. Resets at ${resetTime}. Add GITHUB_TOKEN to .env to fix.`;
        } else {
            disclaimer.style.color = ''; // Reset
            disclaimer.innerHTML = `<i class="fas fa-info-circle"></i> Events reflect real GitHub activity and may appear with short delays due to API behavior.`;
        }
    }
}

/**
 * 4. Update Distribution Chart
 */
function updateChart(distribution) {
    if (!state.chart) return;

    const labels = Object.keys(distribution);
    const data = Object.values(distribution);

    state.chart.data.labels = labels;
    state.chart.data.datasets[0].data = data;
    state.chart.update();
}

/**
 * 5. Render Live Stream
 */
function renderStream(events) {
    const list = elements.eventList;
    if (!list) return;

    list.innerHTML = '';

    if (events.length === 0) {
        list.innerHTML = `<li class="event-item" style="justify-content: center; opacity: 0.5;">Waiting for GitHub events...</li>`;
        return;
    }

    events.forEach(evt => {
        const li = document.createElement('li');
        li.className = 'event-item';

        const type = evt.type.replace('Event', '');
        const createdTime = formatRelativeTime(new Date(evt.created_at));
        const ingestedTime = new Date(evt.ingested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        li.innerHTML = `
            <div style="display:flex; flex-direction:column; gap: 0.25rem; flex: 1;">
                <div style="display:flex; align-items:center; gap: 1rem;">
                    <span class="badge ${type}">${type}</span>
                    <span style="font-size: 0.85rem; color: var(--text-primary);">
                        <strong>${evt.actor.display_login}</strong> at <i>${evt.repo.name}</i>
                    </span>
                </div>
                <div style="font-size: 0.7rem; color: var(--text-secondary); margin-left: 115px; opacity: 0.6;">
                    Event Time (GitHub): ${createdTime} | Received by Server: ${ingestedTime}
                </div>
            </div>
            <span class="time">${createdTime}</span>
        `;
        list.appendChild(li);
    });
}

/**
 * Helper: Format Relative Time
 */
function formatRelativeTime(date) {
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
