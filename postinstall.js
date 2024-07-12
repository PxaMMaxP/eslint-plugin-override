const { execSync } = require('child_process');
const path = require('path');
// Only run the script when executed in the root directory
if (process.cwd() === path.resolve(__dirname)) {
    console.log('Running npm install --legacy-peer-deps...');
    execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
} else {
    console.log('Skipping npm install --legacy-peer-deps...');
}