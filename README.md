# GitHub Real-Time Analytics Platform (Fenwick Tree)

This project demonstrates a full-stack implementation of a real-time event aggregation and analytics platform. It is designed for students and evaluators in Data Structures and Algorithms (DSA) courses.

## Core Objective
To showcase the application of a **Fenwick Tree (Binary Indexed Tree)** for high-performance, real-time cumulative analytics on rolling-window data.

## Key Features
- **Incremental Data Ingestion**: Polls GitHub Public Events API for 100 events every 2 minutes, mapping them to true activity timestamps.
- **BIT-Powered Analytics**: Uses multiple Fenwick Trees to compute activity for 5m, 15m, and 60m windows in **O(log N)** time.
- **Hourly Trends (24h)**: A secondary BIT architecture tracks global activity distribution across a full day.
- **Repository Leaderboard**: Real-time identification of high-traffic repositories within the analytics window.
- **BIT Explorer**: An interactive visualization table showing the internal memory state (partial sums) of the Fenwick Tree array.
- **Rate Limit Resilience**: Implements exponential backoff and `GITHUB_TOKEN` support to handle API quotas gracefully.

## Handling API Rate Limits
Unauthenticated requests to the GitHub API are limited to 60 per hour. 
- To increase the limit to **5000/hour**, create a `.env` file in the root directory.
- Add your Personal Access Token: `GITHUB_TOKEN=your_token_here`.
- The system will automatically detect the token and resume high-frequency polling.

## Technology Stack
- **Backend**: Node.js, Express, Dotenv
- **Algorithms**: Fenwick Tree (BIT)
- **Frontend**: Vanilla JavaScript, Chart.js, HTML5/CSS3

## Academic Context
> This system demonstrates the application of Fenwick Tree for real-time cumulative analytics on live server data with realistic ingestion delays. All statistics (range sums and prefix sums) are derived strictly from the BIT data structure.
