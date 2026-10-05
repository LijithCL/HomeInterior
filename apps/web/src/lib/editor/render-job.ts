export type RenderTier = 'PREVIEW' | 'HQ';
export type RenderStatus = 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';

export interface RenderJob {
  id: string;
  projectId: string;
  tier: RenderTier;
  status: RenderStatus;
  outputUrl: string | null;
  errorMessage: string | null;
}
