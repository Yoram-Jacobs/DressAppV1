const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Add JDK 17 bin directory to PATH so keytool/gradle can be found
process.env.PATH = "C:\\Program Files\\Microsoft\\jdk-17.0.19.10-hotspot\\bin;" + process.env.PATH;

// Print home directory and config file contents to verify
const userHome = process.env.USERPROFILE || process.env.HOME;
const configPath = path.join(userHome, '.bubblewrap', 'config.json');
console.log(`User Home: ${userHome}`);
console.log(`Config Path: ${configPath}`);
if (fs.existsSync(configPath)) {
    console.log(`Config Content: ${fs.readFileSync(configPath, 'utf8')}`);
} else {
    console.log(`Config file does not exist!`);
}

const bubblewrapBin = path.join(__dirname, 'node_modules', '@bubblewrap', 'cli', 'bin', 'bubblewrap.js');

function runCommand(args) {
    return new Promise((resolve) => {
        console.log(`Spawning bubblewrap ${args.join(' ')}...`);
        const child = spawn('node', [bubblewrapBin, ...args], {
            cwd: __dirname,
            env: process.env,
            stdio: ['pipe', 'pipe', 'inherit']
        });

        child.stdout.on('data', (data) => {
            const output = data.toString();
            process.stdout.write(output);

            if (output.includes('Password for the Key Store:')) {
                child.stdin.write('dressapp\n');
            }
            if (output.includes('Password for the Key:')) {
                child.stdin.write('dressapp\n');
            }
        });

        child.on('close', (code) => {
            resolve(code);
        });
    });
}

async function main() {
    console.log("=== RUNNING DOCTOR ===");
    const doctorCode = await runCommand(['doctor']);
    console.log(`Doctor exited with code ${doctorCode}`);

    if (doctorCode === 0) {
        console.log("=== RUNNING BUILD ===");
        const buildCode = await runCommand(['build']);
        console.log(`Build exited with code ${buildCode}`);
        process.exit(buildCode);
    } else {
        process.exit(doctorCode);
    }
}

main();
