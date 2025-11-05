const { spawn } = require('child_process');
const path = require('path');

// Iniciar el servidor principal
const mainServer = spawn('node', ['server.js'], {
    stdio: 'inherit'
});

// Iniciar el servidor de grabaciones
const recordingServer = spawn('node', [path.join('camera-recorder-app', 'server', 'index.js')], {
    stdio: 'inherit'
});

process.on('SIGINT', () => {
    mainServer.kill();
    recordingServer.kill();
    process.exit();
});

mainServer.on('close', (code) => {
    console.log(`Servidor principal cerrado con código ${code}`);
});

recordingServer.on('close', (code) => {
    console.log(`Servidor de grabaciones cerrado con código ${code}`);
});