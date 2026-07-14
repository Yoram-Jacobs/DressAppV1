const { spawn } = require('child_process');
const path = require('path');

// Add JDK 17 bin directory to PATH so keytool can be found
process.env.PATH = "C:\\Program Files\\Microsoft\\jdk-17.0.19.10-hotspot\\bin;" + process.env.PATH;

const bubblewrapBin = path.join(__dirname, 'node_modules', '@bubblewrap', 'cli', 'bin', 'bubblewrap.js');
console.log(`Spawning bubblewrap update...`);

const child = spawn('node', [bubblewrapBin, 'update'], {
    cwd: __dirname,
    env: process.env,
    stdio: ['pipe', 'pipe', 'inherit'] // Pipe stdin and stdout, inherit stderr
});

child.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);

    if (output.includes('versionName for the new App version:')) {
        console.log('\n[Auto-Responder] Sending versionName: 1.0.0');
        child.stdin.write('1.0.0\n');
    }
    
    if (output.includes('versionCode for the new App version:')) {
        console.log('\n[Auto-Responder] Sending versionCode: 1');
        child.stdin.write('1\n');
    }
});

child.on('close', (code) => {
    console.log(`bubblewrap update process exited with code ${code}`);
    process.exit(code);
});
