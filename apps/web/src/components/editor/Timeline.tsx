'use client';

import { useEffect, useRef, useState } from 'react';
import { CONSTRUCTION_DAY_MAX, CONSTRUCTION_PHASES } from '@/lib/editor/document';
import { useEditorStore } from '@/lib/editor/editor-store';

const PLAY_STEP_DAYS = 2;
const PLAY_INTERVAL_MS = 150;

function currentPhaseLabel(day: number): string {
  const passed = CONSTRUCTION_PHASES.filter((p) => p.day <= day);
  return passed.length > 0 ? passed[passed.length - 1].label : 'Not started';
}

export function Timeline() {
  const timelineDay = useEditorStore((s) => s.timelineDay);
  const setTimelineDay = useEditorStore((s) => s.setTimelineDay);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) return;
    playRef.current = setInterval(() => {
      const next = useEditorStore.getState().timelineDay + PLAY_STEP_DAYS;
      if (next >= CONSTRUCTION_DAY_MAX) {
        setTimelineDay(CONSTRUCTION_DAY_MAX);
        setPlaying(false);
      } else {
        setTimelineDay(next);
      }
    }, PLAY_INTERVAL_MS);
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [playing, setTimelineDay]);

  function togglePlay() {
    if (!playing && timelineDay >= CONSTRUCTION_DAY_MAX) {
      setTimelineDay(0);
    }
    setPlaying((p) => !p);
  }

  return (
    <div className="flex items-center gap-3 border-t border-neutral-200 bg-white px-4 py-2">
      <button
        onClick={togglePlay}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
      >
        {playing ? 'Pause' : 'Play'}
      </button>

      <div className="relative flex-1">
        <input
          type="range"
          min={0}
          max={CONSTRUCTION_DAY_MAX}
          step={1}
          value={timelineDay}
          onChange={(e) => {
            setPlaying(false);
            setTimelineDay(Number(e.target.value));
          }}
          className="w-full"
        />
        <div className="pointer-events-none flex justify-between px-0.5 text-[10px] text-neutral-400">
          {CONSTRUCTION_PHASES.map((phase) => (
            <span key={phase.day}>{phase.label}</span>
          ))}
        </div>
      </div>

      <div className="w-40 text-right text-sm text-neutral-600">
        Day {timelineDay} · <span className="font-medium text-neutral-900">{currentPhaseLabel(timelineDay)}</span>
      </div>
    </div>
  );
}
