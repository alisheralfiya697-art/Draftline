import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApiApp } from '../server/app.js';
import { DocumentStore } from '../server/store.js';

describe('Draftline API, persistence, sharing, and file import', () => {
  let tmpDir: string;
  let dbPath: string;
  let app: ReturnType<typeof createApiApp>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draftline-test-'));
    dbPath = path.join(tmpDir, 'documents.json');
    const store = new DocumentStore(dbPath);
    app = createApiApp(store);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('requires a valid X-User-Id header for document endpoints', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(401);

    const invalid = await request(app)
      .get('/api/documents')
      .set('X-User-Id', 'unknown-user');
    expect(invalid.status).toBe(401);
  });

  it('creates, renames, updates rich-text content, and persists across store reloads', async () => {
    const createdRes = await request(app)
      .post('/api/documents')
      .set('X-User-Id', 'user-maya')
      .send({ title: 'Sprint Review Notes' });

    expect(createdRes.status).toBe(201);
    const docId = createdRes.body.document.id as string;
    expect(createdRes.body.document.title).toBe('Sprint Review Notes');
    expect(createdRes.body.document.isOwner).toBe(true);

    // Reject empty title rename
    const badRename = await request(app)
      .patch(`/api/documents/${docId}`)
      .set('X-User-Id', 'user-maya')
      .send({ title: '   ' });
    expect(badRename.status).toBe(400);

    // Save formatted rich-text content + valid rename
    const updateRes = await request(app)
      .patch(`/api/documents/${docId}`)
      .set('X-User-Id', 'user-maya')
      .send({
        title: 'Sprint Review Final',
        contentHtml:
          '<h1>Summary</h1><p><strong>Shipped</strong> <u>persistence</u> and <em>sharing</em>.</p><ul><li><p>Item 1</p></li></ul>',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.document.title).toBe('Sprint Review Final');
    expect(updateRes.body.document.wordCount).toBe(7);

    // Simulate server restart / reload by instantiating a new DocumentStore on the same file
    const reloadedApp = createApiApp(new DocumentStore(dbPath));
    const fetchAfterReload = await request(reloadedApp)
      .get(`/api/documents/${docId}`)
      .set('X-User-Id', 'user-maya');

    expect(fetchAfterReload.status).toBe(200);
    expect(fetchAfterReload.body.document.title).toBe('Sprint Review Final');
    expect(fetchAfterReload.body.document.contentHtml).toContain('<u>persistence</u>');
  });

  it('enforces owner, editor, viewer, and unshared access rules', async () => {
    const createRes = await request(app)
      .post('/api/documents')
      .set('X-User-Id', 'user-maya')
      .send({ title: 'Private Proposal', contentHtml: '<p>Initial draft</p>' });
    const docId = createRes.body.document.id as string;

    // Unshared user cannot read
    const deniedRead = await request(app)
      .get(`/api/documents/${docId}`)
      .set('X-User-Id', 'user-carlos');
    expect(deniedRead.status).toBe(403);

    // Owner grants viewer access to Carlos
    const shareViewer = await request(app)
      .put(`/api/documents/${docId}/shares`)
      .set('X-User-Id', 'user-maya')
      .send({ userId: 'user-carlos', permission: 'viewer' });
    expect(shareViewer.status).toBe(200);

    // Carlos sees document as shared (not owned) with viewer role
    const carlosList = await request(app)
      .get('/api/documents')
      .set('X-User-Id', 'user-carlos');
    const sharedEntry = carlosList.body.documents.find(
      (d: { id: string }) => d.id === docId
    );
    expect(sharedEntry).toBeDefined();
    expect(sharedEntry.isOwner).toBe(false);
    expect(sharedEntry.accessRole).toBe('viewer');

    // Viewer cannot edit or delete
    const viewerEdit = await request(app)
      .patch(`/api/documents/${docId}`)
      .set('X-User-Id', 'user-carlos')
      .send({ contentHtml: '<p>Unauthorized edit</p>' });
    expect(viewerEdit.status).toBe(403);

    const viewerDelete = await request(app)
      .delete(`/api/documents/${docId}`)
      .set('X-User-Id', 'user-carlos');
    expect(viewerDelete.status).toBe(403);

    // Owner upgrades Carlos to editor
    const shareEditor = await request(app)
      .put(`/api/documents/${docId}/shares`)
      .set('X-User-Id', 'user-maya')
      .send({ userId: 'user-carlos', permission: 'editor' });
    expect(shareEditor.status).toBe(200);

    // Editor can save changes, but still cannot delete or manage shares
    const editorEdit = await request(app)
      .patch(`/api/documents/${docId}`)
      .set('X-User-Id', 'user-carlos')
      .send({ contentHtml: '<p>Approved collaborator edit</p>' });
    expect(editorEdit.status).toBe(200);

    const editorShareAttempt = await request(app)
      .put(`/api/documents/${docId}/shares`)
      .set('X-User-Id', 'user-carlos')
      .send({ userId: 'user-priya', permission: 'viewer' });
    expect(editorShareAttempt.status).toBe(403);

    const editorDeleteAttempt = await request(app)
      .delete(`/api/documents/${docId}`)
      .set('X-User-Id', 'user-carlos');
    expect(editorDeleteAttempt.status).toBe(403);
  });

  it('imports .txt and .md files into sanitized editable HTML and rejects invalid uploads', async () => {
    // Import .md containing unsafe <script> tag to verify sanitization
    const mdContent = [
      '# Release Checklist',
      '',
      'Verify **server validation** and *sanitization*.',
      '',
      '<script>alert("xss")</script>',
      '',
      '- Item alpha',
      '- Item beta',
    ].join('\n');

    const mdRes = await request(app)
      .post('/api/documents/import')
      .set('X-User-Id', 'user-maya')
      .attach('file', Buffer.from(mdContent, 'utf8'), 'release-checklist.md');

    expect(mdRes.status).toBe(201);
    expect(mdRes.body.document.title).toBe('release checklist');
    expect(mdRes.body.document.sourceFormat).toBe('md');
    expect(mdRes.body.document.contentHtml).toContain('<h1>Release Checklist</h1>');
    expect(mdRes.body.document.contentHtml).toContain('<strong>server validation</strong>');
    expect(mdRes.body.document.contentHtml).not.toContain('<script>');

    // Import .txt
    const txtRes = await request(app)
      .post('/api/documents/import')
      .set('X-User-Id', 'user-maya')
      .field('title', 'Meeting Transcript')
      .attach('file', Buffer.from('First paragraph.\n\nSecond paragraph.', 'utf8'), 'notes.txt');

    expect(txtRes.status).toBe(201);
    expect(txtRes.body.document.title).toBe('Meeting Transcript');
    expect(txtRes.body.document.contentHtml).toContain('<p>First paragraph.</p>');

    // Reject unsupported extension
    const badExt = await request(app)
      .post('/api/documents/import')
      .set('X-User-Id', 'user-maya')
      .attach('file', Buffer.from('binary', 'utf8'), 'diagram.png');
    expect(badExt.status).toBe(400);

    // Reject invalid .docx payload gracefully
    const badDocx = await request(app)
      .post('/api/documents/import')
      .set('X-User-Id', 'user-maya')
      .attach('file', Buffer.from('not a real zip docx', 'utf8'), 'broken.docx');
    expect(badDocx.status).toBe(400);
  });
});
