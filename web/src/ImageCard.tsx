import { App, Button, Image, Popconfirm, Tooltip, Typography } from 'antd';
import type { FileDetails } from './types';
import { hasMetadata } from './types';
import DeleteOutlined from '@ant-design/icons/lib/icons/DeleteOutlined';
import ExportOutlined from '@ant-design/icons/lib/icons/ExportOutlined';
import FolderOpenOutlined from '@ant-design/icons/lib/icons/FolderOpenOutlined';
import InfoCircleOutlined from '@ant-design/icons/lib/icons/InfoCircleOutlined';
import PlayCircleFilled from '@ant-design/icons/lib/icons/PlayCircleFilled';
import SoundOutlined from '@ant-design/icons/lib/icons/SoundOutlined';
import PlusSquareOutlined from '@ant-design/icons/lib/icons/PlusSquareOutlined';
import ZoomInOutlined from '@ant-design/icons/lib/icons/ZoomInOutlined';
import HighlightOutlined from '@ant-design/icons/lib/icons/HighlightOutlined';
import StarFilled from '@ant-design/icons/lib/icons/StarFilled';
import StarOutlined from '@ant-design/icons/lib/icons/StarOutlined';
import DeleteFilled from '@ant-design/icons/lib/icons/DeleteFilled';
import SwapOutlined from '@ant-design/icons/lib/icons/SwapOutlined';
import NodeIndexOutlined from '@ant-design/icons/lib/icons/NodeIndexOutlined';
import React, { memo, useEffect, useRef, useState } from 'react';
import { useDrag } from 'ahooks';
import type { Dispatch, SetStateAction } from 'react';
import type { DeleteResult } from './ComfyAppApi';
import type { PreviewMode, SettingsState, SelectionModifiers } from './GalleryContext';
import { ComfyAppApi } from './ComfyAppApi';
import { assetUrl } from './assetUrls';
import { use3DThumbnail } from './GlobalModelRenderer';
import { GRID_THUMBNAIL_WIDTH, useThumbnail } from './thumbnails';
import { addGalleryImagesToGraph, replaceSelectedGalleryNode } from './GalleryGraph';
import { openMaskEditor } from './GalleryMask';

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const ImageCard3DThumbnail = ({ image, onClick }: { image: FileDetails, onClick: () => void }) => {
    const typeMatch = image.url.match(/\.([^.]+)$/);
    const type = typeMatch ? typeMatch[1].toLowerCase() : '';
    const thumbnail = use3DThumbnail(assetUrl(image), type);

    if (thumbnail) {
        return (
            <>
                <img
                    style={{
                        objectFit: "cover",
                        maxWidth: 'var(--gallery-card-width, 350px)',
                        width: '100%',
                        height: '100%',
                        userSelect: 'none',
                        cursor: 'pointer',
                    }}
                    src={thumbnail}
                    onClick={onClick}
                    alt={image.name}
                    draggable={false}
                />
                <Image
                    id={image.url}
                    style={{ display: 'none' }}
                    src={TRANSPARENT_PIXEL}
                    preview={{ src: assetUrl(image) }}
                />
            </>
        );
    }

    return (
        <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: 'var(--gallery-card-bg)', cursor: 'pointer' }}
            onClick={onClick}
        >
            <div style={{ fontSize: '64px', color: 'var(--gallery-accent)', marginBottom: '24px', fontWeight: 'bold' }}>3D</div>
            <Typography.Text style={{ padding: '0 16px', textAlign: 'center', maxWidth: '100%' }} ellipsis>
                {image.name}
            </Typography.Text>
            <Image
                id={image.url}
                style={{ display: 'none' }}
                src={TRANSPARENT_PIXEL}
                preview={{ src: assetUrl(image) }}
            />
        </div>
    );
};

const ImageCard = memo(function ImageCard({
    image,
    dragFolder,
    onInfoClick,
    onVideoClick,
    settings,
    selectedSet,
    selectImage,
    deleteAssets,
    setPreviewingVideo,
    setPreviewMode,
    setOpen,
    trash,
    favorite,
    onToggleFavorite,
    onToggleTrash,
    setHoveredAssetUrl,
    setPreviewAssetUrl,
}: {
    image: FileDetails & { dragFolder?: string };
    dragFolder?: string;
    onInfoClick: (imageName: string) => void;
    onVideoClick: (imageName: string | undefined) => void;
    settings: SettingsState;
    selectedSet: Set<string>;
    selectImage: (url: string, modifiers?: SelectionModifiers) => void;
    deleteAssets: (urls: string[]) => Promise<DeleteResult>;
    setPreviewingVideo: Dispatch<SetStateAction<string | undefined>>;
    setPreviewMode: (mode: PreviewMode) => void;
    setOpen: Dispatch<SetStateAction<boolean>>;
    trash: boolean;
    favorite: boolean;
    onToggleFavorite: () => void;
    onToggleTrash: () => void;
    setHoveredAssetUrl: Dispatch<SetStateAction<string | undefined>>;
    setPreviewAssetUrl: Dispatch<SetStateAction<string | undefined>>;
}) {
    const { message } = App.useApp();
    const dragRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const suppressPreviewClickRef = useRef(false);
    const [dragging, setDragging] = useState(false);
    const [videoPlaying, setVideoPlaying] = useState(false);
    const [videoMuted, setVideoMuted] = useState(true);
    const [videoHovered, setVideoHovered] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [openingWorkflow, setOpeningWorkflow] = useState(false);
    const [nearViewport, setNearViewport] = useState(false);
    const thumbEnabled = image.type === 'image' && nearViewport;
    const { src: thumbnailSrc, state: thumbnailState } = useThumbnail(image, GRID_THUMBNAIL_WIDTH, thumbEnabled);
    const originalSrc = assetUrl(image);
    const selected = selectedSet.has(image.url);

    // Load the asset only when it is on screen plus roughly two rows above and
    // below. Off-screen cards keep a placeholder and stay cheap to paint.
    useEffect(() => {
        const element = dragRef.current;
        if (!element) return;
        const root = element.closest('.gallery-scroll') as HTMLElement | null;
        if (!root) {
            setNearViewport(true);
            return;
        }
        const height = element.getBoundingClientRect().height || 450;
        const observer = new IntersectionObserver(([entry]) => {
            setNearViewport(entry.isIntersecting);
        }, {
            root,
            rootMargin: `${Math.round(height * 2 + 32)}px 0px`,
            threshold: 0,
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [image.url, image.type]);

    // Shift toggles the sound of the hovered looping video. Track Shift while
    // the pointer stays on the card so keydown/keyup both work.
    useEffect(() => {
        if (image.type !== 'media' || !videoHovered) return;
        const syncMuted = (event: KeyboardEvent) => {
            const video = videoRef.current;
            if (!video) return;
            const muted = !event.shiftKey;
            video.muted = muted;
            setVideoMuted(muted);
            if (!video.paused) {
                video.play().catch(() => { });
            }
        };
        window.addEventListener('keydown', syncMuted);
        window.addEventListener('keyup', syncMuted);
        return () => {
            window.removeEventListener('keydown', syncMuted);
            window.removeEventListener('keyup', syncMuted);
        };
    }, [image.type, videoHovered]);

    const handleCardMouseEnter = (event: React.MouseEvent) => {
        setHoveredAssetUrl(image.url);
        if (image.type !== 'media') return;
        setVideoHovered(true);
        const video = videoRef.current;
        if (!video) return;
        const muted = !event.shiftKey;
        video.muted = muted;
        video.loop = true;
        setVideoMuted(muted);
        if (settings.autoPlayVideos) {
            video.play().catch(() => {
                // Audible autoplay can be blocked until a user gesture; keep
                // the visual preview running muted and retry on the next event.
                video.muted = true;
                setVideoMuted(true);
                video.play().catch(() => { });
            });
        }
    };

    const handleCardMouseLeave = () => {
        setHoveredAssetUrl(undefined);
        if (image.type !== 'media') return;
        setVideoHovered(false);
        const video = videoRef.current;
        if (video) {
            video.pause();
            video.muted = true;
        }
        setVideoMuted(true);
        setVideoPlaying(false);
    };

    useDrag(
        {
            name: image.name,
            folder: dragFolder || image.dragFolder || '',
            type: image.type,
            url: image.url,
        },
        dragRef,
        {
            onDragStart: () => setDragging(true),
            onDragEnd: () => setDragging(false),
        }
    );

    // Modifier clicks must not open the antd preview; handle them in capture phase.
    const handleClickCapture = (event: React.MouseEvent) => {
        if ((event.target as HTMLElement).closest('.gallery-card-actions')) return;
        if (!(event.ctrlKey || event.metaKey || event.shiftKey)) return;
        event.preventDefault();
        event.stopPropagation();
        selectImage(image.url, {
            ctrl: event.ctrlKey || event.metaKey,
            shift: event.shiftKey,
        });
    };

    // Opening the hidden Ant Image programmatically also bubbles a click to the
    // card. Suppress that synthetic click so a magnifier/info preview cannot be
    // converted into a selection preview.
    const openHiddenPreview = () => {
        suppressPreviewClickRef.current = true;
        setPreviewAssetUrl(image.url);
        document.getElementById(image.url)?.click();
        window.setTimeout(() => {
            suppressPreviewClickRef.current = false;
        }, 0);
    };

    const handleCardClick = () => {
        if (suppressPreviewClickRef.current) {
            suppressPreviewClickRef.current = false;
            return;
        }
        if (image.type === 'image') {
            setPreviewMode('selection');
            setPreviewAssetUrl(image.url);
            selectImage(image.url, {});
        } else {
            // Video/audio/3D previews are not selection previews.
            setPreviewMode('plain');
            setPreviewAssetUrl(image.url);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const result = await deleteAssets([image.url]);
            if (result.deleted.length > 0) {
                message.success('Asset deleted');
            } else {
                message.error(result.failed[0]?.error || 'Failed to delete asset');
            }
        } finally {
            setDeleting(false);
        }
    };

    const handleReveal = async () => {
        const result = await ComfyAppApi.revealAsset(image.url);
        if (result.ok) {
            message.success('Shown in file manager');
        } else {
            message.error(result.error || 'Failed to show the asset in the file manager');
        }
    };

    const handleOpenExternal = async () => {
        const result = await ComfyAppApi.openAsset(image.url);
        if (result.ok) {
            message.success('Opened in the default application');
        } else {
            message.error(result.error || 'Failed to open the asset');
        }
    };

    const handleAddToGraph = () => {
        const result = addGalleryImagesToGraph(
            [{ url: image.url, name: image.name, type: image.type as 'image' | 'media' | 'audio' }],
            settings.relativePath,
        );
        if (result.ok) {
            message.success(`Added ${image.name} to the active graph`);
        } else {
            message.error(result.error || 'Could not add the image to the graph');
        }
    };

    const handleReplaceInGraph = () => {
        const result = replaceSelectedGalleryNode(
            { url: image.url, name: image.name, type: image.type as 'image' | 'media' | 'audio' },
            settings.relativePath,
        );
        if (result.ok) {
            message.success(`Replaced the selected node with ${image.name}`);
        } else {
            message.error(result.error || 'Could not replace the selected node');
        }
    };

    const handleOpenSourceWorkflow = async () => {
        setOpeningWorkflow(true);
        try {
            const metadata = hasMetadata(image)
                ? image.metadata
                : await ComfyAppApi.fetchMetadata(image.url);
            const rawWorkflow = (metadata as any)?.workflow;
            if (!rawWorkflow) {
                message.error('This image has no embedded workflow metadata');
                return;
            }
            const workflow = typeof rawWorkflow === 'string'
                ? JSON.parse(rawWorkflow)
                : rawWorkflow;

            const app = (window as any).comfyAPI?.app?.app ?? (window as any).app;
            const manager = app?.extensionManager?.workflow;
            if (!manager || typeof manager.createTemporary !== 'function'
                || typeof manager.openWorkflow !== 'function') {
                message.error('The ComfyUI workflow tab API is unavailable');
                return;
            }

            const baseName = image.name.replace(/\.[^.]+$/, '') || 'gallery';
            const tab = manager.createTemporary(`Source - ${baseName}.json`, workflow);
            // createTemporary only stores the JSON. Force the workflow object to
            // parse it into an activeState; otherwise openWorkflow can fall back
            // to the currently active graph.
            tab.content = JSON.stringify(workflow);
            tab.originalContent = tab.content;
            await tab.load({ force: true });
            if (!tab.activeState) {
                throw new Error('The workflow could not be parsed');
            }
            const state = tab.activeState;
            await manager.openWorkflow(tab);
            // The workflow store's openWorkflow only switches the active tab;
            // load the parsed state into the canvas explicitly.
            if (typeof app.loadGraphData === 'function') {
                await app.loadGraphData(state, true, true, tab, {
                    checkForRerouteMigration: false,
                    deferWarnings: true,
                    skipAssetScans: false,
                });
            }
            setOpen(false);
        } catch (error) {
            message.error(`Could not open workflow: ${String(error)}`);
        } finally {
            setOpeningWorkflow(false);
        }
    };

    // Native drag for exporting image as file/image
    const handleNativeDragStart = (event: React.DragEvent<HTMLImageElement | HTMLVideoElement | HTMLAudioElement>) => {
        // Guess MIME based on filename extension (frontend-only, no backend changes)
        const guessMimeFromName = (name?: string) => {
            const ext = (name || '').split('.').pop()?.toLowerCase() || '';
            const map: Record<string, string> = {
                // images
                jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff',
                // video
                mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
                // audio
                mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', flac: 'audio/flac', aac: 'audio/aac', ogg: 'audio/ogg',
            };
            return map[ext] || '';
        };

        const guessed = guessMimeFromName(image.name || image.url);
        // Fallback to previous simple heuristic if we couldn't guess from extension
        const mimeType = guessed || (image.type === 'image' ? 'image/png' : image.type === 'audio' ? 'audio/wav' : 'video/mp4');

        event.dataTransfer.setData('text/uri-list', assetUrl(image));
        event.dataTransfer.setData('DownloadURL', `${mimeType}:${image.name}:${window.location.origin + assetUrl(image)}`);
    };

    const openPreview = () => {
        try { setPreviewMode('plain'); setPreviewingVideo(undefined); } catch { }
        openHiddenPreview();
        window.setTimeout(() => setPreviewMode('plain'), 0);
    };

    const handlePlainPreview = () => {
        // Magnifier: read-only preview, deliberately no selection change.
        setPreviewMode('plain');
        setPreviewingVideo(undefined);
        openHiddenPreview();
        window.setTimeout(() => setPreviewMode('plain'), 0);
    };

    const handleMaskEditor = async () => {
        const result = await openMaskEditor(image, settings.relativePath, () => setOpen(false));
        if (result.ok) {
            message.success('Mask editor opened');
        } else {
            message.error(result.error || 'Could not open the mask editor');
        }
    };

    const imageSrc = !thumbEnabled
        ? TRANSPARENT_PIXEL
        : (thumbnailSrc ?? (thumbnailState === 'error' ? originalSrc : TRANSPARENT_PIXEL));
    const showThumbPlaceholder = image.type === 'image' && (!thumbEnabled || thumbnailState === 'loading');

    return (<>
        <div
            className={`image-card${selected ? ' gallery-card-selected' : ''}${trash ? ' gallery-card-trash' : ''}`}
            data-asset-url={image.url}
            ref={dragRef}
            style={{
                width: 'var(--gallery-card-width, 350px)',
                height: 'var(--gallery-card-height, 450px)',
                borderRadius: 8,
                overflow: "hidden",
                margin: 0,
                opacity: dragging ? 0.5 : 1,
                display: "flex",
                alignContent: "center",
                justifyContent: "center",
                alignItems: "center",
                position: "relative",
                cursor: 'grab',
            }}
            onClickCapture={handleClickCapture}
            onClick={handleCardClick}
            onMouseEnter={handleCardMouseEnter}
            onMouseLeave={handleCardMouseLeave}
        >
            {image.type == "image" ? (<>
                {showThumbPlaceholder && <div className="gallery-thumb-placeholder" />}
                <Image
                    id={image.url}
                    style={{
                        objectFit: "cover",
                        position: "relative",
                        zIndex: 1,
                        ...(settings.imageThumbFit === 'height'
                            ? { maxHeight: 'var(--gallery-card-height, 450px)', width: 'auto', maxWidth: '100%' }
                            : { maxWidth: 'var(--gallery-card-width, 350px)', width: '100%', height: 'auto' }),
                        userSelect: 'none',
                        cursor: 'grab',
                    }}
                    src={imageSrc}
                    loading="lazy"
                    preview={{ src: originalSrc }}
                    onClick={() => setPreviewingVideo(undefined)}
                    alt={image.name}
                    draggable
                    onDragStart={handleNativeDragStart}
                    onError={() => { /* useThumbnail already falls back via state */ }}
                />
            </>) : image.type === "audio" ? (<>
                <div
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', cursor: 'pointer' }}
                    onClick={openPreview}
                >
                    <SoundOutlined style={{ fontSize: '64px', color: 'var(--gallery-accent)', marginBottom: '24px' }} />
                    <Typography.Text style={{ marginBottom: '16px', padding: '0 16px', textAlign: 'center', maxWidth: '100%' }} ellipsis>
                        {image.name}
                    </Typography.Text>
                    <audio controls preload="none" style={{ width: '90%', height: '40px' }} src={nearViewport ? originalSrc : undefined} onClick={(e) => e.stopPropagation()} />
                    <Image
                        id={image.url}
                        style={{ display: 'none' }}
                        src={TRANSPARENT_PIXEL}
                        preview={{ src: originalSrc }}
                    />
                </div>
            </>) : image.type === "3d" ? (
                <ImageCard3DThumbnail image={image as any} onClick={openPreview} />
            ) : <>
                <video
                    ref={videoRef}
                    style={{
                        ...(settings.videoThumbFit === 'height'
                            ? { maxHeight: 'var(--gallery-card-height, 450px)' }
                            : { maxWidth: 'var(--gallery-card-width, 350px)' }),
                        cursor: "pointer",
                        zIndex: 1,
                    }}
                    src={nearViewport ? originalSrc : undefined}
                    loop
                    muted={videoMuted}
                    playsInline
                    preload="metadata"
                    onPlaying={() => setVideoPlaying(true)}
                    onPause={() => setVideoPlaying(false)}
                    onClick={() => {
                        onVideoClick(image.name);
                        openHiddenPreview();
                    }}
                    draggable
                    onDragStart={handleNativeDragStart}
                />
                {!videoPlaying && settings.autoPlayVideos && <PlayCircleFilled className="gallery-card-play" />}
                <Image
                    id={image.url}
                    style={{ display: "none" }}
                    src={TRANSPARENT_PIXEL}
                    preview={{ src: originalSrc }}
                    alt={image.name}
                />
            </>}

            <div
                className="gallery-card-actions"
                onClick={(event) => { event.stopPropagation(); event.preventDefault(); }}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="gallery-card-action-row">
                    <Tooltip title="Preview without selecting">
                        <Button
                            className="gallery-card-action"
                            shape="circle"
                            size="small"
                            icon={<ZoomInOutlined />}
                            onClick={handlePlainPreview}
                            aria-label={`Preview ${image.name} without selecting`}
                        />
                    </Tooltip>
                    {image.type === 'image' && (
                        <Tooltip title="Open the source workflow in a new workflow tab">
                            <Button
                                className="gallery-card-action"
                                shape="circle"
                                size="small"
                                loading={openingWorkflow}
                                icon={<NodeIndexOutlined />}
                                onClick={handleOpenSourceWorkflow}
                                aria-label={`Open source workflow for ${image.name}`}
                            />
                        </Tooltip>
                    )}
                    {(image.type === 'image' || image.type === 'media' || image.type === 'audio') && (
                        <Tooltip title="Add to active graph">
                            <Button
                                className="gallery-card-action"
                                shape="circle"
                                size="small"
                                icon={<PlusSquareOutlined />}
                                onClick={handleAddToGraph}
                                aria-label={`Add ${image.name} to the active graph`}
                            />
                        </Tooltip>
                    )}
                    {(image.type === 'image' || image.type === 'media' || image.type === 'audio') && (
                        <Tooltip title="Replace the selected graph node's asset">
                            <Button
                                className="gallery-card-action"
                                shape="circle"
                                size="small"
                                icon={<SwapOutlined />}
                                onClick={handleReplaceInGraph}
                                aria-label={`Replace the selected graph node with ${image.name}`}
                            />
                        </Tooltip>
                    )}
                    {image.type === 'image' && (
                        <Tooltip title="Edit mask">
                            <Button
                                className="gallery-card-action"
                                shape="circle"
                                size="small"
                                icon={<HighlightOutlined />}
                                onClick={handleMaskEditor}
                                aria-label={`Edit mask for ${image.name}`}
                            />
                        </Tooltip>
                    )}
                    <Tooltip title="Show in file manager">
                        <Button
                            className="gallery-card-action"
                            shape="circle"
                            size="small"
                            icon={<FolderOpenOutlined />}
                            onClick={handleReveal}
                            aria-label={`Show ${image.name} in file manager`}
                        />
                    </Tooltip>
                    <Tooltip title="Open in default application">
                        <Button
                            className="gallery-card-action"
                            shape="circle"
                            size="small"
                            icon={<ExportOutlined />}
                            onClick={handleOpenExternal}
                            aria-label={`Open ${image.name} in default application`}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Delete asset?"
                        description={image.name}
                        okText="Delete"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                        onConfirm={handleDelete}
                    >
                        <Button
                            danger
                            type="primary"
                            shape="circle"
                            size="small"
                            loading={deleting}
                            icon={<DeleteOutlined />}
                            aria-label={`Delete ${image.name}`}
                        />
                    </Popconfirm>
                </div>
            </div>

            <div
                className="gallery-card-marks"
                onClick={(event) => { event.stopPropagation(); event.preventDefault(); }}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <Tooltip title={favorite ? 'Remove from favorites (F)' : 'Add to favorites (F)'}>
                    <Button
                        className={`gallery-card-action gallery-mark-favorite${favorite ? ' is-active' : ''}`}
                        shape="circle"
                        size="small"
                        icon={favorite ? <StarFilled /> : <StarOutlined />}
                        onClick={onToggleFavorite}
                        aria-label={`${favorite ? 'Remove' : 'Add'} ${image.name} ${favorite ? 'from' : 'to'} favorites`}
                    />
                </Tooltip>
                <Tooltip title={trash ? 'Remove trash mark (Space)' : 'Mark as trash (Space)'}>
                    <Button
                        className={`gallery-card-action gallery-mark-trash${trash ? ' is-active' : ''}`}
                        shape="circle"
                        size="small"
                        icon={<DeleteFilled />}
                        onClick={onToggleTrash}
                        aria-label={`${trash ? 'Remove trash mark from' : 'Mark'} ${image.name}${trash ? '' : ' as trash'}`}
                    />
                </Tooltip>
            </div>

            <div className="gallery-card-footer">
                <Typography.Text
                    strong
                    className="gallery-card-title"
                    ellipsis
                >
                    {image.name}
                </Typography.Text>
                <Tooltip title="Metadata">
                    <Button
                        color="cyan"
                        variant="filled"
                        icon={<InfoCircleOutlined />}
                        size={"middle"}
                        onClick={(event) => {
                            event.stopPropagation();
                            onInfoClick(image.name);
                        }}
                    />
                </Tooltip>
            </div>
        </div>
    </>)
}, (prev, next) => (
    prev.image === next.image
    && prev.dragFolder === next.dragFolder
    && prev.onInfoClick === next.onInfoClick
    && prev.onVideoClick === next.onVideoClick
    && prev.settings === next.settings
    && prev.selectedSet === next.selectedSet
    && prev.selectImage === next.selectImage
    && prev.deleteAssets === next.deleteAssets
    && prev.setPreviewingVideo === next.setPreviewingVideo
    && prev.setPreviewMode === next.setPreviewMode
    && prev.setOpen === next.setOpen
    && prev.trash === next.trash
    && prev.favorite === next.favorite
    && prev.onToggleFavorite === next.onToggleFavorite
    && prev.onToggleTrash === next.onToggleTrash
    && prev.setHoveredAssetUrl === next.setHoveredAssetUrl
    && prev.setPreviewAssetUrl === next.setPreviewAssetUrl
));

export default ImageCard
