import { unlink } from "node:fs/promises";

const PORT = 3000;
const HISTORY_FILE = "history.json";
const LOG_FILE = "runner.log";
const API_LOG_FILE = "api.log";

// Load history into memory
let history: any[] = [];
try {
  history = await Bun.file(HISTORY_FILE).json();
} catch (e) {}

// 🔧 NEW: Log trimming engine
async function appendAndTrimLog(
  filePath: string,
  msg: string,
  maxLines: number,
) {
  try {
    const file = Bun.file(filePath);
    let lines: string[] = [];

    // Read existing logs if the file exists
    if (await file.exists()) {
      const text = await file.text();
      lines = text.split("\n").filter(Boolean); // filter(Boolean) removes empty lines
    }

    // Append the new message
    lines.push(msg.trim());

    // Keep only the last `maxLines`
    if (lines.length > maxLines) {
      lines = lines.slice(-maxLines);
    }

    // Write back to disk
    await Bun.write(filePath, lines.join("\n") + "\n");
  } catch (e) {
    console.error(`Failed to write to ${filePath}`);
  }
}

// Custom Loggers
async function writeLog(
  file: string,
  level: string,
  color: string,
  msg: string,
) {
  const timestamp = new Date().toLocaleTimeString();
  const terminalMsg = `\x1b[90m[${timestamp}]\x1b[0m ${color}[${level}]\x1b[0m ${msg}`;
  const fileMsg = `[${timestamp}] [${level}] ${msg}`;

  console.log(terminalMsg);
  // 🔧 APPLIED: 400 Line Limit for the Runner Logs
  await appendAndTrimLog(file, fileMsg, 400);
}

const log = {
  info: (msg: string) => writeLog(LOG_FILE, "INFO", "\x1b[34m", msg),
  compile: (msg: string) => writeLog(LOG_FILE, "COMPILE", "\x1b[33m", msg),
  run: (msg: string) => writeLog(LOG_FILE, "EXECUTE", "\x1b[36m", msg),
  success: (msg: string) => writeLog(LOG_FILE, "SUCCESS", "\x1b[32m", msg),
  error: (msg: string) => writeLog(LOG_FILE, "ERROR", "\x1b[31m", msg),
};

async function saveHistory(entry: any) {
  history.unshift(entry);
  // 🔧 APPLIED: 50 Item Limit for Code History
  if (history.length > 50) history.length = 50;
  await Bun.write(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// ---------------------------------------------------------
// ROUTER LOGIC
// ---------------------------------------------------------
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/")
    return new Response(Bun.file("./public/index.html"));
  if (req.method === "GET" && url.pathname === "/api/history")
    return Response.json(history);
  if (req.method === "GET" && url.pathname.startsWith("/api/logs/")) {
    const type = url.pathname.split("/").pop();
    const targetFile = type === "api" ? API_LOG_FILE : LOG_FILE;
    return new Response(
      await Bun.file(targetFile)
        .text()
        .catch(() => "No logs available."),
    );
  }

  if (req.method === "POST" && url.pathname === "/execute") {
    const {
      code,
      input,
      expectedOutput,
      validateOutput,
      compilerFlags = [],
    } = await req.json();
    const reqId = Math.random().toString(36).substring(7);
    const dateStr = new Date().toLocaleString();

    log.info(`Req [${reqId}] received. Flags: [${compilerFlags.join(" ")}]`);

    const uniqueId = Date.now().toString() + "_" + reqId;
    const cppFile = `${uniqueId}.cpp`;
    const exeFile =
      process.platform === "win32" ? `${uniqueId}.exe` : `./${uniqueId}`;

    await Bun.write(cppFile, code);
    let runResult: any = {};
    let compileTime = "0.00";

    try {
      log.compile(`[${reqId}] Compiling...`);
      const compileStart = performance.now();

      const compileArgs = ["g++", cppFile, "-o", exeFile, ...compilerFlags];
      const compile = Bun.spawn(compileArgs, {
        stderr: "pipe",
        cwd: process.cwd(),
      });

      if ((await compile.exited) !== 0) {
        compileTime = (performance.now() - compileStart).toFixed(2);
        log.error(`[${reqId}] Compilation failed.`);
        return Response.json({
          status: "error",
          type: "Compilation Error",
          message: await new Response(compile.stderr).text(),
          compileTime,
        });
      }
      compileTime = (performance.now() - compileStart).toFixed(2);

      log.run(`[${reqId}] Running executable...`);
      const startTime = performance.now();

      const run = Bun.spawn([exeFile], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        cwd: process.cwd(),
      });
      if (input) run.stdin.write(input);
      run.stdin.end();

      const stdoutPromise = new Response(run.stdout).text();
      const stderrPromise = new Response(run.stderr).text();

      let isTimeout = false;
      const timer = setTimeout(() => {
        isTimeout = true;
        run.kill(9);
      }, 3000);
      const runExitCode = await run.exited;
      clearTimeout(timer);

      const executionTime = (performance.now() - startTime).toFixed(2);
      const actualOutput = (await stdoutPromise).trim();
      const stderrText = (await stderrPromise).trim();

      if (isTimeout) {
        log.error(`[${reqId}] Time Limit Exceeded.`);
        runResult = {
          status: "error",
          type: "Time Limit Exceeded",
          message: "Execution >3s.",
          time: executionTime,
          compileTime,
        };
      } else if (runExitCode !== 0) {
        log.error(`[${reqId}] Runtime error (${runExitCode}).`);
        runResult = {
          status: "error",
          type: "Runtime Error",
          message: stderrText || `Code ${runExitCode}`,
          time: executionTime,
          compileTime,
        };
      } else {
        let matchResult = null;
        let type = "Accepted";
        if (validateOutput) {
          matchResult = actualOutput === (expectedOutput || "").trim();
          type = matchResult ? "Accepted" : "Wrong Answer";
        }
        runResult = {
          status: "success",
          type,
          output: actualOutput,
          match: matchResult,
          time: executionTime,
          compileTime,
        };
        log.success(
          `[${reqId}] Finished in ${executionTime}ms. Comp: ${compileTime}ms`,
        );
      }
      return Response.json(runResult);
    } finally {
      await saveHistory({
        id: reqId,
        date: dateStr,
        code,
        input,
        expectedOutput,
        validateOutput,
        ...runResult,
      });
      for (const file of [cppFile, exeFile])
        if (await Bun.file(file).exists()) await unlink(file).catch(() => null);
    }
  }
  return new Response("Not Found", { status: 404 });
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const startTime = performance.now();
    const url = new URL(req.url);
    const response = await handleRequest(req);
    const ms = performance.now() - startTime;
    const timestamp = new Date().toLocaleTimeString();
    const statusColor = response.status === 200 ? "\x1b[32m" : "\x1b[31m";
    const methodColor = req.method === "GET" ? "\x1b[36m" : "\x1b[35m";

    console.log(
      `\x1b[90m[${timestamp}]\x1b[0m \x1b[35m[API]\x1b[0m ${methodColor}[${req.method}]\x1b[0m ${url.pathname} - ${statusColor}${response.status}\x1b[0m (${ms.toFixed(2)}ms)`,
    );

    const fileMsg = `[${timestamp}] [API] [${req.method}] ${url.pathname} - Status: ${response.status} (${ms.toFixed(2)}ms)`;
    // 🔧 APPLIED: 200 Line Limit for the API Logs
    await appendAndTrimLog(API_LOG_FILE, fileMsg, 200);

    return response;
  },
});

log.info("C++ Professional Workspace Started.");
console.log(`📡 \x1b[4mhttp://localhost:${PORT}\x1b[0m\n`);
