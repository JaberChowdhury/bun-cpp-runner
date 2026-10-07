use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RunnerLogLevel {
    Info,
    Compile,
    Execute,
    Success,
    Error,
}

impl RunnerLogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            RunnerLogLevel::Info => "INFO",
            RunnerLogLevel::Compile => "COMPILE",
            RunnerLogLevel::Execute => "EXECUTE",
            RunnerLogLevel::Success => "SUCCESS",
            RunnerLogLevel::Error => "ERROR",
        }
    }

    pub fn color_code(&self) -> &'static str {
        match self {
            RunnerLogLevel::Info => "\x1b[34m",    // Blue
            RunnerLogLevel::Compile => "\x1b[33m", // Yellow
            RunnerLogLevel::Execute => "\x1b[36m", // Cyan
            RunnerLogLevel::Success => "\x1b[32m", // Green
            RunnerLogLevel::Error => "\x1b[31m",   // Red
        }
    }
}

#[derive(Clone)]
pub struct AppLogger {
    runner_log_path: PathBuf,
    api_log_path: PathBuf,
    max_runner_lines: usize,
    max_api_lines: usize,
    runner_lock: Arc<Mutex<()>>,
    api_lock: Arc<Mutex<()>>,
}

impl AppLogger {
    pub fn new(
        runner_log_path: PathBuf,
        api_log_path: PathBuf,
        max_runner_lines: usize,
        max_api_lines: usize,
    ) -> Self {
        Self {
            runner_log_path,
            api_log_path,
            max_runner_lines,
            max_api_lines,
            runner_lock: Arc::new(Mutex::new(())),
            api_lock: Arc::new(Mutex::new(())),
        }
    }

    pub fn format_timestamp() -> String {
        chrono::Local::now().format("%I:%M:%S %p").to_string()
    }

    pub async fn log_runner(&self, level: RunnerLogLevel, msg: &str) {
        let timestamp = Self::format_timestamp();
        let level_str = level.as_str();
        let color = level.color_code();

        // Print colored terminal output
        println!(
            "\x1b[90m[{timestamp}]\x1b[0m {color}[{level_str}]\x1b[0m {msg}"
        );

        // Write trimmed message to runner.log
        let file_msg = format!("[{timestamp}] [{level_str}] {msg}");
        self.append_and_trim(
            &self.runner_log_path,
            &file_msg,
            self.max_runner_lines,
            &self.runner_lock,
        )
        .await;
    }

    pub async fn log_api(&self, method: &str, path: &str, status: u16, duration_ms: f64) {
        let timestamp = Self::format_timestamp();
        let method_color = match method {
            "GET" => "\x1b[36m",  // Cyan
            "POST" => "\x1b[35m", // Magenta
            _ => "\x1b[33m",      // Yellow
        };
        let status_color = if (200..300).contains(&status) {
            "\x1b[32m" // Green
        } else {
            "\x1b[31m" // Red
        };

        // Print colored terminal output
        println!(
            "\x1b[90m[{timestamp}]\x1b[0m \x1b[35m[API]\x1b[0m {method_color}[{method}]\x1b[0m {path} - {status_color}{status}\x1b[0m ({duration_ms:.2}ms)"
        );

        // Write trimmed message to api.log
        let file_msg = format!(
            "[{timestamp}] [API] [{method}] {path} - Status: {status} ({duration_ms:.2}ms)"
        );
        self.append_and_trim(
            &self.api_log_path,
            &file_msg,
            self.max_api_lines,
            &self.api_lock,
        )
        .await;
    }

    async fn append_and_trim(
        &self,
        path: &PathBuf,
        msg: &str,
        max_lines: usize,
        lock: &Arc<Mutex<()>>,
    ) {
        let _guard = lock.lock().await;

        let mut lines = Vec::new();
        if path.exists() {
            if let Ok(content) = fs::read_to_string(path).await {
                lines = content
                    .lines()
                    .map(|l| l.trim().to_string())
                    .filter(|l| !l.is_empty())
                    .collect();
            }
        }

        lines.push(msg.trim().to_string());

        if lines.len() > max_lines {
            let start = lines.len() - max_lines;
            lines = lines[start..].to_vec();
        }

        let mut output = lines.join("\n");
        output.push('\n');

        // Write atomically via a temp file to prevent corruption
        let parent = path.parent().unwrap_or_else(|| std::path::Path::new("."));
        let temp_filename = format!(
            ".tmp_log_{}_{}",
            std::process::id(),
            chrono::Local::now().timestamp_nanos_opt().unwrap_or(0)
        );
        let temp_path = parent.join(temp_filename);

        if let Ok(()) = fs::write(&temp_path, output.as_bytes()).await {
            let _ = fs::rename(&temp_path, path).await;
        } else {
            // Fallback direct write
            let _ = fs::write(path, output.as_bytes()).await;
        }
    }

    pub async fn read_logs(&self, log_type: &str) -> String {
        let target_path = match log_type {
            "api" => &self.api_log_path,
            "runner" => &self.runner_log_path,
            _ => return "Invalid log type. Use 'runner' or 'api'.".to_string(),
        };

        if !target_path.exists() {
            return "No logs available.".to_string();
        }

        fs::read_to_string(target_path)
            .await
            .unwrap_or_else(|_| "No logs available.".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_log_trimming() {
        let dir = tempdir().unwrap();
        let runner_log = dir.path().join("runner.log");
        let api_log = dir.path().join("api.log");

        let logger = AppLogger::new(runner_log.clone(), api_log.clone(), 5, 3);

        for i in 1..=10 {
            logger
                .log_runner(RunnerLogLevel::Info, &format!("Runner msg {i}"))
                .await;
        }

        let runner_content = logger.read_logs("runner").await;
        let lines: Vec<&str> = runner_content.lines().collect();
        assert_eq!(lines.len(), 5);
        assert!(lines.last().unwrap().contains("Runner msg 10"));
        assert!(lines.first().unwrap().contains("Runner msg 6"));

        for i in 1..=5 {
            logger.log_api("GET", "/test", 200, i as f64).await;
        }

        let api_content = logger.read_logs("api").await;
        let api_lines: Vec<&str> = api_content.lines().collect();
        assert_eq!(api_lines.len(), 3);
    }
}
