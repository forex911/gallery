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
//  Gallery State Management — Performance Optimized
//
//  Key optimizations for 5000+ files:
//  1. Pins stored in a mutable ref (avoids O(n²) array copying)
//  2. Reducer tracks a version counter to trigger re-renders
//  3. filteredPins uses direct filter (no .map object allocation)
//  4. Single-pass stats computation
//  5. Batch size 500 for local files (createObjectURL is cheap)
// ═══════════════════════════════════════════════════════

const PROCESS_BATCH = 500; // Files per idle callback batch (up from 80)

const initialState = {
  pinsVersion: 0,       // Incremented on pin changes to trigger useMemo
  filter: 'all',
  search: '',
  sort: 'default',
  savedSet: {},
  progress: null,
  urlStatus: null,
};

function galleryReducer(state, action) {
  switch (action.type) {
    case 'PINS_CHANGED':
      return { ...state, pinsVersion: state.pinsVersion + 1 };

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
  
  // Mutable pins array — avoids O(n²) spread copying in reducer
  const pinsRef = useRef([]);
  const objectUrlsRef = useRef([]);
  const shuffleSeedRef = useRef(null);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Reset shuffle seed when sort mode changes to 'random'
  useEffect(() => {
    if (state.sort === 'random') {
      shuffleSeedRef.current = Date.now();
    }
  }, [state.sort, state.pinsVersion]);

  // Expose pins array length for consumers (avoids passing the whole array)
  const pinsLength = pinsRef.current.length;

  // ─── Filtered + Searched + Sorted pins (memoized) ───
  // No .map() object allocation — pins already have _idx set at creation time
  const filteredPins = useMemo(() => {
    const pins = pinsRef.current;
    const { filter, search, sort } = state;
    const q = search.toLowerCase();

    let result = pins.filter((pin) => {
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
        break;
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pinsVersion, state.filter, state.search, state.sort, shuffleSeedRef.current]);

  // ─── Single-pass stats (memoized) ───
  const stats = useMemo(() => {
    const pins = pinsRef.current;
    let photoCount = 0;
    let videoCount = 0;
    let fileCount = 0;

    for (let i = 0, len = pins.length; i < len; i++) {
      const p = pins[i];
      if (p.isVideo) videoCount++;
      else if (p.isOther) fileCount++;
      else photoCount++;
    }

    return { total: pins.length, photoCount, videoCount, fileCount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pinsVersion]);

  // ─── Helper: append pins to ref and bump version ───
  const appendPins = useCallback((newPins) => {
    const startIdx = pinsRef.current.length;
    for (let i = 0; i < newPins.length; i++) {
      newPins[i]._idx = startIdx + i;
    }
    // Push in-place — no array copy
    pinsRef.current.push(...newPins);
    dispatch({ type: 'PINS_CHANGED' });
  }, []);

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
          // _idx will be set by appendPins
        });
        loaded++;
      }

      appendPins(batch);
      dispatch({ type: 'SET_PROGRESS', payload: { loaded, total } });

      if (end < total) {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => processBatch(end), { timeout: 60 });
        } else {
          setTimeout(() => processBatch(end), 16);
        }
      } else {
        setTimeout(() => {
          dispatch({ type: 'SET_PROGRESS', payload: null });
        }, 800);
      }
    }

    processBatch(0);
  }, [appendPins]);

  // ─── Handle URL imports (with Google Drive folder support) ───
  const loadFromUrls = useCallback((rawText) => {
    const urls = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (!urls.length) return;

    const folderUrls = urls.filter(isDriveFolderUrl);
    const fileUrls = urls.filter((u) => !isDriveFolderUrl(u));

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

        totalExpected = totalExpected - 1 + files.length;

        dispatch({
          type: 'SET_URL_STATUS',
          payload: { text: `Found ${files.length} file(s) in folder. Loading...`, isError: false },
        });

        const pins = files.map((file) => {
          const isVid = isVideo(file.name);
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

        appendPins(pins);
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
      const isImg = isImage(name) || isImage(rawUrl) || isDriveUrl(rawUrl);
      const src = convertDriveUrl(rawUrl, isVid);

      if (isVid) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          appendPins([{ src, thumbSrc: src, name, size: 0, type: 'video/url', isUrl: true, isVideo: true, isImage: false, isOther: false }]);
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
        if (!isDriveUrl(rawUrl)) {
          img.crossOrigin = 'anonymous';
        }
        img.onload = () => {
          appendPins([{ src, thumbSrc, name, size: 0, type: 'image/url', isUrl: true, isVideo: false, isImage: true, isOther: false }]);
          loaded++;
          updateStatus();
        };
        img.onerror = () => { failed++; updateStatus(); };
        img.src = src;
      } else {
        appendPins([{ src, name, size: 0, type: 'file/url', isUrl: true, isVideo: false, isImage: false, isOther: true }]);
        loaded++;
        updateStatus();
      }
    });

    if (fileUrls.length === 0 && folderUrls.length === 0) {
      dispatch({ type: 'SET_URL_STATUS', payload: null });
    }
  }, [appendPins]);

  const setFilter = useCallback((f) => {
    dispatch({ type: 'SET_FILTER', payload: f });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const setSearch = useCallback((q) => {
    dispatch({ type: 'SET_SEARCH', payload: q });
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
    stats,
    pinsLength: pinsRef.current.length,
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
