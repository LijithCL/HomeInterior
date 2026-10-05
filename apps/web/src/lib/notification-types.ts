export type NotificationType = 'COMMENT_POSTED' | 'SHARE_LINK_VIEWED' | 'RENDER_COMPLETED';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  projectId: string | null;
  linkPath: string | null;
  readAt: string | null;
  createdAt: string;
}
