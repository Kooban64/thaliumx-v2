const liquibook = require('./build/Release/liquibook.node');

class OrderBook {
  constructor(symbol = 'default') {
    this.nativeOrderBook = new liquibook.OrderBook(symbol);
  }

  addOrder(isBuy, price, quantity, stopPrice = 0, allOrNone = false, immediateOrCancel = false) {
    return this.nativeOrderBook.addOrder(isBuy, price, quantity, stopPrice, allOrNone, immediateOrCancel);
  }

  cancelOrder(orderId) {
    return this.nativeOrderBook.cancelOrder(orderId);
  }

  replaceOrder(orderId, sizeDelta, newPrice) {
    return this.nativeOrderBook.replaceOrder(orderId, sizeDelta, newPrice);
  }

  getOrderBook() {
    return this.nativeOrderBook.getOrderBook();
  }

  getDepth() {
    return this.nativeOrderBook.getDepth();
  }

  setMarketPrice(price) {
    this.nativeOrderBook.setMarketPrice(price);
  }
}

module.exports = {
  OrderBook
};