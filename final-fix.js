const fs = require('fs');
const path = 'C:/Users/micha/source/repos/analiza-parlamentarna-BACKUP/index.html';

const buffer = fs.readFileSync(path);
let content = buffer.toString('utf8');

// Find exact position and insert
const marker = '<!-- ETL PANEL -->';
const markerPos = content.indexOf(marker);

if (markerPos > -1) {
    console.log('✅ Found marker at position:', markerPos);
    
    // Find the next line after marker
    const afterMarker = markerPos + marker.length;
    const nextNewline = content.indexOf('\n', afterMarker);
    
    // Insert header after the newline
    const header = `            <h2 style="margin-bottom: 1.5rem; color: #2d3748; font-size: 1.8rem;">
                📥 Import Danych z API Sejmu
            </h2>
            
`;
    
    const before = content.substring(0, nextNewline + 1);
    const after = content.substring(nextNewline + 1);
    
    content = before + header + after;
    
    // Preserve BOM
    const BOM = '\uFEFF';
    const finalContent = content.startsWith(BOM) ? content : BOM + content;
    
    fs.writeFileSync(path, finalContent, 'utf8');
    console.log('✅ Header added successfully!');
} else {
    console.log('❌ Marker not found');
}
