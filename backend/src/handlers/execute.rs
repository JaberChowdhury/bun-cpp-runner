use axum::extract::State;
use axum::Json;
use crate::models::{ExecuteRequest, ExecuteResponse};
use crate::services::runner;
use crate::AppState;

pub async fn execute(
    State(state): State<AppState>,
    Json(payload): Json<ExecuteRequest>,
) -> Json<ExecuteResponse> {
    let response = runner::execute_code(
        payload,
        &state.config,
        &state.logger,
        &state.history,
    )
    .await;

    Json(response)
}
