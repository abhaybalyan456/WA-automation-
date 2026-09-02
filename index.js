const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const http = require('http');

// 1. MINI ENGINE TO KEEP RENDER HAPPY
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WhatsApp Cloud Scheduler Engine Live!\n');
});
server.listen(process.env.PORT || 10000, '0.0.0.0', () => {
    console.log('Web dashboard engine initialized.');
});

// 2. CONFIGURATION: SET YOUR MESSAGE TARGET
const GROUP_ID = "https://chat.whatsapp.com/LSkMghci3cPLoWtzR4d8gj"; // Put your ://whatsapp.com characters here
const MESSAGE = "GN bhai log!!!";

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false // We use qrcode-terminal manually for a cleaner look
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('======= SCAN THIS QR CODE WITH YOUR PHONE =======');
            qrcode.generate(qr, { small: true });
            console.log('==================================================');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection dropped due to ', lastDisconnect?.error, ', reconnecting: ', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('🎉 SUCCESSFULLY CONNECTED TO WHATSAPP CLOUD!');
            startClockLoop(sock);
        }
    });
}

// 3. BACKGROUND 1:00 AM CLOCK LOOP
function startClockLoop(sock) {
    console.log("Cloud scheduler active. Standing by for 1:00 AM...");
    let msgSentToday = false;

    setInterval(async () => {
        // Get current time in Indian Standard Time (IST)
        const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        if (currentHour === 1 && currentMinute === 0 && !msgSentToday) {
            console.log("Time matched! Pushing message to group...");
            try {
                await sock.sendMessage(`${GROUP_ID}@g.us`, { text: MESSAGE });
                console.log("Message delivered successfully!");
                msgSentToday = true;
            } catch (error) {
                console.error("Failed to send message: ", error);
            }
        }

        // Reset flag at 2:00 AM for the next day
        if (currentHour === 2) {
            msgSentToday = false;
        }
    }, 10000); // Check the clock every 10 seconds
}

connectToWhatsApp();
