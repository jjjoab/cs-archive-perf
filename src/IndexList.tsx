import { useState, useEffect } from 'react';
import indexText from './assets/CORSICA_STUDIOS_INDEX.txt?raw';
import indexJson from './assets/CORSICA_STUDIOS_INDEX.json';
import './App.css';
import { useSearch } from './contexts/SearchContext';
import searchIndex from './utils/search';
import controlsMenuIcon from './assets/icons/galleryswitch.png';
import playIcon from './assets/icons/play.png';
import { useAudio } from './components/AudioProvider';

interface IndexEntry {
  date: string;
  dateISO: string;
  title: string;
  details: string;
  posterUrl?: string;
  year: number;
  month: number;
  day: number;
  recordings?: { room1?: string | null; room2?: string | null };
}

interface IndexListProps {
  onShowIndexRegular?: () => void;
  onShowTimeline?: () => void;
  onNextView?: () => void;
  onVisibleCountChange?: (count: number) => void;
}

// Import all poster images
const posterModules = import.meta.glob('./assets/corsica test posters/*.{jpg,jpeg,png,webp}', { eager: true }) as Record<string, { default: string }>;
const posterUrls = Object.entries(posterModules).map(([path, module]) => ({
  path,
  url: module.default,
  filename: path.split('/').pop() || ''
}));

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '-');
}

function toDateISO(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDateFromFilename(fileName: string): string | null {
  const nameWithoutExt = fileName.replace(/\.(webp|jpg|jpeg|png)$/i, '');
  const cleanName = nameWithoutExt.replace(/\s*\(\d+\)\s*$/g, '');

  const ddmmyyMatch = cleanName.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (ddmmyyMatch) {
    const day = parseInt(ddmmyyMatch[1], 10);
    const month = parseInt(ddmmyyMatch[2], 10);
    let year = parseInt(ddmmyyMatch[3], 10);
    if (year < 100) year += 2000;
    return toDateISO(year, month, day);
  }

  const monthYearMatch = cleanName.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  if (monthYearMatch) {
    const monthName = monthYearMatch[1].toLowerCase();
    const year = parseInt(monthYearMatch[2], 10);
    const monthMap: { [key: string]: number } = {
      january: 1, february: 2, march: 3, april: 4,
      may: 5, june: 6, july: 7, august: 8,
      september: 9, october: 10, november: 11, december: 12
    };
    return toDateISO(year, monthMap[monthName], 1);
  }

  const yearMatch = cleanName.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    return toDateISO(parseInt(yearMatch[0], 10), 1, 1);
  }

  return null;
}

function extractEventTitle(fileName: string): string {
  const nameWithoutExt = fileName.replace(/\.(webp|jpg|jpeg|png)$/i, '');
  let cleanName = nameWithoutExt.replace(/\s*\(\d+\)\s*$/g, '');

  const parts = cleanName.split(/\s+[–-]\s+/);
  if (parts.length >= 2) {
    cleanName = parts[0];
  } else {
    cleanName = cleanName.replace(/\s*[–-]\s*\d{1,2}\.\d{1,2}\.\d{2,4}$/, '');
    cleanName = cleanName.replace(/\s*[–-]\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i, '');
    cleanName = cleanName.replace(/\s+(19|20)\d{2}$/, '');
  }

  cleanName = cleanName.replace(/_/g, ' ');
  cleanName = cleanName.replace(/\s+/g, ' ').trim();
  return cleanName || 'Untitled';
}

function buildPosterMaps() {
  const byKey = new Map<string, string>();
  const byDate = new Map<string, string[]>();

  for (const poster of posterUrls) {
    const dateISO = parseDateFromFilename(poster.filename);
    if (!dateISO) continue;
    const title = extractEventTitle(poster.filename);
    const key = `${dateISO}__${slug(title)}`;

    if (!byKey.has(key)) {
      byKey.set(key, poster.url);
    }

    if (!byDate.has(dateISO)) {
      byDate.set(dateISO, []);
    }

    byDate.get(dateISO)!.push(poster.url);
  }

  return { byKey, byDate };
}

export default function IndexList({ onShowIndexRegular, onShowTimeline, onNextView, onVisibleCountChange }: IndexListProps) {
  const [entries, setEntries] = useState<IndexEntry[]>([]);
  const [showRightIcons, setShowRightIcons] = useState(false);
  const [filteredEntries, setFilteredEntries] = useState<IndexEntry[]>([]);
  const [posterMaps] = useState(() => buildPosterMaps());
  const { debouncedQuery, setQueryImmediate } = useSearch();
  const audio = useAudio();
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());
  const [selectedEntry, setSelectedEntry] = useState<IndexEntry | null>(null);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [isClosingPreview, setIsClosingPreview] = useState(false);
  const [showRecordingsOnly, setShowRecordingsOnly] = useState(false);
  const [isIndexMenuOpen, setIsIndexMenuOpen] = useState(false);

  useEffect(() => {
    const lines = indexText.split('\n').filter(line => line.trim());
    const parsed: IndexEntry[] = [];
    const dateFallbackCursor = new Map<string, number>();

    // Create a map of recordings data from JSON for quick lookup
    const recordingsMap = new Map<string, { room1?: string | null; room2?: string | null }>();
    (indexJson as Array<{ date: string; name: string; room1Url: string | null; room2Url: string | null }>).forEach(item => {
      const key = `${item.date}__${slug(item.name)}`;
      recordingsMap.set(key, {
        room1: item.room1Url,
        room2: item.room2Url
      });
    });

    for (const line of lines) {
      // Match format: DD.MM.YYYY – TITLE: DETAILS
      const match = line.match(/^(\d{2}\.\d{2}\.\d{4})\s*[–-]\s*([^:]+):\s*(.+)$/);
      if (match) {
        const date = match[1];
        const title = match[2].trim();
        const [day, month, year] = date.split('.');
        const dateISO = `${year}-${month}-${day}`;
        const key = `${dateISO}__${slug(title)}`;
        let posterUrl = posterMaps.byKey.get(key);

        if (!posterUrl) {
          const postersOnDate = posterMaps.byDate.get(dateISO) || [];
          if (postersOnDate.length > 0) {
            const fallbackIndex = dateFallbackCursor.get(dateISO) || 0;
            const safeIndex = Math.min(fallbackIndex, postersOnDate.length - 1);
            posterUrl = postersOnDate[safeIndex];
            dateFallbackCursor.set(dateISO, fallbackIndex + 1);
          }
        }
        
        const recordings = recordingsMap.get(key);
        parsed.push({
          date,
          dateISO,
          title,
          details: match[3].trim(),
          posterUrl,
          year: parseInt(year, 10),
          month: parseInt(month, 10),
          day: parseInt(day, 10),
          recordings: recordings ? { room1: recordings.room1, room2: recordings.room2 } : undefined
        });
      }
    }

    // Sort by year and month descending (newest first)
    parsed.sort((a: IndexEntry, b: IndexEntry) => {
      if (b.year !== a.year) return b.year - a.year;
      if (b.month !== a.month) return b.month - a.month;
      const [dayA] = a.date.split('.');
      const [dayB] = b.date.split('.');
      return parseInt(dayB, 10) - parseInt(dayA, 10);
    });

    setEntries(parsed);
    setCollapsedYears(new Set());
  }, [posterMaps]);

  useEffect(() => {
    if (!debouncedQuery) {
      setFilteredEntries(entries);
    } else {
      const results = searchIndex(entries, debouncedQuery, ['title', 'details', 'date']);
      setFilteredEntries(results as IndexEntry[]);
    }
  }, [entries, debouncedQuery]);

  const displayedEntries: IndexEntry[] = showRecordingsOnly 
    ? filteredEntries.filter(entry => entry.recordings?.room1 || entry.recordings?.room2)
    : filteredEntries;

  useEffect(() => {
    if (onVisibleCountChange) {
      onVisibleCountChange(displayedEntries.length);
    }
  }, [displayedEntries.length, onVisibleCountChange]);

  // Handle menu close on escape key and click outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isIndexMenuOpen) {
        setIsIndexMenuOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isIndexMenuOpen && !target.closest('.index-menu-btn') && !target.closest('.index-menu')) {
        setIsIndexMenuOpen(false);
      }
    };

    if (isIndexMenuOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isIndexMenuOpen]);
  // Group by year and month
  const groupedByYear: { [year: number]: { [month: number]: IndexEntry[] } } = {};
  displayedEntries.forEach(entry => {
    if (!groupedByYear[entry.year]) groupedByYear[entry.year] = {};
    if (!groupedByYear[entry.year][entry.month]) groupedByYear[entry.year][entry.month] = [];
    groupedByYear[entry.year][entry.month].push(entry);
  });

  const years = Object.keys(groupedByYear).map(Number).sort((a, b) => b - a);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const toggleYear = (year: number) => {
    setCollapsedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  const closeControlsAfter = (action?: () => void) => {
    if (action) action();
    setShowRightIcons(false);
  };

  // Inline preview component for list view
  interface InlinePreviewDropdownProps {
    entry: IndexEntry;
    onClose: () => void;
    playIcon: string;
    isClosing: boolean;
  }

  const InlinePreviewDropdown: React.FC<InlinePreviewDropdownProps> = ({ entry, onClose, isClosing }) => {
    const { setQueryImmediate: setQueryImmediateInner } = useSearch();

    const handleArtistClick = (artist: string) => {
      setQueryImmediateInner(artist);
    };

    return (
      <div className={`entry-preview-dropdown${isClosing ? ' closing' : ''}`}>
        <div className="preview-content">
          {entry.posterUrl && (
            <div className="preview-image-wrapper">
              <img src={entry.posterUrl} alt={entry.title} className="preview-image" />
            </div>
          )}
          <div className="preview-info">
            <div className="preview-title">{entry.title}</div>
            <div className="preview-date">{new Date(entry.dateISO).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            {entry.details && (
              <div className="preview-details">{entry.details}</div>
            )}
            {entry.details && (
              <div className="preview-artists">
                {entry.details.split(/[,;\/\|]+|\s+and\s+|\s*&\s*/i).map(artist => artist.trim()).filter(Boolean).map((artist, i) => (
                  <button
                    key={i}
                    className="artist-chip"
                    onClick={() => handleArtistClick(artist)}
                  >
                    {artist}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          className="preview-close-btn"
          onClick={onClose}
          aria-label="Close preview"
        >
          ×
        </button>
      </div>
    );
  };

  const handlePlayRecording = (entry: IndexEntry, room: 'room1' | 'room2') => {
    const recordingUrl = room === 'room1' ? entry.recordings?.room1 : entry.recordings?.room2;
    if (!recordingUrl) return;

    audio.handleNewMix({
      url: recordingUrl,
      event: entry.title,
      date: entry.dateISO,
      artists: entry.details,
      roomLabel: room === 'room1' ? 'Room 1' : 'Room 2'
    });
  };

  return (
    <div className="index-list-container">
      {onShowIndexRegular && (
        <button
          type="button"
          className="stack-toggle-btn active"
          aria-label="Go to archive art view"
          onClick={onShowIndexRegular}
        >
          <img src={controlsMenuIcon} alt="Archive art" />
        </button>
      )}

      <button
        onClick={() => onNextView?.()}
        className={`toggle-view-btn controls-menu-btn ${showRightIcons ? 'active' : ''}`}
        aria-label="Toggle view"
      >
        <img src={controlsMenuIcon} alt="Controls" />
      </button>

      {/* INDEX MENU — uncomment the block below to restore the Expand/Recordings toggles
      <button
        onClick={() => setIsIndexMenuOpen(!isIndexMenuOpen)}
        className="index-menu-btn"
        aria-label="Toggle index menu"
        title="Menu"
      >
        ☰
      </button>

      {isIndexMenuOpen && (
        <div className="index-menu">
          <button
            onClick={() => {
              setIsCompactMode(!isCompactMode);
              setIsIndexMenuOpen(false);
            }}
            className="index-menu-item"
          >
            {isCompactMode ? '▢ Expand' : '▢ Compact'}
          </button>
          <button
            onClick={() => {
              setShowRecordingsOnly(!showRecordingsOnly);
              setIsIndexMenuOpen(false);
            }}
            className="index-menu-item"
          >
            {showRecordingsOnly ? '✓ Recordings' : '○ Recordings'}
          </button>
        </div>
      )}
      */}

      <div className="corsica-grid-controls">
        <div className={`controls-icons-stack ${showRightIcons ? 'show' : ''}`}>
          <button
            className="toggle-view-btn active"
            aria-label="Index List view"
            onClick={() => closeControlsAfter()}
          >
            <img src={controlsMenuIcon} alt="INDEX(LIST)" />
          </button>

          {onShowIndexRegular && (
            <button
              onClick={() => closeControlsAfter(onShowIndexRegular)}
              className="toggle-view-btn"
            >
              <img src={controlsMenuIcon} alt="Index" />
            </button>
          )}

          {onShowTimeline && (
            <button
              onClick={() => closeControlsAfter(onShowTimeline)}
              className="toggle-view-btn"
            >
              <img src={controlsMenuIcon} alt="Timeline" />
            </button>
          )}
        </div>
      </div>

      <div className="index-list-header">
        <h1 className="index-list-title">INDEX</h1>
      </div>

      {debouncedQuery && (
        <div className="active-tag-container">
          <div className="active-tag" aria-label={`Active filter ${debouncedQuery}`}>
            <span className="active-tag-label">{debouncedQuery}</span>
            <button
              className="active-tag-clear"
              onClick={() => setQueryImmediate('')}
              aria-label="Clear filter"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="index-list-content">
        {years.map(year => {
          const isCollapsed = collapsedYears.has(year);
          const months = Object.keys(groupedByYear[year]).map(Number).sort((a, b) => b - a);
          
          return (
            <div key={year} className={`year-section${isCollapsed ? ' collapsed' : ''}`}>
              <h2 
                className="year-header"
                onClick={() => toggleYear(year)}
              >
                {year}
                <span className="year-toggle">{isCollapsed ? '+' : '−'}</span>
              </h2>
              
              <div className={`year-body${isCollapsed ? ' collapsed' : ''}`}>
              <div className="year-body-inner">
              {months.map(month => (
                <div key={`${year}-${month}`} className="month-section">
                  <h3 className="month-header">{monthNames[month - 1]}</h3>
                  <div className="entries-list">
                    {groupedByYear[year][month].map((entry, index) => (
                      <div key={index} className="entry-row-wrapper">
                        <div
                          className={`entry-item clickable${isCompactMode ? ' compact' : ''}${selectedEntry?.dateISO === entry.dateISO && selectedEntry?.title === entry.title ? ' selected' : ''}`}
                          onClick={() => {
                            if (selectedEntry?.dateISO === entry.dateISO && selectedEntry?.title === entry.title) {
                              // Closing the preview
                              setIsClosingPreview(true);
                              setTimeout(() => {
                                setSelectedEntry(null);
                                setIsClosingPreview(false);
                              }, 550);
                            } else {
                              // Opening a new preview
                              setIsClosingPreview(false);
                              setSelectedEntry(entry);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              if (selectedEntry?.dateISO === entry.dateISO && selectedEntry?.title === entry.title) {
                                setIsClosingPreview(true);
                                setTimeout(() => {
                                  setSelectedEntry(null);
                                  setIsClosingPreview(false);
                                }, 550);
                              } else {
                                setIsClosingPreview(false);
                                setSelectedEntry(entry);
                              }
                            }
                          }}
                        >
                          <div className="entry-thumb-col">
                            {entry.posterUrl && (
                              <img
                                src={entry.posterUrl}
                                alt={entry.title}
                                className="entry-poster"
                              />
                            )}
                          </div>
                          <div className="entry-date-col">{entry.day}</div>
                          <div className="entry-main-col">
                            <div className="entry-title">{entry.title}</div>
                            {entry.details && (
                              <div className="entry-details">{entry.details}</div>
                            )}
                          </div>
                          <div className="entry-play-col">
                            {(entry.recordings?.room1 || entry.recordings?.room2) && (
                              <div className="entry-play-buttons">
                                {entry.recordings?.room1 && (
                                  <button className="entry-play-btn" title="Play Room 1" onClick={(e) => { e.stopPropagation(); handlePlayRecording(entry, 'room1'); }}>R1</button>
                                )}
                                {entry.recordings?.room2 && (
                                  <button className="entry-play-btn" title="Play Room 2" onClick={(e) => { e.stopPropagation(); handlePlayRecording(entry, 'room2'); }}>R2</button>
                                )}
                              </div>
                            )}
                        </div>
                        </div>
                        {selectedEntry?.dateISO === entry.dateISO && selectedEntry?.title === entry.title && !isClosingPreview && (
                          <InlinePreviewDropdown 
                            entry={entry} 
                            onClose={() => {
                              setIsClosingPreview(true);
                              setTimeout(() => {
                                setSelectedEntry(null);
                                setIsClosingPreview(false);
                              }, 550);
                            }} 
                            playIcon={playIcon}
                            isClosing={isClosingPreview}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="index-list-footer">
        Showing {displayedEntries.length} of {entries.length} entries
      </div>
    </div>
  );
}
