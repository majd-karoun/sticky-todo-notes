// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Load all saved data (notes, boards, styles, deleted notes)
    // This function is defined in components/utils.js
    // It internally calls functions like createNote, createBoardUI, loadBoardStyles, etc.
    loadSavedData();

    // Setup event listeners for the main note input textarea
    // This function is defined in components/utils.js
    setupTextareaEvents();

    // Setup event listeners for board navigation (buttons, swipe, keyboard)
    // This function is defined in components/board.js
    setupBoardNavigation();

    // Setup event listeners for the board style menu options
    // This function is defined in components/board.js
    setupStyleOptions();

    // Setup event listeners for multi-note selection using a selection box
    // This function is defined in components/selection.js
    initBoardSelectionHandlers();

    // Set the initial shortcut icon (Cmd or Ctrl)
    // This function is defined in components/utils.js
    updateShortcutIcon();

    // Add event listener for the board style button
    const styleButton = document.querySelector('.board-style-button');
    if (styleButton) {
        styleButton.addEventListener('click', toggleBoardStyleMenu); // toggleBoardStyleMenu is in components/board.js
    }

    // Add event listener for the trash bin icon
    const trashBin = document.querySelector('.trash-bin');
    if (trashBin) {
        trashBin.addEventListener('click', toggleTrashModal); // toggleTrashModal is in components/trash.js
    }

    // Add event listener for the close button in the trash modal
    const closeTrashButton = document.querySelector('#trashModal .close-btn');
     if (closeTrashButton) {
        closeTrashButton.addEventListener('click', toggleTrashModal); // toggleTrashModal is in components/trash.js
    }

    // Add event listener for the restore all button in the trash modal
    const restoreAllButton = document.querySelector('#trashModal .restore-all-btn');
    if (restoreAllButton) {
        restoreAllButton.addEventListener('click', restoreAllNotes); // restoreAllNotes is in components/trash.js
    }

     // Add event listener for the clear trash button in the trash modal
    const clearTrashButton = document.querySelector('#trashModal .clear-trash-btn');
    if (clearTrashButton) {
        clearTrashButton.addEventListener('click', clearTrash); // clearTrash is in components/trash.js
    }

});
