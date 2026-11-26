import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createApiApp } from './server/app.js';
import { AuthService } from './server/auth.js';
import { DocumentStore, resolveDataDir } from './server/store.js';

async function startServer() {
  const dataDir = resolveDataDir();
  const dbPath = path.join(dataDir, 'draftline.db');
  const store = new DocumentStore(dbPath);
  const auth = new AuthService();
  const app = createApiApp(store, auth);

  const port = Number(process.env.PORT) || 3000;
  const isProd =
    process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(
      `Draftline server running at http://localhost:${port} (db: ${dbPath})`
    );
  });

  const shutdown = () => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
