/**
 * Floating UI Drag & Drop + Memory Management Module
 * Handles:
 * - Floating button dragging and position persistence
 * - UI visibility management (localStorage)
 * - Position reset functionality
 */

// ===== UI MODE MANAGEMENT =====

export function initUIMode() {
    // Apply visibility from settings checkboxes (master toggle + per-button)
    const applyVisibility = () => {
        let vis = {};
        try {
            const saved = localStorage.getItem('uiVisibility');
            if (saved) vis = JSON.parse(saved);
        } catch { /* defaults */ }

        const masterVisible = vis.floatingBtns !== false;

        // Per-button mapping: settings key → button element ID
        const btnMap = [
            { key: 'btnImport', id: 'importDbBtn', defaultOn: true },
            { key: 'btnExport', id: 'exportDbBtn', defaultOn: true },
            { key: 'btnAi', id: 'aiChatBtn', defaultOn: true },
            { key: 'btnAbout', id: 'aboutBtn', defaultOn: true },
            { key: 'btnHelp', id: 'helpBtn', defaultOn: true },
            { key: 'btnLanguage', id: 'languageBtn', defaultOn: false },
            { key: 'btnReset', id: 'resetMemoryBtn', defaultOn: false }
        ];

        for (const { key, id, defaultOn } of btnMap) {
            const el = document.getElementById(id);
            if (!el) continue;
            const enabled = vis[key] !== undefined ? vis[key] : defaultOn;
            el.style.display = (masterVisible && enabled) ? 'flex' : 'none';
        }
    };

    applyVisibility();
    window._updateUIMode = applyVisibility;
}

// ===== FLOATING BUTTON POSITIONS =====

export function resetFloatingButtonPositions() {
    const floatingBtns = document.querySelectorAll('.floating-btn');
    localStorage.removeItem('floatingButtonPositions');

    floatingBtns.forEach(btn => {
        btn.style.left = '';
        btn.style.top = '';
        btn.style.right = '';
        btn.style.bottom = '';
        btn.classList.remove('dragging');
    });
}

function saveButtonPosition(btn) {
    const btnId = btn.id;
    if (!btnId) return;

    const positions = JSON.parse(localStorage.getItem('floatingButtonPositions') || '{}');
    positions[btnId] = {
        left: btn.style.left,
        top: btn.style.top
    };
    localStorage.setItem('floatingButtonPositions', JSON.stringify(positions));
}

function loadButtonPositions() {
    const positions = JSON.parse(localStorage.getItem('floatingButtonPositions') || '{}');
    const floatingBtns = document.querySelectorAll('.floating-btn');

    floatingBtns.forEach(btn => {
        const btnId = btn.id;
        if (btnId && positions[btnId]) {
            btn.style.left = positions[btnId].left;
            btn.style.top = positions[btnId].top;
            btn.style.right = 'auto';
            btn.style.bottom = 'auto';
        }
    });
}

// ===== FLOATING BUTTON DRAG & DROP =====

export function initFloatingButtonsDragDrop() {
    const floatingBtns = document.querySelectorAll('.floating-btn');
    let draggedElement = null;
    let offset = { x: 0, y: 0 };
    let isDraggingEnabled = false;
    let holdTimer = null;
    const holdDuration = 2000;

    loadButtonPositions();

    floatingBtns.forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            startDrag(e, e.clientX, e.clientY);
        });

        btn.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            startDrag(e, touch.clientX, touch.clientY);
        });

        btn.addEventListener('click', (e) => {
            if (isDraggingEnabled) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }, true);

        function startDrag(_e, clientX, clientY) {
            draggedElement = btn;
            isDraggingEnabled = false;

            const rect = btn.getBoundingClientRect();
            offset.x = clientX - rect.left;
            offset.y = clientY - rect.top;

            holdTimer = setTimeout(() => {
                isDraggingEnabled = true;
                draggedElement.classList.add('dragging');
                if (navigator.vibrate) navigator.vibrate(50);
            }, holdDuration);
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (draggedElement && isDraggingEnabled) {
            moveDrag(e.clientX, e.clientY);
        }
    });

    document.addEventListener('touchmove', (e) => {
        if (draggedElement && isDraggingEnabled) {
            const touch = e.touches[0];
            moveDrag(touch.clientX, touch.clientY);
            e.preventDefault();
        }
    }, { passive: false });

    function moveDrag(clientX, clientY) {
        draggedElement.style.left = (clientX - offset.x) + 'px';
        draggedElement.style.top = (clientY - offset.y) + 'px';
        draggedElement.style.right = 'auto';
        draggedElement.style.bottom = 'auto';
    }

    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);

    function endDrag() {
        if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
        }

        if (draggedElement) {
            draggedElement.classList.remove('dragging');

            if (isDraggingEnabled) {
                saveButtonPosition(draggedElement);
            }

            draggedElement = null;

            setTimeout(() => {
                isDraggingEnabled = false;
            }, 100);
        }
    }
}
