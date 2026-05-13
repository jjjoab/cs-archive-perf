import { useEffect, useMemo, useState } from 'react';
import datesJson from '../assets/corsica test posters/dates.json';
import indexJson from '../assets/CORSICA_STUDIOS_INDEX.json';
import { useSearch } from '../contexts/SearchContext';
import EventModal from './EventModal';
import type { Event, EventModalData } from '../types';

const imageModules = import.meta.glob(
  '/src/assets/corsica test posters/*.{jpg,jpeg,png,webp}',
  { eager: true }
) as Record<string, { default: string }>;

interface DateEntry {
  date: string;
  event?: string;
}
const datesMap = datesJson as Record<string, string | DateEntry>;

function getDate(entry: string | DateEntry | undefined): string | null {
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  return entry.date ?? null;
}

function getEventName(entry: string | DateEntry | undefined): string | null {
  if (!entry || typeof entry === 'string') return null;
  return entry.event ?? null;
}

function parseDateFromFilename(name: string): string | null {
  const clean = name
    .replace(/\.(webp|jpg|jpeg|png)$/i, '')
    .replace(/\s*\(\d+\)\s*$/, '');

  const m = clean.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\s|$)/);
  if (m) {
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    return `${year}-${String(parseInt(m[2], 10)).padStart(2, '0')}-${String(parseInt(m[1], 10)).padStart(2, '0')}`;
  }

  const y = clean.match(/\b(20\d{2})\b/);
  if (y) return `${y[1]}-01-01`;

  return null;
}

function extractTitle(name: string): string {
  const clean = name
    .replace(/\.(webp|jpg|jpeg|png)$/i, '')
    .replace(/\s*\(\d+\)\s*$/, '');
  const parts = clean.split(/\s+[–-]\s+/);
  if (parts.length >= 2) return parts[0].trim();
  return clean
    .replace(/\s*[–-]\s*[\d.]+$/, '')
    .replace(/\s+(20\d{2})$/, '')
    .trim() || 'Event';
}

interface Poster {
  url: string;
  filename: string;
  title: string;
  date: string;
  year: number;
}

// Build a date → events[] map for linking posters to recordings
const eventsByDate = new Map<string, Event[]>();
for (const event of indexJson as Event[]) {
  if (!eventsByDate.has(event.date)) eventsByDate.set(event.date, []);
  eventsByDate.get(event.date)!.push(event);
}

interface ArchiveTimelineProps {
  onSwitchView: () => void;
  onVisibleCountChange: (count: number) => void;
}

export default function ArchiveTimeline({ onSwitchView, onVisibleCountChange }: ArchiveTimelineProps) {
  const { debouncedQuery } = useSearch();
  const [selected, setSelected] = useState<EventModalData | null>(null);

  const posters = useMemo<Poster[]>(() => {
    const result: Poster[] = [];
    for (const [path, mod] of Object.entries(imageModules)) {
      const filename = path.split('/').pop() ?? '';
      const entry = datesMap[filename];
      const isoDate = getDate(entry) ?? parseDateFromFilename(filename);
      if (!isoDate) continue;
      const year = parseInt(isoDate.split('-')[0], 10);
      const titleFromEntry = getEventName(entry);
      result.push({
        url: mod.default,
        filename,
        title: titleFromEntry ?? extractTitle(filename),
        date: isoDate,
        year,
      });
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, []);

  const filtered = useMemo(() => {
    if (!debouncedQuery) return posters;
    const q = debouncedQuery.toLowerCase();
    return posters.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.date.includes(q) ||
        String(p.year).includes(q) ||
        // also search matched events' artist names
        (eventsByDate.get(p.date) ?? []).some((e) =>
          e.name.toLowerCase().includes(q) || e.artists.toLowerCase().includes(q)
        )
    );
  }, [posters, debouncedQuery]);

  useEffect(() => {
    onVisibleCountChange(filtered.length);
  }, [filtered.length, onVisibleCountChange]);

  const openModal = (poster: Poster) => {
    const matchedEvents = eventsByDate.get(poster.date) ?? [];
    const ev = matchedEvents[0];
    setSelected({
      src: poster.url,
      fileName: poster.filename,
      event: ev?.name ?? poster.title,
      date: poster.date,
      year: poster.year,
      details: ev?.artists,
      recordings: ev ? { room1: ev.room1Url, room2: ev.room2Url } : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-[#101010] text-white pt-11 pb-24">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 sticky top-11 bg-[#101010] z-10">
        <span className="text-xs text-white/30 uppercase tracking-widest">
          {filtered.length} posters
        </span>
        <button
          onClick={onSwitchView}
          className="text-xs uppercase tracking-wider text-white/30 hover:text-white transition-colors"
        >
          Gallery →
        </button>
      </div>

      {/* Poster grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-px bg-white/5">
        {filtered.map((poster) => (
          <div
            key={poster.filename}
            className="aspect-square relative overflow-hidden cursor-pointer group bg-[#101010]"
            onClick={() => openModal(poster)}
          >
            <img
              src={poster.url}
              alt={poster.title}
              className="w-full h-full object-cover transition-opacity duration-200 group-hover:opacity-60"
            />
            <div className="absolute inset-0 flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-t from-black/90 via-black/30 to-transparent">
              <p className="text-white text-xs font-display uppercase leading-tight truncate">
                {poster.title}
              </p>
              <p className="text-white/50 text-xs">
                {new Date(poster.date + 'T00:00:00').toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center text-white/20 text-sm uppercase tracking-widest">
          No posters found
        </div>
      )}

      {selected && <EventModal selectedImage={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
