export type SharePermission = 'editor' | 'viewer';

export interface SeededUser {
  id: string;
  name: string;
  email: string;
  role: string;
  initials: string;
}

export interface DocumentShare {
  userId: string;
  permission: SharePermission;
  grantedAt: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  contentHtml: string;
  ownerId: string;
  sharedWith: DocumentShare[];
  createdAt: string;
  updatedAt: string;
  lastEditedById: string;
  sourceFormat?: 'native' | 'txt' | 'md' | 'docx';
}

export interface HydratedShare {
  userId: string;
  name: string;
  email: string;
  initials: string;
  permission: SharePermission;
  grantedAt: string;
}

export interface DocumentDTO {
  id: string;
  title: string;
  contentHtml: string;
  ownerId: string;
  owner: SeededUser;
  isOwner: boolean;
  accessRole: 'owner' | SharePermission;
  sharedWith: HydratedShare[];
  createdAt: string;
  updatedAt: string;
  lastEditedBy: SeededUser;
  sourceFormat: 'native' | 'txt' | 'md' | 'docx';
  wordCount: number;
}

export type DocumentFilter = 'all' | 'owned' | 'shared';
