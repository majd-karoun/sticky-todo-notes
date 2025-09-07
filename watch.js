#!/usr/bin/env node

//Automatically run build on file changes.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🔍 Starting file watcher...');
console.log('📁 Watching for changes in:');
console.log('   - components/');
console.log('   - app.js');
console.log('   - styles.css');
console.log('');

let buildTimeout;
let isBuilding = false;

function runBuild() {
    if (isBuilding) {
        console.log('⏳ Build already in progress, skipping...');
        return;
    }
    
    isBuilding = true;
    console.log('🔨 File changed, running build...');
    
    const buildProcess = spawn('node', ['build.js'], {
        stdio: 'inherit',
        cwd: __dirname
    });
    
    buildProcess.on('close', (code) => {
        isBuilding = false;
        if (code === 0) {
            console.log('✅ Build completed successfully!');
        } else {
            console.log(`❌ Build failed with code ${code}`);
        }
        console.log('👀 Watching for changes...\n');
    });
    
    buildProcess.on('error', (err) => {
        isBuilding = false;
        console.error('❌ Build error:', err.message);
        console.log('👀 Watching for changes...\n');
    });
}

function debouncedBuild() {
    clearTimeout(buildTimeout);
    buildTimeout = setTimeout(runBuild, 300); // 300ms debounce
}

function watchDirectory(dir) {
    try {
        fs.watch(dir, { recursive: true }, (eventType, filename) => {
            if (!filename) return;
            
            // Only watch specific file types
            const ext = path.extname(filename);
            if (!['.js', '.css'].includes(ext)) return;
            
            // Skip minified files and build output
            if (filename.includes('.min.') || filename.includes('bundle')) return;
            
            console.log(`📝 ${eventType}: ${path.join(dir, filename)}`);
            debouncedBuild();
        });
        console.log(`   ✓ Watching ${dir}`);
    } catch (err) {
        console.log(`   ⚠️  Could not watch ${dir}: ${err.message}`);
    }
}

function watchFile(file) {
    try {
        fs.watch(file, (eventType) => {
            console.log(`📝 ${eventType}: ${file}`);
            debouncedBuild();
        });
        console.log(`   ✓ Watching ${file}`);
    } catch (err) {
        console.log(`   ⚠️  Could not watch ${file}: ${err.message}`);
    }
}

// Watch directories and files
watchDirectory('./components');
watchFile('./app.js');
watchFile('./styles.css');

console.log('');
console.log('🚀 File watcher is running!');
console.log('💡 Press Ctrl+C to stop');
console.log('👀 Watching for changes...\n');

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Stopping file watcher...');
    process.exit(0);
});
