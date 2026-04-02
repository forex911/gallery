# Gallery — Premium React Media Collection

A modern, highly-performant React application for browsing and managing photos and videos. Built with Vite, React, and Masonic for seamless infinite-scroll masonry layouts.

## Features

- **Blazing Fast Masonry Grid**: Powered by Masonic to comfortably handle thousands of media items without lag.
- **Lazy Loading & Smooth Animations**: Uses Intersection Observer for true lazy loading of off-screen items. Images feature a custom smooth fade-in and scale animation as they load, with a beautiful shimmer placeholder before they are ready.
- **Upload & URL Support**: Drag and drop local images and videos, or import directly using external URLs.
- **Google Drive Integration**: Special support built-in for extracting and instantly loading files directly from public Google Drive folder URLs.
- **Sorting & Filtering**: Quickly filter media by type (JPG, PNG, GIF, MP4, etc.) or sort them alphabetically or randomly.
- **Responsive Lightbox**: Native, fast lightbox to view media in full size, with keyboard navigation support.
- **Premium Design System**: Complete, modern CSS design system with subtle backdrop filters, hover states, and smooth transitions.

## Quick Start

### Prerequisites
- Node.js 18+

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```

### Building for Production

To build the application for production:
```bash
npm run build
```

## Structure

- `/src/components`: React components (`GalleryGrid`, `PinCard`, `UrlModal`, `StatsBar`, `Lightbox`, etc.)
- `/src/hooks`: Custom React hooks (e.g. `useGallery` for robust state management)
- `/src/utils`: Helper functions for URL parsing, file extensions, formatting sizes, and Drive integrations.
- `/src/App.css`: Custom premium design system styling.

## Technologies Used
- React 18
- Vite
- Masonic (for windowed masonry layout)
- Vanilla CSS (for full control and premium styling)
