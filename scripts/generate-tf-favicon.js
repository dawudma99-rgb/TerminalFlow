const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..', 'app');
const svgPath = path.join(appDir, 'icon-tf-monogram.svg');

async function generateFavicons() {
  try {
    // Read the SVG
    const svgBuffer = fs.readFileSync(svgPath);

    // Generate 512x512 icon.png
    await sharp(svgBuffer)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(appDir, 'icon.png'));

    console.log('✓ Generated app/icon.png (512x512)');

    // Generate 180x180 apple-icon.png
    await sharp(svgBuffer)
      .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(appDir, 'apple-icon.png'));

    console.log('✓ Generated app/apple-icon.png (180x180)');

    // Generate multiple sizes for favicon.ico (16, 32, 48)
    const sizes = [16, 32, 48];
    const pngBuffers = [];

    for (const size of sizes) {
      const buffer = await sharp(svgBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      pngBuffers.push(buffer);
    }

    // Create multi-resolution ICO file
    const icoBuffer = await toIco(pngBuffers);
    fs.writeFileSync(path.join(appDir, 'favicon.ico'), icoBuffer);

    console.log('✓ Generated app/favicon.ico (multi-resolution: 16x16, 32x32, 48x48)');

    console.log('\n✅ All favicon files generated successfully!');

  } catch (error) {
    console.error('Error generating favicons:', error);
    process.exit(1);
  }
}

generateFavicons();

