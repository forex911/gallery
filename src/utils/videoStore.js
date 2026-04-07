// ═══════════════════════════════════════════════════════
//  Global Video State Management
//  Enforces ONE video playing globally and handles delays.
// ═══════════════════════════════════════════════════════

class VideoStore {
  constructor() {
    this.activeVideoRef = null;
    this.hoverTimeout = null;
  }

  // Register a new playing video and stop the previous one
  registerPlaying(videoElement) {
    if (this.activeVideoRef && this.activeVideoRef !== videoElement) {
      try {
        this.activeVideoRef.pause();
        this.activeVideoRef.currentTime = 0;
      } catch (err) {
        // Ignore play-pause race conditions
      }
    }
    this.activeVideoRef = videoElement;
  }

  clearActive(videoElement) {
    if (this.activeVideoRef === videoElement) {
      this.activeVideoRef = null;
    }
  }

  clearHoverTimeout() {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }
}

export const globalVideoStore = new VideoStore();
