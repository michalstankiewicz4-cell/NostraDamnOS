const fs = require('fs');

const filePath = 'C:/Users/micha/source/repos/analiza-parlamentarna-BACKUP/index.html';

let content = fs.readFileSync(filePath, 'utf8');

const oldText = `        <main>\r
            <!-- ETL PANEL -->\r
            <div class="etl-panel">`;

const newText = `        <main>\r
            <!-- ETL PANEL -->\r
            <h2 style="margin-bottom: 1.5rem; color: #2d3748; font-size: 1.8rem;">\r
                📥 Import Danych z API Sejmu\r
            </h2>\r
            \r
            <div class="etl-panel">`;

content = content.replace(oldText, newText);

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Header added successfully!');
