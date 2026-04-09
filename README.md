# Gallery — Premium React Media Collection

Repository: https://github.com/forex911/gallery

A modern, high-performance React application for browsing and managing large collections of photos and videos. Built using Vite, React, and Masonic, this project focuses on scalability, smooth rendering, and a premium user experience.

---

## Overview

Gallery is engineered to handle thousands of media files efficiently through windowed rendering and optimized loading strategies. It provides a seamless infinite-scroll masonry layout with a clean, responsive UI.

The application is suitable for portfolios, media dashboards, and cloud-based gallery systems.

---

## Features

### Performance
- Windowed masonry layout powered by Masonic
- Efficient rendering of large datasets without lag
- Optimized DOM updates and reflows

### Lazy Loading & UX
- Intersection Observer–based lazy loading
- Smooth fade-in and scale animations
- Shimmer loading placeholders

### Media Support
- Drag-and-drop upload for local files
- External URL import support
- Google Drive public folder integration

### Sorting & Filtering
- Filter by media type (JPG, PNG, GIF, MP4, etc.)
- Sort alphabetically or randomly

### Viewing Experience
- Responsive lightbox for full-screen viewing
- Keyboard navigation support
- Fast transitions and minimal UI

### Design System
- Custom CSS design system
- Clean layout and spacing
- Smooth hover effects and transitions
- Fully responsive design

---

## Tech Stack

- React 18
- Vite
- Masonic
- Vanilla CSS

---

## Installation

### Prerequisites
- Node.js 18+

### Setup

git clone https://github.com/forex911/gallery.git
cd gallery
npm install
npm run dev

---

## Build for Production

npm run build

The production-ready files will be available in the dist/ folder.

---

## Project Structure

src/
│
├── components/        # UI components
│   ├── GalleryGrid
│   ├── PinCard
│   ├── UrlModal
│   ├── StatsBar
│   └── Lightbox
│
├── hooks/             # Custom hooks
│   └── useGallery
│
├── utils/             # Utility functions
│   ├── URL parsing
│   ├── File handling
│   ├── Size formatting
│   └── Google Drive integration
│
├── App.css            # Design system
└── main.jsx           # Entry point

---

## Architecture

### Windowed Rendering
Only visible items are rendered using Masonic, ensuring smooth performance even with large datasets.

### Lazy Loading
Media loads only when it enters the viewport, improving performance and reducing bandwidth usage.

### Modular Design
The codebase is structured into components, hooks, and utilities for scalability and maintainability.

---

## Use Cases

- Portfolio websites
- Media galleries
- Content dashboards
- Cloud file viewers

---

## Future Improvements

- Authentication and private galleries
- Cloud storage integration (AWS S3, Firebase)
- Video streaming optimization
- AI-based tagging and search
- Progressive Web App (PWA)

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a pull request

---

## License

MIT License
