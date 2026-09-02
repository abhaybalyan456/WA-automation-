const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Variables to keep track of state
let latestQrData = null;
let connectionStatus = 'Disconnected. Waiting for QR generation...';
let sockInstance = null;

// 1. CONFIGURATION: SET YOUR MESSAGE TARGET
const GROUP_ID = "https://chat.whatsapp.com/LSkMghci3cPLoWtzR4d8gj"; // Put your ://whatsapp.com characters here
const MESSAGE = "gn bhai log!!";

// 2. THE WEB FRONTEND UI (HTML Page with Refresh button)
app.get('/', async (req, res) => {
    if (connectionStatus === 'CONNECTED') {
        return res.send(`
            <style>body { font-family: sans-serif; text-align: center; padding-top: 50px; background: #f0f2f5; }</style>
            <h2>🎉 Connected!</h2>
            <p>Your WhatsApp automation server is active. You can close this webpage now.</p>
        `);
    }

    if (!latestQrData) {
        return res.send(`
            <style>body { font-family: sans-serif; text-align: center; padding-top: 50px; }</style>
            <h2>Generating QR Code...</h2>
            <p>Please refresh the page in 5 seconds.</p>
            <script>setTimeout(() => location.reload(), 5000);</script>
        `);
    }

    try {
        // Convert the raw WhatsApp string into a scannable Web Image
        const qrImageSrc = await QRCode.toDataURL(latestQrData);
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp Cloud Link</title>
                <style>
                    body { font-family: sans-serif; text-align: center; padding: 40px; background: #fafafa; color: #333; }
                    .card { background: white; max-width: 400px; margin: 0 auto; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                    button { background: #007bff; color: white; border: none; padding: 10px 20px; font-size: 16px; border-radius: 4px; cursor: pointer; margin-top: 20px; }
                    button:hover { background: #0056b3; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>Link Your WhatsApp</h2>
                    <p>Status: <strong>${connectionStatus}</strong></p>
                    <img src="${qrImageSrc}" alt="WhatsApp QR Code" style="width: 250px; height: 250px;" />
                    <p style="font-size: 14px; color: #666;">Open WhatsApp > Linked Devices > Link a Device</p>
                    <button onclick="location.reload()">🔄 Refresh QR Code</button>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send('Error rendering QR image.');
    }
});

// 3. WHATSAPP CONNECTION CORE ENGINE
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sockInstance = makeWASocket({
        auth: state,
        printQRInTerminal: true // Still leaves it in logs as a fallback backup
    });

    sockInstance.ev.on('creds.update', saveCreds);

    sockInstance.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // Catch the real-time changing QR string data
        if (qr) {
            latestQrData = qr;
            connectionStatus = 'Scan ready. Code refreshes every 20 seconds.';
        }
        
        if (connection === 'close') {
            latestQrData = null;
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            connectionStatus = 'Reconnecting...';
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            latestQrData = null; // Clear QR data once linked
            connectionStatus = 'CONNECTED';
            console.log('🎉 SUCCESSFULLY CONNECTED TO WHATSAPP CLOUD!');
            startClockLoop(sockInstance);
        }
    });
}

// 4. BACKGROUND 1:00 AM TIMER LOOP
function startClockLoop(sock) {
    console.log("Cloud scheduler active. Monitoring for 1:00 AM target...");
    let msgSentToday = false;

    setInterval(async () => {
        // Keeps time context natively fixed to Indian Standard Time (IST)
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

        // Reset system flags at 2:00 AM to prepare for tomorrow's run
        if (currentHour === 2) {
            msgSentToday = false;
        }
    }, 10000); // Check the system clock array loops every 10 seconds
}

// 5. START SERVER
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web application hosted on port ${PORT}`);
    connectToWhatsApp();
});
