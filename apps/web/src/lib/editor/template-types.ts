import type { Room, Wall } from './document';

export interface TemplatePreview {
  walls: Wall[];
  rooms: Room[];
}

export interface BuiltInTemplateSummary {
  id: string;
  label: string;
  description: string;
  preview: TemplatePreview;
}

export interface CustomTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  preview: TemplatePreview;
}
