const fs = require('fs');
const path = require('path');

const srcIconsDir = path.join(__dirname, '..', 'src', 'icons');
const distIconsDir = path.join(__dirname, '..', 'dist', 'icons');

if (!fs.existsSync(distIconsDir)) {
  fs.mkdirSync(distIconsDir, { recursive: true });
}

// Copy icon files from src/icons to dist/icons
const sizes = [16, 32, 48, 128];
sizes.forEach(size => {
  const srcFile = path.join(srcIconsDir, `icon-${size}.png`);
  const distFile = path.join(distIconsDir, `icon-${size}.png`);

  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, distFile);
    console.log(`Copied icon-${size}.png`);
  } else {
    console.warn(`Warning: icon-${size}.png not found in src/icons/`);
  }
});

console.log('Icon generation complete!');
