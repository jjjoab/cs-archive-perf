import { useEffect, useMemo, useState } from 'react';
import indexJson from '../assets/CORSICA_STUDIOS_INDEX.json';
import { useSearch } from '../contexts/SearchContext';
import { useAudio } from '../contexts/AudioContext';
import searchIndex from '../utils/search';
import EventModal from './EventModal';
import type { Event, EventModalData } from '../types';

const posterModules = import.meta.glob(
  '/src/assets/corsica test posters/*.{jpg,jpeg,png,webp}',
  { eager: true }
) as Record<string, { default: string }>;

// Build a date → poster URL map (first match wins per date)
const postersByDate = new Map<string, string>();
for (const [path, mod] of Object.entries(posterModules)) {
  const filename = path.split('/').pop() ?? '';
  const m = filename.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) {
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    const iso = `${year}-${String(parseInt(m[2], 10)).padStart(2, '0')}-${String(parseInt(m[1], 10)).padStart(2, '0')}`;
    if (!postersByDate.has(iso)) postersByDate.set(iso, mod.default);
  }
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface IndexListProps {
  onSwitchView: () => void;
  onVisibleCountChange: (count: number) => void;
}

export default function IndexList({ onSwitchView, onVisibleCountChange }: IndexListProps) {
  const events = indexJson as Event[];
  const { debouncedQuery, setQueryImmediate } = useSearch();
  const { handleNewMix } = useAudio();
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<EventModalData | null>(null);
  const [recordingsOnly, setRecordingsOnly] = useState(false);

  const filtered = useMemo(() => {
    const base = recordingsOnly ? events.filter((e) => e.room1Url || e.room2Url) : events;
    if (!debouncedQuery) return base;
    return searchIndex(base, debouncedQuery, ['name', 'artists', 'date']);
  }, [events, debouncedQuery, recordingsOnly]);

  useEffect(() => {
    onVisibleCountChange(filtered.length);
  }, [filtered.length, onVisibleCountChange]);

  const grouped = useMemo(() => {
    const map = new Map<number, Map<number, Event[]>>();
    for (const e of filtered) {
      const [year, month] = e.date.split('-').map(Number);
      if (!map.has(year)) map.set(year, new Map());
      const yearMap = map.get(year)!;
      if (!yearMap.has(month)) yearMap.set(month, []);
      yearMap.get(month)!.push(e);
    }
    return map;
  }, [filtered]);

  const years = [...grouped.keys()].sort((a, b) => b - a);

  const toggleYear = (year: number) => {
    setCollapsedYears((prev) => {
      const next = new Set(prev);
      next.has(year) ? next.delete(year) : next.add(year);
      return next;
    });
  };

  const openModal = (event: Event) => {
    const [year] = event.date.split('-').map(Number);
    setSelectedEvent({
      src: postersByDate.get(event.date),
      event: event.name,
      date: event.date,
      year,
      details: event.artists,
      recordings: { room1: event.room1Url, room2: event.room2Url },
    });
  };

  const playRecording = (e: React.MouseEvent, event: Event, room: 'room1' | 'room2') => {
    e.stopPropagation();
    const url = room === 'room1' ? event.room1Url : event.room2Url;
    if (!url) return;
    handleNewMix({
      url,
      event: event.name,
      date: event.date,
      artists: event.artists,
      roomLabel: room === 'room1' ? 'Room 1' : 'Room 2',
    });
  };

  return (
    <div className="min-h-screen bg-[#101010] text-white pt-11 pb-24">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 sticky top-11 bg-[#101010] z-10">
        <span className="text-xs text-white/30 uppercase tracking-widest">
          {filtered.length} events
        </span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setRecordingsOnly((p) => !p)}
            className={`text-xs uppercase tracking-wider transition-colors ${recordingsOnly ? 'text-white' : 'text-white/30 hover:text-white/60'}`}
          >
            {recordingsOnly ? '✓ ' : ''}Recordings
          </button>
          <button
            onClick={onSwitchView}
            className="text-xs uppercase tracking-wider text-white/30 hover:text-white transition-colors"
          >
            Archive →
          </button>
        </div>
      </div>

      {/* Active search tag */}
      {debouncedQuery && (
        <div className="px-4 py-2 flex items-center gap-2 border-b border-white/5">
          <span className="text-xs text-white/30 uppercase tracking-wider">Filter:</span>
          <span className="text-xs border border-white/20 px-2 py-0.5 text-white/60">
            {debouncedQuery}
          </span>
          <button
            onClick={() => setQueryImmediate('')}
            className="text-white/30 hover:text-white text-base leading-none transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Year groups */}
      <div className="divide-y divide-white/5">
        {years.map((year) => {
          const collapsed = collapsedYears.has(year);
          const monthMap = grouped.get(year)!;
          const months = [...monthMap.keys()].sort((a, b) => b - a);

          return (
            <div key={year}>
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-white/50 hover:text-white transition-colors"
                onClick={() => toggleYear(year)}
              >
                <span className="text-xs uppercase tracking-widest">{year}</span>
                <span className="text-xs text-white/30">{collapsed ? '+' : '−'}</span>
              </button>

              {!collapsed &&
                months.map((month) => (
                  <div key={`${year}-${month}`}>
                    <div className="px-4 pt-2 pb-1">
                      <span className="text-xs text-white/20 uppercase tracking-widest">
                        {MONTHS[month - 1]}
                      </span>
                    </div>
                    {monthMap.get(month)!.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5 group"
                        onClick={() => openModal(event)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') openModal(event);
                        }}
                      >
                        {/* Poster thumbnail */}
                        <div className="w-8 h-8 flex-shrink-0 bg-white/5 overflow-hidden">
                          {postersByDate.get(event.date) ? (
                            <img
                              src={postersByDate.get(event.date)}
                              alt=""
                              className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                            />
                          ) : (
                            <div className="w-full h-full" />
                          )}
                        </div>

                        {/* Day number */}
                        <span className="text-xs text-white/30 w-5 flex-shrink-0 tabular-nums">
                          {event.date.split('-')[2]}
                        </span>

                        {/* Event info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white truncate">{event.name}</div>
                          {event.artists && (
                            <div className="text-xs text-white/35 truncate">{event.artists}</div>
                          )}
                        </div>

                        {/* Play buttons */}
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {event.room1Url && (
                            <button
                              className="text-xs text-white/50 hover:text-white px-1.5 py-1 hover:bg-white/10 transition-colors"
                              onClick={(e) => playRecording(e, event, 'room1')}
                              title="Play Room 1"
                            >
                              ▶ R1
                            </button>
                          )}
                          {event.room2Url && (
                            <button
                              className="text-xs text-white/50 hover:text-white px-1.5 py-1 hover:bg-white/10 transition-colors"
                              onClick={(e) => playRecording(e, event, 'room2')}
                              title="Play Room 2"
                            >
                              ▶ R2
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center text-white/20 text-sm uppercase tracking-widest">
          No events found
        </div>
      )}

      {selectedEvent && (
        <EventModal selectedImage={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}
