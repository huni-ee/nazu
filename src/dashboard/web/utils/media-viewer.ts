/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { button, element } from './dom.js';
import { safeImageUrl } from './profile.js';

interface ImageViewerDetails {
  text?: string;
  createdAt?: number;
  loading?: boolean;
  images?: Array<string | { url?: string; fallbackUrl?: string }>;
  imageIndex?: number;
  trigger?: HTMLElement | null;
}

export function createMediaViewer({
  shell,
  detail,
  dialogRoot
}: {
  shell: HTMLElement;
  detail: HTMLElement;
  dialogRoot: HTMLElement;
}) {
  let cleanup: (() => void) | null = null;

  function friendPostDate(value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
    if (value > Date.now()) return null;
    const date = new Date(value);
    const time = element(
      'time',
      'friend-post-date',
      new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(date)
    );
    time.dateTime = date.toISOString();
    return time;
  }

  function closeDialog() {
    const dispose = cleanup;
    cleanup = null;
    dialogRoot.replaceChildren();
    dispose?.();
  }

  function showVideoViewer(value: string, posterUrl: string, label: string, trigger?: HTMLElement | null) {
    const src = safeImageUrl(value);
    if (!src) return;
    closeDialog();
    const previousFocus = trigger || document.activeElement;
    const wasInert = shell.inert;
    const pausedPreviews = [...detail.querySelectorAll<HTMLVideoElement>('.friend-animated-video')].filter(
      (video) => !video.paused
    );
    for (const preview of pausedPreviews) preview.pause();
    const backdrop = element('div', 'dialog-backdrop image-viewer-backdrop');
    const viewer = element('div', 'image-viewer video-viewer');
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-modal', 'true');
    viewer.setAttribute('aria-label', label);
    const finish = () => closeDialog();
    const close = button('image-viewer-close', '×', finish);
    close.setAttribute('aria-label', '영상 닫기');
    close.title = '닫기 (Esc)';
    const video = element('video', 'video-viewer-media');
    video.controls = true;
    video.autoplay = true;
    video.defaultMuted = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'metadata';
    (video as HTMLVideoElement & { referrerPolicy: string }).referrerPolicy = 'no-referrer';
    video.tabIndex = 0;
    video.setAttribute('aria-label', label);
    const poster = safeImageUrl(posterUrl);
    if (poster) video.poster = poster;
    video.addEventListener(
      'error',
      () => {
        if (!viewer.isConnected) return;
        if (!poster) {
          const message = element('p', 'image-viewer-state', '영상을 불러올 수 없습니다.');
          message.setAttribute('role', 'status');
          video.replaceWith(message);
          return;
        }
        const fallback = element('img', 'video-viewer-fallback');
        fallback.src = poster;
        fallback.alt = label;
        fallback.referrerPolicy = 'no-referrer';
        fallback.addEventListener(
          'error',
          () => {
            const message = element('p', 'image-viewer-state', '영상을 불러올 수 없습니다.');
            message.setAttribute('role', 'status');
            fallback.replaceWith(message);
          },
          { once: true }
        );
        video.replaceWith(fallback);
      },
      { once: true }
    );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
      }
    };
    viewer.append(close, video);
    viewer.addEventListener('click', (event) => {
      if (event.target === viewer) finish();
    });
    backdrop.append(viewer);
    dialogRoot.replaceChildren(backdrop);
    cleanup = () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      document.removeEventListener('keydown', onKeyDown);
      shell.inert = wasInert;
      for (const preview of pausedPreviews) {
        if (preview.isConnected) void preview.play().catch(() => {});
      }
      if ((previousFocus instanceof HTMLElement || previousFocus instanceof SVGElement) && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
    shell.inert = true;
    document.addEventListener('keydown', onKeyDown);
    video.src = src;
    close.focus();
  }

  function showImageViewer(value: string, label: string, details?: ImageViewerDetails) {
    let src = safeImageUrl(value);
    let text = typeof details?.text === 'string' ? details.text : '';
    if (!src && !text.trim()) return;
    closeDialog();
    const previousFocus = details?.trigger || document.activeElement;
    const wasInert = shell.inert;
    const backdrop = element('div', 'dialog-backdrop image-viewer-backdrop');
    const viewer = element('div', 'image-viewer');
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-modal', 'true');
    viewer.setAttribute('aria-label', label);
    let createdAt = details?.createdAt;
    let statusText = details?.loading ? '게시물 상세 내용을 불러오는 중…' : '';
    const postInfo = element('div', 'image-viewer-post-info');
    postInfo.tabIndex = 0;
    postInfo.setAttribute('role', 'region');
    postInfo.setAttribute('aria-label', '게시물 내용');
    const initialImages = Array.isArray(details?.images)
      ? details.images
          .map((entry, index) => ({
            url: safeImageUrl(typeof entry === 'string' ? entry : entry?.url),
            fallbackUrl: safeImageUrl(typeof entry === 'object' ? entry?.fallbackUrl : ''),
            originalIndex: index
          }))
          .filter((entry) => entry.url)
      : [];
    let imageUrls = initialImages.length ? initialImages.map((entry) => entry.url) : src ? [src] : [];
    let fallbackUrls = initialImages.length ? initialImages.map((entry) => entry.fallbackUrl) : [];
    let imageIndex = Math.max(
      0,
      initialImages.findIndex((entry) => entry.originalIndex === details?.imageIndex)
    );
    const content = element('div', 'image-viewer-content');
    const image = element('img', 'image-viewer-image');
    image.alt = label;
    image.referrerPolicy = 'no-referrer';
    image.draggable = false;
    image.hidden = true;
    const message = element('p', 'image-viewer-state', '사진을 불러오는 중…');
    message.setAttribute('role', 'status');
    let fitScale = 1;
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let pointerId: number | null = null;
    let pointerX = 0;
    let pointerY = 0;
    const endDrag = (event?: PointerEvent) => {
      if (event && event.pointerId !== pointerId) return;
      const releasedPointer = pointerId;
      pointerId = null;
      if (releasedPointer !== null && image.hasPointerCapture(releasedPointer))
        image.releasePointerCapture(releasedPointer);
      content.classList.remove('is-dragging');
    };
    const finish = () => {
      closeDialog();
    };
    const close = button('image-viewer-close', '×', finish);
    const isPost = details?.text !== undefined || details?.createdAt !== undefined || details?.loading !== undefined;
    close.setAttribute('aria-label', isPost ? '게시물 닫기' : '사진 닫기');
    close.title = '닫기 (Esc)';
    const gallery = element('div', 'image-viewer-gallery');
    gallery.setAttribute('role', 'group');
    gallery.setAttribute('aria-label', isPost ? '게시물 사진 넘기기' : '사진 넘기기');
    const previous = button('image-viewer-gallery-prev', '‹', () => selectImage(imageIndex - 1));
    previous.setAttribute('aria-label', '이전 사진');
    const next = button('image-viewer-gallery-next', '›', () => selectImage(imageIndex + 1));
    next.setAttribute('aria-label', '다음 사진');
    const count = element('span', 'image-viewer-gallery-count');
    count.setAttribute('aria-live', 'polite');
    gallery.append(previous, count, next);
    const controls = element('div', 'image-viewer-controls');
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', '사진 확대 조절');
    const zoomOut = button('image-viewer-zoom-out', '−', () => setZoom(zoom / 1.25));
    zoomOut.setAttribute('aria-label', '사진 축소');
    zoomOut.title = '축소';
    const zoomSlider = element('input', 'image-viewer-zoom-slider');
    zoomSlider.type = 'range';
    zoomSlider.min = '100';
    zoomSlider.max = '400';
    zoomSlider.step = '1';
    zoomSlider.value = '100';
    zoomSlider.setAttribute('aria-label', '사진 확대 비율');
    zoomSlider.addEventListener('input', () => setZoom(zoomSlider.valueAsNumber / 100));
    const zoomLevel = element('output', 'image-viewer-zoom-level', '—');
    zoomLevel.setAttribute('aria-label', '처음 표시 크기 대비 확대 비율');
    const zoomIn = button('image-viewer-zoom-in', '+', () => setZoom(zoom * 1.25));
    zoomIn.setAttribute('aria-label', '사진 확대');
    zoomIn.title = '확대';
    const fit = button('image-viewer-fit', '맞춤', () => setZoom(1));
    fit.setAttribute('aria-label', '사진을 화면에 맞추기');
    const updateView = () => {
      const ready = !image.hidden;
      const maxX = Math.max(0, (image.naturalWidth * fitScale * zoom - content.clientWidth) / 2);
      const maxY = Math.max(0, (image.naturalHeight * fitScale * zoom - content.clientHeight) / 2);
      panX = Math.max(-maxX, Math.min(maxX, panX));
      panY = Math.max(-maxY, Math.min(maxY, panY));
      image.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
      content.classList.toggle('is-zoomed', ready && zoom > 1);
      zoomOut.disabled = !ready || zoom <= 1;
      zoomSlider.disabled = !ready;
      zoomSlider.value = String(Math.round(zoom * 100));
      zoomSlider.setAttribute('aria-valuetext', `${zoomSlider.value}%`);
      zoomIn.disabled = !ready || zoom >= 4;
      fit.disabled = !ready || zoom <= 1;
      zoomLevel.textContent = ready ? `${Math.round(zoom * 100)}%` : '—';
    };
    const setZoom = (value: number, anchorX = 0, anchorY = 0) => {
      if (image.hidden) return;
      const nextZoom = Math.round(Math.max(1, Math.min(4, value)) * 100) / 100;
      const ratio = nextZoom / zoom;
      panX = anchorX - (anchorX - panX) * ratio;
      panY = anchorY - (anchorY - panY) * ratio;
      zoom = nextZoom;
      updateView();
    };
    const fitImage = () => {
      const postSpace = src && postInfo.isConnected ? postInfo.offsetHeight + 12 : 0;
      viewer.style.setProperty('--image-viewer-post-space', `${postSpace}px`);
      if (!src) {
        viewer.style.setProperty('--image-viewer-width', `${postInfo.offsetWidth}px`);
        viewer.style.setProperty('--image-viewer-height', `${postInfo.offsetHeight}px`);
        return;
      }
      if (!image.naturalWidth || !image.naturalHeight || image.hidden) return;
      endDrag();
      const maxWidth = Math.max(1, Math.min(1100, viewer.clientWidth - (window.innerWidth <= 400 ? 32 : 64)));
      const maxHeight = Math.max(1, viewer.clientHeight - 136 - postSpace - (gallery.isConnected ? 80 : 0));
      fitScale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
      const width = `${image.naturalWidth * fitScale}px`;
      const height = `${image.naturalHeight * fitScale}px`;
      viewer.style.setProperty('--image-viewer-width', width);
      viewer.style.setProperty('--image-viewer-height', height);
      content.style.width = width;
      content.style.height = height;
      image.style.width = width;
      image.style.height = height;
      zoom = 1;
      panX = 0;
      panY = 0;
      updateView();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
      }
      if (
        imageUrls.length > 1 &&
        ['ArrowLeft', 'ArrowRight'].includes(event.key) &&
        !(event.target instanceof HTMLInputElement)
      ) {
        event.preventDefault();
        selectImage(imageIndex + (event.key === 'ArrowRight' ? 1 : -1));
      }
      if (event.key === 'Tab') {
        const focusable = [
          ...viewer.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), .image-viewer-post-info'
          )
        ];
        const index = focusable.findIndex((node) => node === document.activeElement);
        const next = event.shiftKey ? (index <= 0 ? focusable.length - 1 : index - 1) : (index + 1) % focusable.length;
        event.preventDefault();
        focusable[next].focus();
      }
    };
    image.addEventListener('load', () => {
      image.hidden = false;
      message.hidden = true;
      fitImage();
    });
    image.addEventListener('error', () => {
      const fallback = fallbackUrls[imageIndex];
      if (fallback && image.src !== fallback) {
        image.src = fallback;
        return;
      }
      endDrag();
      image.hidden = true;
      message.hidden = false;
      message.textContent = '사진을 불러올 수 없습니다.';
      updateView();
    });
    image.addEventListener('dblclick', () => setZoom(zoom > 1 ? 1 : 2));
    image.addEventListener('pointerdown', (event) => {
      if (zoom <= 1 || event.button !== 0 || pointerId !== null) return;
      event.preventDefault();
      pointerId = event.pointerId;
      pointerX = event.clientX;
      pointerY = event.clientY;
      image.setPointerCapture(pointerId);
      content.classList.add('is-dragging');
    });
    image.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      panX += event.clientX - pointerX;
      panY += event.clientY - pointerY;
      pointerX = event.clientX;
      pointerY = event.clientY;
      updateView();
    });
    image.addEventListener('pointerup', endDrag);
    image.addEventListener('pointercancel', endDrag);
    image.addEventListener('lostpointercapture', endDrag);
    content.addEventListener(
      'wheel',
      (event) => {
        if (image.hidden || event.deltaY === 0) return;
        event.preventDefault();
        const bounds = content.getBoundingClientRect();
        setZoom(
          zoom * (event.deltaY < 0 ? 1.25 : 0.8),
          event.clientX - bounds.left - bounds.width / 2,
          event.clientY - bounds.top - bounds.height / 2
        );
      },
      { passive: false }
    );
    viewer.addEventListener('click', (event) => {
      if (event.target === content || event.target === viewer) finish();
    });
    controls.append(zoomOut, zoomSlider, zoomIn, zoomLevel, fit);
    content.append(image, message);
    viewer.append(close);
    function renderInfo() {
      const date = friendPostDate(createdAt);
      postInfo.replaceChildren();
      if (text.trim()) postInfo.append(element('p', 'image-viewer-post-text', text));
      if (date) postInfo.append(date);
      if (statusText) {
        const status = element('p', 'image-viewer-post-status', statusText);
        status.setAttribute('role', 'status');
        postInfo.append(status);
      }
      const hasInfo = postInfo.childElementCount > 0;
      viewer.classList.toggle('has-post-info', Boolean(src && hasInfo));
      viewer.classList.toggle('is-text-post', Boolean(!src && hasInfo));
      if (hasInfo) viewer.append(postInfo);
      else postInfo.remove();
    }
    function renderGallery() {
      count.textContent = `${imageIndex + 1} / ${imageUrls.length}`;
      previous.disabled = imageIndex === 0;
      next.disabled = imageIndex >= imageUrls.length - 1;
      viewer.classList.toggle('is-chat-gallery', !isPost && imageUrls.length > 1);
      if (imageUrls.length > 1) viewer.append(gallery);
      else gallery.remove();
    }
    function selectImage(index: number) {
      if (index < 0 || index >= imageUrls.length || index === imageIndex) return;
      imageIndex = index;
      loadImage();
    }
    function loadImage() {
      endDrag();
      src = imageUrls[imageIndex] || '';
      zoom = 1;
      panX = 0;
      panY = 0;
      if (src) {
        viewer.append(content, controls);
        if (image.getAttribute('src') !== src) {
          image.hidden = true;
          message.hidden = false;
          message.textContent = '사진을 불러오는 중…';
          image.src = src;
        }
        image.alt = imageUrls.length > 1 ? `${label} · ${imageIndex + 1} / ${imageUrls.length}` : label;
      } else {
        image.removeAttribute('src');
        image.hidden = true;
        content.remove();
        controls.remove();
      }
      renderGallery();
      renderInfo();
      updateView();
      fitImage();
    }
    loadImage();
    backdrop.append(viewer);
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) finish();
    });
    dialogRoot.replaceChildren(backdrop);
    cleanup = () => {
      endDrag();
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', fitImage);
      shell.inert = wasInert;
      if ((previousFocus instanceof HTMLElement || previousFocus instanceof SVGElement) && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
    shell.inert = true;
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', fitImage);
    updateView();
    fitImage();
    close.focus();
    return {
      setContent(detail: { images?: string[]; text?: string; createdAt?: number }) {
        if (!viewer.isConnected) return;
        imageUrls = Array.isArray(detail.images) ? detail.images.map(safeImageUrl).filter(Boolean) : [];
        fallbackUrls = [];
        imageIndex = 0;
        text = typeof detail.text === 'string' ? detail.text : '';
        createdAt = detail.createdAt ?? createdAt;
        statusText = '';
        loadImage();
      },
      setStatus(messageText: string) {
        if (!viewer.isConnected) return;
        statusText = messageText;
        renderInfo();
        fitImage();
      }
    };
  }

  return { close: closeDialog, showImage: showImageViewer, showVideo: showVideoViewer };
}
