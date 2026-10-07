use crate::models::HistoryEntry;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct HistoryService {
    history_file: PathBuf,
    max_history: usize,
    entries: Arc<RwLock<Vec<HistoryEntry>>>,
}

impl HistoryService {
    pub async fn new(history_file: PathBuf, max_history: usize) -> Self {
        let entries = Self::load_from_disk(&history_file, max_history).await;
        Self {
            history_file,
            max_history,
            entries: Arc::new(RwLock::new(entries)),
        }
    }

    async fn load_from_disk(path: &PathBuf, max_history: usize) -> Vec<HistoryEntry> {
        if !path.exists() {
            return Vec::new();
        }

        match fs::read_to_string(path).await {
            Ok(content) => {
                match serde_json::from_str::<Vec<HistoryEntry>>(&content) {
                    Ok(mut list) => {
                        if list.len() > max_history {
                            list.truncate(max_history);
                        }
                        list
                    }
                    Err(err) => {
                        eprintln!(
                            "Warning: Failed to parse history file at {:?}: {err}. Starting with empty history.",
                            path
                        );
                        Vec::new()
                    }
                }
            }
            Err(err) => {
                eprintln!("Warning: Failed to read history file at {:?}: {err}", path);
                Vec::new()
            }
        }
    }

    pub async fn add_entry(&self, entry: HistoryEntry) -> Result<(), std::io::Error> {
        let mut entries = self.entries.write().await;
        entries.insert(0, entry);
        if entries.len() > self.max_history {
            entries.truncate(self.max_history);
        }

        // Persist to disk atomically
        let json_data = serde_json::to_string_pretty(&*entries)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

        let parent = self
            .history_file
            .parent()
            .unwrap_or_else(|| std::path::Path::new("."));

        let temp_filename = format!(
            ".tmp_history_{}_{}.json",
            std::process::id(),
            chrono::Local::now().timestamp_nanos_opt().unwrap_or(0)
        );
        let temp_path = parent.join(temp_filename);

        fs::write(&temp_path, json_data.as_bytes()).await?;
        fs::rename(&temp_path, &self.history_file).await?;

        Ok(())
    }

    pub async fn get_history(&self) -> Vec<HistoryEntry> {
        let entries = self.entries.read().await;
        entries.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Language;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_history_cap_and_persistence() {
        let dir = tempdir().unwrap();
        let history_file = dir.path().join("history.json");

        let service = HistoryService::new(history_file.clone(), 3).await;

        for i in 1..=5 {
            let entry = HistoryEntry {
                id: format!("id{i}"),
                date: "test_date".to_string(),
                language: Language::Cpp,
                code: format!("int x = {i};"),
                input: None,
                expected_output: None,
                validate_output: false,
                status: "success".to_string(),
                execution_type: "Accepted".to_string(),
                output: Some(format!("output {i}")),
                message: None,
                r#match: None,
                time: Some("1.0".to_string()),
                compile_time: "10.0".to_string(),
                memory: Some("1.2 MB".to_string()),
                memory_kb: Some(1234),
            };
            service.add_entry(entry).await.unwrap();
        }

        let history = service.get_history().await;
        assert_eq!(history.len(), 3);
        assert_eq!(history[0].id, "id5");
        assert_eq!(history[1].id, "id4");
        assert_eq!(history[2].id, "id3");

        // Reload from disk to verify atomic persistence
        let reloaded = HistoryService::new(history_file, 3).await;
        let reloaded_history = reloaded.get_history().await;
        assert_eq!(reloaded_history.len(), 3);
        assert_eq!(reloaded_history[0].id, "id5");
    }
}
