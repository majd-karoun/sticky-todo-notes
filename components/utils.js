// Global Variables
const colors = ['#f0e68c', '#98ff98', '#ff7eb9', '#7afcff', '#FE8801', '#ec0c39', '#AF65EF', '#ffd700', '#C1C1C1', '#FFFFFF'];
const boardStyles = {
    colors: { 
        default: '#1a1a1a', 
        current: '#1a1a1a',
        available: ['#1a1a1a', '#500000', '#004000', '#000050', '#10253F', '#400040']
    },
    patterns: { default: 'none', current: 'none' }
};
let deletedNotes = [];
let holdTimer, activeNote = null, activePalette = null;
let isSelecting = false, selectionBox = null, selectionStartX = 0, selectionStartY = 0;
let selectedNotes = [], selectedStickers = [], isMovingSelection = false, selectionMoveStartX = 0, selectionMoveStartY = 0;
let notesInitialPositions = [], stickersInitialPositions = [];
const lastNotePositions = {}, lastNoteColors = {};
lastNotePositions[1] = { x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 75 };
lastNoteColors[1] = colors[0];
let currentBoardId = 1, boardCount = 1, isMobileView = false;
const MAX_BOARDS = 9;
const ACTIVE_NOTES_KEY = 'stickyNotes_active', DELETED_NOTES_KEY = 'stickyNotes_deleted', BOARDS_COUNT_KEY = 'stickyNotes_boardCount';

const checkMobileView = () => {
    isMobileView = window.innerWidth <= 768;
    if (isMobileView && currentBoardId !== 1 && typeof switchToBoard === 'function') switchToBoard(1);
};

const parsePosition = value => parseInt(String(value).replace('px', '')) || 0;

const getNextNotePosition = (lastX, lastY) => {
    const horizontalOffset = Math.random() * 10 - 5;
    let newX = lastX + horizontalOffset, newY = lastY + 70;
    const padding = 5, maxX = window.innerWidth - 200; // Account for full note width
    const bottomThreshold = window.innerHeight - 300; // Break line when reaching 300px from bottom
    
    // If the new position would be too close to the bottom, start a new line
    if (newY > bottomThreshold) { 
        newY = 50; // Start new line at top
        newX = lastX + 250; // Move to next column (note width + more spacing)
        
        // If we've reached the right edge, start from the far left again
        if (newX > maxX) {
            newX = padding + 50; // Start from far left with some padding
            newY = 50; // Keep at top for new row
        }
    }
    
    // Ensure position is within bounds
    const finalX = Math.min(Math.max(newX, padding), maxX);
    const finalY = Math.min(Math.max(newY, padding), window.innerHeight - 100);
    
    return { x: finalX, y: finalY };
};

const hexToRgb = hex => {
    if (hex.startsWith('rgba')) {
        const parts = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return parts ? { r: parseInt(parts[1]), g: parseInt(parts[2]), b: parseInt(parts[3]) } : null;
    }
    hex = hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
};

const saveToLocalStorage = (key, data) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error(`Failed to save to localStorage (${key}):`, error);
    }
};

const saveActiveNotes = () => {
    const boardElement = document.querySelector(`.board[data-board-id="${currentBoardId}"]`);
    if (!boardElement) return;
    const notesData = Array.from(boardElement.querySelectorAll('.sticky-note')).map(note => ({
        text: note.querySelector('.sticky-content').innerHTML,
        color: note.style.backgroundColor,
        x: note.style.left, y: note.style.top,
        width: note.style.width || '200px', height: note.style.height || '150px',
        isBold: note.querySelector('.sticky-content').classList.contains('bold'),
        noteId: note.dataset.noteId,
        zIndex: note.style.zIndex || 1
    }));
    saveToLocalStorage(`${ACTIVE_NOTES_KEY}_board_${currentBoardId}`, notesData);
    if (typeof updateBoardIndicators === 'function') updateBoardIndicators();
};
const saveDeletedNotes = () => saveToLocalStorage(DELETED_NOTES_KEY, deletedNotes);
const saveBoardCount = () => localStorage.setItem(BOARDS_COUNT_KEY, boardCount.toString());
const saveBoardStyles = () => saveToLocalStorage(`boardStyles_board_${currentBoardId}`, {
    color: boardStyles.colors.current,
    pattern: boardStyles.patterns.current
});

const updateShortcutIconDisplay = () => {
    const shortcutIconEl = document.getElementById('shortcutIcon');
    if (!shortcutIconEl) return;
    const modKey = navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl';
    shortcutIconEl.innerHTML = modKey;
    shortcutIconEl.className = 'shortcut-icon focus-hint';
};

const setupTextareaEvents = () => {
    const textarea = document.querySelector('.note-input textarea');
    if (!textarea) return;
    const shortcutIconEl = document.getElementById('shortcutIcon');

    const updateHint = () => {
        if (!shortcutIconEl) return;
        const modKey = navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl';
        const hasText = textarea.value.trim();
        shortcutIconEl.innerHTML = hasText ? `${modKey}+↵` : modKey;
        shortcutIconEl.classList.toggle('focus-hint', !hasText);
        shortcutIconEl.classList.toggle('enter-hint', hasText);
    };

    textarea.addEventListener('focus', () => {
        updateHint();
        textarea.style.height = '50px';
        requestAnimationFrame(() => textarea.style.height = '200px');
        textarea.addEventListener('input', updateHint);
    });
    textarea.addEventListener('blur', () => {
        updateShortcutIconDisplay();
        textarea.style.height = '200px';
        requestAnimationFrame(() => textarea.style.height = '50px');
        textarea.removeEventListener('input', updateHint);
    });
    document.addEventListener('mousedown', e => {
        if (!e.target.closest('.note-input') && document.activeElement === textarea) textarea.blur();
    });
};

const safeParseJSON = (data, fallback = null) => {
    try {
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to parse JSON data:', error);
        return fallback;
    }
};


const performOneTimeStorageCleanup = () => {
    const CLEANUP_FLAG_KEY = 'stickyNotes_storageCleanupPerformed';
    
    // Check if cleanup has already been performed
    if (localStorage.getItem(CLEANUP_FLAG_KEY)) {
        return; // Cleanup already done, exit early
    }
    
    try {
        console.log('Performing one-time localStorage cleanup...');
        
        // Get all localStorage keys
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
                key.startsWith('stickyNotes_') || 
                key.startsWith('boardColor_') || 
                key.startsWith('boardPattern_') || 
                key.startsWith('boardStyles_') || 
                key.startsWith('emojiStickers_') || 
                key.startsWith('daysPatternStartDate_') ||
                key.startsWith('emojiUsageOrder')
            )) {
                keysToRemove.push(key);
            }
        }
        
        // Remove all old app data
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        console.log(`Cleaned up ${keysToRemove.length} localStorage items`);
        
        // Set the flag to indicate cleanup has been performed
        localStorage.setItem(CLEANUP_FLAG_KEY, 'true');
        
    } catch (error) {
        console.error('Error during localStorage cleanup:', error);
        // Still set the flag to prevent repeated attempts if there's an error
        localStorage.setItem(CLEANUP_FLAG_KEY, 'true');
    }
};

const loadSavedData = () => {
    try {
        // Perform one-time localStorage cleanup before loading any data
        performOneTimeStorageCleanup();
        
        checkMobileView();
        if (typeof createSelectionBox === 'function') createSelectionBox();

        const savedBoardCount = localStorage.getItem(BOARDS_COUNT_KEY);
        if (savedBoardCount) {
            const parsedCount = parseInt(savedBoardCount);
            if (!isNaN(parsedCount) && parsedCount > 0) {
                // Trust the saved boardCount but cap it at MAX_BOARDS
                boardCount = Math.min(parsedCount, MAX_BOARDS);
                
                // Create UI for all boards up to the saved count
                for (let i = 2; i <= boardCount; i++) {
                    if (typeof createBoardUI === 'function') createBoardUI(i);
                }
            }
        }
        if (typeof updateAddButtonState === 'function') updateAddButtonState();

        for (let i = 1; i <= boardCount; i++) {
            const savedBoardNotes = localStorage.getItem(`${ACTIVE_NOTES_KEY}_board_${i}`);
            if (savedBoardNotes) {
                const notesData = safeParseJSON(savedBoardNotes, []);
                if (Array.isArray(notesData)) {
                    notesData.forEach(note => {
                        if (note && typeof note === 'object' && note.text) {
                            lastNotePositions[i] = { x: parsePosition(note.x), y: parsePosition(note.y) };
                            lastNoteColors[i] = note.color || colors[0];
                            if (typeof createNote === 'function') {
                                const createdNote = createNote(note.text, note.color || colors[0], parsePosition(note.x), parsePosition(note.y), true, note.width || '200px', note.height || '150px', note.isBold || false, i);
                                if (createdNote && note.noteId) {
                                    createdNote.dataset.noteId = note.noteId;
                                    if (note.zIndex && !isNaN(parseInt(note.zIndex))) {
                                        createdNote.style.zIndex = note.zIndex;
                                        if (typeof globalZIndex !== 'undefined' && parseInt(note.zIndex) >= globalZIndex) {
                                            globalZIndex = parseInt(note.zIndex);
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            }
            if (typeof loadBoardStyles === 'function') loadBoardStyles(i);
        }
        if (typeof switchToBoard === 'function') switchToBoard(1);

        const savedDeleted = localStorage.getItem(DELETED_NOTES_KEY);
        if (savedDeleted) {
            const deletedData = safeParseJSON(savedDeleted, []);
            if (Array.isArray(deletedData)) {
                deletedNotes = deletedData;
                if (typeof updateTrashCount === 'function') updateTrashCount();
            }
        }
        ['updateBoardIndicators', 'updateShortcutHintVisibility'].forEach(fn => {
            if (typeof window[fn] === 'function') window[fn]();
        });
        updateShortcutIconDisplay();
        setupTextareaEvents();
    } catch (error) {
        console.error('Critical error loading saved data:', error);
    }
};

