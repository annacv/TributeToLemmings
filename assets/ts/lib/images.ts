/* Eager image loading shared by every canvas screen: create the element and set
   the source so the browser starts decoding immediately. Callers guard their
   draws with img.complete, so no onload plumbing is needed here. */

/** Loads a single image source into a fresh HTMLImageElement. */
export function loadImage(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}

/** Loads a list of sources, preserving order. */
export function loadImages(srcs: readonly string[]): HTMLImageElement[] {
  return srcs.map(loadImage);
}
