const express = require('express');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'mock-backend' });
});

// Mirror ThaliumX backend contract for gateway smoke tests
app.get('/api/csrf-token', (_req, res) => {
  res.status(200).json({ csrfToken: 'mock-csrf-token', success: true });
});

app.post('/api/auth/login', (_req, res) => {
  // Expected behavior for invalid creds
  res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });
});

app.get('/api/auth/profile', (_req, res) => {
  // Expected behavior for missing token
  res.status(401).json({ success: false, error: { code: 'MISSING_TOKEN', message: 'Access token required' } });
});

// Simple frontend-like responses
app.get('/token-presale', (_req, res) => {
  res.status(200).send('<html><body>mock token presale</body></html>');
});

app.get('/', (_req, res) => {
  res.status(200).send('<html><body>mock frontend</body></html>');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`mock-backend listening on ${port}`);
});

