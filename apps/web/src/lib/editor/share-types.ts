export interface ShareLink {
  id: string;
  projectId: string;
  token: string;
  createdBy: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  url: string;
}
