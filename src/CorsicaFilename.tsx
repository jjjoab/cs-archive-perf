import React, { useEffect, useMemo, useRef, useState } from 'react';
import playIcon from './assets/icons/play.png';
import controlsMenuIcon from './assets/icons/galleryswitch.png';
import EventModal from './components/EventModal';
import AudioPlayer from './components/AudioPlayer';
import { useAudio } from './components/AudioProvider';
import { useSearch } from './contexts/SearchContext';
import searchIndex from './utils/search';

// Vite glob import for corsica test posters
const corsicaFiles = import.meta.glob('/src/assets/corsica test posters/*.{webp,jpg,jpeg,png}', { eager: true });

// Import text index
import indexJson from './assets/CORSICA_STUDIOS_INDEX.json';

interface ImageData {
  src: string;
  fileName: string;
  date: string;
  event: string;
  timestamp: number;
  year: number | 'Unknown';
  details?: string;
  recordings?: { room1?: string | null; room2?: string | null };
  joinKey?: string;
  indexRawLine?: string;
  parseNote?: string;
  parsedTitle?: string;
  parsedDatePart?: string;
  parsedDateISO?: string;
  matchedIndex?: boolean;
}

interface ParsedDate {
  date: Date;
  timestamp: number;
  year: number | 'Unknown';
  dateISO: string;
  datePart: string;
}

interface CorsicaFilenameProps {
  onShowIndexList?: () => void;
  onShowIndexRegular?: () => void;
  onNextView?: () => void;
  isHorizontalScroll?: boolean;
  setIsHorizontalScroll?: (value: boolean) => void;
  initialTimeline?: boolean;
  onVisibleCountChange?: (count: number) => void;
}

const CorsicaFilename: React.FC<CorsicaFilenameProps> = ({ onShowIndexList, onShowIndexRegular, onNextView, isHorizontalScroll: propIsHorizontalScroll, setIsHorizontalScroll, initialTimeline = false, onVisibleCountChange }) => {
  const [corsicaData, setCorsicaData] = useState<ImageData[]>([]);
  const [isTimeline, setIsTimeline] = useState(initialTimeline);
  const [desiredTimelineTimestamp, setDesiredTimelineTimestamp] = useState<number | null>(null);
  // Keep internal timeline state in sync if parent toggles `initialTimeline`
  useEffect(() => {
    setIsTimeline(initialTimeline);
  }, [initialTimeline]);
  const [gridColumns, setGridColumns] = useState(() => (typeof window !== 'undefined' && window.innerWidth <= 768 ? 3 : 6));
  const [rowSize, setRowSize] = useState(200); // Default row height for horizontal scroll
  const [timelineStats, setTimelineStats] = useState({ min: 0, max: 0, range: 0 });
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showRightIcons, setShowRightIcons] = useState(false);
  const [localIsHorizontalScroll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const timelineRef = useRef<HTMLDivElement>(null);
  const hasInitialTimelineScrollRef = useRef(false);
  const indexPinchLastDistanceRef = useRef<number | null>(null);
  const indexPinchAccumulatedDeltaRef = useRef(0);
  const indexWheelAccumulatedRef = useRef(0);
  const [viewportBounds, setViewportBounds] = useState({ top: 0, bottom: 0, width: window.innerWidth });
  const [hasTouchLikeInput, setHasTouchLikeInput] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(hover: none), (pointer: coarse)').matches;
  });
  const [activeCenterByYear, setActiveCenterByYear] = useState<Record<string, number>>({});
  
  // Use prop if provided, otherwise use local state
  const isHorizontalScroll = propIsHorizontalScroll !== undefined ? propIsHorizontalScroll : localIsHorizontalScroll;
  
  const { debouncedQuery, setQueryImmediate } = useSearch();

  const PINCH_STEP_THRESHOLD = 40;
  const WHEEL_STEP_THRESHOLD = 180;

  const changeIndexColumns = (delta: number) => {
    if (isTimeline || isHorizontalScroll) return;
    setGridColumns((prev) => Math.max(1, Math.min(12, prev - delta)));
  };
  
  const handleWheelZoom = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) return;

    if (!isTimeline && !isHorizontalScroll) {
      event.preventDefault();
      indexWheelAccumulatedRef.current += event.deltaY;

      if (Math.abs(indexWheelAccumulatedRef.current) >= WHEEL_STEP_THRESHOLD) {
        const direction = indexWheelAccumulatedRef.current < 0 ? 1 : -1;
        changeIndexColumns(direction);
        indexWheelAccumulatedRef.current = 0;
      }
      return;
    }

    if (!isTimeline) return;
    event.preventDefault();
    return;
  };

  useEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;
    if (isTimeline || isHorizontalScroll) return;

    const getTouchDistance = (touchA: Touch, touchB: Touch) => {
      const dx = touchA.clientX - touchB.clientX;
      const dy = touchA.clientY - touchB.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const resetPinch = () => {
      indexPinchLastDistanceRef.current = null;
      indexPinchAccumulatedDeltaRef.current = 0;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length < 2) return;
      indexPinchLastDistanceRef.current = getTouchDistance(event.touches[0], event.touches[1]);
      indexPinchAccumulatedDeltaRef.current = 0;

      event.preventDefault();
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length < 2) return;

      const currentDistance = getTouchDistance(event.touches[0], event.touches[1]);
      const previousDistance = indexPinchLastDistanceRef.current;

      if (previousDistance !== null) {
        indexPinchAccumulatedDeltaRef.current += currentDistance - previousDistance;

        if (indexPinchAccumulatedDeltaRef.current >= PINCH_STEP_THRESHOLD) {
          changeIndexColumns(1);
          indexPinchAccumulatedDeltaRef.current = 0;
        } else if (indexPinchAccumulatedDeltaRef.current <= -PINCH_STEP_THRESHOLD) {
          changeIndexColumns(-1);
          indexPinchAccumulatedDeltaRef.current = 0;
        }
      }

      indexPinchLastDistanceRef.current = currentDistance;

      event.preventDefault();
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        resetPinch();
      }
    };

    containerEl.addEventListener('touchstart', onTouchStart, { passive: false });
    containerEl.addEventListener('touchmove', onTouchMove, { passive: false });
    containerEl.addEventListener('touchend', onTouchEnd, { passive: false });
    containerEl.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      containerEl.removeEventListener('touchstart', onTouchStart);
      containerEl.removeEventListener('touchmove', onTouchMove);
      containerEl.removeEventListener('touchend', onTouchEnd);
      containerEl.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isHorizontalScroll, isTimeline]);

  useEffect(() => {
    const blockGesture = (event: Event) => {
      if (!(isTimeline || (!isTimeline && !isHorizontalScroll))) return;
      event.preventDefault();
    };

    document.addEventListener('gesturestart', blockGesture, { passive: false } as AddEventListenerOptions);
    document.addEventListener('gesturechange', blockGesture, { passive: false } as AddEventListenerOptions);
    document.addEventListener('gestureend', blockGesture, { passive: false } as AddEventListenerOptions);

    return () => {
      document.removeEventListener('gesturestart', blockGesture as EventListener);
      document.removeEventListener('gesturechange', blockGesture as EventListener);
      document.removeEventListener('gestureend', blockGesture as EventListener);
    };
  }, [isHorizontalScroll, isTimeline]);

  // Shared slug function (poster + index)
  const slug = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[“”"']/g, '')
      .replace(/[_]+/g, ' ')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s/g, '-');
  };

  // Build lookup map from index text
  const buildIndexMap = () => {
    const map = new Map<
      string,
      {
        title: string;
        artists: string;
        room1Url: string | null;
        room2Url: string | null;
        dateISO: string;
        id: number;
        type: string;
      }
    >();
    const byDate = new Map<
      string,
      {
        key: string;
        title: string;
        artists: string;
        room1Url: string | null;
        room2Url: string | null;
        id: number;
        type: string;
      }[]
    >();
    const parsedLines: { dateISO: string; title: string; key: string; id: number }[] = [];

    for (const entry of indexJson as any[]) {
      const dateISO = entry.date;
      const title = entry.name;
      const artists = entry.artists || '';
      const room1Url = entry.room1Url ?? null;
      const room2Url = entry.room2Url ?? null;
      const id = entry.id;
      const type = entry.type;
      const key = `${dateISO}__${slug(title)}`;

      map.set(key, { title, artists, room1Url, room2Url, dateISO, id, type });
      parsedLines.push({ dateISO, title, key, id });

      if (!byDate.has(dateISO)) byDate.set(dateISO, []);
      byDate.get(dateISO)!.push({ key, title, artists, room1Url, room2Url, id, type });
    }
    
    if (import.meta.env.DEV) {
      console.log(`[Index Map] Built ${map.size} entries`);
      console.log(`[Index Map] Parsed lines: ${parsedLines.length}`);
      console.log('[Index Map] First 20 parsed lines:');
      parsedLines.slice(0, 20).forEach(line => {
        console.log(`  ${line.dateISO} | ${line.title} | ${line.key} | id=${line.id}`);
      });
      // Log first 5 entries as examples
      let count = 0;
      for (const [key, value] of map.entries()) {
        if (count++ < 5) {
          console.log(`  ${key} -> ${value.artists.substring(0, 50)}...`);
        }
      }
    }
    
    return { map, byDate, parsedLines };
  };

  const { map: indexMap, byDate: indexByDate, parsedLines: indexParsedLines } = useMemo(() => buildIndexMap(), []);

  const toISO = (year: number, month: number, day: number) => {
    const y = String(year);
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const normalizeDateFromParts = (dayStr: string, monthStr: string, yearStr: string): ParsedDate => {
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    let year = parseInt(yearStr, 10);
    if (yearStr.length === 2) year += 2000;
    const date = new Date(year, month - 1, day);
    return {
      date,
      timestamp: date.getTime(),
      year,
      dateISO: toISO(year, month, day),
      datePart: `${dayStr}.${monthStr}.${yearStr}`,
    };
  };

  // Parse date from filename
  const parseDateFromFilename = (fileName: string): ParsedDate => {
    // Remove file extension
    let nameWithoutExt = fileName.replace(/\.(webp|jpg|jpeg|png)$/i, '');
    
    // Remove duplicate suffixes like (1), (2), etc.
    nameWithoutExt = nameWithoutExt.replace(/\s*\(\d+\)\s*$/g, '');
    nameWithoutExt = nameWithoutExt.replace(/\s*(copy|final|v\d+)\s*$/i, '');
    const cleanName = nameWithoutExt.trim();

    // Multi-day format like 28_29.11.2025 -> use first day
    const multiDayMatch = cleanName.match(/(\d{1,2})_(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    if (multiDayMatch) {
      const [, day1, , month, year] = multiDayMatch;
      return normalizeDateFromParts(day1, month, year);
    }
    
    // Try DD.MM.YY or DD.MM.YYYY format
    // Look for pattern: number.number.number at the end (before or after separator)
    const ddmmyyMatch = cleanName.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})[\s\.)]*$/);
    if (ddmmyyMatch) {
      return normalizeDateFromParts(ddmmyyMatch[1], ddmmyyMatch[2], ddmmyyMatch[3]);
    }
    
    // Try Month YYYY format (e.g., "April 2022")
    const monthYearMatch = cleanName.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
    if (monthYearMatch) {
      const monthName = monthYearMatch[1];
      const year = parseInt(monthYearMatch[2], 10);
      
      const monthMap: { [key: string]: number } = {
        'january': 0, 'february': 1, 'march': 2, 'april': 3,
        'may': 4, 'june': 5, 'july': 6, 'august': 7,
        'september': 8, 'october': 9, 'november': 10, 'december': 11
      };
      
      const month = monthMap[monthName.toLowerCase()];
      const date = new Date(year, month, 1);
      return {
        date,
        timestamp: date.getTime(),
        year,
        dateISO: toISO(year, month + 1, 1),
        datePart: `${monthName} ${year}`,
      };
    }
    
    // Try YYYY only format
    const yearMatch = cleanName.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0], 10);
      const date = new Date(year, 0, 1);
      return {
        date,
        timestamp: date.getTime(),
        year,
        dateISO: toISO(year, 1, 1),
        datePart: `${year}`,
      };
    }
    
    // No date found - return Unknown
    return {
      date: new Date(9999, 11, 31), // Far future date for sorting to bottom
      timestamp: new Date(9999, 11, 31).getTime(),
      year: 'Unknown',
      dateISO: '',
      datePart: 'Unknown'
    };
  };

  // Extract event title from filename
  const extractEventTitle = (fileName: string): string => {
    // Remove file extension
    let nameWithoutExt = fileName.replace(/\.(webp|jpg|jpeg|png)$/i, '');
    
    // Remove duplicate suffixes like (1), (2), etc.
    let cleanName = nameWithoutExt.replace(/\s*\(\d+\)\s*$/g, '');
    cleanName = cleanName.replace(/\s*(copy|final|v\d+)\s*$/i, '');
    cleanName = cleanName.replace(/[“”"']/g, '');
    
    // Split on separator (en dash or hyphen) to separate title from date
    // Format is: "EVENT TITLE – DD.MM.YYYY" or "EVENT TITLE - DD.MM.YYYY"
    const parts = cleanName.split(/\s+[–—-]\s+/);
    
    if (parts.length >= 2) {
      // First part is the event title
      cleanName = parts[0];
    } else {
      // Fallback: try to remove date patterns from the end
      cleanName = cleanName.replace(/\s*[–—-]\s*\d{1,2}\.\d{1,2}\.\d{2,4}.*$/, '');
      cleanName = cleanName.replace(/\s*[–—-]\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}.*$/i, '');
      cleanName = cleanName.replace(/\s+(19|20)\d{2}$/, '');
    }
    
    // Replace underscores with spaces
    cleanName = cleanName.replace(/_/g, ' ');
    
    // Collapse multiple spaces
    cleanName = cleanName.replace(/\s+/g, ' ').trim();
    
    return cleanName || 'Untitled';
  };

  useEffect(() => {
    const dateFallbackCursor = new Map<string, number>();

    const data = Object.entries(corsicaFiles)
      .map(([path, mod]: any) => {
        const fileName = path.split('/').pop()!;
        const parsedDate = parseDateFromFilename(fileName);
        const eventTitle = extractEventTitle(fileName);
        
        // Build join key for lookup
        const dateISO = parsedDate.year !== 'Unknown' ? parsedDate.dateISO : '';
        const joinKey = dateISO ? `${dateISO}__${slug(eventTitle)}` : '';
        let indexEntry = joinKey ? indexMap.get(joinKey) : undefined;
        let matchByDateOnly = false;
        if (!indexEntry && dateISO) {
          const sameDate = indexByDate.get(dateISO) || [];
          if (sameDate.length >= 1) {
            const fallbackIndex = dateFallbackCursor.get(dateISO) || 0;
            const safeIndex = Math.min(fallbackIndex, sameDate.length - 1);
            indexEntry = indexMap.get(sameDate[safeIndex].key);
            dateFallbackCursor.set(dateISO, fallbackIndex + 1);
            matchByDateOnly = true;
          }
        }
        const details = indexEntry?.artists || '';
        const eventFromIndex = indexEntry?.title || '';
        const recordings = indexEntry
          ? { room1: indexEntry.room1Url, room2: indexEntry.room2Url }
          : undefined;
        const indexRawLine = indexEntry ? `id:${indexEntry.id}` : undefined;
        const matchedIndex = Boolean(indexEntry);
        const parseNote = parsedDate.year === 'Unknown'
          ? 'date_parse_failed'
          : matchedIndex
            ? (matchByDateOnly ? 'matched_by_date_only' : 'matched_by_key')
            : 'unmatched';
        
        // Debug first few items
        if (import.meta.env.DEV && fileName.includes('Synergy')) {
          console.log(`[Poster] ${fileName}`);
          console.log(`  Title: "${eventTitle}"`);
          console.log(`  Date: ${dateISO}`);
          console.log(`  Key: ${joinKey}`);
          console.log(`  Match: ${details ? 'YES' : 'NO'}`);
          if (details) console.log(`  Details: ${details.substring(0, 50)}...`);
        }
        
        return {
          src: mod.default,
          fileName,
          date: parsedDate.dateISO || parsedDate.date.toISOString().split('T')[0],
          event: eventFromIndex || eventTitle,
          timestamp: parsedDate.timestamp,
          year: parsedDate.year,
          details,
          recordings,
          joinKey,
          indexRawLine,
          parseNote,
          parsedTitle: eventTitle,
          parsedDatePart: parsedDate.datePart,
          parsedDateISO: parsedDate.dateISO,
          matchedIndex,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);
    
    setCorsicaData(data);
    
    // Debug report in dev mode
    if (import.meta.env.DEV) {
      const posterFilenames = data.map(d => d.fileName);
      const postersParsedOk = data.filter(d => d.year !== 'Unknown').length;
      const postersFailedParse = data.filter(d => d.year === 'Unknown').length;
      const postersMatched = data.filter(d => d.matchedIndex).length;
      const postersUnmatched = data.filter(d => d.joinKey && !d.matchedIndex);

      console.log('[Posters] Filenames:', posterFilenames);
      console.log('[Posters] Parsed list (title, datePart, dateISO, key, matched):');
      data.forEach(d => {
        const datePart = d.parsedDatePart || (d.year === 'Unknown' ? 'Unknown' : d.date);
        const dateISOValue = d.parsedDateISO || d.date;
        console.log(`  ${d.fileName} | title="${d.parsedTitle || d.event}" | datePart=${datePart} | dateISO=${dateISOValue} | key=${d.joinKey} | matched=${Boolean(d.matchedIndex)}`);
      });

      console.log('[Index] Parsed lines (dateISO, title, key):');
      indexParsedLines.forEach(line => {
        console.log(`  ${line.dateISO} | ${line.title} | ${line.key}`);
      });

      console.log('[Counts] posters_total=', data.length);
      console.log('[Counts] posters_parsed_ok=', postersParsedOk);
      console.log('[Counts] posters_failed_parse=', postersFailedParse);
      console.log('[Counts] posters_matched=', postersMatched);
      console.log('[Counts] posters_unmatched=', postersUnmatched.length);

      console.log('[Unmatched] First 20:');
      postersUnmatched.slice(0, 20).forEach(d => {
        const reason = d.parseNote || 'unmatched';
        console.log(`  ${d.fileName} | reason=${reason} | extractedTitle="${d.parsedTitle || d.event}" | dateISO=${d.parsedDateISO || d.date} | key=${d.joinKey}`);
      });

      console.log('[Matched] First 20:');
      data.filter(d => d.matchedIndex).slice(0, 20).forEach(d => {
        console.log(`  ${d.fileName} | matchedLine=${d.indexRawLine || ''}`);
      });
    }
    
    // Filter out "Unknown" dates for timeline calculations
    const datedItems = data.filter(item => item.year !== 'Unknown');
    
    if (datedItems.length > 0) {
      const min = datedItems[0].timestamp;
      const max = datedItems[datedItems.length - 1].timestamp;
      const range = max - min;
      
      setTimelineStats({ min, max, range });
    }
  }, []);

  const isMobileViewport = viewportBounds.width <= 768;
  const isPhoneLikeViewport = isMobileViewport && hasTouchLikeInput;
  const effectiveTimelineZoom = 1;
  const { activeMix } = useAudio();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(hover: none), (pointer: coarse)');
    const syncInputMode = () => setHasTouchLikeInput(media.matches);
    syncInputMode();
    media.addEventListener('change', syncInputMode);
    return () => media.removeEventListener('change', syncInputMode);
  }, []);

  // Scroll to mid 2025 when timeline first loads
  useEffect(() => {
    if (!isTimeline || timelineStats.range <= 0 || hasInitialTimelineScrollRef.current) return;
    const targetDate = new Date('2025-06-15').getTime();
    const clampedTarget = Math.max(timelineStats.min, Math.min(targetDate, timelineStats.max));
    const daysDiff = (clampedTarget - timelineStats.min) / (1000 * 60 * 60 * 24);
    const targetTopPos = daysDiff * 20;
    const viewportHeight = window.innerHeight;
    const scrollTarget = targetTopPos * effectiveTimelineZoom - viewportHeight / 2;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'auto' });
        hasInitialTimelineScrollRef.current = true;
      });
    });
  }, [effectiveTimelineZoom, isTimeline, timelineStats.min, timelineStats.max, timelineStats.range]);

  const getTimelinePosition = (timestamp: number) => {
    if (timelineStats.range === 0) return 0;
    const daysDiff = (timestamp - timelineStats.min) / (1000 * 60 * 60 * 24);
    return daysDiff * 20; // 20px per day (20% of 100px)
  };

  const getIndexYearLabel = (item: ImageData) => {
    return item.year === 'Unknown' ? 'Unknown' : String(item.year);
  };

  const visibleData = debouncedQuery ? searchIndex(corsicaData, debouncedQuery, ['event','details','parsedTitle','fileName','date']) : corsicaData;

  useEffect(() => {
    onVisibleCountChange?.(visibleData.length);
  }, [visibleData.length, onVisibleCountChange]);

  useEffect(() => {
    if (!isTimeline) return;

    const updateViewportBounds = () => {
      setViewportBounds({
        top: window.scrollY,
        bottom: window.scrollY + window.innerHeight,
        width: window.innerWidth,
      });
    };

    updateViewportBounds();
    window.addEventListener('scroll', updateViewportBounds, { passive: true });
    window.addEventListener('resize', updateViewportBounds);

    return () => {
      window.removeEventListener('scroll', updateViewportBounds);
      window.removeEventListener('resize', updateViewportBounds);
    };
  }, [isTimeline]);

  const timelineContentHeight = timelineStats.range
    ? Math.ceil(timelineStats.range / (1000 * 60 * 60 * 24)) * 20 + 400
    : 0;

  const timelineEntries = useMemo(() => {
    // Only include posters that matched the index when building the timeline
    const items = (visibleData && visibleData.length ? (visibleData as ImageData[]).filter(d => d.matchedIndex) : []) as ImageData[];
    let unknownIndex = 0;

    return items.map((item, sourceIndex) => {
      if (item.year === 'Unknown') {
        const topPosition = timelineContentHeight + 140 + unknownIndex * 140;
        unknownIndex += 1;
        return { item, sourceIndex, topPosition };
      }

      const daysDiff = (item.timestamp - timelineStats.min) / (1000 * 60 * 60 * 24);
      return { item, sourceIndex, topPosition: daysDiff * 20 };
    });
  }, [visibleData, timelineContentHeight, timelineStats.min]);

  const windowedTimelineEntries = useMemo(() => {
    if (!isTimeline || timelineEntries.length === 0) return timelineEntries;

    const safeZoom = Math.max(effectiveTimelineZoom, 0.001);
    const viewportTop = viewportBounds.top / safeZoom;
    const viewportBottom = viewportBounds.bottom / safeZoom;
    const bufferPx = isMobileViewport ? 700 : 1400;
    const minWindowItems = isMobileViewport ? 6 : 10;

    const rangeStart = viewportTop - bufferPx;
    const rangeEnd = viewportBottom + bufferPx;

    let firstInRange = -1;
    let lastInRange = -1;

    for (let index = 0; index < timelineEntries.length; index += 1) {
      const top = timelineEntries[index].topPosition;
      if (top >= rangeStart && top <= rangeEnd) {
        if (firstInRange === -1) firstInRange = index;
        lastInRange = index;
      }
    }

    if (firstInRange === -1 || lastInRange === -1) {
      const viewportCenter = (viewportTop + viewportBottom) / 2;
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (let index = 0; index < timelineEntries.length; index += 1) {
        const distance = Math.abs(timelineEntries[index].topPosition - viewportCenter);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      }

      firstInRange = nearestIndex;
      lastInRange = nearestIndex;
    }

    const start = Math.max(0, firstInRange - minWindowItems);
    const end = Math.min(timelineEntries.length - 1, lastInRange + minWindowItems);
    return timelineEntries.slice(start, end + 1);
  }, [effectiveTimelineZoom, isMobileViewport, isTimeline, timelineEntries, viewportBounds.bottom, viewportBounds.top]);


  const hoveredItem = hoveredIndex !== null
    ? (timelineEntries.find(e => e.sourceIndex === hoveredIndex)?.item ?? null)
    : null;

  const stickyYear = useMemo(() => {
    if (!isTimeline || timelineStats.range <= 0) return null;
    const safeZoom = Math.max(effectiveTimelineZoom, 0.001);
    const logicalViewportMid = ((viewportBounds.top + viewportBounds.bottom) / 2) / safeZoom;
    let result: number | null = null;
    for (let year = 2002; year <= 2026; year++) {
      const yearDate = new Date(`${year}-01-01`).getTime();
      if (yearDate < timelineStats.min || yearDate > timelineStats.max) continue;
      const yearPos = (yearDate - timelineStats.min) / (1000 * 60 * 60 * 24) * 20;
      if (yearPos <= logicalViewportMid) {
        result = year;
      }
    }
    return result;
  }, [isTimeline, viewportBounds.top, viewportBounds.bottom, timelineStats.min, timelineStats.max, timelineStats.range, effectiveTimelineZoom]);

  const indexGroups = [...visibleData]
    .sort((a, b) => b.timestamp - a.timestamp)
    .reduce((groups, item) => {
      const yearLabel = getIndexYearLabel(item);
      const lastGroup = groups[groups.length - 1];
      if (!lastGroup || lastGroup.year !== yearLabel) {
        groups.push({ year: yearLabel, items: [item] });
      } else {
        lastGroup.items.push(item);
      }
      return groups;
    }, [] as { year: string; items: ImageData[] }[])
    .sort((a, b) => {
      if (a.year === 'Unknown') return 1;
      if (b.year === 'Unknown') return -1;
      return Number(b.year) - Number(a.year);
    });

  const handleGridDensity = (delta: number) => {
    if (isHorizontalScroll) {
      setRowSize((prev) => Math.max(120, Math.min(400, prev + delta * 20)));
    } else {
      setGridColumns((prev) => Math.max(1, Math.min(12, prev - delta)));
    }
  };

  const closeControlsAfter = (action: () => void) => {
    action();
    setShowRightIcons(false);
  };

  const updateActiveCenterForYear = (year: string) => {
    const row = rowRefs.current[year];
    if (!row) return;

    const items = Array.from(row.querySelectorAll<HTMLElement>('.carousel-item'));
    if (!items.length) return;

    const containerCenter = row.scrollLeft + row.clientWidth / 2;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    items.forEach((item, index) => {
      const itemCenter = item.offsetLeft + item.offsetWidth / 2;
      const distance = Math.abs(itemCenter - containerCenter);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    setActiveCenterByYear((prev) => (prev[year] === nearestIndex ? prev : { ...prev, [year]: nearestIndex }));
  };

  useEffect(() => {
    if (!isHorizontalScroll) return;
    const raf = requestAnimationFrame(() => {
      indexGroups.forEach((group) => updateActiveCenterForYear(group.year));
    });
    return () => cancelAnimationFrame(raf);
  }, [isHorizontalScroll, indexGroups, rowSize]);

  // When timeline becomes active and a desired timestamp is set, scroll to it
  useEffect(() => {
    if (!isTimeline) return;
    if (!desiredTimelineTimestamp) return;
    if (timelineStats.range <= 0) return;

    const topPos = getTimelinePosition(desiredTimelineTimestamp);
    const viewportHeight = window.innerHeight;
    const scrollTarget = topPos * effectiveTimelineZoom - viewportHeight / 2;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
        setDesiredTimelineTimestamp(null);
      });
    });
  }, [isTimeline, desiredTimelineTimestamp, effectiveTimelineZoom, timelineStats.range]);

  return (
    <div className="corsica-grid-container" ref={containerRef} onWheel={handleWheelZoom}>
      <AudioPlayer />
      <button
        onClick={() => onNextView?.()}
        className={`toggle-view-btn controls-menu-btn ${showRightIcons ? 'active' : ''} ${activeMix ? 'with-player-open' : ''}`}
        aria-label="Toggle view"
      >
        <img src={controlsMenuIcon} alt="Controls" />
      </button>

      <div className={`corsica-grid-controls ${activeMix ? 'with-player-open' : ''}`}>
        <div className={`controls-icons-stack ${showRightIcons ? 'show' : ''}`}>
          {onShowIndexList && (
            <button
              onClick={() => closeControlsAfter(() => {
                if (onShowIndexList) onShowIndexList();
              })}
              className="toggle-view-btn"
            >
              <img src={controlsMenuIcon} alt="INDEX(LIST)" />
            </button>
          )}
          <button
            onClick={() => closeControlsAfter(() => setIsTimeline(false))}
            className={`toggle-view-btn ${!isTimeline ? 'active' : ''}`}
          >
            <img src={controlsMenuIcon} alt="Index" />
          </button>
          <button
            onClick={() => closeControlsAfter(() => setIsTimeline(true))}
            className={`toggle-view-btn ${isTimeline ? 'active' : ''}`}
          >
            <img src={controlsMenuIcon} alt="Timeline" />
          </button>
        </div>
      </div>
      {setIsHorizontalScroll && (
        <button
          onClick={() => {
            if (!isTimeline) {
              // capture center poster timestamp from DOM before switching
              try {
                const centerY = window.scrollY + window.innerHeight / 2;
                let bestDist = Infinity;
                let bestTs: number | null = null;
                corsicaData.forEach((item) => {
                  const img = document.querySelector(`img[alt="${item.fileName}"]`) as HTMLImageElement | null;
                  if (!img) return;
                  const rect = img.getBoundingClientRect();
                  const imgCenter = window.scrollY + rect.top + rect.height / 2;
                  const d = Math.abs(imgCenter - centerY);
                  if (d < bestDist) {
                    bestDist = d;
                    bestTs = item.timestamp;
                  }
                });
                setDesiredTimelineTimestamp(bestTs);
              } catch (e) {
                setDesiredTimelineTimestamp(null);
              }
              setIsTimeline(true);
            } else if (onShowIndexList) {
              onShowIndexList();
            } else {
              setIsTimeline(false);
            }
          }}
          className={`stack-toggle-btn ${isTimeline ? 'active' : ''}`}
          aria-label={isTimeline ? 'Go to index list' : 'Go to timeline view'}
        >
          <img src={controlsMenuIcon} alt={isTimeline ? 'Index list' : 'Timeline'} />
        </button>
      )}
      {debouncedQuery && (
        <div className="active-tag-container">
          <div className="active-tag" aria-label={`Active filter ${debouncedQuery}`}>
            <span className="active-tag-label">{debouncedQuery}</span>
            <button
              className="active-tag-clear"
              onClick={() => { setQueryImmediate(''); }}
              aria-label="Clear filter"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {isTimeline ? (
        <>
        <div
          ref={timelineRef}
          className="timeline"
          style={{
            zoom: effectiveTimelineZoom,
            minHeight: timelineContentHeight,
          }}
        >
          {/* Year markers */}
          {Array.from({ length: 25 }, (_, i) => 2002 + i).map((year) => {
            const yearDate = new Date(`${year}-01-01`).getTime();
            if (yearDate < timelineStats.min || yearDate > timelineStats.max) return null;
            const topPosition = getTimelinePosition(yearDate);
            const safeZoom = Math.max(effectiveTimelineZoom, 0.001);
            const viewportTop = viewportBounds.top / safeZoom;
            const viewportBottom = viewportBounds.bottom / safeZoom;
            if (topPosition < viewportTop - 1800 || topPosition > viewportBottom + 1800) return null;
            return (
              <div
                key={`year-${year}`}
                className="timeline-year-marker"
                style={{ top: `${topPosition}px` }}
              >
                <span>{year}</span>
              </div>
            );
          })}
          
          {windowedTimelineEntries.map(({ item, sourceIndex, topPosition }) => {
            // Skip "Unknown" dates in timeline view or place them at the end
            if (item.year === 'Unknown') {
              return (
                <div 
                  key={`${sourceIndex}-${item.fileName}`} 
                  className="timeline-item unknown-date"
                  style={{ top: `${topPosition}px` }}
                  onMouseEnter={() => setHoveredIndex(sourceIndex)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className="timeline-marker">
                    <div className="timeline-dot"></div>
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-date">Unknown Date</div>
                    <div className="timeline-image">
                      <img src={item.src} alt={item.fileName} loading="lazy" decoding="async" onClick={() => setSelectedImage(item)} />
                    </div>
                  </div>
                </div>
              );
            }
            
              const seed = (sourceIndex * 73856093) ^ (item.timestamp & 0xffffffff);
              // Increase desktop scatter so items spread more on larger screens
              const scatterPercent = isMobileViewport ? ((seed >>> 0) % 22) : ((seed >>> 0) % 42);
              // Keep offset positive so posters stay to the right of the line
              const imgOffset = scatterPercent;
            return (
              <div 
                key={`${sourceIndex}-${item.fileName}`} 
                className={`timeline-item ${sourceIndex % 2 === 0 ? 'left' : 'right'}`}
                style={{ top: `${topPosition}px` }}
                onMouseEnter={() => setHoveredIndex(sourceIndex)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="timeline-marker">
                  <div className="timeline-dot"></div>
                </div>
                <div className="timeline-content">
                  <div className="timeline-date">{new Date(item.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    <div className="timeline-image" style={{ transform: `translateX(${imgOffset}%)` }}>
                    <img src={item.src} alt={item.fileName} loading="lazy" decoding="async" onClick={() => setSelectedImage(item)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {hoveredItem && !isPhoneLikeViewport && (
          <div className="timeline-hover-panel">
            <div className="timeline-hover-event">{hoveredItem.event}</div>
            {hoveredItem.details && (
              <div className="timeline-hover-details">{hoveredItem.details}</div>
            )}
          </div>
        )}
        {stickyYear && (
          <div className="timeline-sticky-year">
            <span>{stickyYear}</span>
          </div>
        )}
        </>
      ) : (
        <div className="index-year-list">
          <div className={`zoom-buttons-container ${showRightIcons ? 'with-controls-open' : ''}`}>
            <button 
              className="zoom-btn"
              onClick={() => handleGridDensity(-1)}
              disabled={isHorizontalScroll ? rowSize <= 120 : gridColumns >= 12}
              aria-label={isHorizontalScroll ? "Decrease row size" : "Increase grid density"}
            >
              −
            </button>
            <button 
              className="zoom-btn"
              onClick={() => handleGridDensity(1)}
              disabled={isHorizontalScroll ? rowSize >= 400 : gridColumns <= 1}
              aria-label={isHorizontalScroll ? "Increase row size" : "Decrease grid density"}
            >
              +
            </button>
          </div>
          {indexGroups.map((group) => (
            <div key={group.year} className="index-year-row" style={{ position: 'relative' }}>
              <div className="index-year-meta">
                <div className="index-year-label">{group.year}</div>
              </div>
              <div
                className={isHorizontalScroll ? "svg-scroll-grid index-year-grid scroll-horizontal carousel-scroll" : "svg-scroll-grid index-year-grid"}
                ref={isHorizontalScroll ? (el) => { rowRefs.current[group.year] = el; } : undefined}
                onScroll={isHorizontalScroll ? () => updateActiveCenterForYear(group.year) : undefined}
                style={isHorizontalScroll ? { 
                  display: 'flex', 
                  flexWrap: 'nowrap',
                  overflowX: 'auto', 
                  gap: '0', 
                  paddingBottom: '20px',
                  paddingLeft: '40%',
                  paddingRight: '40%',
                  alignItems: 'center',
                  height: `${rowSize}px`
                } : { gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
              >
                {group.items.map((item, index) => {
                  const centerIndex = activeCenterByYear[group.year] ?? Math.floor(group.items.length / 2);
                  const distanceFromCenter = Math.abs(index - centerIndex);
                  const stackOrder = group.items.length - distanceFromCenter;
                  const baseOverlap = rowSize * 0.32;
                  const centerSpacing = rowSize * 0.12;
                  const isCenterItem = index === centerIndex;
                  
                  let marginLeft = 0;
                  if (index === 0) {
                    marginLeft = 0;
                  } else if (isCenterItem) {
                    marginLeft = centerSpacing;
                  } else {
                    // Overlap increases with distance from center for spreading effect
                    const spreadFactor = distanceFromCenter * 0.2;
                    marginLeft = -(baseOverlap + (baseOverlap * spreadFactor));
                  }

                  return (
                  <div 
                    key={`${group.year}-${index}`} 
                    className={isHorizontalScroll ? "svg-box carousel-item" : "svg-box"} 
                    style={isHorizontalScroll ? { 
                      flex: '0 0 auto', 
                      width: `${rowSize * 0.7}px`, 
                      height: `${rowSize}px`,
                      marginLeft: `${marginLeft}px`,
                      transition: 'all 0.3s ease',
                      zIndex: stackOrder,
                      transform: isCenterItem ? 'scale(1.14)' : 'scale(1)'
                    } : {}}
                  >
                    <img src={item.src} alt={item.fileName} loading="lazy" decoding="async" onClick={() => setSelectedImage(item)} />
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {selectedImage && (
        <EventModal
          selectedImage={selectedImage}
            onClose={() => setSelectedImage(null)}
            playIconSrc={playIcon}
            onSearchNavigate={onShowIndexList}
            onSearchNavigateRegular={onShowIndexRegular}
            timelineMobilePreview={isTimeline && isMobileViewport}
        />
      )}
    </div>
  );
};

export default CorsicaFilename;
