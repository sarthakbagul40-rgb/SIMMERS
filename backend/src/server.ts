import { app } from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[SIMMERS Server] Running on http://localhost:${PORT}`);
  console.log(`[SIMMERS Server] Environment: ${process.env.NODE_ENV || 'development'}`);
});
