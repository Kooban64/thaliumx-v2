#include "order_book_wrapper.h"
#include <depth.h>
#include <iostream>
#include <sstream>

Napi::FunctionReference OrderBookWrapper::constructor;

Napi::Object OrderBookWrapper::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "OrderBook", {
    InstanceMethod("addOrder", &OrderBookWrapper::AddOrder),
    InstanceMethod("cancelOrder", &OrderBookWrapper::CancelOrder),
    InstanceMethod("replaceOrder", &OrderBookWrapper::ReplaceOrder),
    InstanceMethod("getOrderBook", &OrderBookWrapper::GetOrderBook),
    InstanceMethod("getDepth", &OrderBookWrapper::GetDepth),
    InstanceMethod("setMarketPrice", &OrderBookWrapper::SetMarketPrice)
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("OrderBook", func);
  return exports;
}

OrderBookWrapper::OrderBookWrapper(const Napi::CallbackInfo& info)
  : Napi::ObjectWrap<OrderBookWrapper>(info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  std::string symbol = "default";
  if (info.Length() > 0 && info[0].IsString()) {
    symbol = info[0].As<Napi::String>().Utf8Value();
  }

  orderBook_ = std::make_unique<liquibook::book::DepthOrderBook<std::shared_ptr<liquibook::book::Order>>>(symbol);
}

Napi::Value OrderBookWrapper::AddOrder(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  try {
    if (info.Length() < 5) {
      Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
      return env.Null();
    }

    bool isBuy = info[0].As<Napi::Boolean>().Value();
    uint64_t price = static_cast<uint64_t>(info[1].As<Napi::Number>().DoubleValue());
    uint64_t quantity = static_cast<uint64_t>(info[2].As<Napi::Number>().DoubleValue());
    uint64_t stopPrice = static_cast<uint64_t>(info[3].As<Napi::Number>().DoubleValue());
    bool allOrNone = info[4].As<Napi::Boolean>().Value();
    bool immediateOrCancel = info.Length() > 5 ? info[5].As<Napi::Boolean>().Value() : false;

    auto order = std::make_shared<NodeOrder>(isBuy, price, quantity, stopPrice, allOrNone, immediateOrCancel);
    liquibook::book::OrderConditions conditions = 0;

    bool matched = orderBook_->add(order, conditions);

    return Napi::Boolean::New(env, matched);
  } catch (const std::exception& e) {
    Napi::Error::New(env, std::string("Error adding order: ") + e.what()).ThrowAsJavaScriptException();
    return env.Null();
  } catch (...) {
    Napi::Error::New(env, "Unknown error adding order").ThrowAsJavaScriptException();
    return env.Null();
  }
}

Napi::Value OrderBookWrapper::CancelOrder(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  // For simplicity, we'll need to find the order by some identifier
  // This is a simplified implementation - in practice you'd need order tracking
  Napi::Error::New(env, "Cancel order not fully implemented").ThrowAsJavaScriptException();
  return env.Null();
}

Napi::Value OrderBookWrapper::ReplaceOrder(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 3) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  // Simplified implementation
  Napi::Error::New(env, "Replace order not fully implemented").ThrowAsJavaScriptException();
  return env.Null();
}

Napi::Value OrderBookWrapper::GetOrderBook(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  try {
    Napi::Object result = Napi::Object::New(env);

    // Get bids
    Napi::Array bids = Napi::Array::New(env);
    int bidIndex = 0;
    for (auto it = orderBook_->bids().begin(); it != orderBook_->bids().end(); ++it) {
      Napi::Object bid = Napi::Object::New(env);
      bid.Set("price", Napi::Number::New(env, it->first.price()));
      bid.Set("quantity", Napi::Number::New(env, it->second.open_qty()));
      bids.Set(bidIndex++, bid);
    }

    // Get asks
    Napi::Array asks = Napi::Array::New(env);
    int askIndex = 0;
    for (auto it = orderBook_->asks().begin(); it != orderBook_->asks().end(); ++it) {
      Napi::Object ask = Napi::Object::New(env);
      ask.Set("price", Napi::Number::New(env, it->first.price()));
      ask.Set("quantity", Napi::Number::New(env, it->second.open_qty()));
      asks.Set(askIndex++, ask);
    }

    result.Set("bids", bids);
    result.Set("asks", asks);

    return result;
  } catch (const std::exception& e) {
    Napi::Error::New(env, std::string("Error getting order book: ") + e.what()).ThrowAsJavaScriptException();
    return env.Null();
  } catch (...) {
    Napi::Error::New(env, "Unknown error getting order book").ThrowAsJavaScriptException();
    return env.Null();
  }
}

Napi::Value OrderBookWrapper::GetDepth(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  try {
    Napi::Object result = Napi::Object::New(env);

    // Get depth levels from the order book
    auto& depth = orderBook_->depth();

    Napi::Array bids = Napi::Array::New(env);
    Napi::Array asks = Napi::Array::New(env);

    // Add bid depth levels
    int bidIndex = 0;
    const liquibook::book::DepthLevel* bidLevels = depth.bids();
    for (int i = 0; i < 5; ++i) {  // SIZE = 5
      const liquibook::book::DepthLevel& level = bidLevels[i];
      if (level.price() > 0 && level.price() != 0xFFFFFFFFFFFFFFFFULL) {  // Check for valid price
        Napi::Object bidLevel = Napi::Object::New(env);
        bidLevel.Set("price", Napi::Number::New(env, level.price()));
        bidLevel.Set("quantity", Napi::Number::New(env, level.aggregate_qty()));
        bids.Set(bidIndex++, bidLevel);
      }
    }

    // Add ask depth levels
    int askIndex = 0;
    const liquibook::book::DepthLevel* askLevels = depth.asks();
    for (int i = 0; i < 5; ++i) {  // SIZE = 5
      const liquibook::book::DepthLevel& level = askLevels[i];
      if (level.price() > 0 && level.price() != 0xFFFFFFFFFFFFFFFFULL) {  // Check for valid price
        Napi::Object askLevel = Napi::Object::New(env);
        askLevel.Set("price", Napi::Number::New(env, level.price()));
        askLevel.Set("quantity", Napi::Number::New(env, level.aggregate_qty()));
        asks.Set(askIndex++, askLevel);
      }
    }

    result.Set("bids", bids);
    result.Set("asks", asks);

    return result;
  } catch (const std::exception& e) {
    Napi::Error::New(env, std::string("Error getting depth: ") + e.what()).ThrowAsJavaScriptException();
    return env.Null();
  } catch (...) {
    Napi::Error::New(env, "Unknown error getting depth").ThrowAsJavaScriptException();
    return env.Null();
  }
}

Napi::Value OrderBookWrapper::SetMarketPrice(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  uint64_t price = static_cast<uint64_t>(info[0].As<Napi::Number>().DoubleValue());
  orderBook_->set_market_price(price);

  return env.Null();
}

// NodeOrder implementation
NodeOrder::NodeOrder(bool isBuy, liquibook::book::Price price, liquibook::book::Quantity qty,
                     liquibook::book::Price stopPrice, bool allOrNone, bool immediateOrCancel)
  : isBuy_(isBuy), price_(price), qty_(qty), stopPrice_(stopPrice),
    allOrNone_(allOrNone), immediateOrCancel_(immediateOrCancel) {}

bool NodeOrder::is_buy() const { return isBuy_; }
liquibook::book::Price NodeOrder::price() const { return price_; }
liquibook::book::Quantity NodeOrder::order_qty() const { return qty_; }
liquibook::book::Price NodeOrder::stop_price() const { return stopPrice_; }
bool NodeOrder::all_or_none() const { return allOrNone_; }
bool NodeOrder::immediate_or_cancel() const { return immediateOrCancel_; }