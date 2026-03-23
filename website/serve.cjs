const { execSync } = require('child_process');
execSync('npx astro dev --port 4321', { stdio: 'inherit', cwd: __dirname });
