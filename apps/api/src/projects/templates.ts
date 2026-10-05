import type { ProposedLayoutPlan } from '../ai/providers/ai-provider.interface';

// Hand-authored ProposedLayoutPlans, fed through the same
// buildDocumentFromPlan() the AI generator uses (see ai.service.ts), so a
// template produces exactly the same kind of real wall/room/door/furniture
// geometry as an AI-generated design — just without calling an AI provider.
export interface ProjectTemplate {
  id: string;
  label: string;
  description: string;
  plan: ProposedLayoutPlan;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'studio',
    label: 'Studio Apartment',
    description:
      'One open room with a sleeping, living, and kitchenette corner.',
    plan: {
      notes: 'Studio apartment starter layout.',
      rooms: [
        {
          name: 'Studio',
          kind: 'other',
          widthMm: 5500,
          lengthMm: 4500,
          furniture: [
            'double bed',
            'wardrobe',
            'sofa',
            'coffee table',
            'kitchen counter',
            'refrigerator',
          ],
        },
      ],
    },
  },
  {
    id: '1bhk',
    label: '1BHK Home',
    description: 'A living room, one bedroom, kitchen, and bathroom.',
    plan: {
      notes: '1BHK starter layout.',
      rooms: [
        {
          name: 'Living Room',
          kind: 'living',
          widthMm: 4000,
          lengthMm: 3500,
          furniture: ['sofa', 'coffee table', 'tv table'],
        },
        {
          name: 'Bedroom',
          kind: 'bedroom',
          widthMm: 3500,
          lengthMm: 3000,
          furniture: ['double bed', 'wardrobe', 'nightstand'],
        },
        {
          name: 'Kitchen',
          kind: 'kitchen',
          widthMm: 3000,
          lengthMm: 2500,
          furniture: [
            'kitchen counter',
            'refrigerator',
            'stove',
            'kitchen sink',
          ],
        },
        {
          name: 'Bathroom',
          kind: 'bathroom',
          widthMm: 2200,
          lengthMm: 1800,
          furniture: ['toilet', 'shower'],
        },
      ],
    },
  },
  {
    id: '2bhk',
    label: '2BHK Home',
    description: 'A living room, two bedrooms, kitchen, and bathroom.',
    plan: {
      notes: '2BHK starter layout.',
      rooms: [
        {
          name: 'Living Room',
          kind: 'living',
          widthMm: 4000,
          lengthMm: 3500,
          furniture: ['sofa', 'armchair', 'coffee table', 'tv table'],
        },
        {
          name: 'Bedroom 1',
          kind: 'bedroom',
          widthMm: 3500,
          lengthMm: 3000,
          furniture: ['double bed', 'wardrobe', 'nightstand'],
        },
        {
          name: 'Bedroom 2',
          kind: 'bedroom',
          widthMm: 3200,
          lengthMm: 3000,
          furniture: ['single bed', 'wardrobe', 'study table'],
        },
        {
          name: 'Kitchen',
          kind: 'kitchen',
          widthMm: 3000,
          lengthMm: 2500,
          furniture: [
            'kitchen counter',
            'refrigerator',
            'stove',
            'kitchen sink',
          ],
        },
        {
          name: 'Bathroom',
          kind: 'bathroom',
          widthMm: 2200,
          lengthMm: 1800,
          furniture: ['toilet', 'shower'],
        },
      ],
    },
  },
  {
    id: 'living-room',
    label: 'Living Room',
    description: 'A single furnished living/dining room to start decorating.',
    plan: {
      notes: 'Living/dining room starter layout.',
      rooms: [
        {
          name: 'Living Room',
          kind: 'living',
          widthMm: 4500,
          lengthMm: 4000,
          furniture: [
            'sofa',
            'armchair',
            'coffee table',
            'tv table',
            'dining table',
            'dining chair',
            'console table',
          ],
        },
      ],
    },
  },
];

export function findProjectTemplate(
  id: string | undefined | null,
): ProjectTemplate | undefined {
  if (!id) return undefined;
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}
