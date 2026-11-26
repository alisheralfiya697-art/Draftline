import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { AuthService } from './auth.js';
import {
  ImportValidationError,
  MAX_IMPORT_BYTES,
  parseImportedFile,
} from './importer.js';
import { DocumentStore, StoreError } from './store.js';

interface AuthenticatedRequest extends Request {
  activeUserId?: string;
  tokenJti?: string;
  tokenExp?: number;
}

export function createApiApp(
  store: DocumentStore,
  auth = new AuthService()
) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use(express.json({ limit: '2mb' }));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_IMPORT_BYTES,
      files: 1,
    },
  });

  const requireAuth = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const verified = auth.verifyBearerToken(req.header('authorization'));
    if (!verified) {
      res.status(401).json({
        error: 'Authentication required. Please sign in to continue.',
      });
      return;
    }
    req.activeUserId = verified.user.id;
    req.tokenJti = verified.jti;
    req.tokenExp = verified.exp;
    next();
  };

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/auth/demo-accounts', (_req, res) => {
    res.json({
      authMode: 'simulated-demo',
      accounts: auth.listDemoAccounts(),
    });
  });

  app.post('/api/auth/demo-login', (req, res, next) => {
    try {
      const { userId, email } = req.body ?? {};
      if (
        (typeof userId !== 'string' || !userId.trim()) &&
        (typeof email !== 'string' || !email.trim())
      ) {
        throw new StoreError('Provide a demo userId or email to sign in.', 400);
      }
      const session = auth.issueDemoSession({ userId, email });
      if (!session) {
        throw new StoreError('Selected demo account was not found.', 404);
      }
      res.json(session);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = store.getUserById(req.activeUserId!);
    res.json({ user });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.tokenJti && req.tokenExp) {
      auth.revokeToken(req.tokenJti, req.tokenExp);
    }
    res.status(204).send();
  });

  app.get('/api/users', requireAuth, (_req, res) => {
    res.json({ users: store.getUsers() });
  });

  app.get('/api/documents', requireAuth, (req: AuthenticatedRequest, res) => {
    const documents = store.listForUser(req.activeUserId!);
    res.json({ documents });
  });

  app.post('/api/documents', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const { title, contentHtml } = req.body ?? {};
      const document = store.createDocument({
        userId: req.activeUserId!,
        title,
        contentHtml,
      });
      res.status(201).json({ document });
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/documents/import',
    requireAuth,
    upload.single('file'),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        if (!req.file) {
          throw new ImportValidationError(
            'Please choose a .txt, .md, or .docx file to upload.'
          );
        }

        const parsed = await parseImportedFile({
          originalName: req.file.originalname,
          buffer: req.file.buffer,
          mimeType: req.file.mimetype,
        });

        const overrideTitle =
          typeof req.body?.title === 'string' && req.body.title.trim().length > 0
            ? req.body.title.trim()
            : parsed.title;

        const document = store.createDocument({
          userId: req.activeUserId!,
          title: overrideTitle,
          contentHtml: parsed.contentHtml,
          sourceFormat: parsed.sourceFormat,
        });

        res.status(201).json({ document });
      } catch (err) {
        next(err);
      }
    }
  );

  app.get('/api/documents/:id', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const document = store.getForUser(req.params.id, req.activeUserId!);
      res.json({ document });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/documents/:id', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const { title, contentHtml } = req.body ?? {};
      if (title === undefined && contentHtml === undefined) {
        throw new StoreError(
          'Provide at least a title or contentHtml update.',
          400
        );
      }
      const document = store.updateDocument({
        docId: req.params.id,
        userId: req.activeUserId!,
        title,
        contentHtml,
      });
      res.json({ document });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/documents/:id', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      store.deleteDocument(req.params.id, req.activeUserId!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  app.put(
    '/api/documents/:id/shares',
    requireAuth,
    (req: AuthenticatedRequest, res, next) => {
      try {
        const { userId, permission } = req.body ?? {};
        if (typeof userId !== 'string' || !userId.trim()) {
          throw new StoreError('A valid target userId is required.', 400);
        }
        const document = store.grantShare({
          docId: req.params.id,
          ownerId: req.activeUserId!,
          targetUserId: userId.trim(),
          permission,
        });
        res.json({ document });
      } catch (err) {
        next(err);
      }
    }
  );

  app.delete(
    '/api/documents/:id/shares/:targetUserId',
    requireAuth,
    (req: AuthenticatedRequest, res, next) => {
      try {
        const document = store.revokeShare({
          docId: req.params.id,
          ownerId: req.activeUserId!,
          targetUserId: req.params.targetUserId,
        });
        res.json({ document });
      } catch (err) {
        next(err);
      }
    }
  );

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof StoreError || err instanceof ImportValidationError) {
      res.status(err.status).json({ error: err.message });
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'File exceeds the 5 MB upload limit.' });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }

    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Malformed JSON request body.' });
      return;
    }

    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  return app;
}
