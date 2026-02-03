// Keyboard toggle for database import/export buttons
// Toggles visibility of import/export icons with Shift+P, but only when console is open

(function() {
    console.log('[Keyboard Toggle] Initializing Shift+P toggle for DB buttons...');
    
    // Track visibility state
    let iconsVisible = true;
    
    // Add keyboard event listener
    document.addEventListener('keydown', (e) => {
        // Check if Shift+P is pressed
        if (e.shiftKey && e.key === 'P') {
            e.preventDefault();
            
            // Check if floating console is currently open
            const floatingPanel = document.getElementById('floatingConsolePanel');
            if (!floatingPanel) {
                console.log('[Keyboard Toggle] Console panel not found - ignoring Shift+P');
                return;
            }
            
            // Check computed style to handle CSS classes and stylesheets
            const computedDisplay = window.getComputedStyle(floatingPanel).display;
            if (computedDisplay === 'none') {
                console.log('[Keyboard Toggle] Console is closed - ignoring Shift+P');
                return;
            }
            
            // Get the import/export buttons
            const importBtn = document.getElementById('importDbBtn');
            const exportBtn = document.getElementById('exportDbBtn');
            
            if (!importBtn || !exportBtn) {
                console.error('[Keyboard Toggle] DB buttons not found in DOM');
                return;
            }
            
            // Toggle visibility
            iconsVisible = !iconsVisible;
            const displayValue = iconsVisible ? 'block' : 'none';
            
            importBtn.style.display = displayValue;
            exportBtn.style.display = displayValue;
            
            console.log(`[Keyboard Toggle] DB buttons ${iconsVisible ? 'shown' : 'hidden'}`);
        }
    });
    
    console.log('[Keyboard Toggle] ✅ Shift+P toggle initialized');
})();
