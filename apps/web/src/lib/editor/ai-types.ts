import type { DesignDocument } from './document';

export type AiRequestType = 'FULL_GENERATION' | 'SCOPED_EDIT' | 'IMAGE_TO_DESIGN';
export type AiRequestStatus = 'PENDING' | 'PROPOSED' | 'APPLIED' | 'REJECTED' | 'FAILED';

export interface AiRequest {
  id: string;
  projectId: string;
  type: AiRequestType;
  status: AiRequestStatus;
  prompt: string | null;
  inputImageUrl: string | null;
  baseDocument: DesignDocument;
  proposedDocument: DesignDocument | null;
  summary: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export function documentCounts(doc: DesignDocument) {
  return {
    rooms: doc.rooms.length,
    walls: doc.walls.length,
    objects: doc.objects.length,
    openings: doc.openings.length,
  };
}
