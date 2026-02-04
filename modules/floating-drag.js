/**
 * Floating UI Drag & Drop + Memory Management Module
 * Handles:
 * - Floating button dragging and position persistence
 * - Tab card dragging and reordering
 * - UI mode persistence (localStorage)
 * - Position reset functionality
 */

// ===== TAB CARD DRAG & DROP + MEMORY =====

export function initTabCardsDragDrop() {
    const tabCards = document.querySelectorAll('.tab-card');
    const sidebar = document.getElementById('sidebar');
    const sidebarLeft = document.getElementById('sidebarLeft');
    const sidebarContent = document.getElementById('sidebarContent');

    // Wczytaj pozycje karteczek z localStorage
    loadTabPositions();

    tabCards.forEach((card) => {
        // Drag to reorder
        card.addEventListener('mousedown', startTabDrag);
        card.addEventListener('touchstart', startTabDrag);
    });

    // Single-click otwiera/zamyka, double-click zmienia stronę
    tabCards.forEach(card => {
        const tabName = card.getAttribute('data-tab');
        
        card.addEventListener('click', (e) => {
            // Jeśli to było przeciąganie, nie otwieraj
            if (card.classList.contains('dragging')) {
                card.classList.remove('dragging');
                return;
            }

            const isActive = card.classList.contains('active');
            
            if (isActive) {
                card.classList.remove('active');
                document.getElementById(`panel-${tabName}`)?.classList.remove('active');
            } else {
                tabCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                
                document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
                document.getElementById(`panel-${tabName}`)?.classList.add('active');
            }
        });
        
        // Double-click zmienia stronę karteczki
        card.addEventListener('dblclick', (e) => {
            e.preventDefault();
            toggleTabSide(card);
        });
    });

    function startTabDrag(e) {
        const card = e.currentTarget;
        let isDragging = false;
        let holdTimer = null;
        const holdDuration = 500;
        
        let draggedCard = card;
        let dragContainer = card.parentNode;
        
        function onMove(moveEvent) {
            if (!isDragging) return;
            
            moveEvent.preventDefault();
            const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
            
            if (draggedCard.parentNode !== dragContainer) {
                dragContainer = draggedCard.parentNode;
            }

            const currentCards = Array.from(dragContainer.querySelectorAll('.tab-card'));
            const currentIndex = currentCards.indexOf(draggedCard);

            for (let i = 0; i < currentCards.length; i++) {
                if (i === currentIndex) continue;
                const rect = currentCards[i].getBoundingClientRect();
                if (clientY > rect.top && clientY < rect.bottom) {
                    if (i < currentIndex) {
                        dragContainer.insertBefore(draggedCard, currentCards[i]);
                    } else {
                        dragContainer.insertBefore(draggedCard, currentCards[i].nextSibling);
                    }
                    break;
                }
            }
        }

        function onEnd() {
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
            
            card.classList.remove('dragging');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchend', onEnd);
            
            if (isDragging) {
                saveTabOrder();
            }
        }

        holdTimer = setTimeout(() => {
            isDragging = true;
            card.classList.add('dragging');
        }, holdDuration);

        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
    }

    function toggleTabSide(card) {
        const tabName = card.getAttribute('data-tab');
        const currentSide = localStorage.getItem(`tabSide-${tabName}`) || 'right';
        const newSide = currentSide === 'right' ? 'left' : 'right';
        
        localStorage.setItem(`tabSide-${tabName}`, newSide);
        
        if (newSide === 'left') {
            sidebarLeft.appendChild(card);
            card.classList.add('tab-left');
        } else {
            sidebar.appendChild(card);
            card.classList.remove('tab-left');
        }
        
        const panel = document.getElementById(`panel-${tabName}`);
        if (panel && panel.classList.contains('active')) {
            updateSidebarContentPosition();
        }
    }

    function updateSidebarContentPosition() {
        const activeCard = document.querySelector('.tab-card.active');
        if (!activeCard) return;
        
        const tabName = activeCard.getAttribute('data-tab');
        const side = localStorage.getItem(`tabSide-${tabName}`) || 'right';
        
        if (side === 'left') {
            sidebarContent.classList.add('sidebar-left');
        } else {
            sidebarContent.classList.remove('sidebar-left');
        }
    }

    function saveTabOrder() {
        const cards = Array.from(document.querySelectorAll('.tab-card'));
        const order = cards.map(card => card.getAttribute('data-tab'));
        localStorage.setItem('tabOrder', JSON.stringify(order));
    }

    function loadTabPositions() {
        const cards = document.querySelectorAll('.tab-card');
        
        cards.forEach(card => {
            const tabName = card.getAttribute('data-tab');
            const side = localStorage.getItem(`tabSide-${tabName}`) || 'right';
            
            if (side === 'left') {
                sidebarLeft.appendChild(card);
                card.classList.add('tab-left');
            } else {
                sidebar.appendChild(card);
                card.classList.remove('tab-left');
            }
        });
        
        const savedOrder = localStorage.getItem('tabOrder');
        if (savedOrder) {
            const order = JSON.parse(savedOrder);
            const rightCards = Array.from(sidebar.querySelectorAll('.tab-card'));
            const leftCards = Array.from(sidebarLeft.querySelectorAll('.tab-card'));
            
            order.forEach(tabName => {
                const card = rightCards.find(c => c.getAttribute('data-tab') === tabName) ||
                            leftCards.find(c => c.getAttribute('data-tab') === tabName);
                if (card) {
                    const parent = card.parentNode;
                    parent.appendChild(card);
                }
            });
        }
    }
}

export function resetTabsLayout() {
    const sidebar = document.getElementById('sidebar');
    const sidebarLeft = document.getElementById('sidebarLeft');
    const sidebarContent = document.getElementById('sidebarContent');
    const cards = document.querySelectorAll('.tab-card');

    localStorage.removeItem('tabOrder');
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('tabSide-')) {
            localStorage.removeItem(key);
        }
    });

    cards.forEach(card => {
        sidebar.appendChild(card);
        card.classList.remove('tab-left');
    });

    sidebarContent.classList.remove('sidebar-left');
}

// ===== UI MODE MANAGEMENT =====

export function initUIMode() {
    const toggleUIBtn = document.getElementById('toggleUIBtn');
    const uiHoldProgress = document.getElementById('uiHoldProgress');
    const uiHoldProgressBar = document.getElementById('uiHoldProgressBar');
    
    if (!toggleUIBtn) return;

    let uiMode = parseInt(localStorage.getItem('uiMode') || '0');
    const holdDurationMs = 10000;
    let holdInterval = null;
    let holdProgress = 0;
    let holdActive = false;
    let holdTriggered = false;

    const importDbBtn = document.getElementById('importDbBtn');
    const exportDbBtn = document.getElementById('exportDbBtn');
    const cleanRodoBtn = document.getElementById('cleanRodoBtn');
    const languageBtn = document.getElementById('languageBtn');
    const helpBtn = document.getElementById('helpBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarLeft = document.getElementById('sidebarLeft');
    const sidebarContent = document.getElementById('sidebarContent');

    const toolsButtons = [importDbBtn, exportDbBtn, cleanRodoBtn, languageBtn, helpBtn];

    const updateUIMode = () => {
        if (uiMode === 1) {
            toolsButtons.forEach(btn => {
                if (btn) btn.style.display = 'flex';
            });
            if (sidebar) sidebar.style.display = 'flex';
            if (sidebarLeft) sidebarLeft.style.display = 'flex';
            if (sidebarContent) sidebarContent.style.display = 'block';
            toggleUIBtn.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
            toggleUIBtn.title = 'Stan 1: Przyciski + Zakładki';
        } else if (uiMode === 2) {
            toolsButtons.forEach(btn => {
                if (btn) btn.style.display = 'flex';
            });
            if (sidebar) sidebar.style.display = 'none';
            if (sidebarLeft) sidebarLeft.style.display = 'none';
            if (sidebarContent) sidebarContent.style.display = 'none';
            toggleUIBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
            toggleUIBtn.title = 'Stan 2: Tylko Przyciski';
        } else if (uiMode === 3) {
            toolsButtons.forEach(btn => {
                if (btn) btn.style.display = 'none';
            });
            if (sidebar) sidebar.style.display = 'flex';
            if (sidebarLeft) sidebarLeft.style.display = 'flex';
            if (sidebarContent) sidebarContent.style.display = 'block';
            toggleUIBtn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
            toggleUIBtn.title = 'Stan 3: Tylko Zakładki';
        } else {
            toolsButtons.forEach(btn => {
                if (btn) btn.style.display = 'none';
            });
            if (sidebar) sidebar.style.display = 'none';
            if (sidebarLeft) sidebarLeft.style.display = 'none';
            if (sidebarContent) sidebarContent.style.display = 'none';
            toggleUIBtn.style.background = 'linear-gradient(135deg, #8b5cf6, #6d28d9)';
            toggleUIBtn.title = 'Stan 0: Tylko Status Bar';
        }
    };

    updateUIMode();

    toggleUIBtn.addEventListener('click', (e) => {
        if (holdTriggered) {
            holdTriggered = false;
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        toggleUIBtn.style.transform = 'scale(0.9)';
        setTimeout(() => toggleUIBtn.style.transform = 'scale(1)', 200);
        uiMode = (uiMode + 1) % 4;
        localStorage.setItem('uiMode', uiMode);
        updateUIMode();
    });

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
            holdProgress += 100; // +100ms co tick
            const progress = Math.min(holdProgress / holdDurationMs, 1);
            if (uiHoldProgressBar) {
                uiHoldProgressBar.style.width = `${Math.round(progress * 100)}%`;
            }

            if (progress >= 1) {
                cancelHold();
                holdTriggered = true;
                resetFloatingButtonPositions();
                resetTabsLayout();
                uiMode = 1;
                localStorage.setItem('uiMode', uiMode);
                updateUIMode();
            }
        }, 100); // Update co 100ms (10 razy na sekundę)
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

export function initFloatingButtonsDragDrop() {
    const floatingBtns = document.querySelectorAll('.floating-btn');
    let draggedElement = null;
    let offset = { x: 0, y: 0 };
    let isDraggingEnabled = false;
    let holdTimer = null;
    const holdDuration = 2000; // 2 sekundy

    // Wczytaj zapisane pozycje z localStorage
    loadButtonPositions();

    floatingBtns.forEach(btn => {
        // Pomiń toggleUIBtn - jest zablokowany przed przeciąganiem
        if (btn.id === 'toggleUIBtn') {
            return;
        }

        // Mouse events
        btn.addEventListener('mousedown', (e) => {
            startDrag(e, e.clientX, e.clientY);
        });

        // Touch events
        btn.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            startDrag(e, touch.clientX, touch.clientY);
        });

        // Prevent click if element was dragged
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

            // Start timer - po 2 sekundach włącz tryb przeciągania
            holdTimer = setTimeout(() => {
                isDraggingEnabled = true;
                draggedElement.classList.add('dragging');
                // Wibracja jeśli dostępna (działa na Android)
                if (navigator.vibrate) navigator.vibrate(50);
            }, holdDuration);
        }
    });

    // Mouse move
    document.addEventListener('mousemove', (e) => {
        if (draggedElement && isDraggingEnabled) {
            moveDrag(e.clientX, e.clientY);
        }
    });

    // Touch move
    document.addEventListener('touchmove', (e) => {
        if (draggedElement && isDraggingEnabled) {
            const touch = e.touches[0];
            moveDrag(touch.clientX, touch.clientY);
            e.preventDefault(); // Zapobiega scrollowaniu podczas drag
        }
    }, { passive: false });

    function moveDrag(clientX, clientY) {
        draggedElement.style.left = (clientX - offset.x) + 'px';
        draggedElement.style.top = (clientY - offset.y) + 'px';
        draggedElement.style.right = 'auto';
        draggedElement.style.bottom = 'auto';
    }

    // Mouse up
    document.addEventListener('mouseup', endDrag);

    // Touch end
    document.addEventListener('touchend', endDrag);

    function endDrag() {
        // Anuluj timer jeśli puścimy przed 2 sekundami
        if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
        }

        if (draggedElement) {
            draggedElement.classList.remove('dragging');
            
            // Zapisz pozycję przycisku do localStorage
            if (isDraggingEnabled) {
                saveButtonPosition(draggedElement);
            }
            
            draggedElement = null;
            
            // Opóźnij reset isDraggingEnabled, żeby event click mógł go zobaczyć
            setTimeout(() => {
                isDraggingEnabled = false;
            }, 100);
        }
    }
}
