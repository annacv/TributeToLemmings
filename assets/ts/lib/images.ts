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
