const { spawn } = require('child_process');
const path = require('path');

// Add JDK 17 bin directory to PATH so keytool can be found
process.env.PATH = "C:\\Program Files\\Microsoft\\jdk-17.0.19.10-hotspot\\bin;" + process.env.PATH;

const child = spawn('npx', ['bubblewrap', 'update'], {
    cwd: __dirname,
    env: process.env,
    shell: true,
    stdio: ['pipe', 'pipe', 'inherit'] // Pipe stdin and stdout, inherit stderr
});

child.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);

    if (output.includes('versionName for the new App version:')) {
        console.log('\n[Auto-Responder] Sending versionName: 1.0.7');
        child.stdin.write('1.0.7\n');
    }
    
    if (output.includes('versionCode for the new App version:')) {
        console.log('\n[Auto-Responder] Sending versionCode: 8');
        child.stdin.write('8\n');
    }
});

child.on('close', (code) => {
    console.log(`bubblewrap update process exited with code ${code}`);
    process.exit(code);
});
