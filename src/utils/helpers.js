// ═══════════════════════════════════════════════════════
//  Utility Helpers
// ═══════════════════════════════════════════════════════

export const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogg', 'ogv'];
export const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif', 'avif'];

export function isVideo(name) {
  const ext = name.split('.').pop().toLowerCase();
  return VIDEO_EXTS.includes(ext);
}

export function isImage(name) {
  const ext = name.split('.').pop().toLowerCase();
  return IMAGE_EXTS.includes(ext);
}

export function isVideoType(type) {
  return type && type.startsWith('video/');
}

export function getExt(name) {
  return name.split('.').pop().toLowerCase();
}

export function fmtSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return Math.round(b / 1024) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

export function escHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════════
//  Google Drive Helpers
// ═══════════════════════════════════════════════════════

/**
 * Convert Google Drive share URLs to direct download/view links.
 */
export function convertDriveUrl(url, isVideoFile = false) {
  url = url.trim();
  
  const constructUrl = (id) => {
    return isVideoFile 
      ? `https://drive.google.com/uc?export=view&id=${id}` 
      : driveDirectUrl(id);
  };

  let match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return constructUrl(match[1]);
  match = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (match) return constructUrl(match[1]);
  match = url.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
  if (match) return constructUrl(match[1]);
  return url;
}

/**
 * Build a direct-access URL for a Google Drive file.
 * Uses lh3.googleusercontent.com which is CORS-friendly.
 */
export function driveDirectUrl(fileId) {
  return `https://lh3.googleusercontent.com/d/${fileId}=w1600`;
}

/**
 * Check if a URL is a Google Drive URL (any type).
 */
export function isDriveUrl(url) {
  return /drive\.google\.com|googleusercontent\.com/.test(url);
}

/**
 * Check if a URL is a Google Drive folder link.
 */
export function isDriveFolderUrl(url) {
  return /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/.test(url.trim());
}

/**
 * Extract folder ID from a Google Drive folder URL.
 */
export function extractDriveFolderId(url) {
  const match = url.trim().match(/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Fetch file IDs from a public Google Drive folder.
 * Uses the Google Drive embed page which exposes file data as HTML.
 * Falls back to a CORS proxy if needed.
 */
export async function fetchDriveFolderFiles(folderId) {
  // Try multiple approaches to list folder contents
  const files = [];

  // Approach 1: Use the Google Drive embed view
  const embedUrl = `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`;

  try {
    // Try direct fetch first (may be blocked by CORS)
    let html = '';
    try {
      const response = await fetch(embedUrl);
      if (response.ok) {
        html = await response.text();
      }
    } catch {
      // Try via self-hosted Vercel API and reliable CORS proxies
      const proxies = [
        { url: `/api/drive?id=${folderId}`, type: 'text' }, // Self-hosted Serverless Function (Vercel)
        { url: `https://api.allorigins.win/get?url=${encodeURIComponent(embedUrl)}`, type: 'json' },
        { url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(embedUrl)}`, type: 'text' },
      ];

      for (const proxy of proxies) {
        try {
          const response = await fetch(proxy.url);
          if (response.ok) {
            if (proxy.type === 'json') {
              const data = await response.json();
              if (data && data.contents) {
                html = data.contents;
                break;
              }
            } else {
              const text = await response.text();
              // Basic check to ensure it's not a proxy error page
              if (text && !text.includes('Proxy Error')) {
                html = text;
                break;
              }
            }
          }
        } catch {
          continue; // Try the next proxy in the fallback array
        }
      }
    }

    if (html) {
      // Extract file IDs from the embedded folder view HTML
      // The page contains links in the format: /file/d/FILE_ID/
      const fileIdPattern = /\/file\/d\/([a-zA-Z0-9_-]{20,})/g;
      const seen = new Set();
      let m;
      while ((m = fileIdPattern.exec(html)) !== null) {
        if (!seen.has(m[1])) {
          seen.add(m[1]);
          files.push({
            id: m[1],
            src: driveDirectUrl(m[1]),
            name: `drive-${m[1].slice(0, 8)}`,
          });
        }
      }

      // Also try to extract file names from the HTML if available
      // Pattern: data-tooltip="filename.ext"
      const tooltipPattern = /data-tooltip="([^"]+\.[a-zA-Z0-9]+)"/g;
      let nameIdx = 0;
      while ((m = tooltipPattern.exec(html)) !== null && nameIdx < files.length) {
        if (m[1] && !m[1].startsWith('http')) {
          files[nameIdx].name = m[1];
          // If we detect it's a video, change the URL to the video streaming endpoint
          // because lh3 proxy only serves static image thumbnails for videos.
          if (isVideo(m[1])) {
            files[nameIdx].src = `https://drive.google.com/uc?export=view&id=${files[nameIdx].id}`;
          }
          nameIdx++;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to fetch Drive folder contents:', err);
  }

  return files;
}

export function getFilenameFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/');
    const last = parts[parts.length - 1];
    if (last && last.includes('.')) return decodeURIComponent(last);
    if (url.includes('drive.google.com')) return 'drive-file';
    return 'media-file';
  } catch {
    return 'media-file';
  }
}

// ═══════════════════════════════════════════════════════
//  Sorting Helpers
// ═══════════════════════════════════════════════════════

/**
 * Shuffle array using Fisher-Yates algorithm (returns new array).
 */
export function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
