// Simple JavaScript-only OrderBook implementation for testing
class OrderBook {
  constructor(symbol = 'default') {
    this.symbol = symbol;
    this.buyOrders = [];
    this.sellOrders = [];
    this.orderIdCounter = 1;
    this.marketPrice = 0;
  }

  addOrder(isBuy, price, quantity, stopPrice = 0, allOrNone = false, immediateOrCancel = false) {
    const order = {
      orderId: this.orderIdCounter++,
      isBuy,
      price,
      quantity,
      stopPrice,
      allOrNone,
      immediateOrCancel,
      timestamp: new Date().toISOString()
    };

    if (isBuy) {
      this.buyOrders.push(order);
      this.buyOrders.sort((a, b) => b.price - a.price); // Sort by price descending
    } else {
      this.sellOrders.push(order);
      this.sellOrders.sort((a, b) => a.price - b.price); // Sort by price ascending
    }

    return order.orderId;
  }

  cancelOrder(orderId) {
    // Remove from buy orders
    const buyIndex = this.buyOrders.findIndex(order => order.orderId === orderId);
    if (buyIndex !== -1) {
      this.buyOrders.splice(buyIndex, 1);
      return true;
    }

    // Remove from sell orders
    const sellIndex = this.sellOrders.findIndex(order => order.orderId === orderId);
    if (sellIndex !== -1) {
      this.sellOrders.splice(sellIndex, 1);
      return true;
    }

    return false;
  }

  replaceOrder(orderId, sizeDelta, newPrice) {
    // Find and update order
    let order = this.buyOrders.find(o => o.orderId === orderId);
    if (order) {
      order.price = newPrice;
      order.quantity += sizeDelta;
      if (order.quantity <= 0) {
        this.cancelOrder(orderId);
        return false;
      }
      // Re-sort buy orders
      this.buyOrders.sort((a, b) => b.price - a.price);
      return true;
    }

    order = this.sellOrders.find(o => o.orderId === orderId);
    if (order) {
      order.price = newPrice;
      order.quantity += sizeDelta;
      if (order.quantity <= 0) {
        this.cancelOrder(orderId);
        return false;
      }
      // Re-sort sell orders
      this.sellOrders.sort((a, b) => a.price - b.price);
      return true;
    }

    return false;
  }

  getOrderBook() {
    return {
      symbol: this.symbol,
      buyOrders: this.buyOrders,
      sellOrders: this.sellOrders,
      marketPrice: this.marketPrice,
      timestamp: new Date().toISOString()
    };
  }

  getDepth() {
    const topBuy = this.buyOrders[0];
    const topSell = this.sellOrders[0];
    
    return {
      symbol: this.symbol,
      bestBid: topBuy ? { price: topBuy.price, quantity: topBuy.quantity } : null,
      bestAsk: topSell ? { price: topSell.price, quantity: topSell.quantity } : null,
      spread: topBuy && topSell ? topSell.price - topBuy.price : null,
      marketPrice: this.marketPrice,
      timestamp: new Date().toISOString()
    };
  }

  setMarketPrice(price) {
    this.marketPrice = price;
  }
}

module.exports = {
  OrderBook
};
