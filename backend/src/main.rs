use std::net::SocketAddr;
use std::sync::Arc;

use axum::http::{header, HeaderValue, Method};
use backend::config::Config;
use backend::routes;
use backend::services::history::HistoryService;
use backend::services::logger::{AppLogger, RunnerLogLevel};
use backend::AppState;
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing subscriber for any library tracing
    tracing_subscriber::fmt::init();

    let config = Arc::new(Config::new());

    let logger = Arc::new(AppLogger::new(
        config.runner_log_file.clone(),
        config.api_log_file.clone(),
        config.max_runner_logs,
        config.max_api_logs,
    ));

    let history = Arc::new(
        HistoryService::new(config.history_file.clone(), config.max_history).await,
    );

    let state = AppState {
        config: config.clone(),
        logger: logger.clone(),
        history,
    };

    // CORS layer configured for frontend dev server
    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:5173".parse::<HeaderValue>()?,
            "http://127.0.0.1:5173".parse::<HeaderValue>()?,
            "http://localhost:3000".parse::<HeaderValue>()?,
            "http://127.0.0.1:3000".parse::<HeaderValue>()?,
        ])
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::OPTIONS,
            Method::PUT,
            Method::DELETE,
        ])
        .allow_headers([
            header::CONTENT_TYPE,
            header::ACCEPT,
            header::AUTHORIZATION,
            header::ORIGIN,
        ]);

    let app = routes::create_router(state).layer(cors);

    let bind_addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    let listener = tokio::net::TcpListener::bind(bind_addr).await?;

    logger
        .log_runner(
            RunnerLogLevel::Info,
            "C++/Rust Professional Workspace Started.",
        )
        .await;

    println!("📡 \x1b[4mhttp://localhost:{}\x1b[0m\n", config.port);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    println!("\nServer gracefully shut down.");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(_) => {
                std::future::pending::<()>().await;
            }
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
