#include <napi.h>
#include "order_book_wrapper.h"

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  OrderBookWrapper::Init(env, exports);
  return exports;
}

NODE_API_MODULE(liquibook, Init)