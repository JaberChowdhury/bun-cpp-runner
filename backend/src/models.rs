use serde::{Deserialize, Deserializer, Serialize, Serializer};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Language {
    Cpp,
    Rust,
}

impl Default for Language {
    fn default() -> Self {
        Language::Cpp
    }
}

impl Language {
    pub fn as_str(&self) -> &'static str {
        match self {
            Language::Cpp => "cpp",
            Language::Rust => "rust",
        }
    }

    pub fn file_extension(&self) -> &'static str {
        match self {
            Language::Cpp => "cpp",
            Language::Rust => "rs",
        }
    }
}

impl Serialize for Language {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for Language {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        match s.to_ascii_lowercase().as_str() {
            "cpp" | "c++" => Ok(Language::Cpp),
            "rust" | "rs" => Ok(Language::Rust),
            other => Err(serde::de::Error::custom(format!(
                "Unsupported language '{}'. Supported languages: 'cpp', 'rust'",
                other
            ))),
        }
    }
}

fn default_memory_limit_mb() -> Option<u64> {
    Some(256)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteRequest {
    #[serde(default)]
    pub language: Language,
    pub code: String,
    #[serde(default)]
    pub input: Option<String>,
    #[serde(default)]
    pub expected_output: Option<String>,
    #[serde(default)]
    pub validate_output: bool,
    #[serde(default)]
    pub compiler_flags: Vec<String>,
    #[serde(default = "default_memory_limit_mb")]
    pub memory_limit_mb: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteResponse {
    pub status: String,
    #[serde(rename = "type")]
    pub execution_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    pub r#match: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time: Option<String>,
    pub compile_time: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory_kb: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub date: String,
    pub language: Language,
    pub code: String,
    #[serde(default)]
    pub input: Option<String>,
    #[serde(default)]
    pub expected_output: Option<String>,
    #[serde(default)]
    pub validate_output: bool,
    pub status: String,
    #[serde(rename = "type")]
    pub execution_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(default)]
    pub r#match: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub time: Option<String>,
    #[serde(default)]
    pub compile_time: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub memory: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub memory_kb: Option<u64>,
}

pub struct Verdict;

impl Verdict {
    pub const ACCEPTED: &'static str = "Accepted";
    pub const WRONG_ANSWER: &'static str = "Wrong Answer";
    pub const TIME_LIMIT_EXCEEDED: &'static str = "Time Limit Exceeded";
    pub const MEMORY_LIMIT_EXCEEDED: &'static str = "Memory Limit Exceeded";
    pub const RUNTIME_ERROR: &'static str = "Runtime Error";
    pub const COMPILATION_ERROR: &'static str = "Compilation Error";

    pub const STATUS_SUCCESS: &'static str = "success";
    pub const STATUS_ERROR: &'static str = "error";
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_language_serde() {
        let cpp_json = serde_json::to_string(&Language::Cpp).unwrap();
        assert_eq!(cpp_json, "\"cpp\"");

        let rust_json = serde_json::to_string(&Language::Rust).unwrap();
        assert_eq!(rust_json, "\"rust\"");

        let parsed_cpp: Language = serde_json::from_str("\"c++\"").unwrap();
        assert_eq!(parsed_cpp, Language::Cpp);

        let parsed_rust: Language = serde_json::from_str("\"rust\"").unwrap();
        assert_eq!(parsed_rust, Language::Rust);
    }

    #[test]
    fn test_execute_request_defaults() {
        let json = r#"{"code": "int main() {}"}"#;
        let req: ExecuteRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.language, Language::Cpp);
        assert_eq!(req.validate_output, false);
        assert_eq!(req.compiler_flags.len(), 0);
        assert_eq!(req.input, None);
        assert_eq!(req.memory_limit_mb, Some(256));

        // Test explicit memory limit
        let json_with_limit = r#"{"code": "int main() {}", "memoryLimitMb": 512}"#;
        let req_with_limit: ExecuteRequest = serde_json::from_str(json_with_limit).unwrap();
        assert_eq!(req_with_limit.memory_limit_mb, Some(512));
    }

    #[test]
    fn test_execute_response_match_null() {
        let resp = ExecuteResponse {
            status: "success".to_string(),
            execution_type: "Accepted".to_string(),
            output: Some("Hello".to_string()),
            message: None,
            r#match: None,
            time: Some("1.23".to_string()),
            compile_time: "45.67".to_string(),
            memory: Some("14.2 MB".to_string()),
            memory_kb: Some(14540),
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains(r#""match":null"#));
        assert!(!json.contains(r#""message""#));
        assert!(json.contains(r#""memory":"14.2 MB""#));
        assert!(json.contains(r#""memoryKb":14540"#));
    }

    #[test]
    fn test_verdict_constants() {
        assert_eq!(Verdict::MEMORY_LIMIT_EXCEEDED, "Memory Limit Exceeded");
    }
}
