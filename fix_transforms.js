const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/certificate-template.tsx', 'utf8');

// Regex to safely remove transform property inside style objects
code = code.replace(/,\s*transform:\s*'[^']+'/g, '');
code = code.replace(/transform:\s*'[^']+',?\s*/g, '');

fs.writeFileSync('frontend/src/components/certificate-template.tsx', code);
