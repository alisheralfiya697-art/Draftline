import express from 'express';
import os from 'node:os';
import path from 'node:path';
import serverless from 'serverless-http';
import { createApiApp } from '../../server/app.js';
import { AuthService } from '../../server/auth.js';
import { DocumentStore } from '../../server/store.js';

const dataDir = process.env.DATA_DIR?.trim()
  ? path.resolve(process.env.DATA_DIR.trim())
  : path.join(os.tmpdir(), 'draftline-data');

const store = new DocumentStore(path.join(dataDir, 'draftline.db'));
const auth = new AuthService();
const apiApp = createApiApp(store, auth);

const wrapper = express();
wrapper.use((req, _res, next) => {
  if (req.url.startsWith('/.netlify/functions/api')) {
    const suffix = req.url.slice('/.netlify/functions/api'.length);
    req.url = `/api${suffix.startsWith('/') ? suffix : `/${suffix}`}`.replace(
      /\/+$/,
      ''
    ) || '/api';
  } else if (!req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
  }
  next();
});
wrapper.use(apiApp);

export const handler = serverless(wrapper, {
  binary: ['multipart/form-data'],
});
