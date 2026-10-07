use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use crate::AppState;

pub async fn get_logs(
    State(state): State<AppState>,
    Path(log_type): Path<String>,
) -> impl IntoResponse {
    let content = state.logger.read_logs(&log_type).await;

    if content.starts_with("Invalid log type") {
        (StatusCode::BAD_REQUEST, content)
    } else {
        (StatusCode::OK, content)
    }
}
