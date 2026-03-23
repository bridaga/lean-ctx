use anyhow::Result;
use rmcp::ServiceExt;
use tracing_subscriber::EnvFilter;

mod core;
mod server;
mod tools;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .with_writer(std::io::stderr)
        .init();

    tracing::info!("lean-ctx v1.0.0 starting");

    let server = tools::create_server();
    let transport = rmcp::transport::io::stdio();
    let service = server.serve(transport).await?;
    service.waiting().await?;

    Ok(())
}
