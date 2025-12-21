#ifndef ORDER_BOOK_WRAPPER_H
#define ORDER_BOOK_WRAPPER_H

#include <napi.h>
#include <memory>
#include <depth_order_book.h>
#include <order.h>

class OrderBookWrapper : public Napi::ObjectWrap<OrderBookWrapper> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  OrderBookWrapper(const Napi::CallbackInfo& info);

private:
  // Constructor
  static Napi::FunctionReference constructor;

  // Instance methods
  Napi::Value AddOrder(const Napi::CallbackInfo& info);
  Napi::Value CancelOrder(const Napi::CallbackInfo& info);
  Napi::Value ReplaceOrder(const Napi::CallbackInfo& info);
  Napi::Value GetOrderBook(const Napi::CallbackInfo& info);
  Napi::Value GetDepth(const Napi::CallbackInfo& info);
  Napi::Value SetMarketPrice(const Napi::CallbackInfo& info);

  // Internal order book instance
  std::unique_ptr<liquibook::book::DepthOrderBook<std::shared_ptr<liquibook::book::Order>>> orderBook_;
};

// Custom Order implementation for Node.js
class NodeOrder : public liquibook::book::Order {
public:
  NodeOrder(bool isBuy, liquibook::book::Price price, liquibook::book::Quantity qty,
            liquibook::book::Price stopPrice = 0, bool allOrNone = false, bool immediateOrCancel = false);

  virtual bool is_buy() const override;
  virtual liquibook::book::Price price() const override;
  virtual liquibook::book::Quantity order_qty() const override;
  virtual liquibook::book::Price stop_price() const override;
  virtual bool all_or_none() const override;
  virtual bool immediate_or_cancel() const override;

private:
  bool isBuy_;
  liquibook::book::Price price_;
  liquibook::book::Quantity qty_;
  liquibook::book::Price stopPrice_;
  bool allOrNone_;
  bool immediateOrCancel_;
};

#endif // ORDER_BOOK_WRAPPER_H