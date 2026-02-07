/**
 * Floating UI Drag & Drop + Memory Management Module
 * Handles:
 * - Floating button dragging and position persistence
 * - Tab card dragging and reordering
 * - UI mode persistence (localStorage)
 * - Position reset functionality
 */

// ===== TAB CARD DRAG & DROP + MEMORY =====

// Oryginalna kolejność zakładek z HTML (przed jakimkolwiek ładowaniem layoutu)
const originalTabOrder = [];

export function initTabCardsDragDrop() {
    const tabCards = document.querySelectorAll('.tab-card');
    const sidebar = document.getElementById('sidebar');
    const sidebarLeft = document.getElementById('sidebarLeft');

    // Zapisz oryginalną kolejność przed loadLayout
    if (originalTabOrder.length === 0) {
        tabCards.forEach(c => originalTabOrder.push(c.getAttribute('data-tab')));
    }

    loadLayout();

    tabCards.forEach(card => {
        const tabName = card.getAttribute('data-tab');
        let clickTimer = null;

        card.addEventListener('mousedown', startTabDrag);
        card.addEventListener('touchstart', startTabDrag);

        card.addEventListener('click', (e) => {
            if (card.classList.contains('dragging')) {
                card.classList.remove('dragging');
                return;
            }

            if (clickTimer) clearTimeout(clickTimer);
            clickTimer = setTimeout(() => {
                clickTimer = null;

                const isActive = card.classList.contains('active');

                if (isActive) {
                    card.classList.remove('active');
                } else {
                    tabCards.forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                }

                if (tabName === 'settings' && typeof toggleConsole === 'function') {
                    toggleConsole();
                }
            }, 250);
        });

        card.addEventListener('dblclick', (e) => {
            e.preventDefault();
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
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
            const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;

            if (draggedCard.parentNode !== dragContainer) {
                dragContainer = draggedCard.parentNode;
            }

            const children = Array.from(dragContainer.querySelectorAll('.tab-card, .tab-placeholder'));
            const currentIndex = children.indexOf(draggedCard);

            for (let i = 0; i < children.length; i++) {
                if (i === currentIndex) continue;
                const rect = children[i].getBoundingClientRect();
                if (clientY > rect.top && clientY < rect.bottom) {
                    if (i < currentIndex) {
                        dragContainer.insertBefore(draggedCard, children[i]);
                    } else {
                        dragContainer.insertBefore(draggedCard, children[i].nextSibling);
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
                saveLayout();
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
        const isOnRight = card.parentNode === sidebar;

        // Zapamiętaj indeks karty w źródłowym sidebarze
        const sourceChildren = Array.from(card.parentNode.querySelectorAll('.tab-card, .tab-placeholder'));
        const sourceIndex = sourceChildren.indexOf(card);

        // Placeholder w miejsce przenoszonej zakładki
        const placeholder = document.createElement('div');
        placeholder.className = 'tab-placeholder';
        placeholder.setAttribute('data-for', tabName);
        placeholder.style.height = card.offsetHeight + 'px';
        card.parentNode.insertBefore(placeholder, card);

        // Wyłącz transition na czas przenoszenia
        card.style.transition = 'none';
        card.classList.remove('active');

        // Przenieś na drugą stronę — prosta logika 6 slotów
        const targetSidebar = isOnRight ? sidebarLeft : sidebar;
        const targetChildren = Array.from(targetSidebar.querySelectorAll('.tab-card, .tab-placeholder'));

        // Sprawdź czy przeciwny slot (ten sam indeks) jest wolny (placeholder)
        const oppositeSlot = targetChildren[sourceIndex];
        if (oppositeSlot && oppositeSlot.classList.contains('tab-placeholder')) {
            // Przeciwny slot wolny — wstaw tam
            oppositeSlot.replaceWith(card);
        } else {
            // Przeciwny slot zajęty — znajdź pierwszy wolny (placeholder)
            const freeSlot = targetChildren.find(el => el.classList.contains('tab-placeholder'));
            if (freeSlot) {
                freeSlot.replaceWith(card);
            } else {
                // Brak wolnych slotów — dopisz na końcu
                targetSidebar.appendChild(card);
            }
        }

        if (isOnRight) {
            card.classList.add('tab-left');
        } else {
            card.classList.remove('tab-left');
        }

        // Przywróć transition po renderze
        requestAnimationFrame(() => {
            card.style.transition = '';
        });

        saveLayout();
    }

    function saveLayout() {
        function getItems(container) {
            return Array.from(container.children)
                .filter(el => el.classList.contains('tab-card') || el.classList.contains('tab-placeholder'))
                .map(el => {
                    if (el.classList.contains('tab-card')) return el.getAttribute('data-tab');
                    return 'ph:' + el.getAttribute('data-for');
                });
        }
        localStorage.setItem('sidebarLayout', JSON.stringify({
            right: getItems(sidebar),
            left: getItems(sidebarLeft)
        }));
    }

    function loadLayout() {
        const saved = localStorage.getItem('sidebarLayout');
        if (!saved) return;

        let layout;
        try {
            layout = JSON.parse(saved);
        } catch (e) {
            localStorage.removeItem('sidebarLayout');
            return;
        }

        const allCards = {};
        document.querySelectorAll('.tab-card').forEach(c => {
            allCards[c.getAttribute('data-tab')] = c;
        });

        function buildSidebar(container, items, isLeft) {
            items.forEach(item => {
                if (item.startsWith('ph:')) {
                    const ph = document.createElement('div');
                    ph.className = 'tab-placeholder';
                    ph.setAttribute('data-for', item.slice(3));
                    ph.style.height = '62px';
                    container.appendChild(ph);
                } else if (allCards[item]) {
                    container.appendChild(allCards[item]);
                    if (isLeft) {
                        allCards[item].classList.add('tab-left');
                    } else {
                        allCards[item].classList.remove('tab-left');
                    }
                }
            });
        }

        buildSidebar(sidebar, layout.right || [], false);
        buildSidebar(sidebarLeft, layout.left || [], true);

        // Dopasuj wysokość placeholderów do prawdziwej wysokości karty
        const anyCard = document.querySelector('.tab-card');
        if (anyCard) {
            const h = anyCard.offsetHeight + 'px';
            document.querySelectorAll('.tab-placeholder').forEach(ph => ph.style.height = h);
        }
    }
}

export function resetTabsLayout() {
    const sidebar = document.getElementById('sidebar');

    localStorage.removeItem('sidebarLayout');
    localStorage.removeItem('tabOrder');
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('tabSide-')) localStorage.removeItem(key);
    });

    document.querySelectorAll('.tab-placeholder').forEach(p => p.remove());

    // Przywróć oryginalną kolejność z HTML
    originalTabOrder.forEach(tabName => {
        const card = document.querySelector(`.tab-card[data-tab="${tabName}"]`);
        if (card) {
            sidebar.appendChild(card);
            card.classList.remove('tab-left', 'active');
        }
    });
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
    const aiChatBtn = document.getElementById('aiChatBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarLeft = document.getElementById('sidebarLeft');

    const toolsButtons = [importDbBtn, exportDbBtn, cleanRodoBtn, languageBtn, helpBtn, aiChatBtn];

    const updateUIMode = () => {
        if (uiMode === 1) {
            toolsButtons.forEach(btn => {
                if (btn) btn.style.display = 'flex';
            });
            if (sidebar) sidebar.style.display = 'flex';
            if (sidebarLeft) sidebarLeft.style.display = 'flex';
            toggleUIBtn.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
            toggleUIBtn.title = 'Stan 1: Przyciski + Zakładki';
        } else if (uiMode === 2) {
            toolsButtons.forEach(btn => {
                if (btn) btn.style.display = 'flex';
            });
            if (sidebar) sidebar.style.display = 'none';
            if (sidebarLeft) sidebarLeft.style.display = 'none';
            toggleUIBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
            toggleUIBtn.title = 'Stan 2: Tylko Przyciski';
        } else if (uiMode === 3) {
            toolsButtons.forEach(btn => {
                if (btn) btn.style.display = 'none';
            });
            if (sidebar) sidebar.style.display = 'flex';
            if (sidebarLeft) sidebarLeft.style.display = 'flex';
            toggleUIBtn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
            toggleUIBtn.title = 'Stan 3: Tylko Zakładki';
        } else {
            toolsButtons.forEach(btn => {
                if (btn) btn.style.display = 'none';
            });
            if (sidebar) sidebar.style.display = 'none';
            if (sidebarLeft) sidebarLeft.style.display = 'none';
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
