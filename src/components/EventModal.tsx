import React, { useCallback, useEffect, useState } from 'react';
import { useSearch } from '../contexts/SearchContext';
import { useAudio } from './AudioProvider';

export interface EventModalData {
	src?: string;
	fileName?: string;
	event: string;
	date: string;
	year: number | 'Unknown';
	details?: string;
	recordings?: { room1?: string | null; room2?: string | null };
}

interface EventModalProps {
	selectedImage: EventModalData;
	onClose: () => void;
	playIconSrc?: string;
	onSearchNavigate?: () => void;
	onSearchNavigateRegular?: () => void;
	timelineMobilePreview?: boolean;
}

const FADE_MS = 220;

const normalizeSoundcloudEmbedUrl = (embedUrl: string): string => {
	try {
		const parsed = new URL(embedUrl);
		parsed.searchParams.set('color', '#0a26f0');
		parsed.searchParams.set('inverse', 'true');
		parsed.searchParams.set('auto_play', 'true');
		parsed.searchParams.set('show_user', 'true');
		return parsed.toString();
	} catch {
		return embedUrl;
	}
};

const EventModal: React.FC<EventModalProps> = ({
	selectedImage,
	onClose,
	playIconSrc,
	onSearchNavigate,
	onSearchNavigateRegular,
	timelineMobilePreview = false,
}) => {
	const { activeMix, handleNewMix } = useAudio();
	const { setQueryImmediate } = useSearch();
	const [isClosing, setIsClosing] = useState(false);

	const triggerClose = useCallback((afterClose?: () => void) => {
		setIsClosing(true);
		setTimeout(() => {
			onClose();
			if (afterClose) afterClose();
		}, FADE_MS);
	}, [onClose]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') triggerClose();
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [triggerClose]);

	const handlePlay = (mixUrl?: string | null, roomLabel?: string) => {
		if (!mixUrl) return;
		const normalizedUrl = normalizeSoundcloudEmbedUrl(mixUrl);
		if (activeMix?.url === normalizedUrl) return;
		handleNewMix({
			url: normalizedUrl,
			event: selectedImage.event,
			date: selectedImage.date,
			artists: selectedImage.details || '',
			roomLabel: roomLabel || 'Room',
		});
	};

	const recordings = selectedImage.recordings;
	const normalizedRoom1 = recordings?.room1 ? normalizeSoundcloudEmbedUrl(recordings.room1) : null;
	const normalizedRoom2 = recordings?.room2 ? normalizeSoundcloudEmbedUrl(recordings.room2) : null;
	const playingRoomLabel = normalizedRoom1 && activeMix?.url === normalizedRoom1
		? 'Room 1'
		: normalizedRoom2 && activeMix?.url === normalizedRoom2
			? 'Room 2'
			: null;

	const renderModalInfo = () => (
		<div className={`modal-info${timelineMobilePreview ? ' timeline-mobile-preview-info' : ''}`}>
			<div className="modal-event">{selectedImage.event}</div>
			<div className="modal-date">
				{selectedImage.year === 'Unknown'
					? 'Unknown Date'
					: new Date(selectedImage.date).toLocaleDateString('en-US', {
							year: 'numeric',
							month: 'long',
							day: 'numeric',
						})}
			</div>
			<div className="modal-details">
				<div style={{ color: '#ccc', marginBottom: 10 }}>
					{selectedImage.details || 'No index details found'}
				</div>
				{(() => {
					const details = selectedImage.details || '';
					if (!details) return null;
					const parts = details.split(/[,;\/\|]+|\s+and\s+|\s*&\s*/i).map(s => s.trim()).filter(Boolean);
					return (
						<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
							{parts.map((p, i) => (
								<button
									key={i}
									className="artist-chip"
									onClick={(e) => {
										e.stopPropagation();
										setQueryImmediate(p);
										triggerClose(() => {
											if (onSearchNavigateRegular) onSearchNavigateRegular();
											else if (onSearchNavigate) onSearchNavigate();
										});
									}}
								>
									{p}
								</button>
							))}
						</div>
					);
				})()}
			</div>
			{(recordings?.room1 || recordings?.room2) && (
				<>
					<div className="modal-play-actions">
						{recordings?.room1 && (
							<button
								className="modal-play-btn"
								onClick={() => handlePlay(recordings?.room1, 'Room 1')}
								aria-label="Play Room 1"
							>
								<img src={playIconSrc} alt="Play" />
								<span>Room 1</span>
							</button>
						)}
						{recordings?.room2 && (
							<button
								className="modal-play-btn"
								onClick={() => handlePlay(recordings?.room2, 'Room 2')}
								aria-label="Play Room 2"
							>
								<img src={playIconSrc} alt="Play" />
								<span>Room 2</span>
							</button>
						)}
					</div>
					{playingRoomLabel && (
						<div className="modal-play-status" aria-live="polite">
							Playing in player • {playingRoomLabel}
						</div>
					)}
				</>
			)}
		</div>
	);

	if (timelineMobilePreview) {
		return (
			<div className={`timeline-side-preview${isClosing ? ' closing' : ''}`}>
				<button
					className="timeline-side-preview-close"
					onClick={() => triggerClose()}
					aria-label="Close preview"
				>
					×
				</button>
				<div className="timeline-side-preview-scroll">
					{renderModalInfo()}
				</div>
			</div>
		);
	}

	return (
		<div className={`image-modal${isClosing ? ' closing' : ''}`} onClick={() => triggerClose()}>
			<div className="modal-content" onClick={(event) => event.stopPropagation()}>
				<button
					type="button"
					className="modal-close-btn"
					onClick={() => triggerClose()}
					aria-label="Close preview"
				>
					×
				</button>
				{selectedImage.src && (
					<img src={selectedImage.src} alt={selectedImage.fileName || selectedImage.event} />
				)}
				{renderModalInfo()}
			</div>
		</div>
	);
};

export default EventModal;
