import express from 'express';
import cors from 'cors';
import { FenwickTree } from './fenwickTree.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Constants for Time Slots
const TOTAL_SLOTS = 168; // 7 days * 24 hours
const SLOT_DURATION_MS = 60 * 60 * 1000; // 1 hour
// Fixed window end time for this session (prevents shifting logic complexity for demo)
// Current 'Now' is the end of the window.
// Ideally, in a production system, this would be sliding, i.e., relative to Date.now().
// For this demo, we use a reference point of Date.now() at startup.
const SESSION_START_TIME = Date.now();
const WINDOW_START_TIME = SESSION_START_TIME - (TOTAL_SLOTS * SLOT_DURATION_MS);

/** 
 * Maps a timestamp to a 1-based index (1 to 168).
 * Most recent hour (near SESSION_START_TIME) maps to 168.
 * @param {number} timestamp 
 * @returns {number} 1 to 168, or -1 if out of range
 */
function getSlotIndex(timestamp) {
    if (timestamp < WINDOW_START_TIME || timestamp > SESSION_START_TIME + SLOT_DURATION_MS) { // Allow slight future drift
        return -1;
    }
    const offset = timestamp - WINDOW_START_TIME;
    let index = Math.ceil(offset / SLOT_DURATION_MS);
    if (index === 0) index = 1; // Handle exact boundary
    return Math.min(Math.max(index, 1), TOTAL_SLOTS);
}

// Data Structures
const EVENT_TYPES = ['ERROR', 'WARNING', 'INFO', 'DEBUG'];
const trees = {};
const naiveArrays = {}; // For performance comparison
const recentEvents = []; // Store last 20 events
let totalEventsCount = 0;

// Initialize Trees and Arrays
EVENT_TYPES.forEach(type => {
    trees[type] = new FenwickTree(TOTAL_SLOTS);
    naiveArrays[type] = new Float64Array(TOTAL_SLOTS + 1); // 1-based index matching
});

// Helper to record event
function recordEvent(type, timestamp) {
    const index = getSlotIndex(timestamp);
    if (index === -1) return; // Out of window

    // Update Fenwick Tree
    trees[type].update(index, 1);

    // Update Naive Array
    naiveArrays[type][index] += 1;

    // Global Stats
    totalEventsCount++;
    const event = { type, timestamp, date: new Date(timestamp).toISOString() };
    recentEvents.unshift(event);
    if (recentEvents.length > 20) recentEvents.pop();
}

/**
 * GENERATE INITIAL EVENTS
 * 1000 random events distributed over the last 7 days.
 */
console.log('Generating 1000 initial random events...');
for (let i = 0; i < 1000; i++) {
    const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
    // Random time between WINDOW_START_TIME and SESSION_START_TIME
    const time = WINDOW_START_TIME + Math.random() * (SESSION_START_TIME - WINDOW_START_TIME);
    recordEvent(type, time);
}
console.log('Initial generation complete.');

/**
 * CONTINUOUS EVENT GENERATION
 * Every 2-5 seconds.
 */
function startEventGenerator() {
    const delay = Math.floor(Math.random() * 3000) + 2000; // 2000-5000ms
    setTimeout(() => {
        const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
        // Generate event at current time (capped at SESSION_START_TIME for consistency with fixed window?)
        // To verify "Most recent hour = highest index" logic, we should use continuous time.
        // However, if we exceed SESSION_START_TIME, getSlotIndex might fail or we need to slide.
        // For this demo, let's just generate events very close to SESSION_START_TIME or slightly "now"
        const now = Date.now();
        // Just use 'now'. Our getSlotIndex handles slightly future items by clamping or we just update the ref?
        // Since we are not sliding the window, let's treat "now" as valid even if > SESSION_START_TIME
        // Actually, let's stick to the window logic.
        recordEvent(type, now);

        console.log(`[Generated] ${type} event at ${new Date().toISOString()}`);
        startEventGenerator(); // Recurse
    }, delay);
}
startEventGenerator();


// --- API ENDPOINTS ---

/**
 * 1. POST /api/log-event
 * Body: {type: string, timestamp: number}
 */
app.post('/api/log-event', (req, res) => {
    try {
        const { type, timestamp } = req.body;

        if (!EVENT_TYPES.includes(type)) {
            return res.status(400).json({ error: `Invalid type. Allowed: ${EVENT_TYPES.join(', ')}` });
        }
        if (typeof timestamp !== 'number') {
            return res.status(400).json({ error: 'Timestamp must be a number.' });
        }

        recordEvent(type, timestamp);
        res.status(200).json({ success: true, message: 'Event logged' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * 2. GET /api/query
 * Query params: type, startTime, endTime
 */
app.get('/api/query', (req, res) => {
    const startQ = performance.now();
    try {
        const { type, startTime, endTime } = req.query;

        if (!type || !EVENT_TYPES.includes(type)) {
            return res.status(400).json({ error: 'Valid type is required.' });
        }
        const start = parseInt(startTime);
        const end = parseInt(endTime);

        if (isNaN(start) || isNaN(end)) {
            return res.status(400).json({ error: 'startTime and endTime must be numbers.' });
        }

        // Convert times to indices
        const lIndex = getSlotIndex(start);
        const rIndex = getSlotIndex(end);

        // Ensure range is valid 1..168 and l <= r
        const L = Math.max(1, Math.min(lIndex, TOTAL_SLOTS));
        const R = Math.max(1, Math.min(rIndex, TOTAL_SLOTS));

        let count = 0;
        if (L <= R && lIndex !== -1 && rIndex !== -1) {
            count = trees[type].rangeSum(L, R);
        }

        const timeMs = performance.now() - startQ;
        res.json({
            type,
            range: { start, end, lIndex, rIndex },
            count,
            timeMs
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 3. GET /api/stats
 */
app.get('/api/stats', (req, res) => {
    const counts = {};
    EVENT_TYPES.forEach(t => {
        counts[t] = trees[t].prefixSum(TOTAL_SLOTS); // Total count in tree
    });

    res.json({
        counts,
        recentEvents,
        totalEvents: totalEventsCount
    });
});

/**
 * 4. GET /api/performance
 * Compare Fenwick Tree vs Naive Loop
 */
app.get('/api/performance', (req, res) => {
    const comparison = {};
    const ITERATIONS = 10000; // Run enough times to measure difference

    EVENT_TYPES.forEach(type => {
        // Random Range
        const l = Math.floor(Math.random() * (TOTAL_SLOTS / 2)) + 1;
        const r = Math.floor(Math.random() * (TOTAL_SLOTS / 2)) + (TOTAL_SLOTS / 2); // Ensure L < R usually

        // 1. Measure Fenwick
        const startBit = performance.now();
        let bitSum = 0;
        for (let i = 0; i < ITERATIONS; i++) {
            bitSum = trees[type].rangeSum(l, r);
        }
        const endBit = performance.now();

        // 2. Measure Naive
        const startNaive = performance.now();
        let naiveSum = 0;
        const arr = naiveArrays[type];
        for (let i = 0; i < ITERATIONS; i++) {
            let s = 0;
            for (let j = l; j <= r; j++) {
                s += arr[j];
            }
            naiveSum = s;
        }
        const endNaive = performance.now();

        comparison[type] = {
            range: [l, r],
            iterations: ITERATIONS,
            fenwickTimeMs: (endBit - startBit),
            naiveTimeMs: (endNaive - startNaive),
            speedup: ((endNaive - startNaive) / (endBit - startBit)).toFixed(2) + 'x'
        };
    });

    res.json(comparison);
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Tracking window: ${new Date(WINDOW_START_TIME).toISOString()} to ${new Date(SESSION_START_TIME).toISOString()}`);
});
