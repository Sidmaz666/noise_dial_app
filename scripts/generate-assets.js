const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Asset configuration
// Source file must exist in assets/images/
// Destination file will be created/overwritten in assets/images/
const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'images');

const assets = [
  {
    source: 'icon-source.svg',
    destination: 'icon.png',
    width: 1024,
    height: 1024,
  },
  {
    source: 'splash-source.svg',
    destination: 'splash-icon.png',
    width: 1284,
    height: 2778,
  },
  {
    source: 'adaptive-foreground-source.svg',
    destination: 'android-icon-foreground.png',
    width: 432,
    height: 432,
  },
  {
    source: 'adaptive-background-source.svg',
    destination: 'android-icon-background.png',
    width: 432,
    height: 432,
  },
  {
    source: 'adaptive-monochrome-source.svg',
    destination: 'android-icon-monochrome.png',
    width: 432,
    height: 432,
  },
  {
    source: 'icon-source.svg', // Reuse main icon source for favicon
    destination: 'favicon.png',
    width: 48,
    height: 48,
  },
];

console.log('🎨 Generating PNG assets from SVG sources using sharp...');

// Ensure assets directory exists
if (!fs.existsSync(ASSETS_DIR)) {
  console.error(`❌ Assets directory not found: ${ASSETS_DIR}`);
  process.exit(1);
}

async function generateAssets() {
  let successCount = 0;
  
  for (const asset of assets) {
    const sourcePath = path.join(ASSETS_DIR, asset.source);
    const destPath = path.join(ASSETS_DIR, asset.destination);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`⚠️ Source file not found: ${asset.source} (Skipping ${asset.destination})`);
      continue;
    }

    try {
      console.log(`Converting ${asset.source} -> ${asset.destination} (${asset.width}x${asset.height})...`);
      
      await sharp(sourcePath)
        .resize(asset.width, asset.height)
        .png()
        .toFile(destPath);
        
      successCount++;
    } catch (err) {
      console.error(`❌ Error converting ${asset.source}:`, err.message);
    }
  }

  console.log(`\n✅ Asset generation complete! (${successCount}/${assets.length} files generated)`);
}

generateAssets().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
