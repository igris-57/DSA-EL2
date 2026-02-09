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
    isFetching: false,
    bitTrace: []
};

// --- DOM Elements ---
const elements = {
    stats: {
        '10min': document.getElementById('stat-10min'),
        '15min': document.getElementById('stat-15min'),
        '60min': document.getElementById('stat-60min'),
        'peak': document.getElementById('stat-peak'),
        'peakTime': document.getElementById('peak-time')
    },
    eventList: document.getElementById('event-list'),
    chartCanvas: document.getElementById('distribution-chart'),
    repoLeaderboard: document.getElementById('repo-leaderboard'),
    bitVisualizer: document.getElementById('bit-visualizer'),
    bitTrace: document.getElementById('bit-trace')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initTabs();
    initCharts();
    updateDashboard();
    setInterval(updateDashboard, REFRESH_INTERVAL);
});

/**
 * 1. Theme Management
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') document.body.classList.add('light-theme');
    updateThemeIcon(savedTheme);

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light-theme');
        const theme = isLight ? 'light' : 'dark';
        localStorage.setItem('theme', theme);
        updateThemeIcon(theme);
        updateChartsTheme(theme);
    });
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (icon) icon.className = theme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
}

/**
 * 2. Tab Management
 */
function initTabs() {
    document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', () => {
            const tabId = link.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-link-${tabId}`).classList.add('active');
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

/**
 * 3. Charts Initialization
 */
function initCharts() {
    const theme = localStorage.getItem('theme') || 'dark';
    const textColor = theme === 'light' ? '#64748b' : '#9ca3af';
    const gridColor = theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';

    // Distribution Chart
    if (elements.chartCanvas) {
        state.chart = new Chart(elements.chartCanvas, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Events', data: [], backgroundColor: 'rgba(139, 92, 246, 0.4)', borderColor: 'rgba(139, 92, 246, 1)', borderWidth: 1 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } }, x: { grid: { display: false }, ticks: { color: textColor } } }, plugins: { legend: { display: false } } }
        });
    }
}

function updateChartsTheme(theme) {
    const textColor = theme === 'light' ? '#64748b' : '#9ca3af';
    const gridColor = theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    if (state.chart) {
        state.chart.options.scales.y.ticks.color = textColor;
        state.chart.options.scales.y.grid.color = gridColor;
        state.chart.options.scales.x.ticks.color = textColor;
        state.chart.update();
    }
}

/**
 * 4. Data Updates
 */
async function updateDashboard() {
    if (state.isFetching) return;
    state.isFetching = true;

    try {
        const [liveRes, statsRes, extendedRes] = await Promise.all([
            fetch(`${API_BASE}/events/live`),
            fetch(`${API_BASE}/stats/dashboard`),
            fetch(`${API_BASE}/stats/extended`)
        ]);

        const liveEvents = await liveRes.json();
        const stats = await statsRes.json();
        const extended = await extendedRes.json();

        renderStream(liveEvents);
        renderStats(stats);
        renderExtended(extended);
        updateDistributionChart(stats.distribution);

    } catch (err) {
        console.error('Update failed:', err);
    } finally {
        state.isFetching = false;
    }
}

function renderStats(stats) {
    if (elements.stats['10min']) elements.stats['10min'].textContent = stats.last10min;
    if (elements.stats['15min']) elements.stats['15min'].textContent = stats.last15min;
    if (elements.stats['60min']) elements.stats['60min'].textContent = stats.last60min;
    if (elements.stats['peak']) elements.stats['peak'].textContent = stats.peak.count;
    if (elements.stats['peakTime']) elements.stats['peakTime'].textContent = `${stats.peak.minutesAgo} mins ago`;

    // Rate limit handling
    const disclaimer = document.querySelector('.disclaimer');
    if (disclaimer && stats.api) {
        if (stats.api.isRateLimited) {
            disclaimer.style.color = 'var(--color-error)';
            disclaimer.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Rate Limited. Try again later or add token.`;
        } else {
            disclaimer.style.color = '';
            disclaimer.innerHTML = `<i class="fas fa-info-circle"></i> Live GitHub analytics via Fenwick Tree.`;
        }
    }
}

function renderExtended(data) {
    // 1. Repo Leaderboard
    if (elements.repoLeaderboard) {
        elements.repoLeaderboard.innerHTML = data.topRepos.map(repo => `
            <div class="repo-card">
                <div class="repo-info">
                    <h4>${repo.name}</h4>
                    <p>High activity repo</p>
                </div>
                <div class="repo-stat">${repo.count} evts</div>
            </div>
        `).join('');
    }

    // 3. BIT Visualizer
    if (elements.bitVisualizer) {
        const tree = data.bitStructure.main;
        elements.bitVisualizer.innerHTML = tree.map((val, i) => i === 0 ? '' : `
            <div class="bit-node ${val > 0 ? 'active' : ''}" title="Index ${i}: ${val}">
                <span class="idx">${i}</span>
                <span class="val">${val}</span>
            </div>
        `).join('');
    }

    // 3. Trace Log
    if (elements.bitTrace) {
        const totalEvents = data.bitStructure.main.reduce((a, b) => a + b, 0);
        const activeSlots = data.bitStructure.main.filter(v => v > 0).length;
        const log = `[${new Date().toLocaleTimeString()}] BIT Status
────────────────────────────────
Total Events in Window: ${totalEvents}
Active Slots: ${activeSlots} / ${data.bitStructure.size}
Tree Array Size: ${data.bitStructure.main.length}

Fenwick Tree uses 1-based indexing.
Index 0 is unused (always 0).
Each slot represents 1 minute of data.`;
        elements.bitTrace.textContent = log;
    }
}

function updateDistributionChart(dist) {
    if (!state.chart) return;
    state.chart.data.labels = Object.keys(dist);
    state.chart.data.datasets[0].data = Object.values(dist);
    state.chart.update();
}

function renderStream(events) {
    if (!elements.eventList) return;
    if (events.length === 0) {
        elements.eventList.innerHTML = `<li style="text-align:center; padding:2rem; opacity:0.5;">Awaiting data...</li>`;
        return;
    }

    elements.eventList.innerHTML = events.map(evt => {
        const type = evt.type.replace('Event', '');
        return `
            <li class="event-item">
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="badge ${type}">${type}</span>
                        <span style="font-weight:600; font-size:0.85rem;">${evt.actor.login}</span>
                    </div>
                    <div style="font-size:0.75rem; opacity:0.6; margin-left: 148px;">${evt.repo.name}</div>
                </div>
                <span class="time">${formatRelativeTime(new Date(evt.created_at))}</span>
            </li>
        `;
    }).join('');
}

function formatRelativeTime(date) {
    const diff = Math.floor((new Date() - date) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
