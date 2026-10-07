use axum::extract::State;
use axum::Json;
use crate::models::HistoryEntry;
use crate::AppState;

pub async fn get_history(State(state): State<AppState>) -> Json<Vec<HistoryEntry>> {
    let history = state.history.get_history().await;
    Json(history)
}
