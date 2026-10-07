use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub time_limit_ms: u64,
    pub max_history: usize,
    pub max_runner_logs: usize,
    pub max_api_logs: usize,
    pub history_file: PathBuf,
    pub runner_log_file: PathBuf,
    pub api_log_file: PathBuf,
}

impl Default for Config {
    fn default() -> Self {
        Self::new()
    }
}

impl Config {
    pub fn new() -> Self {
        let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = std::env::var("PORT")
            .ok()
            .and_then(|p| p.parse::<u16>().ok())
            .unwrap_or(3000);

        let time_limit_ms = std::env::var("TIME_LIMIT_MS")
            .ok()
            .and_then(|t| t.parse::<u64>().ok())
            .unwrap_or(3000);

        let max_history = std::env::var("MAX_HISTORY")
            .ok()
            .and_then(|m| m.parse::<usize>().ok())
            .unwrap_or(50);

        let max_runner_logs = std::env::var("MAX_RUNNER_LOGS")
            .ok()
            .and_then(|m| m.parse::<usize>().ok())
            .unwrap_or(400);

        let max_api_logs = std::env::var("MAX_API_LOGS")
            .ok()
            .and_then(|m| m.parse::<usize>().ok())
            .unwrap_or(200);

        // Resolve directory for state files (history.json, runner.log, api.log)
        // If specified via environment variables, use those.
        // Otherwise, if running inside `backend/` and `../history.json` or `../SPECIFICATION.md` exists,
        // use parent dir so it shares with workspace root.
        let base_dir = Self::resolve_base_dir();

        let history_file = std::env::var("HISTORY_FILE")
            .map(PathBuf::from)
            .unwrap_or_else(|_| base_dir.join("history.json"));

        let runner_log_file = std::env::var("RUNNER_LOG_FILE")
            .map(PathBuf::from)
            .unwrap_or_else(|_| base_dir.join("runner.log"));

        let api_log_file = std::env::var("API_LOG_FILE")
            .map(PathBuf::from)
            .unwrap_or_else(|_| base_dir.join("api.log"));

        Self {
            host,
            port,
            time_limit_ms,
            max_history,
            max_runner_logs,
            max_api_logs,
            history_file,
            runner_log_file,
            api_log_file,
        }
    }

    fn resolve_base_dir() -> PathBuf {
        let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

        // If history.json exists in current dir, use current dir
        if current_dir.join("history.json").exists() {
            return current_dir;
        }

        // If parent has history.json or context directory, use parent dir
        if let Some(parent) = current_dir.parent() {
            if parent.join("history.json").exists() || parent.join("context").is_dir() {
                return parent.to_path_buf();
            }
        }

        current_dir
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_defaults() {
        let config = Config::new();
        assert_eq!(config.port, 3000);
        assert_eq!(config.time_limit_ms, 3000);
        assert_eq!(config.max_history, 50);
        assert_eq!(config.max_runner_logs, 400);
        assert_eq!(config.max_api_logs, 200);
    }
}
