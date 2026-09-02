const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.urlencoded({ extended: true }));

// Global System Variables
let latestQrData = null;
let connectionStatus = 'Disconnected. Waiting for QR generation...';
let sockInstance = null;
let msgSentToday = false;

// ─── YOUR TARGET GROUP PRE-CONFIGURED ───
const GROUP_ID = "LSkMghci3cPLoWtzR4d8gj"; 

// Dynamic Settings (Changeable from the website)
let targetMessage = "Hey everyone! This is the message scheduled from the cloud.";
let targetHour = 1;   // Default 1 AM
let targetMinute = 0;  // Default 00 mins

// 1. THE VISUAL INTERFACE (Dashboard + Configurations)
app.get('/', async (req, res) => {
    let qrSection = '';
    
    if (connectionStatus === 'CONNECTED') {
        qrSection = `<div style="background:#e3fcef;color:#137333;padding:15px;border-radius:6px;font-weight:bold;margin-bottom:20px;">🎉 Connected to WhatsApp Cloud!</div>`;
    } else if (!latestQrData) {
        qrSection = `<div><h3>Generating QR Code...</h3><p>Please refresh in 5 seconds.</p><script>setTimeout(() => location.reload(), 5000);</script></div>`;
    } else {
        try {
            const qrImageSrc = await QRCode.toDataURL(latestQrData);
            qrSection = `
                <h3>Link Your WhatsApp Account</h3>
                <p>Status: <span style="color:#007bff;font-weight:bold;">${connectionStatus}</span></p>
                <img src="${qrImageSrc}" alt="WhatsApp QR Code" style="width: 220px; height: 220px; border:1px solid #ccc; padding:5px;" />
                <p style="font-size: 13px; color: #666; margin-top:5px;">Open WhatsApp > Linked Devices > Link a Device</p>
                <button type="button" onclick="location.reload()" style="background:#6c757d;margin-top:10px;">🔄 Refresh QR Code</button>
            `;
        } catch (err) {
            qrSection = `<p>Error creating QR code display image.</p>`;
        }
    }

    // Format display padding time
    const displayHour = String(targetHour).padStart(2, '0');
    const displayMin = String(targetMinute).padStart(2, '0');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Cloud Controller</title>
            <style>
                body { font-family: -apple-system, sans-serif; background: #f0f2f5; padding: 30px; display: flex; justify-content: center; }
                .container { background: white; max-width: 500px; width: 100%; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                h2 { color: #075e54; margin-top: 0; text-align: center; }
                .section { border: 1px solid #e1e4e8; padding: 20px; border-radius: 8px; margin-bottom: 20px; background: #fafbfc; }
                label { display: block; font-weight: bold; margin-bottom: 8px; color: #4a4a4a; }
                input[type="text"], input[type="time"] { width: 95%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 15px; margin-bottom: 15px; }
                button { width: 100%; background: #25d366; color: white; border: none; padding: 12px; font-size: 16px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; }
                button:hover { background: #20ba5a; }
                .info-text { font-size: 14px; background: #e8f0fe; color: #1a73e8; padding: 10px; border-radius: 6px; margin-bottom: 15px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>WhatsApp Cloud Scheduler</h2>
                
                <!-- QR Code Connection Section -->
                <div class="section" style="text-align: center;">
                    ${qrSection}
                </div>

                <!-- Settings Configuration Section -->
                <div class="section">
                    <h3>Message Settings</h3>
                    <div class="info-text">
                        Target Group ID: <strong>${GROUP_ID}</strong> (Loaded)<br>
                        Current Queue: <strong>${displayHour}:${displayMin} (IST)</strong>
                    </div>
                    
                    <form action="/save-settings" method="POST">
                        <label>Select Send Time (24-Hour Format):</label>
                        <input type="time" name="scheduled_time" value="${displayHour}:${displayMin}" required>
                        
                        <label>Your Message Text:</label>
                        <input type="text" name="message_text" value="${targetMessage}" required placeholder="Type group message here...">
                        
                        <button type="submit">💾 Save & Update Queue</button>
                    </form>
                </div>
            </div>
        </body>
        </html>
    `);
});

// 2. SAVE CONFIGURATIONS PATHWAY
app.post('/save-settings', (req, res) => {
    const { scheduled_time, message_text } = req.body;
    
    if (scheduled_time && message_text) {
        const [hourStr, minStr] = scheduled_time.split(':');
        targetHour = parseInt(hourStr, 10);
        targetMinute = parseInt(minStr, 10);
        targetMessage = message_text;
        msgSentToday = false; // Reset lock to allow the new timeframe configuration to execute
        console.log(`Settings updated! New target: ${targetHour}:${targetMinute} | Text: "${targetMessage}"`);
    }
    res.redirect('/');
});

// 3. WHATSAPP CONNECTION ENGINE
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sockInstance = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sockInstance.ev.on('creds.update', saveCreds);

    sockInstance.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            latestQrData = qr;
            connectionStatus = 'Scan ready. Code refreshes every 20 seconds.';
        }
        
        if (connection === 'close') {
            latestQrData = null;
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            connectionStatus = 'Reconnecting...';
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            latestQrData = null;
            connectionStatus = 'CONNECTED';
            console.log('🎉 SUCCESSFULLY CONNECTED TO WHATSAPP CLOUD!');
            startClockLoop();
        }
    });
}

// 4. BACKGROUND TIMER LOOP
function startClockLoop() {
    console.log("Cloud monitoring engine started.");

    setInterval(async () => {
        if (connectionStatus !== 'CONNECTED' || !sockInstance) return;

        // Force clock calculation to align with Indian Standard Time (IST)
        const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        // Match user values
        if (currentHour === targetHour && currentMinute === targetMinute && !msgSentToday) {
            console.log(`Time matched (${currentHour}:${currentMinute})! Dispatching message to group...`);
            try {
                await sockInstance.sendMessage(`${GROUP_ID}@g.us`, { text: targetMessage });
                console.log("Message delivered successfully!");
                msgSentToday = true;
            } catch (error) {
                console.error("Failed to send message: ", error);
            }
        }

        // Auto reset verification flag 1 hour later
        if (currentHour === (targetHour + 1) % 24) {
            msgSentToday = false;
        }
    }, 10000); // Clock refresh sweep loops every 10 seconds
}

// 5. START SERVER
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web application dashboard live on port ${PORT}`);
    connectToWhatsApp();
});
