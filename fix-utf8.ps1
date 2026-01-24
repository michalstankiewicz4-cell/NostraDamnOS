$ErrorActionPreference = "Stop"

$file = "C:\Users\micha\source\repos\analiza-parlamentarna-BACKUP\index.html"

# Read with UTF-8
$content = [System.IO.File]::ReadAllText($file, [System.Text.UTF8Encoding]::new($true))

$old = @"
        <main>
            <!-- ETL PANEL -->
            <div class="etl-panel">
"@

$new = @"
        <main>
            <!-- ETL PANEL -->
            <h2 style="margin-bottom: 1.5rem; color: #2d3748; font-size: 1.8rem;">
                📥 Import Danych z API Sejmu
            </h2>
            
            <div class="etl-panel">
"@

$content = $content.Replace($old, $new)

# Write with UTF-8 BOM
[System.IO.File]::WriteAllText($file, $content, [System.Text.UTF8Encoding]::new($true))

Write-Output "✅ Done! Encoding preserved."
