const express = require('express');
const cors = require('cors');
const { OrderBook } = require('./index');

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Store multiple order books by symbol
const orderBooks = new Map();

// Helper function to get or create order book
function getOrderBook(symbol = 'default') {
  if (!orderBooks.has(symbol)) {
    orderBooks.set(symbol, new OrderBook(symbol));
  }
  return orderBooks.get(symbol);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'liquibook-orderbook',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    activeOrderBooks: Array.from(orderBooks.keys())
  });
});

// Get order book depth
app.get('/orderbook/:symbol?', (req, res) => {
  try {
    const symbol = req.params.symbol || 'default';
    const orderBook = getOrderBook(symbol);
    const depth = orderBook.getDepth();
    
    res.json({
      symbol,
      timestamp: new Date().toISOString(),
      depth
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get order book depth', 
      message: error.message 
    });
  }
});

// Get full order book
app.get('/orderbook/:symbol/full', (req, res) => {
  try {
    const symbol = req.params.symbol;
    const orderBook = getOrderBook(symbol);
    const fullBook = orderBook.getOrderBook();
    
    res.json({
      symbol,
      timestamp: new Date().toISOString(),
      orderBook: fullBook
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get full order book', 
      message: error.message 
    });
  }
});

// Add order
app.post('/orderbook/:symbol/orders', (req, res) => {
  try {
    const symbol = req.params.symbol;
    const { 
      isBuy, 
      price, 
      quantity, 
      stopPrice = 0, 
      allOrNone = false, 
      immediateOrCancel = false 
    } = req.body;

    // Validate required fields
    if (typeof isBuy !== 'boolean') {
      return res.status(400).json({ error: 'isBuy must be a boolean' });
    }
    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ error: 'price must be a positive number' });
    }
    if (typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ error: 'quantity must be a positive number' });
    }

    const orderBook = getOrderBook(symbol);
    const result = orderBook.addOrder(isBuy, price, quantity, stopPrice, allOrNone, immediateOrCancel);
    
    res.json({
      symbol,
      orderId: result.orderId || result,
      status: 'added',
      timestamp: new Date().toISOString(),
      order: {
        isBuy,
        price,
        quantity,
        stopPrice,
        allOrNone,
        immediateOrCancel
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to add order', 
      message: error.message 
    });
  }
});

// Cancel order
app.delete('/orderbook/:symbol/orders/:orderId', (req, res) => {
  try {
    const symbol = req.params.symbol;
    const orderId = parseInt(req.params.orderId);
    
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'orderId must be a number' });
    }

    const orderBook = getOrderBook(symbol);
    const result = orderBook.cancelOrder(orderId);
    
    res.json({
      symbol,
      orderId,
      status: 'cancelled',
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to cancel order', 
      message: error.message 
    });
  }
});

// Replace order
app.put('/orderbook/:symbol/orders/:orderId', (req, res) => {
  try {
    const symbol = req.params.symbol;
    const orderId = parseInt(req.params.orderId);
    const { sizeDelta, newPrice } = req.body;
    
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'orderId must be a number' });
    }
    if (typeof sizeDelta !== 'number') {
      return res.status(400).json({ error: 'sizeDelta must be a number' });
    }
    if (typeof newPrice !== 'number' || newPrice <= 0) {
      return res.status(400).json({ error: 'newPrice must be a positive number' });
    }

    const orderBook = getOrderBook(symbol);
    const result = orderBook.replaceOrder(orderId, sizeDelta, newPrice);
    
    res.json({
      symbol,
      orderId,
      status: 'replaced',
      timestamp: new Date().toISOString(),
      sizeDelta,
      newPrice,
      result
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to replace order', 
      message: error.message 
    });
  }
});

// Set market price
app.post('/orderbook/:symbol/market-price', (req, res) => {
  try {
    const symbol = req.params.symbol;
    const { price } = req.body;
    
    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ error: 'price must be a positive number' });
    }

    const orderBook = getOrderBook(symbol);
    orderBook.setMarketPrice(price);
    
    res.json({
      symbol,
      marketPrice: price,
      status: 'updated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to set market price', 
      message: error.message 
    });
  }
});

// List all active order books
app.get('/orderbooks', (req, res) => {
  try {
    const books = Array.from(orderBooks.keys()).map(symbol => ({
      symbol,
      depth: orderBooks.get(symbol).getDepth()
    }));
    
    res.json({
      timestamp: new Date().toISOString(),
      count: books.length,
      orderBooks: books
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to list order books', 
      message: error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: error.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Liquibook Order Book Service running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📈 Order book API: http://localhost:${port}/orderbook/{symbol}`);
  console.log(`⚡ Service ready to handle order book operations`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});
