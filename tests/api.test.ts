import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApiApp } from '../server/app.js';
import { AuthService } from '../server/auth.js';
import { DocumentStore } from '../server/store.js';

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildMinimalDocxBuffer(paragraphText: string): Buffer {
  const files: { name: string; content: Buffer }[] = [
    {
      name: '[Content_Types].xml',
      content: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
        'utf8'
      ),
    },
    {
      name: '_rels/.rels',
      content: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
        'utf8'
      ),
    },
    {
      name: 'word/document.xml',
      content: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${paragraphText}</w:t></w:r></w:p>
  </w:body>
</w:document>`,
        'utf8'
      ),
    },
  ];

  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const crc = crc32(file.content);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8); // stored (no compression)
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(file.content.length, 18);
    localHeader.writeUInt32LE(file.content.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, file.content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(file.content.length, 20);
    centralHeader.writeUInt32LE(file.content.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + file.content.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

describe('Draftline API, demo auth, SQLite persistence, sharing, and file import', () => {
  let tmpDir: string;
  let dbPath: string;
  let store: DocumentStore;
  let auth: AuthService;
  let app: ReturnType<typeof createApiApp>;

  async function signInAs(userId: string): Promise<string> {
    const res = await request(app)
      .post('/api/auth/demo-login')
      .send({ userId });
    expect(res.status).toBe(200);
    return res.body.token as string;
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draftline-test-'));
    dbPath = path.join(tmpDir, 'draftline.db');
    store = new DocumentStore(dbPath);
    auth = new AuthService('test-session-secret-key-0123456789');
    app = createApiApp(store, auth);
  });

  afterEach(() => {
    store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('requires valid Bearer authentication and supports demo login and logout revocation', async () => {
    const unauth = await request(app).get('/api/documents');
    expect(unauth.status).toBe(401);

    const forged = await request(app)
      .get('/api/documents')
      .set('Authorization', 'Bearer forged.token');
    expect(forged.status).toBe(401);

    const token = await signInAs('user-maya');
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe('user-maya');

    // Tampered token signature is rejected
    const [payloadPart] = token.split('.');
    const tampered = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${payloadPart}.invalidSignatureValue`);
    expect(tampered.status).toBe(401);

    // Logout revokes token immediately
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logoutRes.status).toBe(204);

    const afterLogout = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${token}`);
    expect(afterLogout.status).toBe(401);
  });

  it('creates, renames, handles concurrent updates, and persists across SQLite database reopen', async () => {
    const token = await signInAs('user-maya');

    const createdRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Sprint Review Notes' });

    expect(createdRes.status).toBe(201);
    const docId = createdRes.body.document.id as string;
    expect(createdRes.body.document.title).toBe('Sprint Review Notes');
    expect(createdRes.body.document.isOwner).toBe(true);

    // Reject empty title rename
    const badRename = await request(app)
      .patch(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '   ' });
    expect(badRename.status).toBe(400);

    // Save formatted rich-text content + valid rename
    const updateRes = await request(app)
      .patch(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Sprint Review Final',
        contentHtml:
          '<h1>Summary</h1><p><strong>Shipped</strong> <u>persistence</u> and <em>sharing</em>.</p><ul><li><p>Item 1</p></li></ul>',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.document.title).toBe('Sprint Review Final');
    expect(updateRes.body.document.wordCount).toBe(7);

    // Concurrent updates should serialize cleanly without SQLite errors
    const concurrentResults = await Promise.all([
      request(app)
        .patch(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Sprint Review Concurrent A' }),
      request(app)
        .patch(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          contentHtml:
            '<h1>Summary</h1><p><strong>Shipped</strong> <u>SQLite WAL</u> and <em>sharing</em>.</p>',
        }),
    ]);
    expect(concurrentResults[0].status).toBe(200);
    expect(concurrentResults[1].status).toBe(200);

    // Simulate server restart by closing and reopening DocumentStore on same DB path
    store.close();
    store = new DocumentStore(dbPath);
    const reloadedApp = createApiApp(store, auth);
    const fetchAfterReload = await request(reloadedApp)
      .get(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(fetchAfterReload.status).toBe(200);
    expect(fetchAfterReload.body.document.contentHtml).toContain('<u>SQLite WAL</u>');
  });

  it('enforces owner, editor, viewer, revocation, and unshared access rules', async () => {
    const mayaToken = await signInAs('user-maya');
    const carlosToken = await signInAs('user-carlos');
    const priyaToken = await signInAs('user-priya');

    const createRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${mayaToken}`)
      .send({ title: 'Private Proposal', contentHtml: '<p>Initial draft</p>' });
    const docId = createRes.body.document.id as string;

    // Unshared user cannot read
    const deniedRead = await request(app)
      .get(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${carlosToken}`);
    expect(deniedRead.status).toBe(403);

    // Owner grants viewer access to Carlos
    const shareViewer = await request(app)
      .put(`/api/documents/${docId}/shares`)
      .set('Authorization', `Bearer ${mayaToken}`)
      .send({ userId: 'user-carlos', permission: 'viewer' });
    expect(shareViewer.status).toBe(200);

    // Carlos sees document as shared (not owned) with viewer role
    const carlosList = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${carlosToken}`);
    const sharedEntry = carlosList.body.documents.find(
      (d: { id: string }) => d.id === docId
    );
    expect(sharedEntry).toBeDefined();
    expect(sharedEntry.isOwner).toBe(false);
    expect(sharedEntry.accessRole).toBe('viewer');

    // Viewer cannot edit or delete
    const viewerEdit = await request(app)
      .patch(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${carlosToken}`)
      .send({ contentHtml: '<p>Unauthorized edit</p>' });
    expect(viewerEdit.status).toBe(403);

    const viewerDelete = await request(app)
      .delete(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${carlosToken}`);
    expect(viewerDelete.status).toBe(403);

    // Owner upgrades Carlos to editor
    const shareEditor = await request(app)
      .put(`/api/documents/${docId}/shares`)
      .set('Authorization', `Bearer ${mayaToken}`)
      .send({ userId: 'user-carlos', permission: 'editor' });
    expect(shareEditor.status).toBe(200);

    // Editor can save changes, but still cannot delete or manage shares
    const editorEdit = await request(app)
      .patch(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${carlosToken}`)
      .send({ contentHtml: '<p>Approved collaborator edit</p>' });
    expect(editorEdit.status).toBe(200);

    const editorShareAttempt = await request(app)
      .put(`/api/documents/${docId}/shares`)
      .set('Authorization', `Bearer ${carlosToken}`)
      .send({ userId: 'user-priya', permission: 'viewer' });
    expect(editorShareAttempt.status).toBe(403);

    const editorDeleteAttempt = await request(app)
      .delete(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${carlosToken}`);
    expect(editorDeleteAttempt.status).toBe(403);

    // Owner revokes Carlos's access -> immediately denied
    const revokeRes = await request(app)
      .delete(`/api/documents/${docId}/shares/user-carlos`)
      .set('Authorization', `Bearer ${mayaToken}`);
    expect(revokeRes.status).toBe(200);

    const readAfterRevoke = await request(app)
      .get(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${carlosToken}`);
    expect(readAfterRevoke.status).toBe(403);

    // Unshared Priya also denied
    const priyaRead = await request(app)
      .get(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${priyaToken}`);
    expect(priyaRead.status).toBe(403);
  });

  it('imports .txt, .md, and valid .docx files into sanitized editable HTML and rejects invalid uploads', async () => {
    const token = await signInAs('user-maya');

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
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(mdContent, 'utf8'), 'release-checklist.md');

    expect(mdRes.status).toBe(201);
    expect(mdRes.body.document.title).toBe('release checklist');
    expect(mdRes.body.document.sourceFormat).toBe('md');
    expect(mdRes.body.document.contentHtml).toContain('<h1>Release Checklist</h1>');
    expect(mdRes.body.document.contentHtml).toContain('<strong>server validation</strong>');
    expect(mdRes.body.document.contentHtml).not.toContain('<script>');

    // Import .txt with UTF-8 BOM
    const txtRes = await request(app)
      .post('/api/documents/import')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Meeting Transcript')
      .attach('file', Buffer.from('\uFEFFFirst paragraph.\n\nSecond paragraph.', 'utf8'), 'notes.txt');

    expect(txtRes.status).toBe(201);
    expect(txtRes.body.document.title).toBe('Meeting Transcript');
    expect(txtRes.body.document.contentHtml).toContain('<p>First paragraph.</p>');

    // Import valid .docx
    const docxBuffer = buildMinimalDocxBuffer('Imported Word Document Content');
    const docxRes = await request(app)
      .post('/api/documents/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', docxBuffer, 'quarterly-memo.docx');

    expect(docxRes.status).toBe(201);
    expect(docxRes.body.document.title).toBe('quarterly memo');
    expect(docxRes.body.document.sourceFormat).toBe('docx');
    expect(docxRes.body.document.contentHtml).toContain('Imported Word Document Content');

    // Reject unsupported extension
    const badExt = await request(app)
      .post('/api/documents/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('binary', 'utf8'), 'diagram.png');
    expect(badExt.status).toBe(400);

    // Reject binary content disguised as .txt
    const binaryAsTxt = await request(app)
      .post('/api/documents/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a]), 'fake.txt');
    expect(binaryAsTxt.status).toBe(400);

    // Reject oversized file (> 5 MB)
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1024, 'a');
    const tooLargeRes = await request(app)
      .post('/api/documents/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', oversized, 'huge.txt');
    expect(tooLargeRes.status).toBe(400);

    // Reject invalid .docx payload gracefully (non-ZIP signature)
    const badDocx = await request(app)
      .post('/api/documents/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('not a real zip docx', 'utf8'), 'broken.docx');
    expect(badDocx.status).toBe(400);
    expect(badDocx.body.error).toContain('Invalid .docx file signature');
  });

  it('deletes owned documents cleanly and refuses to overwrite corrupted legacy JSON', async () => {
    const token = await signInAs('user-maya');
    const createRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Temporary Draft' });
    expect(createRes.status).toBe(201);
    const docId = createRes.body.document.id as string;

    const delRes = await request(app)
      .delete(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(204);

    const afterDelete = await request(app)
      .get(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(afterDelete.status).toBe(404);

    // Verify corrupt legacy JSON file triggers explicit error rather than silent data wipe
    const corruptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'draftline-corrupt-'));
    try {
      fs.writeFileSync(path.join(corruptDir, 'documents.json'), '{not-valid-json', 'utf8');
      expect(() => new DocumentStore(path.join(corruptDir, 'draftline.db'))).toThrow(
        /Refusing to overwrite corrupted legacy storage file/
      );
    } finally {
      fs.rmSync(corruptDir, { recursive: true, force: true });
    }
  });
});
