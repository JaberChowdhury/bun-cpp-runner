pub mod config;
pub mod handlers;
pub mod models;
pub mod routes;
pub mod services;

use std::sync::Arc;
use config::Config;
use services::history::HistoryService;
use services::logger::AppLogger;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub logger: Arc<AppLogger>,
    pub history: Arc<HistoryService>,
}
