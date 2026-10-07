use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use std::path::Path;

use crate::handlers::{execute, history, logs};
use crate::AppState;

async fn api_logging_middleware(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Response {
    let start = std::time::Instant::now();
    let method = req.method().to_string();
    let path = req.uri().path().to_string();

    let res = next.run(req).await;

    let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;
    let status = res.status().as_u16();

    state.logger.log_api(&method, &path, status, elapsed_ms).await;

    res
}

async fn root_handler() -> impl IntoResponse {
    let possible_paths = [
        Path::new("public/index.html"),
        Path::new("../public/index.html"),
    ];

    for p in &possible_paths {
        if p.exists() {
            if let Ok(content) = tokio::fs::read_to_string(p).await {
                return (
                    [(axum::http::header::CONTENT_TYPE, "text/html; charset=utf-8")],
                    content,
                )
                    .into_response();
            }
        }
    }

    (
        [(axum::http::header::CONTENT_TYPE, "text/plain; charset=utf-8")],
        "C++/Rust Code Runner API",
    )
        .into_response()
}

async fn fallback_handler() -> (StatusCode, &'static str) {
    (StatusCode::NOT_FOUND, "Not Found")
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/", get(root_handler))
        .route("/execute", post(execute::execute))
        .route("/api/history", get(history::get_history))
        .route("/api/logs/{log_type}", get(logs::get_logs))
        .fallback(fallback_handler)
        .layer(middleware::from_fn_with_state(
            state.clone(),
            api_logging_middleware,
        ))
        .with_state(state)
}
