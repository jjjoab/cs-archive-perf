import React, { useEffect, useState } from 'react';
import CorsicaNew from './corsicanew';
import IndexList from './IndexList';
import LoadingScreen from './LoadingScreen';
import LandingPage from './LandingPage';
import { AudioProvider } from './components/AudioProvider';
import { SearchProvider } from './contexts/SearchContext';
import SearchBar from './components/SearchBar';
import headerLogo from './assets/icons/corsica logo white small.png';
import PerformanceDashboard from './components/PerformanceDashboard';

// Toggle between loading screens: 'images' or 'video'
const LOADING_SCREEN_TYPE: 'images' | 'video' = 'video';
const ARCHIVE_YEAR = new Date().getFullYear();

const App: React.FC = () => {
  const [view, setView] = useState<'json' | 'filename' | 'list'>('list');
  const [hasEnteredArchive, setHasEnteredArchive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isHorizontalScroll, setIsHorizontalScroll] = useState(false);
  const [openFilenameInTimeline, setOpenFilenameInTimeline] = useState(false);
  const [visibleImageCount, setVisibleImageCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isArchiveMenuOpen, setIsArchiveMenuOpen] = useState(false);
  const useVideoLoadingScreen = LOADING_SCREEN_TYPE === 'video' && window.innerWidth > 768;

  const ActiveLoadingScreen = useVideoLoadingScreen ? LoadingScreen : LoadingScreen;

  const handleEnterArchive = () => {
    setHasEnteredArchive(true);
    setIsLoading(true);
    setIsMobileMenuOpen(false);
    setIsArchiveMenuOpen(false);
  };

  const handleReturnToLanding = () => {
    setHasEnteredArchive(false);
    setIsLoading(false);
    setIsMobileMenuOpen(false);
    setIsArchiveMenuOpen(false);
  };

  const handleShowArchiveArt = () => {
    setView('filename');
    setTimeout(() => setOpenFilenameInTimeline(false), 0);
    setIsMobileMenuOpen(false);
    setIsArchiveMenuOpen(false);
  };

  const handleShowGalleryList = () => {
    setView('list');
    setIsMobileMenuOpen(false);
    setIsArchiveMenuOpen(false);
  };

  const handleNextView = () => {
    if (view === 'filename' && !openFilenameInTimeline) {
      // filename (default) → list
      setView('list');
    } else if (view === 'list') {
      // list → filename (timeline)
      setView('filename');
      setOpenFilenameInTimeline(true);
    } else if (view === 'filename' && openFilenameInTimeline) {
      // filename (timeline) → filename (default)
      setView('filename');
      setOpenFilenameInTimeline(false);
    }
  };

  useEffect(() => {
    if (!isArchiveMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('.archive-top-menu') || target.closest('.archive-title-trigger')) {
        return;
      }

      setIsArchiveMenuOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isArchiveMenuOpen]);

  return (
    <>
    <SearchProvider>
    <AudioProvider>
      {!hasEnteredArchive ? (
        <LandingPage onEnterArchive={handleEnterArchive} />
      ) : (
        <>
      {isLoading && <ActiveLoadingScreen onComplete={() => setIsLoading(false)} />}
      <div className="archive-header">
        <div className="archive-header-left">
        <div
          role="button"
          tabIndex={0}
          aria-label="Go to landing page"
          onClick={handleReturnToLanding}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleReturnToLanding(); } }}
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <img src={headerLogo} alt="Archive logo" style={{ height: '26px', width: 'auto', display: 'block' }} />
        </div>
        <button
          type="button"
          className={`archive-title-trigger ${isArchiveMenuOpen ? 'active' : ''}`}
          aria-label="Toggle archive menu"
          aria-expanded={isArchiveMenuOpen}
          onClick={() => {
            setIsArchiveMenuOpen((prev) => !prev);
            setIsMobileMenuOpen(false);
          }}
        >
          <span className="archive-title">ARCHIVE</span>
          <span className="archive-title-arrow" aria-hidden="true">↓</span>
        </button>
        </div>
        <div className="archive-header-actions">
          <SearchBar />
          <button
            type="button"
            className={`archive-mobile-menu-btn ${isMobileMenuOpen ? 'active' : ''}`}
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
            onClick={() => {
              setIsMobileMenuOpen((prev) => !prev);
              setIsArchiveMenuOpen(false);
            }}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
      <div className={`archive-top-menu ${isArchiveMenuOpen ? 'open' : ''}`}>
        <button type="button" className="archive-top-menu-row" onClick={handleShowArchiveArt}>
          <span className="archive-top-menu-label">ARCHIVE</span>
        </button>
        <button type="button" className="archive-top-menu-row" onClick={handleShowGalleryList}>
          <span className="archive-top-menu-label">GALLERY</span>
        </button>
        <a
          href="https://everpress.com/profile/corsica-studios"
          target="_blank"
          rel="noopener noreferrer"
          className="archive-top-menu-row"
          onClick={() => setIsArchiveMenuOpen(false)}
        >
          <span className="archive-top-menu-label">MERCH</span>
        </a>
        <div className="archive-top-menu-row" aria-disabled="true">
          <span className="archive-top-menu-label">RECORDINGS</span>
        </div>
      </div>
      <div className={`archive-mobile-menu ${isMobileMenuOpen ? 'open' : ''}`}>
        <button type="button" className="archive-mobile-menu-row" onClick={handleShowArchiveArt}>
          <span className="archive-mobile-menu-label">ARCHIVE</span>
        </button>
        <button type="button" className="archive-mobile-menu-row" onClick={handleShowGalleryList}>
          <span className="archive-mobile-menu-label">GALLERY</span>
        </button>
        <a
          href="https://everpress.com/profile/corsica-studios"
          target="_blank"
          rel="noopener noreferrer"
          className="archive-mobile-menu-row"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <span className="archive-mobile-menu-label">MERCH</span>
        </a>
        <div className="archive-mobile-menu-row" aria-disabled="true">
          <span className="archive-mobile-menu-label">RECORDINGS</span>
        </div>
      </div>
      <div className="main-content" style={{ display: isLoading ? 'none' : 'block' }}>
        {/*
        <div className="view-toggle-container">
          <button 
            onClick={() => setView('json')}
            className={`source-toggle-btn ${view === 'json' ? 'active' : ''}`}
          >
            JSON Dates
          </button>
          <button 
            onClick={() => setView('filename')}
            className={`source-toggle-btn ${view === 'filename' ? 'active' : ''}`}
          >
            Filename Dates
          </button>
          <button 
            onClick={() => setView('list')}
            className={`source-toggle-btn ${view === 'list' ? 'active' : ''}`}
          >
            Index List
          </button>
        </div>
        */}
        {view === 'list' ? (
          <IndexList
            onShowIndexRegular={() => {
              setOpenFilenameInTimeline(false);
              setView('filename');
            }}
            onShowTimeline={() => {
              setOpenFilenameInTimeline(true);
              setView('filename');
            }}
            onNextView={handleNextView}
            onVisibleCountChange={setVisibleImageCount}
          />
        ) : view === 'filename' ? (
          <CorsicaNew
            source="filename"
            onShowIndexList={() => setView('list')}
            onShowIndexRegular={() => {
              setOpenFilenameInTimeline(false);
              setView('filename');
            }}
            onNextView={handleNextView}
            isHorizontalScroll={isHorizontalScroll}
            setIsHorizontalScroll={setIsHorizontalScroll}
            initialTimeline={openFilenameInTimeline}
            onVisibleCountChange={setVisibleImageCount}
          />
        ) : (
          <CorsicaNew
            source="json"
            onShowIndexList={() => setView('list')}
            onShowIndexRegular={() => setView('filename')}
            onNextView={handleNextView}
            isHorizontalScroll={isHorizontalScroll}
            setIsHorizontalScroll={setIsHorizontalScroll}
            onVisibleCountChange={setVisibleImageCount}
          />
        )}
      </div>
      <div className="site-footer" style={{ display: 'flex', alignItems: 'center' }}>
        <span>Corsicastudios.com | @Corsicastudios | {visibleImageCount} images | {ARCHIVE_YEAR}</span>
        <PerformanceDashboard />
      </div>
        </>
      )}
    </AudioProvider>
    </SearchProvider>
    </>
  );
};

export default App;
