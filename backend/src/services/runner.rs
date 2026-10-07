use crate::config::Config;
use crate::models::{ExecuteRequest, ExecuteResponse, HistoryEntry, Language, Verdict};
use crate::services::history::HistoryService;
use crate::services::logger::{AppLogger, RunnerLogLevel};
use std::sync::Arc;
use std::time::Instant;
use tempfile::Builder;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

use std::sync::atomic::{AtomicU64, Ordering};

static REQ_COUNTER: AtomicU64 = AtomicU64::new(1);

pub fn generate_req_id() -> String {
    let count = REQ_COUNTER.fetch_add(1, Ordering::Relaxed);
    let nanos = chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0) as u64;
    let mut val = nanos.wrapping_mul(6364136223846793005).wrapping_add(count);
    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyz0123456789";

    let mut id = String::with_capacity(6);
    for _ in 0..6 {
        id.push(CHARSET[(val % CHARSET.len() as u64) as usize] as char);
        val /= CHARSET.len() as u64;
    }
    id
}

pub fn format_history_date() -> String {
    chrono::Local::now()
        .format("%-m/%-d/%Y, %-I:%M:%S %p")
        .to_string()
}

pub fn format_memory(kb: u64) -> String {
    if kb >= 1024 {
        format!("{:.1} MB", kb as f64 / 1024.0)
    } else {
        format!("{} KB", kb)
    }
}

pub async fn execute_code(
    req: ExecuteRequest,
    config: &Config,
    logger: &Arc<AppLogger>,
    history: &Arc<HistoryService>,
) -> ExecuteResponse {
    let req_id = generate_req_id();
    let date_str = format_history_date();

    let flags_str = req.compiler_flags.join(" ");
    logger
        .log_runner(
            RunnerLogLevel::Info,
            &format!(
                "Req [{req_id}] received. Lang: {}, Flags: [{flags_str}]",
                req.language.as_str()
            ),
        )
        .await;

    // Create a temporary directory for isolation and guaranteed cleanup on drop
    let temp_dir = match Builder::new().prefix("runner_").tempdir() {
        Ok(dir) => dir,
        Err(err) => {
            logger
                .log_runner(
                    RunnerLogLevel::Error,
                    &format!("[{req_id}] Failed to create temporary workspace: {err}"),
                )
                .await;
            return ExecuteResponse {
                status: Verdict::STATUS_ERROR.to_string(),
                execution_type: Verdict::RUNTIME_ERROR.to_string(),
                output: None,
                message: Some(format!("Failed to create temporary directory: {err}")),
                r#match: None,
                time: Some("0.00".to_string()),
                compile_time: "0.00".to_string(),
                memory: None,
                memory_kb: None,
            };
        }
    };

    let source_path = temp_dir
        .path()
        .join(format!("main.{}", req.language.file_extension()));
    let exe_path = if cfg!(windows) {
        temp_dir.path().join("main.exe")
    } else {
        temp_dir.path().join("main")
    };

    // Write source file to disk
    if let Err(err) = tokio::fs::write(&source_path, req.code.as_bytes()).await {
        logger
            .log_runner(
                RunnerLogLevel::Error,
                &format!("[{req_id}] Failed to write source file: {err}"),
            )
            .await;
        return ExecuteResponse {
            status: Verdict::STATUS_ERROR.to_string(),
            execution_type: Verdict::RUNTIME_ERROR.to_string(),
            output: None,
            message: Some(format!("Failed to write source file: {err}")),
            r#match: None,
            time: Some("0.00".to_string()),
            compile_time: "0.00".to_string(),
            memory: None,
            memory_kb: None,
        };
    }

    // 1. Compilation Step
    logger
        .log_runner(RunnerLogLevel::Compile, &format!("[{req_id}] Compiling..."))
        .await;
    let compile_start = Instant::now();

    let (program, compile_args) = match req.language {
        Language::Cpp => {
            let mut args = vec![
                source_path.to_string_lossy().to_string(),
                "-o".to_string(),
                exe_path.to_string_lossy().to_string(),
            ];
            args.extend(req.compiler_flags.clone());
            ("g++", args)
        }
        Language::Rust => {
            let mut args = vec![
                source_path.to_string_lossy().to_string(),
                "-o".to_string(),
                exe_path.to_string_lossy().to_string(),
            ];
            if req.compiler_flags.iter().any(|f| f == "-O3" || f == "-O") {
                args.push("-O".to_string());
            }
            // Pass any other rust-compatible flags
            for flag in &req.compiler_flags {
                if flag.starts_with("--edition") || flag.starts_with("-C") {
                    args.push(flag.clone());
                }
            }
            ("rustc", args)
        }
    };

    let mut compile_cmd = Command::new(program);
    compile_cmd.args(&compile_args);
    compile_cmd.current_dir(temp_dir.path());
    compile_cmd.stdout(std::process::Stdio::piped());
    compile_cmd.stderr(std::process::Stdio::piped());

    let compile_result = timeout(Duration::from_secs(15), compile_cmd.output()).await;
    let compile_elapsed = compile_start.elapsed();
    let compile_time = format!("{:.2}", compile_elapsed.as_secs_f64() * 1000.0);

    let (compile_success, compile_stderr) = match compile_result {
        Ok(Ok(output)) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            (output.status.success(), stderr)
        }
        Ok(Err(err)) => (
            false,
            format!("Failed to execute compiler '{program}': {err}"),
        ),
        Err(_) => (false, "Compilation timed out after 15 seconds.".to_string()),
    };

    if !compile_success {
        logger
            .log_runner(
                RunnerLogLevel::Error,
                &format!("[{req_id}] Compilation failed."),
            )
            .await;

        let response = ExecuteResponse {
            status: Verdict::STATUS_ERROR.to_string(),
            execution_type: Verdict::COMPILATION_ERROR.to_string(),
            output: None,
            message: Some(compile_stderr.clone()),
            r#match: None,
            time: None,
            compile_time: compile_time.clone(),
            memory: None,
            memory_kb: None,
        };

        let _ = history
            .add_entry(HistoryEntry {
                id: req_id,
                date: date_str,
                language: req.language,
                code: req.code,
                input: req.input,
                expected_output: req.expected_output,
                validate_output: req.validate_output,
                status: response.status.clone(),
                execution_type: response.execution_type.clone(),
                output: None,
                message: Some(compile_stderr),
                r#match: None,
                time: None,
                compile_time,
                memory: None,
                memory_kb: None,
            })
            .await;

        return response;
    }

    // 2. Execution Step
    logger
        .log_runner(
            RunnerLogLevel::Execute,
            &format!("[{req_id}] Running executable..."),
        )
        .await;

    let mut run_cmd = Command::new(&exe_path);
    run_cmd.current_dir(temp_dir.path());
    run_cmd.stdin(std::process::Stdio::piped());
    run_cmd.stdout(std::process::Stdio::piped());
    run_cmd.stderr(std::process::Stdio::piped());
    run_cmd.kill_on_drop(false);

    let mut child = match run_cmd.spawn() {
        Ok(c) => c,
        Err(err) => {
            logger
                .log_runner(
                    RunnerLogLevel::Error,
                    &format!("[{req_id}] Failed to spawn executable: {err}"),
                )
                .await;
            let response = ExecuteResponse {
                status: Verdict::STATUS_ERROR.to_string(),
                execution_type: Verdict::RUNTIME_ERROR.to_string(),
                output: None,
                message: Some(format!("Failed to spawn executable: {err}")),
                r#match: None,
                time: Some("0.00".to_string()),
                compile_time: compile_time.clone(),
                memory: None,
                memory_kb: None,
            };
            let _ = history
                .add_entry(HistoryEntry {
                    id: req_id,
                    date: date_str,
                    language: req.language,
                    code: req.code,
                    input: req.input,
                    expected_output: req.expected_output,
                    validate_output: req.validate_output,
                    status: response.status.clone(),
                    execution_type: response.execution_type.clone(),
                    output: None,
                    message: response.message.clone(),
                    r#match: None,
                    time: response.time.clone(),
                    compile_time,
                    memory: None,
                    memory_kb: None,
                })
                .await;
            return response;
        }
    };

    let pid = match child.id() {
        Some(id) => id as libc::pid_t,
        None => {
            let response = ExecuteResponse {
                status: Verdict::STATUS_ERROR.to_string(),
                execution_type: Verdict::RUNTIME_ERROR.to_string(),
                output: None,
                message: Some("Failed to retrieve child process ID.".to_string()),
                r#match: None,
                time: Some("0.00".to_string()),
                compile_time: compile_time.clone(),
                memory: None,
                memory_kb: None,
            };
            return response;
        }
    };

    // Pipe stdin input
    if let Some(mut stdin) = child.stdin.take() {
        if let Some(ref input_str) = req.input {
            if !input_str.is_empty() {
                let _ = stdin.write_all(input_str.as_bytes()).await;
            }
        }
        drop(stdin);
    }

    let mut stdout_pipe = child.stdout.take();
    let mut stderr_pipe = child.stderr.take();

    let stdout_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        if let Some(mut pipe) = stdout_pipe.take() {
            let _ = tokio::io::AsyncReadExt::read_to_end(&mut pipe, &mut buf).await;
        }
        buf
    });

    let stderr_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        if let Some(mut pipe) = stderr_pipe.take() {
            let _ = tokio::io::AsyncReadExt::read_to_end(&mut pipe, &mut buf).await;
        }
        buf
    });

    let (tx, mut rx) = tokio::sync::mpsc::channel::<(libc::pid_t, libc::c_int, libc::rusage)>(1);
    tokio::task::spawn_blocking(move || {
        let mut status: libc::c_int = 0;
        let mut usage: libc::rusage = unsafe { std::mem::zeroed() };
        let ret = unsafe { libc::wait4(pid, &mut status, 0, &mut usage) };
        let _ = tx.blocking_send((ret, status, usage));
    });

    let run_start = Instant::now();
    let run_timeout = Duration::from_millis(config.time_limit_ms);
    let wait_res = timeout(run_timeout, rx.recv()).await;
    let run_elapsed = run_start.elapsed();
    let execution_time = format!("{:.2}", run_elapsed.as_secs_f64() * 1000.0);

    let (ret, status, usage, timed_out) = match wait_res {
        Ok(Some((r, s, u))) => (r, s, u, false),
        _ => {
            // Timed out or channel closed
            unsafe {
                libc::kill(pid, libc::SIGKILL);
            }
            let (r, s, u) = match timeout(Duration::from_millis(500), rx.recv()).await {
                Ok(Some(tuple)) => tuple,
                _ => (-1, 0, unsafe { std::mem::zeroed() }),
            };
            (r, s, u, true)
        }
    };

    drop(child);

    let stdout_bytes = stdout_task.await.unwrap_or_default();
    let stderr_bytes = stderr_task.await.unwrap_or_default();

    let peak_rss_kb = if ret > 0 {
        #[cfg(target_os = "macos")]
        let kb = (usage.ru_maxrss / 1024) as u64;
        #[cfg(not(target_os = "macos"))]
        let kb = usage.ru_maxrss as u64;
        kb
    } else {
        0
    };
    let formatted_memory = format_memory(peak_rss_kb);

    let memory_limit_mb = req.memory_limit_mb.unwrap_or(256);
    let memory_limit_kb = memory_limit_mb.saturating_mul(1024);

    let stderr_text = String::from_utf8_lossy(&stderr_bytes).trim().to_string();

    let exceeded_rss = peak_rss_kb > memory_limit_kb;
    let killed_by_oom = !timed_out && libc::WIFSIGNALED(status) && libc::WTERMSIG(status) == libc::SIGKILL;
    let stderr_alloc_failure = {
        let lower = stderr_text.to_lowercase();
        lower.contains("bad_alloc")
            || lower.contains("out of memory")
            || lower.contains("cannot allocate memory")
            || lower.contains("memory allocation of")
    };

    let is_mle = exceeded_rss || killed_by_oom || stderr_alloc_failure;

    let response = if is_mle {
        logger
            .log_runner(
                RunnerLogLevel::Error,
                &format!("[{req_id}] Memory Limit Exceeded ({formatted_memory})."),
            )
            .await;

        let message = if !stderr_text.is_empty() {
            if stderr_alloc_failure {
                stderr_text
            } else {
                format!(
                    "Memory limit exceeded: {} used (limit: {} MB)\n{}",
                    formatted_memory, memory_limit_mb, stderr_text
                )
            }
        } else {
            format!(
                "Memory limit exceeded: {} used (limit: {} MB)",
                formatted_memory, memory_limit_mb
            )
        };

        ExecuteResponse {
            status: Verdict::STATUS_ERROR.to_string(),
            execution_type: Verdict::MEMORY_LIMIT_EXCEEDED.to_string(),
            output: None,
            message: Some(message),
            r#match: None,
            time: Some(execution_time.clone()),
            compile_time: compile_time.clone(),
            memory: Some(formatted_memory.clone()),
            memory_kb: Some(peak_rss_kb),
        }
    } else if timed_out {
        logger
            .log_runner(
                RunnerLogLevel::Error,
                &format!("[{req_id}] Time Limit Exceeded."),
            )
            .await;

        ExecuteResponse {
            status: Verdict::STATUS_ERROR.to_string(),
            execution_type: Verdict::TIME_LIMIT_EXCEEDED.to_string(),
            output: None,
            message: Some("Execution >3s.".to_string()),
            r#match: None,
            time: Some(execution_time.clone()),
            compile_time: compile_time.clone(),
            memory: Some(formatted_memory.clone()),
            memory_kb: Some(peak_rss_kb),
        }
    } else if !libc::WIFEXITED(status) || libc::WEXITSTATUS(status) != 0 {
        let exit_code = if libc::WIFEXITED(status) {
            libc::WEXITSTATUS(status).to_string()
        } else if libc::WIFSIGNALED(status) {
            format!("signal {}", libc::WTERMSIG(status))
        } else {
            "abnormal".to_string()
        };

        logger
            .log_runner(
                RunnerLogLevel::Error,
                &format!("[{req_id}] Runtime error ({exit_code})."),
            )
            .await;

        let message = if stderr_text.is_empty() {
            format!("Code {exit_code}")
        } else {
            stderr_text
        };

        ExecuteResponse {
            status: Verdict::STATUS_ERROR.to_string(),
            execution_type: Verdict::RUNTIME_ERROR.to_string(),
            output: None,
            message: Some(message),
            r#match: None,
            time: Some(execution_time.clone()),
            compile_time: compile_time.clone(),
            memory: Some(formatted_memory.clone()),
            memory_kb: Some(peak_rss_kb),
        }
    } else {
        let actual_output = String::from_utf8_lossy(&stdout_bytes).trim().to_string();

        let (match_result, verdict_type) = if req.validate_output {
            let expected_output = req.expected_output.as_deref().unwrap_or("").trim();
            let is_match = actual_output == expected_output;
            let v_type = if is_match {
                Verdict::ACCEPTED
            } else {
                Verdict::WRONG_ANSWER
            };
            (Some(is_match), v_type)
        } else {
            (None, Verdict::ACCEPTED)
        };

        logger
            .log_runner(
                RunnerLogLevel::Success,
                &format!(
                    "[{req_id}] Finished in {execution_time}ms (Mem: {formatted_memory}). Comp: {compile_time}ms"
                ),
            )
            .await;

        ExecuteResponse {
            status: Verdict::STATUS_SUCCESS.to_string(),
            execution_type: verdict_type.to_string(),
            output: Some(actual_output),
            message: None,
            r#match: match_result,
            time: Some(execution_time.clone()),
            compile_time: compile_time.clone(),
            memory: Some(formatted_memory.clone()),
            memory_kb: Some(peak_rss_kb),
        }
    };

    // Save to history
    let _ = history
        .add_entry(HistoryEntry {
            id: req_id,
            date: date_str,
            language: req.language,
            code: req.code,
            input: req.input,
            expected_output: req.expected_output,
            validate_output: req.validate_output,
            status: response.status.clone(),
            execution_type: response.execution_type.clone(),
            output: response.output.clone(),
            message: response.message.clone(),
            r#match: response.r#match,
            time: response.time.clone(),
            compile_time: response.compile_time.clone(),
            memory: response.memory.clone(),
            memory_kb: response.memory_kb,
        })
        .await;

    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_cpp_execution() {
        let dir = tempdir().unwrap();
        let logger = Arc::new(AppLogger::new(
            dir.path().join("runner.log"),
            dir.path().join("api.log"),
            400,
            200,
        ));
        let history = Arc::new(HistoryService::new(dir.path().join("history.json"), 50).await);
        let config = Config::new();

        let req = ExecuteRequest {
            language: Language::Cpp,
            code: r#"
                #include <iostream>
                int main() {
                    int a, b;
                    if (std::cin >> a >> b) {
                        std::cout << (a + b) << std::endl;
                    }
                    return 0;
                }
            "#
            .to_string(),
            input: Some("15 27\n".to_string()),
            expected_output: Some("42".to_string()),
            validate_output: true,
            compiler_flags: vec!["-O3".to_string()],
            memory_limit_mb: Some(256),
        };

        let resp = execute_code(req, &config, &logger, &history).await;
        assert_eq!(resp.status, Verdict::STATUS_SUCCESS);
        assert_eq!(resp.execution_type, Verdict::ACCEPTED);
        assert_eq!(resp.output.as_deref(), Some("42"));
        assert_eq!(resp.r#match, Some(true));
        assert!(resp.memory.is_some());
        assert!(resp.memory_kb.is_some());

        let hist = history.get_history().await;
        assert_eq!(hist.len(), 1);
        assert_eq!(hist[0].output.as_deref(), Some("42"));
        assert!(hist[0].memory.is_some());
        assert!(hist[0].memory_kb.is_some());
    }

    #[tokio::test]
    async fn test_rust_execution() {
        let dir = tempdir().unwrap();
        let logger = Arc::new(AppLogger::new(
            dir.path().join("runner.log"),
            dir.path().join("api.log"),
            400,
            200,
        ));
        let history = Arc::new(HistoryService::new(dir.path().join("history.json"), 50).await);
        let config = Config::new();

        let req = ExecuteRequest {
            language: Language::Rust,
            code: r#"
                use std::io::{self, Read};
                fn main() {
                    let mut input = String::new();
                    io::stdin().read_to_string(&mut input).unwrap();
                    let nums: Vec<i32> = input.split_whitespace().map(|s| s.parse().unwrap()).collect();
                    println!("{}", nums[0] * nums[1]);
                }
            "#
            .to_string(),
            input: Some("6 7\n".to_string()),
            expected_output: Some("42".to_string()),
            validate_output: true,
            compiler_flags: vec!["-O".to_string()],
            memory_limit_mb: Some(256),
        };

        let resp = execute_code(req, &config, &logger, &history).await;
        assert_eq!(resp.status, Verdict::STATUS_SUCCESS);
        assert_eq!(resp.execution_type, Verdict::ACCEPTED);
        assert_eq!(resp.output.as_deref(), Some("42"));
        assert_eq!(resp.r#match, Some(true));
        assert!(resp.memory.is_some());
        assert!(resp.memory_kb.is_some());
    }

    #[tokio::test]
    async fn test_compilation_error() {
        let dir = tempdir().unwrap();
        let logger = Arc::new(AppLogger::new(
            dir.path().join("runner.log"),
            dir.path().join("api.log"),
            400,
            200,
        ));
        let history = Arc::new(HistoryService::new(dir.path().join("history.json"), 50).await);
        let config = Config::new();

        let req = ExecuteRequest {
            language: Language::Cpp,
            code: "this is invalid cpp syntax;".to_string(),
            input: None,
            expected_output: None,
            validate_output: false,
            compiler_flags: vec![],
            memory_limit_mb: Some(256),
        };

        let resp = execute_code(req, &config, &logger, &history).await;
        assert_eq!(resp.status, Verdict::STATUS_ERROR);
        assert_eq!(resp.execution_type, Verdict::COMPILATION_ERROR);
        assert!(resp.message.is_some());
        assert_eq!(resp.memory, None);
        assert_eq!(resp.memory_kb, None);
    }

    #[tokio::test]
    async fn test_timeout_execution() {
        let dir = tempdir().unwrap();
        let logger = Arc::new(AppLogger::new(
            dir.path().join("runner.log"),
            dir.path().join("api.log"),
            400,
            200,
        ));
        let history = Arc::new(HistoryService::new(dir.path().join("history.json"), 50).await);
        let mut config = Config::new();
        config.time_limit_ms = 1000; // 1 second for faster test

        let req = ExecuteRequest {
            language: Language::Cpp,
            code: r#"
                #include <chrono>
                #include <thread>
                int main() {
                    while (true) {
                        std::this_thread::sleep_for(std::chrono::milliseconds(50));
                    }
                    return 0;
                }
            "#
            .to_string(),
            input: None,
            expected_output: None,
            validate_output: false,
            compiler_flags: vec![],
            memory_limit_mb: Some(256),
        };

        let resp = execute_code(req, &config, &logger, &history).await;
        assert_eq!(resp.status, Verdict::STATUS_ERROR);
        assert_eq!(resp.execution_type, Verdict::TIME_LIMIT_EXCEEDED);
        assert!(resp.memory.is_some());
        assert!(resp.memory_kb.is_some());
    }

    #[tokio::test]
    async fn test_memory_limit_exceeded_by_rss() {
        let dir = tempdir().unwrap();
        let logger = Arc::new(AppLogger::new(
            dir.path().join("runner.log"),
            dir.path().join("api.log"),
            400,
            200,
        ));
        let history = Arc::new(HistoryService::new(dir.path().join("history.json"), 50).await);
        let config = Config::new();

        // Allocate 30 MB while memory limit is 10 MB
        let req = ExecuteRequest {
            language: Language::Cpp,
            code: r#"
                #include <vector>
                #include <iostream>
                int main() {
                    std::vector<char> v(30 * 1024 * 1024, 42);
                    std::cout << (int)v[0] << std::endl;
                    return 0;
                }
            "#
            .to_string(),
            input: None,
            expected_output: None,
            validate_output: false,
            compiler_flags: vec![],
            memory_limit_mb: Some(10),
        };

        let resp = execute_code(req, &config, &logger, &history).await;
        assert_eq!(resp.status, Verdict::STATUS_ERROR);
        assert_eq!(resp.execution_type, Verdict::MEMORY_LIMIT_EXCEEDED);
        assert!(resp.memory.is_some());
        assert!(resp.memory_kb.unwrap() > 10 * 1024);
        assert!(resp.message.is_some());
    }

    #[tokio::test]
    async fn test_memory_limit_exceeded_by_bad_alloc() {
        let dir = tempdir().unwrap();
        let logger = Arc::new(AppLogger::new(
            dir.path().join("runner.log"),
            dir.path().join("api.log"),
            400,
            200,
        ));
        let history = Arc::new(HistoryService::new(dir.path().join("history.json"), 50).await);
        let config = Config::new();

        // Deliberately throw bad_alloc
        let req = ExecuteRequest {
            language: Language::Cpp,
            code: r#"
                #include <new>
                int main() {
                    throw std::bad_alloc();
                    return 0;
                }
            "#
            .to_string(),
            input: None,
            expected_output: None,
            validate_output: false,
            compiler_flags: vec![],
            memory_limit_mb: Some(256),
        };

        let resp = execute_code(req, &config, &logger, &history).await;
        assert_eq!(resp.status, Verdict::STATUS_ERROR);
        assert_eq!(resp.execution_type, Verdict::MEMORY_LIMIT_EXCEEDED);
        assert!(resp.memory.is_some());
        assert!(resp.message.unwrap().contains("bad_alloc"));
    }
}
