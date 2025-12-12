use super::config::Settings;
use super::types::TickerResult;
use crate::models::{AccountDesc, MarketTrade};

use sqlx::postgres::Postgres;
use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use ttl_cache::TtlCache;
pub struct AppState {
    pub user_addr_map: Mutex<HashMap<String, AccountDesc>>,
    pub db: sqlx::pool::Pool<Postgres>,
    pub manage_channel: Option<tonic::transport::channel::Channel>,
    pub config: Settings,
    pub cache: AppCache,
}

#[derive(Debug)]
pub struct TradingData {
    pub ticker_ret_cache: HashMap<String, TickerResult>,
    // Cache for recent trades API results
    pub recent_trades_cache: TtlCache<String, Vec<MarketTrade>>,
}

impl TradingData {
    pub fn new() -> Self {
        let mut recent_trades_cache = TtlCache::new(100); // Cache up to 100 different market/limit combinations
        recent_trades_cache.set_default_ttl(Duration::from_secs(5)); // 5 second TTL for trade data

        TradingData {
            ticker_ret_cache: HashMap::new(),
            recent_trades_cache,
        }
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
    pub trading: RefCell<TradingData>,
}

impl AppCache {
    pub fn new() -> Self {
        AppCache {
            trading: TradingData::new().into(),
        }
    }
}

impl Default for AppCache {
    fn default() -> Self {
        Self::new()
    }
}
