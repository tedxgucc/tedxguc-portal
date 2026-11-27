// Shrinks a photo in the browser before it's uploaded, so the public site never
// serves giant camera files (a 6000px cover froze scrolling for a second).
// PNGs keep their transparency (logos); everything else becomes a JPEG.
// GIFs and SVGs are left alone. Never throws: on any problem it returns the original.
export async function shrinkImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 400 * 1024) { bitmap.close(); return file; }
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return file; }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.\w+$/, type === 'image/png' ? '.png' : '.jpg');
    return new File([blob], name, { type, lastModified: Date.now() });
  } catch {
    return file;
  }
}
