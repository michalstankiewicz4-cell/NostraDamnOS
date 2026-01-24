const fs = require('fs');

const filePath = 'C:/Users/micha/source/repos/analiza-parlamentarna-BACKUP/index.html';

let content = fs.readFileSync(filePath, 'utf8');

// Znalezienie dokładnego miejsca i dodanie nagłówka
const searchText = '        <main>\r\n            <!-- ETL PANEL -->\r\n            <div class="etl-panel">';
const replacement = '        <main>\r\n            <!-- ETL PANEL -->\r\n            <h2 style="margin-bottom: 1.5rem; color: #2d3748; font-size: 1.8rem;">\r\n                📥 Import Danych z API Sejmu\r\n            </h2>\r\n            \r\n            <div class="etl-panel">';

if (content.includes(searchText)) {
    content = content.replace(searchText, replacement);
    fs.writeFileSync(filePath, content, {encoding: 'utf8', flag: 'w'});
    console.log('✅ Header added!');
} else {
    console.log('❌ Pattern not found');
    // Try with just \n
    const searchText2 = '        <main>\n            <!-- ETL PANEL -->\n            <div class="etl-panel">';
    const replacement2 = '        <main>\n            <!-- ETL PANEL -->\n            <h2 style="margin-bottom: 1.5rem; color: #2d3748; font-size: 1.8rem;">\n                📥 Import Danych z API Sejmu\n            </h2>\n            \n            <div class="etl-panel">';
    
    if (content.includes(searchText2)) {
        content = content.replace(searchText2, replacement2);
        fs.writeFileSync(filePath, content, {encoding: 'utf8', flag: 'w'});
        console.log('✅ Header added (LF)!');
    }
}
