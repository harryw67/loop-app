// Resizes an image to a max dimension and re-encodes as JPEG at a lower
// quality before upload. Runs entirely in the browser using canvas — no
// server cost, and it means a 12MB phone photo becomes ~200-400KB before
// it ever leaves the device.
export function compressImage(file, maxDimension = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { resolve(file); return; }

    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => { img.src = reader.result; };
    reader.onerror = () => reject(new Error('Could not read file'));

    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) { height = Math.round((height * maxDimension) / width); width = maxDimension; }
        else { width = Math.round((width * maxDimension) / height); height = maxDimension; }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        blob => {
          if (!blob) { resolve(file); return; } // fall back to original if compression fails
          resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => resolve(file); // fall back to original rather than blocking the upload

    reader.readAsDataURL(file);
  });
}
