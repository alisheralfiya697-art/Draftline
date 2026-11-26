import type { DocumentRecord, SeededUser } from '../src/types/document.js';

export const SEEDED_USERS: SeededUser[] = [
  {
    id: 'user-maya',
    name: 'Maya Lin',
    email: 'maya@draftline.app',
    role: 'Product Lead',
    initials: 'ML',
  },
  {
    id: 'user-devon',
    name: 'Devon Brooks',
    email: 'devon@draftline.app',
    role: 'Staff Engineer',
    initials: 'DB',
  },
  {
    id: 'user-priya',
    name: 'Priya Nair',
    email: 'priya@draftline.app',
    role: 'Design Systems',
    initials: 'PN',
  },
  {
    id: 'user-carlos',
    name: 'Carlos Vega',
    email: 'carlos@draftline.app',
    role: 'Operations',
    initials: 'CV',
  },
];

export function createInitialDocuments(): DocumentRecord[] {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();

  return [
    {
      id: 'doc-q4-scope',
      title: 'Q4 Product Architecture & Scope',
      ownerId: 'user-maya',
      lastEditedById: 'user-maya',
      createdAt: hoursAgo(48),
      updatedAt: hoursAgo(2),
      sourceFormat: 'native',
      sharedWith: [
        { userId: 'user-devon', permission: 'editor', grantedAt: hoursAgo(36) },
        { userId: 'user-priya', permission: 'viewer', grantedAt: hoursAgo(18) },
      ],
      contentHtml: [
        '<h1>Q4 Product Architecture &amp; Scope</h1>',
        '<p>This brief aligns engineering and design around our core collaborative document workflow. We are intentionally prioritizing <strong>fast editing reliability</strong> and <em>predictable access control</em> over sprawling feature parity.</p>',
        '<h2>Core Functional Boundaries</h2>',
        '<ul>',
        '<li><p><strong>Rich-Text Formatting:</strong> Headings (H1–H3), bold, italic, underline, and bulleted or numbered lists.</p></li>',
        '<li><p><strong>Document Import:</strong> Upload <u>.txt, .md, and .docx</u> files directly into an editable document canvas.</p></li>',
        '<li><p><strong>Explicit Sharing:</strong> Owners can grant seeded team members editor or viewer permissions.</p></li>',
        '</ul>',
        '<h2>Open Decisions for Review</h2>',
        '<ol>',
        '<li><p>Confirm whether viewer permissions should allow local text export.</p></li>',
        '<li><p>Validate file size ceiling of 5 MB for uploaded Word documents.</p></li>',
        '</ol>',
      ].join(''),
    },
    {
      id: 'doc-design-notes',
      title: 'Editorial Typography & Sheet Guidelines',
      ownerId: 'user-maya',
      lastEditedById: 'user-maya',
      createdAt: hoursAgo(72),
      updatedAt: hoursAgo(14),
      sourceFormat: 'native',
      sharedWith: [],
      contentHtml: [
        '<h1>Editorial Typography &amp; Sheet Guidelines</h1>',
        '<p>Document pages should feel calm, legible, and free of visual clutter. Maintain a comfortable reading measure around <strong>65–75 characters per line</strong> and keep metadata quiet.</p>',
        '<h3>Spacing Rules</h3>',
        '<ul>',
        '<li><p>Use consistent heading hierarchy without skipping levels.</p></li>',
        '<li><p>Separate document sections with whitespace rather than nested boxes.</p></li>',
        '</ul>',
      ].join(''),
    },
    {
      id: 'doc-storage-rfc',
      title: 'Persistence & Sanitization Notes',
      ownerId: 'user-devon',
      lastEditedById: 'user-devon',
      createdAt: hoursAgo(28),
      updatedAt: hoursAgo(5),
      sourceFormat: 'md',
      sharedWith: [
        { userId: 'user-maya', permission: 'editor', grantedAt: hoursAgo(20) },
      ],
      contentHtml: [
        '<h1>Persistence &amp; Sanitization Notes</h1>',
        '<p>All document bodies are normalized and sanitized on the server before persistence so imported Markdown and Word files never introduce unsafe markup.</p>',
        '<h2>Verification Checklist</h2>',
        '<ol>',
        '<li><p>Validate incoming titles (1–160 characters, non-empty after trim).</p></li>',
        '<li><p>Verify ownership before allowing share changes or document deletion.</p></li>',
        '<li><p>Persist document updates atomically so browser refreshes keep latest edits.</p></li>',
        '</ol>',
      ].join(''),
    },
    {
      id: 'doc-onboarding-handbook',
      title: 'Team Operations Runbook',
      ownerId: 'user-priya',
      lastEditedById: 'user-priya',
      createdAt: hoursAgo(96),
      updatedAt: hoursAgo(24),
      sourceFormat: 'docx',
      sharedWith: [
        { userId: 'user-maya', permission: 'viewer', grantedAt: hoursAgo(22) },
        { userId: 'user-carlos', permission: 'editor', grantedAt: hoursAgo(20) },
      ],
      contentHtml: [
        '<h1>Team Operations Runbook</h1>',
        '<p>Shared reference for weekly sprint handoffs. This document is intentionally set to <em>view-only</em> for Maya to demonstrate permission enforcement.</p>',
        '<h3>Weekly Cadence</h3>',
        '<ul>',
        '<li><p><strong>Monday:</strong> Scope triage and milestone review.</p></li>',
        '<li><p><strong>Thursday:</strong> Release readiness and automated test check.</p></li>',
        '</ul>',
      ].join(''),
    },
  ];
}
