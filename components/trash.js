// Bin Management
let pendingNotesToDelete = []; // Store notes waiting to be deleted when bin is full
const TRASH_LIMIT = 100, ANIMATION_DELAY = 50, DEFAULT_COLOR = '#ffd700';

const markAsDone = note => {
    if (selectedNotes.includes(note) && selectedNotes.length > 1) {
        selectedNotes.forEach((selectedNote, i) => setTimeout(() => markNoteAsDone(selectedNote), i * 100));
        clearSelection();
    } else {
        markNoteAsDone(note);
    }
};

const markNoteAsDone = note => {
    if (deletedNotes.length > TRASH_LIMIT) {
        !pendingNotesToDelete.includes(note) && pendingNotesToDelete.push(note);
        return openTrashDueToLimit();
    }
    
    const content = note.querySelector('.sticky-content');
    const noteData = {
        text: content.innerHTML,
        color: note.style.backgroundColor,
        x: note.style.left, y: note.style.top,
        width: note.style.width, height: note.style.height,
        timestamp: new Date().toLocaleString(),
        isBold: content.classList.contains('bold')
    };
    
    updateNoteColumns(note);
    [deletedNotes.unshift(noteData), saveDeletedNotes(), updateTrashCount()];
    animateNoteToTrash(note);
};

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

const animateNoteToTrash = note => {
    const trashBin = document.querySelector('.trash-bin');
    const trashRect = trashBin.getBoundingClientRect();
    const noteRect = note.getBoundingClientRect();
    const throwX = trashRect.left - noteRect.left + (trashRect.width / 2) - (noteRect.width / 2);
    const throwY = trashRect.top - noteRect.top;

    note.style.setProperty('--throwX', `${throwX}px`);
    note.style.setProperty('--throwY', `${throwY}px`);
    note.style.animation = 'paperCrumble 0.5s ease-in forwards';
    trashBin.style.animation = 'binShake 0.5s ease-in-out';

    setTimeout(() => {
        note.remove();
        trashBin.style.animation = '';
        saveActiveNotes();
        updateBoardIndicators();
    }, 500);
};

const checkTrashCollision = note => {
    const [trashRect, noteRect] = [
        document.querySelector('.trash-bin').getBoundingClientRect(),
        note.getBoundingClientRect()
    ];
    
    if (noteRect.right > trashRect.left && noteRect.left < trashRect.right &&
        noteRect.bottom > trashRect.top && noteRect.top < trashRect.bottom) {
        markAsDone(note);
        return true;
    }
    return false;
};

// Trash Modal Management
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

const renderDeletedNotes = () => {
    const container = document.querySelector('.deleted-notes-container');
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

const restoreNote = index => {
    const noteElement = document.querySelectorAll('.deleted-note')[index];
    noteElement?.classList.add('shrinking');
    
    setTimeout(() => {
        const [note] = deletedNotes.splice(index, 1);
        createNote(note.text, note.color, parsePosition(note.x), parsePosition(note.y), true, note.width, note.height, note.isBold);
        [saveDeletedNotes(), updateTrashCount(), renderDeletedNotes(), saveActiveNotes(), updateBoardIndicators()];
    }, 300);
};

const clearTrash = () => {
    const notes = [...document.querySelectorAll('.deleted-note')].slice(0, 6);
    notes.forEach((note, i) => {
        note.classList.add('note-deleting');
        note.style.animationDelay = `${i * ANIMATION_DELAY}ms`;
    });
    
    setTimeout(() => {
        const processPending = () => {
            if (pendingNotesToDelete.length) {
                const notesToProcess = [...pendingNotesToDelete];
                pendingNotesToDelete = [];
                setTimeout(() => notesToProcess.forEach(note => note?.parentNode && markNoteAsDone(note)), 100);
            }
        };
        
        deletedNotes = [];
        [saveDeletedNotes(), updateTrashCount(), renderDeletedNotes()];
        setTimeout(() => [toggleTrashModal(), processPending()], 200);
    }, 350 + (notes.length ? (notes.length - 1) * ANIMATION_DELAY : 0) + 100);
};

const updateTrashCount = () => {
    document.querySelector('.trash-count').textContent = deletedNotes.length;
};

document.addEventListener('click', e => {
    const modal = document.getElementById('trashModal');
    modal?.classList.contains('visible') && e.target === modal && toggleTrashModal();
});