'use client';

import { useState } from 'react';

const FAQS = [
  {
    question: 'How do I switch between 2D and 3D?',
    answer:
      'Use the "2D" / "3D" toggle at the top of the editor toolbar. Walls, rooms, furniture, doors, and windows are all shared between both views — anything you add or edit in one shows up in the other.',
  },
  {
    question: 'How do I draw walls, doors, and windows?',
    answer:
      'Use the Wall, Room, Door, and Window tools in the 2D toolbar to sketch a floor plan, or use the Wall tool directly in the 3D view to build in three dimensions. Drag a door or window asset from the sidebar onto an existing wall to place it.',
  },
  {
    question: 'How do I move, resize, or rotate an object?',
    answer:
      'Click an object to select it, then drag it directly to reposition it, or use the Move / Rotate / Scale gizmo in the 3D view. You can also type exact position, size, and rotation values into the Properties panel, or use "Flip 180°" to face it the other way.',
  },
  {
    question: 'Do I need to create a team to use the app?',
    answer:
      'No — you can design and manage your own projects on a personal plan without ever creating a team. Teams are only needed once you want to collaborate with other people on the same designs.',
  },
  {
    question: 'How does billing work?',
    answer:
      'There are Free, Pro, and Ultimate plans, available for individuals or teams. New Pro subscriptions include a 30-day free trial. Manage your plan, payment method, and invoices from the Billing page.',
  },
  {
    question: 'How do I invite teammates?',
    answer:
      'Create a team from the Teams page, then invite collaborators by email and assign them the Owner, Editor, or Viewer role.',
  },
  {
    question: "Can I share my design with someone who doesn't have an account?",
    answer:
      'Yes — open the Share panel in the editor to generate a view-only link that anyone can open without signing in.',
  },
  {
    question: 'How do I get a photorealistic render?',
    answer:
      'Use the Render button in the toolbar to generate an HQ render of your current view — a Pro/Ultimate feature.',
  },
  {
    question: 'Can I undo a mistake?',
    answer: 'Yes — use the Undo / Redo buttons in the toolbar, or the Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z shortcuts.',
  },
];

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200">
      {FAQS.map((faq, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={faq.question}>
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-medium text-neutral-900 hover:bg-neutral-50"
            >
              {faq.question}
              <span className={`shrink-0 text-neutral-400 transition-transform ${isOpen ? 'rotate-45' : ''}`}>
                +
              </span>
            </button>
            {isOpen && <p className="px-4 pb-4 text-sm text-neutral-600">{faq.answer}</p>}
          </div>
        );
      })}
    </div>
  );
}
