const fs = require('fs');
const path = 'C:/Users/micha/source/repos/analiza-parlamentarna-BACKUP/style.css';

let content = fs.readFileSync(path, 'utf8');

// Replace sidebar height
content = content.replace(
    /\.etl-sidebar \{([^}]*?)max-height: 80vh;/s,
    '.etl-sidebar {$1max-height: 50vh;'
);

// Replace main height
content = content.replace(
    /\.etl-main \{([^}]*?)max-height: 80vh;/s,
    '.etl-main {$1max-height: 50vh;'
);

fs.writeFileSync(path, content, 'utf8');
console.log('✅ Heights changed: 80vh → 50vh');
