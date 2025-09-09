/**
 * TRASH MANAGEMENT MODULE
 * Handles note deletion, trash bin functionality, and note restoration
 * Features:
 * - Note deletion with smooth animations
 * - Trash bin collision detection
 * - Deleted notes storage and management
 * - Note restoration from trash
 * - Trash limit handling with pending deletion queue
 * - Modal interface for trash management
 */

// TRASH SYSTEM CONSTANTS AND STATE

let pendingNotesToDelete = []; // Store notes waiting to be deleted when bin is full
const TRASH_LIMIT = 100, ANIMATION_DELAY = 50, DEFAULT_COLOR = '#ffd700';

/**
 * Opens the trash modal when trash limit is reached
 * Provides visual feedback to encourage trash clearing
 */
const openTrashDueToLimit = () => {
    const [modal, clearButton] = [$('#trashModal'), $('.clear-trash-btn')];
    if (modal && !modal.classList.contains('visible')) {
        modal.style.display = 'block';
        modal.classList.add('visible');
        requestAnimationFrame(() => renderDeletedNotes());
    }
    if (clearButton) {
        clearButton.classList.add('shake-animation');
        setTimeout(() => clearButton.classList.remove('shake-animation'), 1000);
    }
};

// NOTE DELETION FUNCTIONS

/**
 * Marks a note or multiple selected notes as done (deleted)
 * Handles both single note and multi-note selection scenarios
 * @param {Element} note - The note element to mark as done
 */
const markAsDone = note => {
    if (selectedNotes.includes(note) && selectedNotes.length > 1) {
        selectedNotes.forEach((selectedNote, i) => setTimeout(() => markNoteAsDone(selectedNote), i * 100));
        clearSelection();
    } else {
        markNoteAsDone(note);
    }
};

/**
 * Processes the deletion of a single note
 * Handles trash limit checking, data extraction, and animation
 * @param {Element} note - The note element to delete
 */
const markNoteAsDone = note => {
    if (deletedNotes.length >= TRASH_LIMIT) {
        !pendingNotesToDelete.includes(note) && pendingNotesToDelete.push(note);
        openTrashDueToLimit();
        return;
    }
    
    // Clean up event listeners before deletion
    if (note._eventCleanup) {
        note._eventCleanup();
    }
    
    const content = $within(note, '.sticky-content');
    const noteData = {
        text: content.innerHTML,
        color: note.style.backgroundColor,
        x: note.style.left, y: note.style.top,
        width: note.style.width, height: note.style.height,
        timestamp: new Date().toLocaleString(),
        isBold: content.classList.contains('bold')
    };
    
    updateNoteColumns(note);
    deletedNotes.unshift(noteData);
    window.DebouncedStorage.saveLow(DELETED_NOTES_KEY, deletedNotes);
    updateTrashCount();
    animateNoteToTrash(note);
};

/**
 * Updates note column tracking for pattern-based boards
 * Removes deleted note from column position tracking
 * @param {Element} note - The note being deleted
 */
const updateNoteColumns = note => {
    if (!window.noteColumns) return;
    const board = note.closest('.board');
    if (!board || !board.matches('.board-pattern-weekdays, .board-pattern-days')) return;
    
    const [boardRect, noteRect] = [board.getBoundingClientRect(), note.getBoundingClientRect()];
    const columnIndex = Math.min(5, Math.max(0, Math.floor(((noteRect.left + (noteRect.width / 2) - boardRect.left) / (boardRect.width / 6)))));
    
    if (window.noteColumns[columnIndex]) {
        window.noteColumns[columnIndex] = window.noteColumns[columnIndex].filter(pos => 
            Math.abs(pos.x - parsePosition(note.style.left)) > 1 || 
            Math.abs(pos.y - parsePosition(note.style.top)) > 1
        );
    }
};

/**
 * Animates a note being thrown into the trash bin
 * Calculates trajectory and applies CSS animations
 * @param {Element} note - The note element to animate
 */
const animateNoteToTrash = note => {
    const trashBin = $('.trash-bin');
    const trashRect = trashBin.getBoundingClientRect();
    const noteRect = note.getBoundingClientRect();
    const throwX = trashRect.left - noteRect.left + (trashRect.width / 2) - (noteRect.width / 2);
    const throwY = trashRect.top - noteRect.top;

    note.style.setProperty('--throwX', `${throwX}px`);
    note.style.setProperty('--throwY', `${throwY}px`);
    note.style.animation = 'paperCrumble 0.6s ease-in forwards';
    trashBin.style.animation = 'binShake 0.6s ease-in-out';

    setTimeout(() => {
        note.remove();
        trashBin.style.animation = '';
        saveActiveNotes();
        updateBoardIndicators();
    }, 600);
};

/**
 * Checks if a note collides with the trash bin during drag operations
 * @param {Element} note - The note element to check for collision
 * @returns {boolean} True if collision detected and note was deleted
 */
const checkTrashCollision = note => {
    const [trashRect, noteRect] = [
        $('.trash-bin').getBoundingClientRect(),
        note.getBoundingClientRect()
    ];
    
    if (noteRect.right > trashRect.left && noteRect.left < trashRect.right &&
        noteRect.bottom > trashRect.top && noteRect.top < trashRect.bottom) {
        markAsDone(note);
        return true;
    }
    return false;
};

// TRASH MODAL MANAGEMENT

/**
 * Toggles the visibility of the trash modal
 * Handles modal display and note rendering
 */
const toggleTrashModal = () => {
    const modal = document.getElementById('trashModal');
    const isVisible = modal.classList.toggle('visible');
    
    if (isVisible) {
        modal.style.display = 'block';
        requestAnimationFrame(() => renderDeletedNotes());
    } else {
        setTimeout(() => modal.style.display = 'none', 300);
    }
};

/**
 * Renders the list of deleted notes in the trash modal
 * Creates HTML for each deleted note with restore functionality
 */
const renderDeletedNotes = () => {
    const container = $('.deleted-notes-container');
    // Force container to calculate layout first
    container.style.minHeight = '200px';
    container.innerHTML = deletedNotes.length ? 
        deletedNotes.map((note, i) => `
            <div class="deleted-note" style="background-color: ${note.color || DEFAULT_COLOR}">
                <div class="deleted-note-content ${note.isBold ? 'bold' : ''}">${note.text}</div>
                <div class="deleted-note-actions">
                    <button class="restore-btn" onclick="restoreNote(${i})">Restore</button>
                </div>
            </div>`).join('') : 
        '<div class="empty-state">(Empty)</div>';
};

/**
 * Restores a deleted note back to the current board
 * @param {number} index - Index of the note in the deletedNotes array
 */
const restoreNote = index => {
    const noteElement = $$('.deleted-note')[index];
    noteElement?.classList.add('shrinking');
    
    setTimeout(() => {
        const [note] = deletedNotes.splice(index, 1);
        createNote(note.text, note.color, parsePosition(note.x), parsePosition(note.y), true, note.width, note.height, note.isBold);
        window.DebouncedStorage.saveLow(DELETED_NOTES_KEY, deletedNotes);
        updateTrashCount();
        renderDeletedNotes();
        window.DebouncedStorage.saveHigh(`${ACTIVE_NOTES_KEY}_board_${currentBoardId}`, getNotesData());
        updateBoardIndicators();
    }, 300);
};

/**
 * Clears all notes from the trash with staggered animations
 * Processes any pending notes that were waiting for trash space
 */
const clearTrash = () => {
    // If trash is already empty, just close the modal immediately
    if (deletedNotes.length === 0) {
        toggleTrashModal();
        return;
    }
    
    const notes = [...$$('.deleted-note')].slice(0, 6);
    notes.forEach((note, i) => {
        note.classList.add('note-deleting');
        note.style.animationDelay = `${i * ANIMATION_DELAY}ms`;
    });
    
    // Wait for all animations to complete before clearing data and closing modal
    setTimeout(() => {
        deletedNotes = [];
        window.DebouncedStorage.saveLow(DELETED_NOTES_KEY, deletedNotes);
        updateTrashCount();
        renderDeletedNotes();
        
        // Close modal first, then process pending notes
        setTimeout(() => {
            toggleTrashModal();
            
            // Process pending notes after modal is closed
            if (pendingNotesToDelete.length) {
                const notesToProcess = [...pendingNotesToDelete];
                pendingNotesToDelete = [];
                setTimeout(() => {
                    notesToProcess.forEach(note => {
                        if (note?.parentNode) {
                            markNoteAsDone(note);
                        }
                    });
                }, 300);
            }
        }, 200);
    }, (notes.length ? (notes.length - 1) * ANIMATION_DELAY + 300 : 0) + 100);
};

/**
 * Updates the trash count display in the UI
 */
const updateTrashCount = () => {
    $('.trash-count').textContent = deletedNotes.length;
};

// EVENT HANDLERS

/**
 * Closes trash modal when clicking outside the modal content
 */
document.addEventListener('click', e => {
    const modal = $('#trashModal');
    modal?.classList.contains('visible') && e.target === modal && toggleTrashModal();
});