# Specification: C++ & Rust Runner (React Mantine v9 + Rust Axum)

## 1. Overview & Architecture

This project is a high-performance web-based code execution workspace for C++ and Rust.
The architecture is split into:

- **Backend**: Rust + Axum (`backend/`) on Port 3000
  - Asynchronous execution engine with Tokio.
  - Safe subprocess spawning (`tokio::process::Command`), pipe handling, process termination, and 3-second timeout protection.
  - Accurate thread-safe logging engine (`runner.log` max 400 lines, `api.log` max 200 lines).
  - Accurate history persistence (`history.json`, capped at 50 records) protected by Mutex / atomic file writes.
  - CORS enabled to allow separate frontend dev server access.
- **Frontend**: React + Mantine v9 (`frontend/`) on Vite Port 5173
  - Built with Vite and TypeScript.
  - Monaco Editor (`@monaco-editor/react`) for full VS-Code grade C++ and Rust editing, syntax highlighting, autocompletion, and theme integration.
  - Mantine v9 (`@mantine/core`, `@mantine/hooks`, `@mantine/notifications`, `@tabler/icons-react`).
  - Dark/light mode toggle with Mantine v9's `useMantineColorScheme`.
  - Modern IDE layout with split panels: Code Editor, Standard Input, Expected Output validation, Execution Verdict & Timing stats, History timeline, Server Logs viewer.
  - Pre-configured boilerplates/snippets for C++ (Standard, Graph DFS) and Rust (Basic, Graph).
  - Configurable compiler flags (`-O3`, `-Wall`, `-std=c++20` for C++; `-O` for Rust).

## 2. API Contract

- `POST /execute`
  - Request body:
    ```json
    {
      "language": "cpp" | "rust",
      "code": "string",
      "input": "string",
      "expectedOutput": "string",
      "validateOutput": boolean,
      "compilerFlags": ["string"]
    }
    ```
  - Response body:
    ```json
    {
      "status": "success" | "error",
      "type": "Accepted" | "Wrong Answer" | "Time Limit Exceeded" | "Runtime Error" | "Compilation Error",
      "output": "string",
      "message": "string (optional error)",
      "match": boolean | null,
      "time": "string (ms)",
      "compileTime": "string (ms)"
    }
    ```
- `GET /api/history`
  - Returns array of recent executions (up to 50 items).
- `GET /api/logs/:type` (`runner` or `api`)
  - Returns raw string logs.

## 3. Directory Layout

```
bun-cpp-runner/
├── backend/
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── config.rs
│       ├── models.rs
│       ├── routes.rs
│       ├── handlers/
│       │   ├── execute.rs
│       │   ├── history.rs
│       │   └── logs.rs
│       └── services/
│           ├── runner.rs
│           ├── logger.rs
│           └── history.rs
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── postcss.config.cjs
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── theme.ts
│       ├── types.ts
│       ├── components/
│       │   ├── Header.tsx
│       │   ├── EditorPanel.tsx
│       │   ├── OutputPanel.tsx
│       │   ├── HistoryPanel.tsx
│       │   └── LogsPanel.tsx
│       └── constants/
│           └── snippets.ts
└── context/
    └── SPECIFICATION.md
```
