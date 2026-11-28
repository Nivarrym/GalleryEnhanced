import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Empty, Spin } from 'antd';
import ImageCard from './ImageCard';
import { useGalleryContext } from './GalleryContext';
import type { FileDetails } from './types';
import { perfMeasure } from './perf';

const ENDLESS_INITIAL = 40;
const ENDLESS_STEP = 40;

interface GalleryGridBodyProps {
    imagesDetailsList: FileDetails[];
    currentFolder: string;
    onInfoClick: (imageName: string) => void;
    onVideoClick: (imageName: string | undefined) => void;
}

interface DateSection {
    key: string;
    date: string | null;
    items: FileDetails[];
}

/**
 * CSS-grid gallery body. Unlike a JS virtualizer, changing the card width or
 * the container width is handled natively by the browser; React does not need
 * to recompute row positions. In endless mode only a growing prefix is mounted,
 * and ImageCard loads thumbnails only within the viewport plus two rows.
 */
const GalleryGridBody = ({ imagesDetailsList, currentFolder, onInfoClick, onVideoClick }: GalleryGridBodyProps) => {
    const {
        dataRevision,
        loading,
        sortMethod,
        settings,
        pageMode,
        pageIndex,
        selectedSet,
        selectImage,
        deleteAssets,
        setPreviewingVideo,
        setPreviewMode,
        setOpen,
        isAssetTrashed,
        isAssetFavorite,
        toggleAssetTag,
        setHoveredAssetUrl,
        setPreviewAssetUrl,
    } = useGalleryContext();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [endlessLimit, setEndlessLimit] = useState(ENDLESS_INITIAL);

    const pageSize = pageMode === 'endless' ? null : pageMode;
    const pageCount = pageSize ? Math.max(1, Math.ceil(imagesDetailsList.length / pageSize)) : 1;
    const safePageIndex = Math.min(pageIndex, pageCount - 1);
    const visibleItems = useMemo(() => {
        if (pageSize) {
            return imagesDetailsList.slice(safePageIndex * pageSize, (safePageIndex + 1) * pageSize);
        }
        return imagesDetailsList.slice(0, Math.min(endlessLimit, imagesDetailsList.length));
    }, [imagesDetailsList, pageSize, safePageIndex, endlessLimit]);

    const sections = useMemo<DateSection[]>(() => {
        if (!settings.showDateDivider || (sortMethod !== 'Newest' && sortMethod !== 'Oldest')) {
            return [{ key: 'all', date: null, items: visibleItems }];
        }
        const grouped: { [date: string]: FileDetails[] } = {};
        visibleItems.forEach((item) => {
            const date = item.timestamp ? new Date(item.timestamp * 1000).toISOString().slice(0, 10) : 'Unknown';
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(item);
        });
        return Object.entries(grouped).map(([date, items]) => ({ key: date, date, items }));
    }, [visibleItems, settings.showDateDivider, sortMethod]);

    useEffect(() => {
        setEndlessLimit(ENDLESS_INITIAL);
        scrollRef.current?.scrollTo({ top: 0 });
    }, [currentFolder, pageMode, pageIndex]);

    useEffect(() => {
        if (loading || dataRevision === 0) return;
        const frame = window.requestAnimationFrame(() => {
            perfMeasure('grid.firstPaint', 'data.ready', { items: visibleItems.length, folder: currentFolder });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [loading, dataRevision]);

    const handleScroll = () => {
        if (pageMode !== 'endless') return;
        const element = scrollRef.current;
        if (!element) return;
        if (element.scrollTop + element.clientHeight >= element.scrollHeight - 500) {
            setEndlessLimit((limit) => Math.min(imagesDetailsList.length, limit + ENDLESS_STEP));
        }
    };

    const thumbSize = Math.min(600, Math.max(160, settings.thumbSize ?? 350));
    const cardHeight = Math.round(thumbSize * (450 / 350));

    return (
        <div
            className="gallery-grid-body"
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                ['--gallery-card-width' as string]: `${thumbSize}px`,
                ['--gallery-card-height' as string]: `${cardHeight}px`,
            } as React.CSSProperties}
        >
            <div className="gallery-scroll" ref={scrollRef} onScroll={handleScroll}>
                {imagesDetailsList.length === 0 ? (
                    <Empty
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                        }}
                        description={'No images found'}
                    />
                ) : (
                    <>
                        {sections.map((section) => (
                            <section className="gallery-date-section" key={section.key}>
                                {section.date && (
                                    <div className="gallery-date-header">
                                        <span className="gallery-date-divider-text">{section.date}</span>
                                    </div>
                                )}
                                <div className="gallery-cards-grid">
                                    {section.items.map((image) => (
                                        <ImageCard
                                            image={image}
                                            key={image.name}
                                            dragFolder={currentFolder}
                                            onInfoClick={onInfoClick}
                                            onVideoClick={onVideoClick}
                                            settings={settings}
                                            selectedSet={selectedSet}
                                            selectImage={selectImage}
                                            deleteAssets={deleteAssets}
                                            setPreviewingVideo={setPreviewingVideo}
                                            setPreviewMode={setPreviewMode}
                                            setOpen={setOpen}
                                            trash={isAssetTrashed(image.url)}
                                            favorite={isAssetFavorite(image.url)}
                                            onToggleFavorite={() => toggleAssetTag(image.url, 'favorite')}
                                            onToggleTrash={() => toggleAssetTag(image.url, 'trash')}
                                            setHoveredAssetUrl={setHoveredAssetUrl}
                                            setPreviewAssetUrl={setPreviewAssetUrl}
                                        />
                                    ))}
                                </div>
                            </section>
                        ))}
                        {pageMode === 'endless' && endlessLimit < imagesDetailsList.length && (
                            <div className="gallery-endless-more">
                                <Spin size="small" />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default GalleryGridBody;
