// @para-doc [#csa-cms-sec-magic-bytes]
export function validateFileMagicBytes(buffer: Uint8Array, extension: string): boolean {
  const ext = extension.toLowerCase();
  
  if (ext === 'png') {
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0D &&
      buffer[5] === 0x0A &&
      buffer[6] === 0x1A &&
      buffer[7] === 0x0A
    );
  }
  
  if (ext === 'jpg' || ext === 'jpeg') {
    // JPEG signature: FF D8 FF
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xFF &&
      buffer[1] === 0xD8 &&
      buffer[2] === 0xFF
    );
  }
  
  if (ext === 'gif') {
    // GIF signature: 47 49 46 38 ('GIF8')
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38
    );
  }
  
  if (ext === 'webp') {
    // WebP signature: RIFF (bytes 0-3) and WEBP (bytes 8-11)
    return (
      buffer.length >= 12 &&
      buffer[0] === 0x52 && // R
      buffer[1] === 0x49 && // I
      buffer[2] === 0x46 && // F
      buffer[3] === 0x46 && // F
      buffer[8] === 0x57 && // W
      buffer[9] === 0x45 && // E
      buffer[10] === 0x42 && // B
      buffer[11] === 0x50    // P
    );
  }
  
  // @para-doc [#csa-cms-sec-gap-avif]
  if (ext === 'avif') {
    // AVIF signature: ftyp at 4-7 (0x66 0x74 0x79 0x70) and avif/avis at 8-11
    return (
      buffer.length >= 12 &&
      buffer[4] === 0x66 && // f
      buffer[5] === 0x74 && // t
      buffer[6] === 0x79 && // y
      buffer[7] === 0x70 && // p
      buffer[8] === 0x61 && // a
      buffer[9] === 0x76 && // v
      buffer[10] === 0x69 && // i
      (buffer[11] === 0x66 || buffer[11] === 0x73) // f or s
    );
  }
  
  return false;
}

// Helper to decode HTML entities for normalization
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

// @para-doc [#csa-cms-sec-svg-scrub]
export function sanitizeSvg(content: string): string {
  let sanitized = content;

  // 1. Remove <script> elements and their content
  sanitized = sanitized.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');

  // 2. Remove <foreignObject> elements and their content to prevent iframe/html injection
  sanitized = sanitized.replace(/<foreignObject[^>]*>([\s\S]*?)<\/foreignObject>/gi, '');

  // 3. Remove inline event handlers (on*)
  sanitized = sanitized.replace(/\son[a-z]+\s*=\s*(["'])([\s\S]*?)\1/gi, '');

  // 4. Scrub javascript: links in href or xlink:href (supporting HTML entity bypasses)
  sanitized = sanitized.replace(/(href|xlink:href)\s*=\s*(["'])([\s\S]*?)\2/gi, (match, attr, _quote, val) => {
    const decodedVal = decodeHtmlEntities(val).replace(/\s/g, ''); // strip whitespace
    if (/\bjavascript:/i.test(decodedVal)) {
      return `${attr}="#"`;
    }
    return match;
  });

  return sanitized;
}
