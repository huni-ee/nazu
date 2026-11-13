/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

export function arrangeMasonryCards(target: HTMLElement | null) {
  if (!target || !('ResizeObserver' in window)) return null;
  const list = target;
  const cards = [...list.children] as HTMLElement[];
  let active = true;
  let frame = 0;
  let lastWidth = 0;

  function arrange() {
    if (!active || !list.isConnected) return;
    const width = list.getBoundingClientRect().width;
    if (!width) return;
    lastWidth = width;
    const style = getComputedStyle(list);
    const columns = Math.max(1, parseInt(style.getPropertyValue('--detail-card-columns'), 10) || 1);
    const gap = parseFloat(style.columnGap) || 0;
    const cardWidth = (width - gap * (columns - 1)) / columns;
    const heights: number[] = Array.from({ length: columns }, () => 0);
    list.classList.add('is-masonry');
    for (const card of cards) card.style.width = `${cardWidth}px`;
    const cardHeights = cards.map((card) => card.getBoundingClientRect().height);
    cards.forEach((card, index) => {
      const column = heights.indexOf(Math.min(...heights));
      card.style.left = `${column * (cardWidth + gap)}px`;
      card.style.top = `${heights[column]}px`;
      heights[column] += cardHeights[index] + gap;
    });
    list.style.height = `${Math.max(0, Math.max(...heights) - gap)}px`;
  }

  function queueArrange() {
    if (!active || !list.isConnected || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      arrange();
    });
  }

  const observer = new ResizeObserver((entries) => {
    if (entries.some((entry) => entry.target !== list || Math.abs(entry.contentRect.width - lastWidth) > 0.1)) {
      queueArrange();
    }
  });
  window.addEventListener('resize', queueArrange);
  observer.observe(list);
  for (const card of cards) observer.observe(card);
  arrange();
  return () => {
    active = false;
    observer.disconnect();
    window.removeEventListener('resize', queueArrange);
    cancelAnimationFrame(frame);
  };
}
