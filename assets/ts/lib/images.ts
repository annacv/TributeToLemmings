/* Eager image loading shared by every canvas screen: create the element and set
   the source so the browser starts decoding immediately. Callers guard their
   draws with img.complete, so no onload plumbing is needed here. */

export function loadImage(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}

export function loadImages(srcs: readonly string[]): HTMLImageElement[] {
  return srcs.map(loadImage);
}

/* Runs `onSettled` once every image has finished (loaded or errored), so a slow
   decode can't leave a screen half-drawn. Already-complete images count
   immediately — if all are, the callback fires synchronously. Listeners are
   one-shot, so `onSettled` runs exactly once. */
export function whenImagesSettled(
  imgs: readonly HTMLImageElement[],
  onSettled: () => void,
): void {
  let pending = imgs.filter((img) => !img.complete);
  if (pending.length === 0) {
    onSettled();
    return;
  }
  const settle = (img: HTMLImageElement): void => {
    pending = pending.filter((i) => i !== img);
    if (pending.length === 0) onSettled();
  };
  pending.forEach((img) => {
    img.addEventListener('load', () => settle(img), { once: true });
    img.addEventListener('error', () => settle(img), { once: true });
  });
}
