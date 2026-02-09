# Technical Report: Real-Time GitHub Analytics Platform
**Project Area:** Data Structures & Algorithms (Experiential Learning)
**Theme:** High-Performance Cumulative Analytics using Fenwick Trees

---

## 1. Project Overview
This project is a full-stack system designed to aggregate and analyze global GitHub activity in real-time. Instead of using static or simulated data, it consumes the **GitHub Public Events API**, presenting challenges like asynchronous ingestion, burst traffic, and rate limiting—all of which are handled by efficient data structures.

## 2. Core Theory: The Fenwick Tree (BIT)
The heart of the system is the **Fenwick Tree**, also known as the **Binary Indexed Tree (BIT)**.

### Why BIT?
In a real-time monitor, we frequently need to do two things:
1. **Update values** (e.g., "An event just happened at Minute 45").
2. **Query ranges** (e.g., "How many events happened in the last 15 minutes?").

| Structure | Update Time | Range Query Time |
| :--- | :--- | :--- |
| Simple Array | O(1) | **O(n)** |
| Prefix Sum Array | **O(n)** | O(1) |
| **Fenwick Tree** | **O(log n)** | **O(log n)** |

By using BIT, we ensure that as the data volume grows, our analytics performance remains consistent and extremely fast.

## 3. System Architecture
The platform is built with a **Data Pipeline** model:

1. **Ingestion (Backend)**: Node.js polls GitHub API every 2 minutes for the latest 100 events.
2. **Normalization**: Events are mapped to a **1-60 minute slot** based on their true `created_at` timestamp.
3. **Processing**: The `FenwickTree` is updated incrementally using `update(slot, 1)`.
4. **API Layer**: Express.js provides endpoints for raw event streams and BIT-derived statistics.
5. **Visualization (Frontend)**: Vanilla JavaScript renders the dashboard, utilizing **Chart.js** for distribution and live badges for activity.

## 4. Key Logic & Techniques

### A. Incremental Updates (O(log N))
Unlike systems that rebuild their state periodically, our system is **event-driven**. When a batch of events arrives, we iterate through them once and update the tree branch-by-branch. This is the most efficient way to maintain a live running total.

### B. Sliding Window Maintenance
The system maintains a **rolling 60-minute window**. 
- As time moves forward, events "fall out" of the window.
- The `maintenance()` routine identifies these events and "undoes" their contribution to the BIT using `update(oldSlot, -1)`. 
- This keeps the memory footprint low and the analytics accurate to the current hour.

### C. Dual-Timestamp Integrity
To preserve academic rigor, we track:
- **Event Time (GitHub)**: The actual moment the user pushed code.
- **Received by Server**: When our system saw it.
Analytics are **always** performed on the true GitHub time, ensuring the BI-Tree reflects real history, not just polling latency.

## 5. Technology Stack
- **Languages**: JavaScript (Node.js & Vanilla Browser JS)
- **Frameworks**: Express.js (Backend), CSS3/HTML5 (Frontend)
- **Visualization**: Chart.js (Real-time distribution charts)
- **Environment**: Dotenv (For secure API Key/Token handling)
- **Icons/Fonts**: FontAwesome & Google Inter Font

## 6. Real-World Engineering: Rate Limit Resilience
GitHub limits unauthenticated users to 60 hits per hour. We implemented:
- **Exponential Backoff**: If the server hits a limit, it halts for 5 minutes to let the quota reset.
- **Token Integration**: Users can add a `GITHUB_TOKEN` to jump from 60 to 5,000 requests/hour.
- **Visual Feedback**: The UI changes state (Red disclaimer) to alert the user if they are currently rate-limited.

## 7. Advanced Features
- **Hourly Persistence**: A separate Fenwick Tree with 24 slots provides a high-level view of activity throughout the day, showcasing the versatility of BIT in handling multiple granularities.
- **Repository Metadata**: The system builds a frequency map of active repositories, demonstrating how BIT-derived totals can be augmented with relational metadata.
- **Internal State Inspection**: The "BIT Explorer" provides a direct mapping of the internal array, allowing users to see how index `i` stores a sum that covers a range determined by its Least Significant Bit.

## 8. Conclusion
This project successfully applies a complex data structure (Fenwick Tree) to a real-world scenario. It demonstrate that advanced algorithms aren't just for whiteboard interviews—they are essential for building responsive, high-traffic systems in the real world.
