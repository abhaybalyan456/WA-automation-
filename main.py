import os
import time
from threading import Thread
from datetime import datetime
from flask import Flask
import pywhatkit

# 1. THE WEB ENGINE (Keeps Render happy)
app = Flask(__name__)
@app.route('/')
def home(): return "WhatsApp Cloud Trigger Active!"

def run_server():
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))

# 2. YOUR 1:00 AM TRIGGER
def whatsapp_clock():
    print("Cloud clock is ticking...")

    # ─── CHANGE THESE VALUES ───
    GROUP_ID = "https://chat.whatsapp.com/LSkMghci3cPLoWtzR4d8gj"  # Put your group invite link ID here
    MESSAGE = "GN bhai log!"
    # ───────────────────────────

    msg_sent = False
    while True:
        now = datetime.now()
        # 1:00 AM is hour 1 and minute 0
        if now.hour == 1 and now.minute == 0 and not msg_sent:
            print("It is 1:00 AM! Launching WhatsApp cloud delivery...")
            pywhatkit.sendwhatmsg_to_group(GROUP_ID, MESSAGE, 1, 1, wait_time=15)
            msg_sent = True

        if now.hour == 2: # Reset for the next day just in case
            msg_sent = False

        time.sleep(10)

if __name__ == "__main__":
    Thread(target=run_server, daemon=True).start()
    whatsapp_clock()
