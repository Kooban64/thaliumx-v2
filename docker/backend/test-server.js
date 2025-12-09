console.log('Starting ThaliumX Backend...');

try {
  // Test basic imports
  const express = require('express');
  console.log('✓ Express imported successfully');
  
  const cors = require('cors');
  console.log('✓ CORS imported successfully');
  
  const helmet = require('helmet');
  console.log('✓ Helmet imported successfully');
  
  const morgan = require('morgan');
  console.log('✓ Morgan imported successfully');
  
  const compression = require('compression');
  console.log('✓ Compression imported successfully');
  
  const dotenv = require('dotenv');
  console.log('✓ Dotenv imported successfully');
  
  // Load environment variables
  dotenv.config();
  console.log('✓ Environment variables loaded');
  
  // Create basic app
  const app = express();
  console.log('✓ Express app created');
  
  // Basic middleware
  app.use(cors());
  app.use(helmet());
  app.use(morgan('combined'));
  app.use(compression());
  console.log('✓ Basic middleware configured');
  
  // Health check route
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'ThaliumX Backend is running'
    });
  });
  console.log('✓ Health check route configured');
  
  // Start server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Health check available at http://localhost:${PORT}/health`);
  });
  
} catch (error) {
  console.error('❌ Error starting backend:', error);
  process.exit(1);
}
