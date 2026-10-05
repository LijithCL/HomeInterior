export interface Comment {
  id: string;
  projectId: string;
  floorId: string | null;
  x: number | null;
  y: number | null;
  body: string;
  authorId: string | null;
  authorName: string | null;
  resolved: boolean;
  createdAt: string;
}
