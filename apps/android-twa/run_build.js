const { spawn } = require('child_process');
const path = require('path');

// Add JDK 17 bin directory to PATH so keytool/gradle can be found
process.env.PATH = "C:\\Program Files\\Microsoft\\jdk-17.0.19.10-hotspot\\bin;" + process.env.PATH;

const bubblewrapBin = path.join(__dirname, 'node_modules', '@bubblewrap', 'cli', 'bin', 'bubblewrap.js');
console.log(`Spawning bubblewrap build...`);

const child = spawn('node', [bubblewrapBin, 'build'], {
    cwd: __dirname,
    env: process.env,
    stdio: ['pipe', 'pipe', 'inherit'] // Pipe stdin and stdout, inherit stderr
});

child.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);

    if (output.includes('Password for the Key Store:')) {
        console.log('\n[Auto-Responder] Sending Key Store Password');
        child.stdin.write('dressapp\n');
    }
    
    if (output.includes('Password for the Key:')) {
        console.log('\n[Auto-Responder] Sending Key Password');
        child.stdin.write('dressapp\n');
    }
});

child.on('close', (code) => {
    console.log(`bubblewrap build process exited with code ${code}`);
    process.exit(code);
});
