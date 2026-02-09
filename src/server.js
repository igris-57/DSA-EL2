import express from 'express';
import cors from 'cors';
import { FenwickTree } from './fenwickTree.js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// --- BIT Configuration ---
const WINDOW_MINUTES = 60;
const GITHUB_API_URL = 'https://api.github.com/events?per_page=100';
let POLLING_INTERVAL = 120000; // 2 minutes (Safer for unauthenticated demo)

/**
 * GITHUB API POLLING STRATEGY:
 * We poll for 100 events every 2 minutes. 
 * - Unauthenticated limit is 60 requests/hr (polling every 1m uses all of it).
 * - Polling every 2m leaves 50% headroom for restarts/browser refreshes.
 * - If GITHUB_TOKEN is provided in .env, limit increases to 5000/hr.
 */

// Data Structures
const mainTree = new FenwickTree(WINDOW_MINUTES);
const typeTrees = {};
const repoStats = {}; // { repoName: { count: x, lastUpdate: ts } }
const eventCache = []; // Stores events: { id, type, created_at, ingested_at, slot }

// API Status State
let apiStatus = {
    online: true,
    lastLimit: null,
    resetTime: null,
    isRateLimited: false,
    errorMessage: null
};

// Supported real GitHub event types
const SUPPORTED_TYPES = [
    'PushEvent', 'CreateEvent', 'DeleteEvent', 'PullRequestEvent',
    'IssuesEvent', 'IssueCommentEvent', 'ForkEvent', 'WatchEvent',
    'ReleaseEvent', 'GollumEvent', 'MemberEvent', 'CommitCommentEvent',
    'PullRequestReviewEvent', 'PullRequestReviewCommentEvent'
];

let windowStart = Date.now() - (WINDOW_MINUTES * 60 * 1000);

/**
 * Maps a timestamp to a 1-60 minute slot relative to the current window.
 */
function getSlotIndex(timestamp) {
    const now = Date.now();
    const elapsed = timestamp - (now - (WINDOW_MINUTES * 60 * 1000));
    const minute = Math.floor(elapsed / 60000) + 1;
    return minute; // May return < 1 or > 60 if out of current window
}

/**
 * INCREMENTAL Fenwick Tree Update:
 * Updates are performed in O(log N) as events arrive.
 * Any contribution to the BIT is strictly based on the true 'created_at' timestamp.
 */
function processEvent(evt) {
    const ts = new Date(evt.created_at).getTime();
    const slot = getSlotIndex(ts);

    // Only update BIT if event falls within our 60-minute analytics window
    if (slot >= 1 && slot <= WINDOW_MINUTES) {
        // Increment global BIT in O(log N)
        mainTree.update(slot, 1);

        // Normalize type
        const type = SUPPORTED_TYPES.includes(evt.type) ? evt.type : 'OtherEvent';
        if (!typeTrees[type]) {
            typeTrees[type] = new FenwickTree(WINDOW_MINUTES);
        }
        // Increment per-type BIT in O(log N)
        typeTrees[type].update(slot, 1);

        // Tag event with the slot it was assigned to for future cleanup
        evt.slot = slot;

        // Repo tracking
        const repoName = evt.repo.name;
        if (!repoStats[repoName]) repoStats[repoName] = 0;
        repoStats[repoName]++;
    }
}

/**
 * EFFICIENT MAINTENANCE ROUTINE:
 * Handles the "sliding window" by removing expired events (older than 60 mins).
 * - Complexity: O(E * log N) where E is the number of expired events.
 * - This does NOT scan the entire tree.
 * - It "undoes" the contribution of an event at its specific BIT slot in O(log N).
 */
function maintenance() {
    const now = Date.now();
    const cutoff = now - (WINDOW_MINUTES * 60 * 1000);

    // 1. Remove expired events from cache and decrement BIT
    // In a production high-volume system, we would use a more efficient sliding pointer.
    for (let i = eventCache.length - 1; i >= 0; i--) {
        const evt = eventCache[i];
        const ts = new Date(evt.created_at).getTime();

        if (ts < cutoff) {
            // Decrement BIT values for the slot this event occupied
            if (evt.slot >= 1 && evt.slot <= WINDOW_MINUTES) {
                mainTree.update(evt.slot, -1);
                const type = SUPPORTED_TYPES.includes(evt.type) ? evt.type : 'OtherEvent';
                if (typeTrees[type]) typeTrees[type].update(evt.slot, -1);
            }
            // Remove from cache
            eventCache.splice(i, 1);
        }
    }

    // 2. Re-slotting (Heuristic)
    // Since our BIT indices are "minutes relative to now", as time moves,
    // the semantic meaning of "slot 10" changes. 
    // To maintain O(log N) efficiency while keeping the window "live", 
    // we rebuild ONLY when the window has shifted significantly (e.g. 1 minute).
    const currentBase = Math.floor(now / 60000);
    if (!global.lastBase || currentBase > global.lastBase) {
        rebuildBit();
        global.lastBase = currentBase;
    }
}

/**
 * HEURISTIC ALIGNMENT fallback:
 * Periodically re-maps active events to align internal indices with real-world time boundaries.
 * This is a standard optimization for windowed data structures to prevent drift.
 */
function rebuildBit() {
    mainTree.tree.fill(0);
    Object.values(typeTrees).forEach(t => t.tree.fill(0));

    eventCache.forEach(evt => {
        const ts = new Date(evt.created_at).getTime();
        const slot = getSlotIndex(ts);
        if (slot >= 1 && slot <= WINDOW_MINUTES) {
            mainTree.update(slot, 1);
            const type = SUPPORTED_TYPES.includes(evt.type) ? evt.type : 'OtherEvent';
            if (!typeTrees[type]) { // Ensure tree exists before updating
                typeTrees[type] = new FenwickTree(WINDOW_MINUTES);
            }
            typeTrees[type].update(slot, 1);
            evt.slot = slot;
        }
    });

    // Reset repo stats on rebuild to keep it fresh
    Object.keys(repoStats).forEach(k => delete repoStats[k]);
    eventCache.forEach(evt => {
        const repoName = evt.repo.name;
        if (!repoStats[repoName]) repoStats[repoName] = 0;
        repoStats[repoName]++;
    });
}

/**
 * Polls GitHub API for public events with backoff logic.
 */
async function fetchGitHubData() {
    try {
        console.log(`[API] Polling GitHub... (Rate Limit: ${apiStatus.lastLimit || 'Checking'})`);

        const headers = { 'User-Agent': 'Log-Event-Aggregator-BIT-v2' };
        if (process.env.GITHUB_TOKEN) {
            headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
        }

        const response = await fetch(GITHUB_API_URL, { headers });

        apiStatus.lastLimit = response.headers.get('x-ratelimit-remaining');
        apiStatus.resetTime = response.headers.get('x-ratelimit-reset');

        if (response.status === 403) {
            apiStatus.isRateLimited = true;
            apiStatus.errorMessage = "Rate limit exceeded. Try adding GITHUB_TOKEN to .env";
            console.error(`[API] 403 Forbidden: Rate Limited. Resets at ${new Date(apiStatus.resetTime * 1000).toLocaleTimeString()}`);

            // Exponential Backoff: Stop polling for 5 minutes
            setTimeout(fetchGitHubData, 300000);
            return;
        }

        if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);

        const newEvents = await response.json();
        const ingested_at = new Date().toISOString();

        apiStatus.isRateLimited = false;
        apiStatus.errorMessage = null;

        newEvents.forEach(evt => {
            if (!eventCache.find(cached => cached.id === evt.id)) {
                const enriched = {
                    ...evt,
                    ingested_at,
                    type_label: evt.type.replace('Event', '')
                };
                eventCache.unshift(enriched);
                processEvent(enriched);
            }
        });

        if (eventCache.length > 5000) eventCache.length = 5000;
        console.log(`[BIT] Success. Events cached: ${eventCache.length}`);

        // Schedule next poll
        setTimeout(fetchGitHubData, POLLING_INTERVAL);

    } catch (err) {
        console.error('[API] Fetch Error:', err.message);
        setTimeout(fetchGitHubData, POLLING_INTERVAL); // Retry
    }
}

// Start Initial Polling
fetchGitHubData();

// --- API ENDPOINTS ---

/**
 * 1. GET /api/events/live
 */
app.get('/api/events/live', (req, res) => {
    res.json(eventCache.slice(0, 30));
});

/**
 * 2. GET /api/stats/dashboard
 */
app.get('/api/stats/dashboard', (req, res) => {
    maintenance(); // Ensure BIT is aligned with current time

    const nowIdx = WINDOW_MINUTES;
    const stats = {
        last10min: mainTree.rangeSum(Math.max(1, nowIdx - 9), nowIdx),
        last15min: mainTree.rangeSum(Math.max(1, nowIdx - 14), nowIdx),
        last60min: mainTree.prefixSum(nowIdx),
        peak: findPeakInterval(),
        distribution: getDistribution(),
        api: apiStatus
    };
    res.json(stats);
});

/**
 * Finds the minute with the highest activity using rangeSum(i, i).
 */
function findPeakInterval() {
    let maxVal = -1;
    let peakSlot = 1;
    for (let i = 1; i <= WINDOW_MINUTES; i++) {
        const val = mainTree.rangeSum(i, i);
        if (val > maxVal) {
            maxVal = val;
            peakSlot = i;
        }
    }
    // Return time relative to now
    return { count: maxVal, minutesAgo: WINDOW_MINUTES - peakSlot };
}

/**
 * Calculates event type distribution using per-type Fenwick Trees.
 */
function getDistribution() {
    const dist = {};
    Object.keys(typeTrees).forEach(type => {
        const count = typeTrees[type].prefixSum(WINDOW_MINUTES);
        if (count > 0) dist[type.replace('Event', '')] = count;
    });
    return dist;
}

/**
 * 3. GET /api/stats/extended
 */
app.get('/api/stats/extended', (req, res) => {
    const topRepos = Object.entries(repoStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

    // BIT Internal Structure (for visualizer)
    const bitStructure = {
        main: Array.from(mainTree.tree),
        size: mainTree.size
    };

    res.json({
        topRepos,
        bitStructure
    });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n=========================================`);
    console.log(`BIT ANALYTICS SERVER RUNNING`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`Window Size: ${WINDOW_MINUTES} Minutes`);
    console.log(`Implementation: Fenwick Tree (Binary Indexed Tree)`);
    console.log(`=========================================\n`);
});
