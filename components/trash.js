// Bin Management
function markAsDone(note) {
    const isPartOfSelection = selectedNotes.includes(note) && selectedNotes.length > 1;
    if (isPartOfSelection) {
        const notesToDelete = [...selectedNotes];
        notesToDelete.forEach((selectedNote, index) => {
            setTimeout(() => markNoteAsDone(selectedNote), index * 100);
        });
        clearSelection(); // Clear selection after processing
    } else {
        markNoteAsDone(note);
    }
}

function markNoteAsDone(note) {
    const content = note.querySelector('.sticky-content');
    const noteData = {
        text: content.innerHTML,
        color: note.style.backgroundColor,
        x: note.style.left,
        y: note.style.top,
        width: note.style.width,
        height: note.style.height,
        timestamp: new Date().toLocaleString(),
        isBold: content.classList.contains('bold')
    };
    
    // Update noteColumns to remove this note's position
    if (window.noteColumns) {
        const boardElement = note.closest('.board');
        if (boardElement && (boardElement.classList.contains('board-pattern-weekdays') || boardElement.classList.contains('board-pattern-days'))) {
            const boardRect = boardElement.getBoundingClientRect();
            const noteRect = note.getBoundingClientRect();
            const noteCenterX = noteRect.left + (noteRect.width / 2) - boardRect.left;
            const columnWidth = boardRect.width / 6; // 6 columns for weekdays
            const columnIndex = Math.min(5, Math.max(0, Math.floor(noteCenterX / columnWidth)));
            
            if (window.noteColumns[columnIndex]) {
                // Remove this note's position from the column
                window.noteColumns[columnIndex] = window.noteColumns[columnIndex].filter(pos => 
                    Math.abs(pos.x - parsePosition(note.style.left)) > 1 || 
                    Math.abs(pos.y - parsePosition(note.style.top)) > 1
                );
            }
        }
    }
    deletedNotes.unshift(noteData);
    saveDeletedNotes();
    updateTrashCount();

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
        updateBoardIndicators(); // Update indicators after note removal
    }, 500);
}

function checkTrashCollision(note) {
    const trashBin = document.querySelector('.trash-bin');
    const trashRect = trashBin.getBoundingClientRect();
    const noteRect = note.getBoundingClientRect();
    if (noteRect.right > trashRect.left && noteRect.left < trashRect.right &&
        noteRect.bottom > trashRect.top && noteRect.top < trashRect.bottom) {
        markAsDone(note);
        return true;
    }
    return false;
}

// Trash Modal Management
function toggleTrashModal() {
    const modal = document.getElementById('trashModal');
    const isVisible = modal.classList.contains('visible');
    if (!isVisible) {
        modal.style.display = 'block';
        requestAnimationFrame(() => modal.classList.add('visible')); // Use rAF for smoother transition
        renderDeletedNotes();
    } else {
        modal.classList.remove('visible');
        setTimeout(() => modal.style.display = 'none', 300); // Match CSS transition
    }
}

function renderDeletedNotes() {
    const container = document.querySelector('.deleted-notes-container');
    if (deletedNotes.length === 0) {
        container.innerHTML = `<div class="empty-state">(Empty)</div>`;
        return;
    }
    container.innerHTML = deletedNotes.map((note, index) => `
        <div class="deleted-note" style="background-color: ${note.color || '#ffd700'}">
            <div class="deleted-note-content ${note.isBold ? 'bold' : ''}">${note.text}</div>
            <div class="deleted-note-actions">
                <button class="restore-btn" onclick="restoreNote(${index})">Restore</button>
            </div>
        </div>`).join('');
}

function restoreNote(index) {
    const noteElement = document.querySelectorAll('.deleted-note')[index];
    noteElement.classList.add('shrinking');
    setTimeout(() => {
        const note = deletedNotes.splice(index, 1)[0];
        createNote(note.text, note.color, parsePosition(note.x), parsePosition(note.y), true, note.width, note.height, note.isBold);
        saveDeletedNotes();
        updateTrashCount();
        renderDeletedNotes();
        saveActiveNotes();
        updateBoardIndicators();
    }, 300); // Match animation
}

function clearTrash() {
    const notes = document.querySelectorAll('.deleted-note');
    const topNotes = Array.from(notes).slice(0, 6);
    topNotes.forEach((note, index) => {
        note.classList.add('note-deleting');
        note.style.animationDelay = `${index * 50}ms`;
    });
    setTimeout(() => {
        deletedNotes = [];
        saveDeletedNotes();
        updateTrashCount();
        renderDeletedNotes(); // Will show empty state
        // toggleTrashModal(); // Optionally close modal, or let user close it
    }, 350 + (topNotes.length > 0 ? (topNotes.length - 1) * 50 : 0) + 100); // Adjust timeout based on staggered animation
}

function updateTrashCount() {
    document.querySelector('.trash-count').textContent = deletedNotes.length;
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('trashModal');
    if (modal.classList.contains('visible') && e.target === modal) {
        toggleTrashModal();
    }
});