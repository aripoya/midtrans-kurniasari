const fs = require('fs');
const path = require('path');

// Path to worker.js
const filePath = path.join(__dirname, 'src', 'worker.js');

// Read the file
let content = fs.readFileSync(filePath, 'utf-8');

// Replace all instances of 'request.corsHeaders = corsHeaders;' with 'request.corsHeaders = corsHeaders(request);'
content = content.replace(/request\.corsHeaders = corsHeaders;/g, 'request.corsHeaders = corsHeaders(request);');

// Replace other instances of corsHeaders
content = content.replace(/headers: \{ ['"]Content-Type['"]: ['"]application\/json['"], ...corsHeaders \}/g, 'headers: { \'Content-Type\': \'application/json\', ...corsHeaders(request) }');
content = content.replace(/headers: \{ ['"]Content-Type['"]: ['"]application\/json['"], ...errorCorsHeaders \}/g, 'headers: { \'Content-Type\': \'application/json\', ...errorCorsHeaders }');

// Update the error handler section to use corsHeaders as a function
content = content.replace(
    /const errorCorsHeaders = corsHeaders \|\| \{[^}]+\};/g, 
    'const errorCorsHeaders = request ? corsHeaders(request) : {\n' +
    '                \'Access-Control-Allow-Origin\': \'https://tagihan.kurniasari.co.id\',\n' +
    '                \'Vary\': \'Origin\',\n' +
    '                \'Access-Control-Allow-Methods\': \'GET, POST, PUT, DELETE, OPTIONS\',\n' +
    '                \'Access-Control-Allow-Headers\': \'Content-Type, Authorization\',\n' +
    '            };'
);

// Write the updated content back to the file
fs.writeFileSync(filePath, content);

console.log('Successfully updated corsHeaders references in worker.js');
