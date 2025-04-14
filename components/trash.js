// Bin Management
function markAsDone(note) {
    const content = note.querySelector('.sticky-content');
    const isBold = content.classList.contains('bold');

    const noteData = {
        text: content.innerHTML,
        color: note.style.backgroundColor,
        x: note.style.left,
        y: note.style.top,
        width: note.style.width,
        height: note.style.height,
        timestamp: new Date().toLocaleString(),
        isBold: isBold // Save the bold state
    };

    deletedNotes.unshift(noteData); // deletedNotes is in utils.js
    saveDeletedNotes(); // saveDeletedNotes is in utils.js
    updateTrashCount();

    const trashBin = document.querySelector('.trash-bin');
    const trashRect = trashBin.getBoundingClientRect();
    const noteRect = note.getBoundingClientRect();

    const throwX = trashRect.left - noteRect.left + (trashRect.width / 2) - (noteRect.width / 2);
    const throwY = trashRect.top - noteRect.top;

    note.style.setProperty('--throwX', `${throwX}px`);
    note.style.setProperty('--throwY', `${throwY}px`);
    note.style.animation = 'paperCrumble 0.5s ease-in forwards';

    // Start bin shake animation immediately instead of after delay
    trashBin.style.animation = 'binShake 0.5s ease-in-out';

    setTimeout(() => {
        note.remove();
        trashBin.style.animation = '';
        saveActiveNotes(); // saveActiveNotes is in utils.js
    }, 500);
}

function checkTrashCollision(note) {
    const trashBin = document.querySelector('.trash-bin');
    const trashRect = trashBin.getBoundingClientRect();
    const noteRect = note.getBoundingClientRect();

    if (noteRect.right > trashRect.left &&
        noteRect.left < trashRect.right &&
        noteRect.bottom > trashRect.top &&
        noteRect.top < trashRect.bottom) {
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
        modal.offsetHeight; // Force reflow
        modal.classList.add('visible');
        renderDeletedNotes();
    } else {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

function renderDeletedNotes() {
    const container = document.querySelector('.deleted-notes-container');

    if (deletedNotes.length === 0) { // deletedNotes is in utils.js
        container.innerHTML = `
            <div class="empty-state">
                (Empty)
            </div>`;
        return;
    }

    container.innerHTML = deletedNotes.map((note, index) => `
        <div class="deleted-note" style="background-color: ${note.color}">
            <div class="deleted-note-content ${note.isBold ? 'bold' : ''}">${note.text}</div>
            <div class="deleted-note-actions">
                <button class="restore-btn" onclick="restoreNote(${index})">Restore</button>
                <button class="delete-btn" onclick="deleteNotePermanently(${index})">Delete</button>
            </div>
        </div>
    `).join('');
}

function restoreNote(index) {
    const noteElement = document.querySelectorAll('.deleted-note')[index];
    noteElement.classList.add('removing');
    noteElement.style.animation = 'noteDelete 0.2s ease-out forwards';

    setTimeout(() => {
        const note = deletedNotes[index]; // deletedNotes is in utils.js

        // Create the note with its bold state
        const restoredNote = createNote( // createNote is in note.js
            note.text,
            note.color,
            parsePosition(note.x), // parsePosition is in utils.js
            parsePosition(note.y),
            true,
            note.width,
            note.height,
            note.isBold  // Pass the bold state
        );

        restoredNote.style.animation = 'paperPop 0.3s ease-out forwards';

        deletedNotes.splice(index, 1);
        saveDeletedNotes(); // saveDeletedNotes is in utils.js
        updateTrashCount();
        renderDeletedNotes();
        saveActiveNotes(); // saveActiveNotes is in utils.js
    }, 300);

    updateBoardIndicators(); // updateBoardIndicators is in board.js
}

function deleteNotePermanently(index) {
    const noteElement = document.querySelectorAll('.deleted-note')[index];
    noteElement.classList.add('removing');
    noteElement.style.animation = 'noteDelete 0.3s ease-out forwards';

    setTimeout(() => {
        deletedNotes.splice(index, 1); // deletedNotes is in utils.js
        saveDeletedNotes(); // saveDeletedNotes is in utils.js
        updateTrashCount();
        renderDeletedNotes();
    }, 300);
}

function restoreAllNotes() {
    const notes = document.querySelectorAll('.deleted-note');
    notes.forEach((note, index) => {
        note.classList.add('removing');
        note.style.animation = 'noteDelete 0.2s ease-out forwards';
    });

    setTimeout(() => {
        while (deletedNotes.length > 0) { // deletedNotes is in utils.js
            const note = deletedNotes[0];
            createNote( // createNote is in note.js
                note.text,
                note.color,
                parsePosition(note.x), // parsePosition is in utils.js
                parsePosition(note.y),
                true,
                note.width,
                note.height,
                note.isBold  // Pass the bold state
            ).style.animation = 'paperPop 0.3s ease-out forwards';

            deletedNotes.splice(0, 1);
            saveActiveNotes(); // saveActiveNotes is in utils.js
        }
        saveDeletedNotes(); // saveDeletedNotes is in utils.js
        updateTrashCount();
        toggleTrashModal();
    }, 300);

    updateBoardIndicators(); // updateBoardIndicators is in board.js
}

function clearTrash() {
    if (confirm('Are you sure you want to permanently delete all notes in the Bin?')) {
        const notes = document.querySelectorAll('.deleted-note');
        notes.forEach(note => {
            note.classList.add('removing');
        });

        // Wait for animation to complete before clearing
        setTimeout(() => {
            deletedNotes = []; // deletedNotes is in utils.js
            saveDeletedNotes(); // saveDeletedNotes is in utils.js
            updateTrashCount();
            renderDeletedNotes();
            toggleTrashModal(); // Close the modal
        }, 300);
    }
}

function updateTrashCount() {
    const countElement = document.querySelector('.trash-count');
    countElement.textContent = deletedNotes.length; // deletedNotes is in utils.js
}

// Event listener to close trash modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('trashModal');
    const modalContent = modal.querySelector('.modal-content');

    // Check if modal is visible and click is on the backdrop
    if (modal.classList.contains('visible') &&
        e.target === modal) {  // Click is on the modal backdrop
        toggleTrashModal();
    }
});
