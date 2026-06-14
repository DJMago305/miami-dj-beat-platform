const fs = require('fs');
let js = fs.readFileSync('web/js/rentals.js', 'utf8');

js = js.replace(
    /if \(cat === 'dj'\) groups\['DJ \/ Performance Talent'\] \+= lineTotal;/,
    `if (cat === 'dj' || item.id.startsWith('dj_')) groups['DJ / Performance Talent'] += lineTotal;`
);

fs.writeFileSync('web/js/rentals.js', js);
console.log("rentals.js DJ subcategories updated!");
