$path = 'C:\Users\micha\source\repos\analiza-parlamentarna-BACKUP\index.html'
$output = 'C:\Users\micha\source\repos\analiza-parlamentarna-BACKUP\index-new.html'
$content = Get-Content $path -Raw

# Pattern to find
$old = @'
        <main>
            <!-- ETL PANEL -->
            <div class="etl-panel">
'@

# Replacement
$new = @'
        <main>
            <!-- ETL PANEL -->
            <h2 style="margin-bottom: 1.5rem; color: #2d3748; font-size: 1.8rem;">
                📥 Import Danych z API Sejmu
            </h2>
            
            <div class="etl-panel">
'@

# Replace
$content = $content.Replace($old, $new)

# Save to new file
Set-Content $output $content -NoNewline -Encoding UTF8

Write-Output "✅ Saved to index-new.html - now replacing..."

# Replace original
Start-Sleep -Seconds 1
Remove-Item $path -Force
Rename-Item $output $path

Write-Output "✅ Done!"
