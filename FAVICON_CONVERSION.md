# Favicon Conversion Guide

The TerminalFlow wordmark favicon is currently implemented as an SVG (`app/icon.svg`), which works in all modern browsers. If you need PNG format for maximum compatibility, follow these steps:

## Quick Conversion (Recommended)

### Option 1: Online Converter
1. Open `app/icon.svg` in your browser or image editor
2. Use an online SVG to PNG converter:
   - https://convertio.co/svg-png/
   - https://cloudconvert.com/svg-to-png
3. Export at **256x256** pixels (Next.js will auto-generate smaller sizes)
4. Save as `app/icon.png`
5. Update `app/layout.tsx` metadata to reference `/icon.png` instead of `/icon.svg`

### Option 2: RealFaviconGenerator (Best for multiple sizes)
1. Go to https://realfavicongenerator.net/
2. Upload `app/icon.svg`
3. Configure settings:
   - iOS: 180x180
   - Android: 192x192
   - Favicon: 32x32, 16x16
4. Download the generated package
5. Place `favicon.ico` in `app/` directory
6. Place other icons in `public/` directory
7. Update metadata in `app/layout.tsx` accordingly

### Option 3: Image Editor (Photoshop, GIMP, etc.)
1. Open `app/icon.svg` in your image editor
2. Export as PNG at 256x256 pixels
3. Save as `app/icon.png`
4. Update metadata

## Testing the Favicon

After updating:
1. **Hard refresh** your browser:
   - Chrome/Edge: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Firefox: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
2. **Clear favicon cache** in Chrome:
   - Settings → Privacy and security → Clear browsing data
   - Select "Cached images and files"
   - Time range: "All time"
   - Click "Clear data"
3. Restart your browser if needed

## Current Implementation

- **SVG favicon**: `app/icon.svg` (full "TerminalFlow" wordmark)
- **Fallback**: `app/icon-tf.svg` (simplified "TF" monogram for very small sizes)
- **Metadata**: Configured in `app/layout.tsx`

The SVG version works perfectly in modern browsers and scales beautifully at any size. PNG is only needed if you require support for very old browsers.

