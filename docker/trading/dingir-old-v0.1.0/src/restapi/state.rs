use super::config::Settings;
use super::types::TickerResult;
use crate::models::{AccountDesc, MarketTrade};

use sqlx::postgres::Postgres;
use std::sync::RwLock;
use std::collections::HashMap;
use std::sync::Mutex;
use ttl_cache::TtlCache;
pub struct AppState {
    pub user_addr_map: Mutex<HashMap<String, AccountDesc>>,
    pub db: sqlx::pool::Pool<Postgres>,
    pub manage_channel: Option<tonic::transport::channel::Channel>,
    pub config: Settings,
    pub cache: AppCache,
}

pub struct TradingData {
    pub ticker_ret_cache: HashMap<String, TickerResult>,
    // Cache for recent trades API results
    pub recent_trades_cache: TtlCache<String, Vec<MarketTrade>>,
}

impl TradingData {
    pub fn new() -> Self {
        let recent_trades_cache = TtlCache::new(100); // Cache up to 100 different market/limit combinations

        TradingData {
            ticker_ret_cache: HashMap::new(),
            recent_trades_cache,
        }
    }
}

impl std::fmt::Debug for TradingData {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TradingData")
            .field("ticker_ret_cache", &self.ticker_ret_cache)
            .field("recent_trades_cache", &"<TtlCache>")
            .finish()
    }
}

impl Default for TradingData {
    fn default() -> Self {
        Self::new()
    }
}

//TLS storage
#[derive(Debug)]
pub struct AppCache {
    pub trading: RwLock<TradingData>,
}

impl AppCache {
    pub fn new() -> Self {
        AppCache {
            trading: RwLock::new(TradingData::new()),
        }
    }
}

impl Default for AppCache {
    fn default() -> Self {
        Self::new()
    }
}
