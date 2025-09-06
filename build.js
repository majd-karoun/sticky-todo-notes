const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
  try {
    console.log('🚀 Starting comprehensive build process...');

    // Define all JavaScript files in the correct order (as they appear in HTML)
    const jsFiles = [
      'components/utils.js',
      'components/selection.js', 
      'components/trash.js',
      'components/note/note-creation.js',
      'components/note/note-interaction.js',
      'components/note/note-transfer.js',
      'components/emoji.js',
      'components/board.js',
      'app.js'
    ];

    // Create a temporary bundle file
    console.log('📦 Bundling all JavaScript files...');
    let bundledContent = '';
    let totalOriginalSize = 0;

    for (const file of jsFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        bundledContent += `\n/* ${file} */\n${content}\n`;
        totalOriginalSize += fs.statSync(file).size;
        console.log(`   ✓ Added ${file} (${fs.statSync(file).size} bytes)`);
      } else {
        console.log(`   ⚠️  File not found: ${file}`);
      }
    }

    // Write temporary bundle
    const tempBundlePath = 'temp-bundle.js';
    fs.writeFileSync(tempBundlePath, bundledContent);

    // Minify the complete bundle
    console.log('🗜️  Minifying complete bundle...');
    const jsResult = await esbuild.build({
      entryPoints: [tempBundlePath],
      bundle: false,
      minify: true,
      outfile: 'app.bundle.min.js',
      format: 'iife',
      target: 'es2015',
      write: true,
      metafile: true
    });

    // Clean up temporary file
    fs.unlinkSync(tempBundlePath);

    // Build CSS
    console.log('🎨 Minifying CSS...');
    const cssResult = await esbuild.build({
      entryPoints: ['styles.css'],
      bundle: false,
      minify: true,
      outfile: 'styles.min.css',
      write: true,
      metafile: true
    });

    // Calculate compression ratios
    const minifiedJsSize = fs.statSync('app.bundle.min.js').size;
    const jsCompression = Math.round((1 - minifiedJsSize / totalOriginalSize) * 100);

    const originalCssSize = fs.statSync('styles.css').size;
    const minifiedCssSize = fs.statSync('styles.min.css').size;
    const cssCompression = Math.round((1 - minifiedCssSize / originalCssSize) * 100);

    console.log('✅ Build completed successfully!');
    console.log(`📊 JavaScript Bundle: ${totalOriginalSize} bytes → ${minifiedJsSize} bytes (${jsCompression}% reduction)`);
    console.log(`📊 CSS: ${originalCssSize} bytes → ${minifiedCssSize} bytes (${cssCompression}% reduction)`);
    console.log('🚀 Ready for Netlify deployment!');

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
