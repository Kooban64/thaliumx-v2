#![allow(dead_code)]
#![allow(clippy::collapsible_if)]
#![allow(clippy::let_and_return)]
#![allow(clippy::too_many_arguments)]
#![allow(clippy::single_char_pattern)]
// Clippy lint temporarily disabled for RefCell usage in async context
// #![allow(clippy::await_holding_refcell_ref)]

use dingir_exchange::config;
use dingir_exchange::controller::create_controller;
use dingir_exchange::persist;
use dingir_exchange::server::GrpcHandler;
//use dingir_exchange::sqlxextend;

use dingir_exchange::types::ConnectionType;
use fluidex_common::non_blocking_tracing;
use orchestra::rpc::exchange::matchengine_server::MatchengineServer;
use sqlx::Connection;

fn main() {
    dotenv::dotenv().ok();
    let _guard = non_blocking_tracing::setup();

    let rt: tokio::runtime::Runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("build runtime");

    rt.block_on(async {
        let server = prepare().await.expect("Init state error");
        grpc_run(server).await
    })
    .unwrap();
}

async fn prepare() -> anyhow::Result<GrpcHandler> {
    let mut settings = config::Settings::new();
    log::debug!("Settings: {:?}", settings);

    let mut conn = ConnectionType::connect(&settings.db_log)
        .await
        .expect(&*format!("cannot connect to db at {}", settings.db_log));
    persist::MIGRATOR.run(&mut conn).await?;
    log::info!("MIGRATOR done");

    let market_cfg = if settings.market_from_db {
        persist::init_config_from_db(&mut conn, &mut settings).await?
    } else {
        persist::MarketConfigs::new()
    };

    let mut grpc_stub = create_controller((settings.clone(), market_cfg));
    log::info!("grpc_stub created");
    grpc_stub.user_manager.load_users_from_db(&mut conn).await?;
    persist::init_from_db(&mut conn, &mut grpc_stub).await?;
    log::info!("init from db done");
    log::info!("Creating GrpcHandler...");
    let grpc = GrpcHandler::new(grpc_stub, settings);
    log::info!("GrpcHandler created successfully");
    Ok(grpc)
}

async fn grpc_run(mut grpc: GrpcHandler) -> Result<(), Box<dyn std::error::Error>> {
    log::info!("Starting gprc service - DISABLED FOR TESTING");
    // Temporarily disable server startup to isolate the crash
    // let addr = "0.0.0.0:50051".parse().unwrap();
    // log::info!("Starting gprc service");

    // let (tx, rx) = tokio::sync::oneshot::channel::<()>();
    // let on_leave = grpc.on_leave();  // <-- This might be the issue
    // log::info!("on_leave created");

    // tokio::spawn(async move {
    //     tokio::signal::ctrl_c().await.ok();
    //     log::info!("Ctrl-c received, shutting down");
    //     tx.send(()).ok();
    // });
    // log::info!("Signal handler spawned");

    // log::info!("Creating tonic server...");
    // let server = tonic::transport::Server::builder()
    //     .add_service(MatchengineServer::new(grpc));
    // log::info!("Server builder created");

    // server
    //     .serve_with_shutdown(addr, async {
    //         rx.await.ok();
    //     })
    //     .await?;

    // log::info!("Shutted down, wait for final clear");
    // on_leave.leave().await;
    // log::info!("Shutted down");
    Ok(())
}
