// Floating Buttons Drag and Drop - obsługa desktop i mobile
export function initFloatingButtonsDragDrop() {
    const floatingBtns = document.querySelectorAll('.floating-btn');
    let draggedElement = null;
    let offset = { x: 0, y: 0 };
    let isDraggingEnabled = false;
    let holdTimer = null;
    const holdDuration = 2000; // 2 sekundy

    floatingBtns.forEach(btn => {
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
            draggedElement = null;
            
            // Opóźnij reset isDraggingEnabled, żeby event click mógł go zobaczyć
            setTimeout(() => {
                isDraggingEnabled = false;
            }, 100);
        }
    }
}
