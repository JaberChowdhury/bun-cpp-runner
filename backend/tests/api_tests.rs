use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use backend::config::Config;
use backend::models::{ExecuteRequest, ExecuteResponse, HistoryEntry, Language, Verdict};
use backend::routes;
use backend::services::history::HistoryService;
use backend::services::logger::AppLogger;
use backend::AppState;
use std::sync::Arc;
use tempfile::tempdir;
use tower::ServiceExt;

async fn setup_test_app() -> (axum::Router, tempfile::TempDir) {
    let dir = tempdir().unwrap();
    let runner_log = dir.path().join("runner.log");
    let api_log = dir.path().join("api.log");
    let history_file = dir.path().join("history.json");

    let mut config = Config::new();
    config.runner_log_file = runner_log.clone();
    config.api_log_file = api_log.clone();
    config.history_file = history_file.clone();
    config.time_limit_ms = 3000;

    let logger = Arc::new(AppLogger::new(runner_log, api_log, 400, 200));
    let history = Arc::new(HistoryService::new(history_file, 50).await);

    let state = AppState {
        config: Arc::new(config),
        logger,
        history,
    };

    let router = routes::create_router(state);
    (router, dir)
}

#[tokio::test]
async fn test_root_endpoint() {
    let (app, _dir) = setup_test_app().await;

    let response = app
        .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_execute_cpp_success() {
    let (app, _dir) = setup_test_app().await;

    let req_body = ExecuteRequest {
        language: Language::Cpp,
        code: r#"
            #include <iostream>
            int main() {
                std::cout << "Hello from C++!" << std::endl;
                return 0;
            }
        "#
        .to_string(),
        input: None,
        expected_output: Some("Hello from C++!".to_string()),
        validate_output: true,
        compiler_flags: vec!["-O3".to_string()],
        memory_limit_mb: Some(256),
    };

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/execute")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&req_body).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let resp: ExecuteResponse = serde_json::from_slice(&body_bytes).unwrap();

    assert_eq!(resp.status, Verdict::STATUS_SUCCESS);
    assert_eq!(resp.execution_type, Verdict::ACCEPTED);
    assert_eq!(resp.output.as_deref(), Some("Hello from C++!"));
    assert_eq!(resp.r#match, Some(true));
    assert!(resp.memory.is_some());
    assert!(resp.memory_kb.is_some());
}

#[tokio::test]
async fn test_execute_rust_wrong_answer() {
    let (app, _dir) = setup_test_app().await;

    let req_body = ExecuteRequest {
        language: Language::Rust,
        code: r#"
            fn main() {
                println!("100");
            }
        "#
        .to_string(),
        input: None,
        expected_output: Some("200".to_string()),
        validate_output: true,
        compiler_flags: vec![],
        memory_limit_mb: Some(256),
    };

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/execute")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&req_body).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let resp: ExecuteResponse = serde_json::from_slice(&body_bytes).unwrap();

    assert_eq!(resp.status, Verdict::STATUS_SUCCESS);
    assert_eq!(resp.execution_type, Verdict::WRONG_ANSWER);
    assert_eq!(resp.output.as_deref(), Some("100"));
    assert_eq!(resp.r#match, Some(false));
    assert!(resp.memory.is_some());
    assert!(resp.memory_kb.is_some());
}

#[tokio::test]
async fn test_execute_compilation_error() {
    let (app, _dir) = setup_test_app().await;

    let req_body = ExecuteRequest {
        language: Language::Cpp,
        code: "invalid cpp syntax !!!".to_string(),
        input: None,
        expected_output: None,
        validate_output: false,
        compiler_flags: vec![],
        memory_limit_mb: Some(256),
    };

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/execute")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&req_body).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let resp: ExecuteResponse = serde_json::from_slice(&body_bytes).unwrap();

    assert_eq!(resp.status, Verdict::STATUS_ERROR);
    assert_eq!(resp.execution_type, Verdict::COMPILATION_ERROR);
    assert!(resp.message.is_some());
    assert_eq!(resp.memory, None);
    assert_eq!(resp.memory_kb, None);
}

#[tokio::test]
async fn test_history_endpoint() {
    let (app, _dir) = setup_test_app().await;

    // 1. Execute one run
    let req_body = ExecuteRequest {
        language: Language::Rust,
        code: r#"
            fn main() {
                println!("History Test");
            }
        "#
        .to_string(),
        input: None,
        expected_output: None,
        validate_output: false,
        compiler_flags: vec![],
        memory_limit_mb: Some(256),
    };

    let _ = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/execute")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&req_body).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    // 2. Fetch history
    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/history")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let history: Vec<HistoryEntry> = serde_json::from_slice(&body_bytes).unwrap();

    assert_eq!(history.len(), 1);
    assert_eq!(history[0].language, Language::Rust);
    assert_eq!(history[0].output.as_deref(), Some("History Test"));
    assert!(history[0].memory.is_some());
    assert!(history[0].memory_kb.is_some());
}

#[tokio::test]
async fn test_logs_endpoint() {
    let (app, _dir) = setup_test_app().await;

    // Fetch runner logs
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/logs/runner")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    // Fetch api logs
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/logs/api")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    // Invalid log type
    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/logs/unknown")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_execute_memory_limit_exceeded() {
    let (app, _dir) = setup_test_app().await;

    // Allocate 30 MB while memory limit is 10 MB
    let req_body = ExecuteRequest {
        language: Language::Cpp,
        code: r#"
            #include <vector>
            #include <iostream>
            int main() {
                std::vector<char> v(30 * 1024 * 1024, 1);
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

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/execute")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&req_body).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let resp: ExecuteResponse = serde_json::from_slice(&body_bytes).unwrap();

    assert_eq!(resp.status, Verdict::STATUS_ERROR);
    assert_eq!(resp.execution_type, Verdict::MEMORY_LIMIT_EXCEEDED);
    assert!(resp.memory.is_some());
    assert!(resp.memory_kb.unwrap() > 10 * 1024);
    assert!(resp.message.is_some());
}

#[tokio::test]
async fn test_execute_bad_alloc_mle() {
    let (app, _dir) = setup_test_app().await;

    let req_body = ExecuteRequest {
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

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/execute")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&req_body).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let resp: ExecuteResponse = serde_json::from_slice(&body_bytes).unwrap();

    assert_eq!(resp.status, Verdict::STATUS_ERROR);
    assert_eq!(resp.execution_type, Verdict::MEMORY_LIMIT_EXCEEDED);
    assert!(resp.memory.is_some());
}

#[tokio::test]
async fn test_execute_json_default_memory_limit() {
    let (app, _dir) = setup_test_app().await;

    // JSON payload without memoryLimitMb - verifies default is used
    let json_payload = r##"{
        "language": "cpp",
        "code": "#include <iostream>\nint main() { std::cout << 99; return 0; }",
        "validateOutput": false
    }"##;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/execute")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(json_payload))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let resp: ExecuteResponse = serde_json::from_slice(&body_bytes).unwrap();

    assert_eq!(resp.status, Verdict::STATUS_SUCCESS);
    assert_eq!(resp.execution_type, Verdict::ACCEPTED);
    assert_eq!(resp.output.as_deref(), Some("99"));
    assert!(resp.memory.is_some());
    assert!(resp.memory_kb.is_some());
}
