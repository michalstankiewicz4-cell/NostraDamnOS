/**
 * Floating UI Drag & Drop + Memory Management Module
 * Handles:
 * - Floating button dragging and position persistence
 * - UI visibility management (localStorage)
 * - Position reset functionality
 */

// Legacy stubs (tab system removed)
export function initTabCardsDragDrop() {}
export function resetTabsLayout() {
    localStorage.removeItem('sidebarLayout');
    localStorage.removeItem('tabOrder');
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('tabSide-')) localStorage.removeItem(key);
    });
}

// ===== UI MODE MANAGEMENT =====

export function initUIMode() {
    const toggleUIBtn = document.getElementById('toggleUIBtn');
    const uiHoldProgress = document.getElementById('uiHoldProgress');
    const uiHoldProgressBar = document.getElementById('uiHoldProgressBar');

    if (!toggleUIBtn) return;

    const holdDurationMs = 10000;
    let holdInterval = null;
    let holdProgress = 0;
    let holdActive = false;
    let holdTriggered = false;

    // Apply visibility from settings checkboxes
    const applyVisibility = () => {
        let vis = {};
        try {
            const saved = localStorage.getItem('uiVisibility');
            if (saved) vis = JSON.parse(saved);
        } catch { /* defaults */ }

        const btnIds = ['languageBtn', 'helpBtn', 'importDbBtn', 'exportDbBtn', 'aboutBtn', 'aiChatBtn'];
        btnIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = vis.floatingBtns !== false ? 'flex' : 'none';
        });
    };

    applyVisibility();
    window._updateUIMode = applyVisibility;

    // Click → navigate to Settings (section 5)
    toggleUIBtn.addEventListener('click', (e) => {
        if (holdTriggered) {
            holdTriggered = false;
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        toggleUIBtn.style.transform = 'scale(0.9)';
        setTimeout(() => toggleUIBtn.style.transform = 'scale(1)', 200);

        const settingsNav = document.querySelector('.nav-item[data-section="5"]');
        if (settingsNav) settingsNav.click();
    });

    // Hold 10s → reset positions
    const showHoldProgress = () => {
        if (!uiHoldProgress || !uiHoldProgressBar) return;
        uiHoldProgress.style.display = 'block';
        uiHoldProgressBar.style.width = '0%';
    };

    const hideHoldProgress = () => {
        if (!uiHoldProgress || !uiHoldProgressBar) return;
        uiHoldProgress.style.display = 'none';
        uiHoldProgressBar.style.width = '0%';
    };

    const startHold = (e) => {
        if (e.type === 'mousedown' && e.button !== 0) return;
        if (holdActive) return;
        holdActive = true;
        holdProgress = 0;
        showHoldProgress();

        holdInterval = setInterval(() => {
            holdProgress += 100;
            const progress = Math.min(holdProgress / holdDurationMs, 1);
            if (uiHoldProgressBar) {
                uiHoldProgressBar.style.width = `${Math.round(progress * 100)}%`;
            }
            if (progress >= 1) {
                cancelHold();
                holdTriggered = true;
                resetFloatingButtonPositions();
                resetTabsLayout();
                applyVisibility();
            }
        }, 100);
    };

    const cancelHold = () => {
        if (!holdActive) return;
        holdActive = false;
        holdProgress = 0;
        if (holdInterval) {
            clearInterval(holdInterval);
            holdInterval = null;
        }
        hideHoldProgress();
    };

    toggleUIBtn.addEventListener('mousedown', startHold);
    toggleUIBtn.addEventListener('touchstart', startHold, { passive: true });
    toggleUIBtn.addEventListener('mouseleave', cancelHold);
    document.addEventListener('mouseup', cancelHold);
    document.addEventListener('touchend', cancelHold);
    document.addEventListener('touchcancel', cancelHold);
    window.addEventListener('blur', cancelHold);
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
        if (btn.id === 'toggleUIBtn') return;

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

        function startDrag(e, clientX, clientY) {
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
