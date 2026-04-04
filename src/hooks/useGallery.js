import { useReducer, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  getExt,
  isVideo,
  isImage,
  convertDriveUrl,
  getFilenameFromUrl,
  isDriveUrl,
  isDriveFolderUrl,
  extractDriveFolderId,
  fetchDriveFolderFiles,
  shuffleArray,
} from '../utils/helpers';

// ═══════════════════════════════════════════════════════
//  Gallery State Management
//
//  Central state: all pins, filter, search, sort, progress.
//  Uses useReducer for predictable batch updates.
// ═══════════════════════════════════════════════════════

const PROCESS_BATCH = 80; // Files per idle callback batch

const initialState = {
  pins: [],             // Array of pin objects
  filter: 'all',        // Current format filter
  search: '',           // Search query
  sort: 'default',      // Sort mode: 'default' | 'name-asc' | 'name-desc' | 'random'
  savedSet: {},         // { [index]: true }
  progress: null,       // { loaded, total } or null
  urlStatus: null,      // { text, isError } or null
};

function galleryReducer(state, action) {
  switch (action.type) {
    case 'ADD_PINS':
      return { ...state, pins: [...state.pins, ...action.payload] };

    case 'SET_FILTER':
      return { ...state, filter: action.payload };

    case 'SET_SEARCH':
      return { ...state, search: action.payload };

    case 'SET_SORT':
      return { ...state, sort: action.payload };

    case 'TOGGLE_SAVE': {
      const idx = action.payload;
      const next = { ...state.savedSet };
      if (next[idx]) delete next[idx];
      else next[idx] = true;
      return { ...state, savedSet: next };
    }

    case 'SET_PROGRESS':
      return { ...state, progress: action.payload };

    case 'SET_URL_STATUS':
      return { ...state, urlStatus: action.payload };

    default:
      return state;
  }
}

export function useGallery() {
  const [state, dispatch] = useReducer(galleryReducer, initialState);
  const objectUrlsRef = useRef([]);
  const shuffleSeedRef = useRef(null);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Reset shuffle seed when sort mode changes to 'random' or pin count changes
  useEffect(() => {
    if (state.sort === 'random') {
      shuffleSeedRef.current = Date.now();
    }
  }, [state.sort, state.pins.length]);

  // ─── Filtered + Searched + Sorted pins (memoized) ───
  const filteredPins = useMemo(() => {
    const { pins, filter, search, sort } = state;
    const q = search.toLowerCase();

    let result = pins
      .map((pin, idx) => ({ ...pin, _idx: idx }))
      .filter((pin) => {
        const ext = getExt(pin.name);
        const matchFilter = filter === 'all' || ext === filter;
        const matchSearch = !q || pin.name.toLowerCase().includes(q);
        return matchFilter && matchSearch;
      });

    // Apply sorting
    switch (sort) {
      case 'name-asc':
        result = result.slice().sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
        break;
      case 'name-desc':
        result = result.slice().sort((a, b) =>
          b.name.localeCompare(a.name, undefined, { sensitivity: 'base' })
        );
        break;
      case 'random':
        result = shuffleArray(result);
        break;
      default:
        // keep original order
        break;
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pins, state.filter, state.search, state.sort, shuffleSeedRef.current]);

  // ─── Handle local file uploads (batched, uses createObjectURL) ───
  const handleFiles = useCallback((fileList) => {
    const media = Array.from(fileList);
    if (!media.length) return;

    const total = media.length;
    let loaded = 0;

    dispatch({ type: 'SET_PROGRESS', payload: { loaded: 0, total } });

    function processBatch(start) {
      const end = Math.min(start + PROCESS_BATCH, total);
      const batch = [];

      for (let i = start; i < end; i++) {
        const file = media[i];
        const url = URL.createObjectURL(file);
        objectUrlsRef.current.push(url);
        const isVid = file.type.startsWith('video/') || isVideo(file.name);
        const isImg = file.type.startsWith('image/') || isImage(file.name);
        batch.push({
          src: url,
          name: file.name,
          size: file.size,
          type: file.type,
          isVideo: isVid,
          isImage: isImg,
          isOther: !isVid && !isImg,
          isUrl: false,
        });
        loaded++;
      }

      dispatch({ type: 'ADD_PINS', payload: batch });
      dispatch({ type: 'SET_PROGRESS', payload: { loaded, total } });

      if (end < total) {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => processBatch(end), { timeout: 60 });
        } else {
          setTimeout(() => processBatch(end), 16);
        }
      } else {
        // Done — clear progress after a short delay
        setTimeout(() => {
          dispatch({ type: 'SET_PROGRESS', payload: null });
        }, 800);
      }
    }

    processBatch(0);
  }, []);

  // ─── Handle URL imports (with Google Drive folder support) ───
  const loadFromUrls = useCallback((rawText) => {
    const urls = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (!urls.length) return;

    // Separate folder URLs from individual file URLs
    const folderUrls = urls.filter(isDriveFolderUrl);
    const fileUrls = urls.filter((u) => !isDriveFolderUrl(u));

    // Track overall progress
    let totalExpected = fileUrls.length + (folderUrls.length > 0 ? 1 : 0);
    let loaded = 0;
    let failed = 0;

    dispatch({
      type: 'SET_URL_STATUS',
      payload: {
        text: folderUrls.length > 0
          ? `Processing ${folderUrls.length} folder(s) and ${fileUrls.length} file URL(s)...`
          : `Loading ${fileUrls.length} item(s)...`,
        isError: false,
      },
    });

    function updateStatus() {
      if (loaded + failed >= totalExpected) {
        if (failed > 0) {
          dispatch({
            type: 'SET_URL_STATUS',
            payload: {
              text: `Loaded ${loaded} item(s). ${failed} failed — check that links are publicly accessible.`,
              isError: true,
            },
          });
        } else {
          dispatch({
            type: 'SET_URL_STATUS',
            payload: { text: `All ${loaded} item(s) loaded successfully.`, isError: false },
          });
        }
      }
    }

    // ─── Process Google Drive folder URLs ───
    folderUrls.forEach(async (folderUrl) => {
      const folderId = extractDriveFolderId(folderUrl);
      if (!folderId) {
        failed++;
        updateStatus();
        return;
      }

      dispatch({
        type: 'SET_URL_STATUS',
        payload: { text: `Scanning Google Drive folder...`, isError: false },
      });

      try {
        const files = await fetchDriveFolderFiles(folderId);

        if (files.length === 0) {
          dispatch({
            type: 'SET_URL_STATUS',
            payload: {
              text: `Could not access folder contents. Make sure the folder is set to "Anyone with the link" and contains viewable files. Try sharing individual file links instead.`,
              isError: true,
            },
          });
          failed++;
          updateStatus();
          return;
        }

        // Update total expected count
        totalExpected = totalExpected - 1 + files.length;

        dispatch({
          type: 'SET_URL_STATUS',
          payload: { text: `Found ${files.length} file(s) in folder. Loading...`, isError: false },
        });

        // Add all found files directly — PinCard handles load errors gracefully
        const pins = files.map((file) => {
          const isVid = isVideo(file.name);
          // Drive lh3 proxies serve image thumbnails for ALL files automatically!
          // We assume image if it's not explicitly a video to regain full preview support.
          const isImg = !isVid;
          return {
            src: file.src,
            thumbSrc: file.thumbSrc || file.src,
            name: file.name,
            size: 0,
            type: isVid ? 'video/url' : 'image/url',
            isUrl: true,
            isVideo: isVid,
            isImage: isImg,
            isOther: false,
          };
        });

        dispatch({ type: 'ADD_PINS', payload: pins });
        loaded += files.length;

        dispatch({
          type: 'SET_URL_STATUS',
          payload: { text: `Added ${files.length} file(s) from folder.`, isError: false },
        });
        updateStatus();
      } catch (err) {
        console.error('Drive folder error:', err);
        dispatch({
          type: 'SET_URL_STATUS',
          payload: {
            text: `Failed to access folder. Ensure the folder is public, or paste individual file share links instead.`,
            isError: true,
          },
        });
        failed++;
        updateStatus();
      }
    });

    // ─── Process individual file URLs ───
    fileUrls.forEach((rawUrl) => {
      const name = getFilenameFromUrl(rawUrl);
      const isVid = isVideo(name) || isVideo(rawUrl);
      // Drive URLs automatically resolve to an image thumbnail if they aren't parsed as a video stream
      const isImg = isImage(name) || isImage(rawUrl) || isDriveUrl(rawUrl);
      const src = convertDriveUrl(rawUrl, isVid);

      if (isVid) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          dispatch({
            type: 'ADD_PINS',
            payload: [{ src, thumbSrc: src, name, size: 0, type: 'video/url', isUrl: true, isVideo: true, isImage: false, isOther: false }],
          });
          loaded++;
          updateStatus();
        };
        video.onerror = () => { failed++; updateStatus(); };
        video.src = src;
      } else if (isImg) {
        let thumbSrc = src;
        if (src.includes('lh3.googleusercontent.com')) {
          thumbSrc = src.replace('=w1600', '=w400');
        }
        const img = new Image();
        // Only set crossOrigin for non-Drive URLs
        if (!isDriveUrl(rawUrl)) {
          img.crossOrigin = 'anonymous';
        }
        img.onload = () => {
          dispatch({
            type: 'ADD_PINS',
            payload: [{ src, thumbSrc, name, size: 0, type: 'image/url', isUrl: true, isVideo: false, isImage: true, isOther: false }],
          });
          loaded++;
          updateStatus();
        };
        img.onerror = () => { failed++; updateStatus(); };
        img.src = src;
      } else {
        dispatch({
          type: 'ADD_PINS',
          payload: [{ src, name, size: 0, type: 'file/url', isUrl: true, isVideo: false, isImage: false, isOther: true }],
        });
        loaded++;
        updateStatus();
      }
    });

    // If only folders and no file URLs, we need to wait for the async folder processing
    if (fileUrls.length === 0 && folderUrls.length === 0) {
      dispatch({ type: 'SET_URL_STATUS', payload: null });
    }
  }, []);

  const setFilter = useCallback((f) => {
    dispatch({ type: 'SET_FILTER', payload: f });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const setSearch = useCallback((q) => {
    dispatch({ type: 'SET_SEARCH', payload: q });
    // Don't scroll on every typed letter, natural search behavior
  }, []);

  const setSort = useCallback((s) => {
    dispatch({ type: 'SET_SORT', payload: s });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const toggleSave = useCallback((idx) => {
    dispatch({ type: 'TOGGLE_SAVE', payload: idx });
  }, []);

  const clearUrlStatus = useCallback(() => {
    dispatch({ type: 'SET_URL_STATUS', payload: null });
  }, []);

  return {
    state,
    filteredPins,
    handleFiles,
    loadFromUrls,
    setFilter,
    setSearch,
    setSort,
    toggleSave,
    clearUrlStatus,
  };
}
