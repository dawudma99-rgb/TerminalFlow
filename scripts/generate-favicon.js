// Script to generate PNG favicon from SVG wordmark
// Run with: node scripts/generate-favicon.js
// Requires: npm install sharp (or use online converter)

const fs = require('fs');
const path = require('path');

console.log('PNG favicon generation script');
console.log('');
console.log('Since generating PNG requires image processing libraries, please use one of these methods:');
console.log('');
console.log('Method 1: Online converter (recommended)');
console.log('1. Open app/icon.svg in a browser or image editor');
console.log('2. Export as PNG at 256x256, 48x48, and 32x32 sizes');
console.log('3. Save as app/icon.png (Next.js will use the largest size)');
console.log('');
console.log('Method 2: Using sharp (if installed)');
console.log('npm install sharp');
console.log('Then modify this script to use sharp to convert SVG to PNG');
console.log('');
console.log('Method 3: Use an online favicon generator');
console.log('Upload app/icon.svg to https://realfavicongenerator.net/');
console.log('Download the generated favicon.ico and place in app/');

