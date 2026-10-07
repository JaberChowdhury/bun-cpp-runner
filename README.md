# C++ & Rust Pro Workspace

A modern, high-performance web-based code execution workspace for C++ and Rust, rewritten with a **Rust + Axum** backend and a **React + Mantine v9** frontend.

---

## 🚀 Architecture Overview

```
bun-cpp-runner/
├── backend/                  # Rust + Axum Code Execution Server
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs           # Server entry point (Axum, CORS, graceful shutdown)
│   │   ├── config.rs         # Port, timeouts, log & history limits
│   │   ├── models.rs         # Strongly typed request/response structs
│   │   ├── routes.rs         # Route mapping & API timing logging middleware
│   │   ├── handlers/         # /execute, /api/history, /api/logs/:type
│   │   └── services/
│   │       ├── runner.rs     # Async g++ and rustc compiler & runner engine
│   │       ├── logger.rs     # Thread-safe color terminal & trimmed disk logging
│   │       └── history.rs    # Thread-safe atomic JSON persistence (max 50 items)
│   └── tests/
│       └── api_tests.rs      # Integration test suite (16 tests)
│
├── frontend/                 # React 19 + Mantine v9 + Vite Client
│   ├── package.json
│   ├── vite.config.ts        # Vite proxy for /execute and /api/ -> :3000
│   ├── postcss.config.cjs    # Mantine v9 PostCSS configuration
│   └── src/
│       ├── main.tsx          # MantineProvider, Notifications, CSS imports
│       ├── App.tsx           # Responsive split IDE layout & keyboard shortcuts
│       ├── theme.ts          # Mantine theme configuration
│       ├── components/
│       │   ├── Header.tsx        # Title, Language toggle, Dark/Light mode, Run button
│       │   ├── EditorPanel.tsx   # Monaco Editor, language mode, flag toggles, snippets
│       │   ├── OutputPanel.tsx   # Stdin, expected output validation, verdicts, timings
│       │   ├── HistoryPanel.tsx  # Interactive past runs timeline with 1-click restore
│       │   └── LogsPanel.tsx     # Runner & API logs viewer with auto-scroll & polling
│       └── constants/
│           └── snippets.ts   # C++ & Rust templates (Basic, Blank, Graph DFS)
│
└── context/
    └── SPECIFICATION.md      # Grounded requirements and API contract specification
```

---

## 🛠️ Getting Started

### Prerequisites
- **Rust / Cargo** (1.75+ or newer)
- **Bun** (or Node.js / npm)
- **g++** (for compiling C++ codes)
- **rustc** (for compiling Rust codes)

---

### Running in Development

**Start Both Backend and Frontend Simultaneously** (Single Command):
```bash
bun run dev
# or: bun start
```
This runs both the Rust Axum backend (port `3000`) and the React Mantine frontend (port `5173`) concurrently in a single terminal with color-coded logging.

Alternatively, run them separately:
1. **Start the Backend (Rust + Axum)**:
   ```bash
   bun run dev:backend
   # Or directly with Cargo:
   cargo run --manifest-path backend/Cargo.toml
   ```
   *The Axum backend starts on `http://localhost:3000`.*

2. **Start the Frontend (React + Mantine v9)**:
   ```bash
   bun run dev:frontend
   # Or directly inside frontend/:
   cd frontend && bun run dev
   ```
   *The Vite frontend starts on `http://localhost:5173` and automatically proxies `/execute` and `/api/*` to the Axum backend.*

---

### Running Tests & Building

- **Backend tests**:
  ```bash
  bun run test:backend
  # Or:
  cargo test --manifest-path backend/Cargo.toml
  ```

- **Frontend production build**:
  ```bash
  bun run build:frontend
  # Or:
  cd frontend && bun run build
  ```

---

## ✨ Features

- **Monaco Editor Integration**: VS Code-grade code editing with syntax highlighting for C++ and Rust, custom snippets, and direct `Ctrl+Enter` keybinding support.
- **Mantine v9 Design System**: Polished dark/light color schemes, responsive split-screen layout, and notification toasts.
- **Robust Execution Engine**:
  - Compiles C++ (`g++`, `-O3`, `-Wall`, `-std=c++20`, etc.) and Rust (`rustc`, `-O`).
  - Strict 3-second timeout protection with asynchronous process tree termination.
  - Precise millisecond compile and execution time measurements.
- **Output Validation**: Automatic comparison against expected output with side-by-side diffing and verdicts (`Accepted`, `Wrong Answer`, `Time Limit Exceeded`, `Runtime Error`, `Compilation Error`).
- **Thread-Safe History**: Preserves up to 50 previous execution attempts in `history.json` with one-click restore.
- **Accurate Real-Time Logging**: Thread-safe trimmed logs for runner operations (max 400 lines) and API hits (max 200 lines).
