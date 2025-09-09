/**
 * BUILD SYSTEM MODULE
 * Comprehensive build pipeline using esbuild for JavaScript and CSS optimization
 * Features:
 * - Multi-file JavaScript bundling in correct dependency order
 * - Advanced minification with esbuild for optimal compression
 * - CSS processing and minification
 * - Build statistics and compression reporting
 * - Error handling and validation
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

/**
 * Main build function that orchestrates the entire build process
 * Handles JavaScript bundling, minification, and CSS processing
 * Provides detailed build statistics and error reporting
 */
async function build() {
  try {
    console.log('🚀 Starting comprehensive build process...');

    // Define all JavaScript files in the correct dependency order
    // Order matches HTML script loading sequence to maintain functionality
    const componentFiles = [
      'components/optimization/dom-cache.js',
      'components/optimization/event-manager.js',
      'components/optimization/animation-batcher.js',
      'components/optimization/storage-debouncer.js',
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

    // JAVASCRIPT BUNDLING PHASE
    // Create temporary bundle with all source files and size tracking
    console.log('📦 Bundling all JavaScript files...');
    let bundledContent = '';
    let totalOriginalSize = 0;

    // Process each JavaScript file and add to bundle with source comments
    for (const file of componentFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        bundledContent += `\n/* ${file} */\n${content}\n`;
        totalOriginalSize += fs.statSync(file).size;
        console.log(`   ✓ Added ${file} (${fs.statSync(file).size} bytes)`);
      } else {
        console.log(`   ⚠️  File not found: ${file}`);
      }
    }

    // Add global function exports for HTML onclick handlers
    // These functions need to be available in the global scope
    bundledContent += `
/* Global function exports for HTML onclick handlers */
window.addNote = addNote;
window.restoreNote = restoreNote;
window.changeNoteColor = changeNoteColor;
window.markAsDone = markAsDone;
window.toggleBold = toggleBold;
window.clearTrash = clearTrash;
`;

    // Create temporary bundle file for esbuild processing
    const tempBundlePath = 'temp-bundle.js';
    fs.writeFileSync(tempBundlePath, bundledContent);

    // JAVASCRIPT MINIFICATION PHASE
    // Use esbuild for advanced minification and optimization
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

    // Clean up temporary bundle file
    fs.unlinkSync(tempBundlePath);

    // CSS PROCESSING PHASE
    // Minify CSS with esbuild for consistent optimization
    console.log('🎨 Minifying CSS...');
    const cssResult = await esbuild.build({
      entryPoints: ['styles.css'],
      bundle: false,
      minify: true,
      outfile: 'styles.min.css',
      write: true,
      metafile: true
    });

    // STATISTICS CALCULATION
    // Calculate and display compression ratios for both JS and CSS
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

// Execute the build process
build();
