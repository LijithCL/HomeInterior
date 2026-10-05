const HELP_VIDEOS = [
  {
    title: 'Getting started: your first floor plan',
    description: 'Draw walls, add rooms, and place your first doors and windows in the 2D editor.',
    src: '/help-videos/getting-started.webm',
  },
  {
    title: 'Switching to 3D and walking through your design',
    description: 'Flip to 3D, orbit the camera, and use the Move/Rotate/Scale tools on furniture.',
    src: '/help-videos/switching-to-3d.webm',
  },
  {
    title: 'Adding furniture, doors, and windows',
    description: 'Drag assets from the sidebar, then reposition or resize them in either view.',
    src: '/help-videos/adding-furniture.webm',
  },
  {
    title: 'Inviting your team and sharing a design',
    description: 'Create a team, invite collaborators, and generate a view-only share link.',
    src: '/help-videos/inviting-team.webm',
  },
  {
    title: 'Rendering a photorealistic preview',
    description: 'Generate an HQ render of any room once you’re happy with the layout.',
    src: '/help-videos/rendering.webm',
  },
];

export function HelpVideos() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {HELP_VIDEOS.map((video) => (
        <div
          key={video.title}
          className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4 transition hover:border-accent-light"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent-dark">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <p className="text-sm font-medium text-neutral-900">{video.title}</p>
          </div>
          <p className="text-xs text-neutral-500">{video.description}</p>
          <video controls preload="metadata" className="mt-1 w-full rounded-md bg-black" src={video.src} />
        </div>
      ))}
    </div>
  );
}
