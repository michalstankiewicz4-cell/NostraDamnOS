# Fix encoding and add database buttons
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$htmlPath = "C:\Users\micha\source\repos\NostraDamnOS\index.html"

# Read original file
$content = [System.IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)

# Define buttons HTML
$buttonsHtml = @"

    <!-- Database Import/Export Buttons -->
    <button id="importDbBtn" style="position: fixed; bottom: 160px; right: 20px; width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; font-size: 24px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 1000; transition: all 0.2s;" title="Import bazy danych">
        📥
    </button>

    <button id="exportDbBtn" style="position: fixed; bottom: 90px; right: 20px; width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; font-size: 24px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 1000; transition: all 0.2s;" title="Export bazy danych">
        📤
    </button>
"@

# Define hover effects
$hoverScript = @"

        // Database buttons hover effects
        const importDbBtn = document.getElementById('importDbBtn');
        const exportDbBtn = document.getElementById('exportDbBtn');
        
        if (importDbBtn) {
            importDbBtn.addEventListener('mouseenter', () => {
                importDbBtn.style.transform = 'scale(1.1)';
            });
            importDbBtn.addEventListener('mouseleave', () => {
                importDbBtn.style.transform = 'scale(1)';
            });
        }
        
        if (exportDbBtn) {
            exportDbBtn.addEventListener('mouseenter', () => {
                exportDbBtn.style.transform = 'scale(1.1)';
            });
            exportDbBtn.addEventListener('mouseleave', () => {
                exportDbBtn.style.transform = 'scale(1)';
            });
        }
        
"@

$moduleImport = @"

    <!-- Database Import/Export Logic -->
    <script type="module">
        import { initDbButtons } from './modules/db-buttons.js';
        initDbButtons();
    </script>
"@

# Add buttons before "<!-- Floating Console Button -->"
$content = $content -replace '(    <!-- Floating Console Button -->)', "$buttonsHtml`r`n`$1"

# Add hover effects after "const helpBtn = document.getElementById('helpBtn');"
$content = $content -replace "(        const helpBtn = document.getElementById\('helpBtn'\);)", "`$1`r`n$hoverScript"

# Add module import before "</body>"
$content = $content -replace '(</body>)', "$moduleImport`r`n`$1"

# Write with UTF-8 BOM
[System.IO.File]::WriteAllText($htmlPath, $content, [System.Text.Encoding]::UTF8)

Write-Host "Done!" -ForegroundColor Green
