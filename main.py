import os
import time
from threading import Thread
from datetime import datetime
from flask import Flask
import requests

# 1. MINI WEB SERVER TO KEEP RENDER HAPPY
app = Flask(__name__)

@app.route('/')
def home():
    return "WhatsApp Cloud Trigger Active and Running Headless!"

def run_server():
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)

# 2. HEADLESS CLOUD SCHEDULER LOGIC
def whatsapp_cloud_clock():
    print("Headless cloud scheduler initialized...")
    
    # ─── CONFIGURATION: SET YOUR TRIGGER ───
    # Put your group invite link ID here (the characters after ://whatsapp.com)
    GROUP_ID = "https://chat.whatsapp.com/LSkMghci3cPLoWtzR4d8gj"  
    MESSAGE = "gn bhai log"
    # ───────────────────────────────────────
    
    msg_sent = False
    
    while True:
        now = datetime.now()
        
        # Check if it is exactly 1:00 AM
        if now.hour == 1 and now.minute == 0 and not msg_sent:
            print("Time matched! Initializing headless API send...")
            
            # Open-source public webhook API payload structure
            url = f"https://wppconnect.io"
            payload = {
                "chatId": f"{GROUP_ID}@g.us",
                "contentType": "string",
                "content": MESSAGE
            }
            
            try:
                # Dispatches the raw data string directly through the internet pipeline
                response = requests.post(url, json=payload, timeout=10)
                print(f"Server response received: {response.status_code}")
                msg_sent = True
            except Exception as e:
                print(f"Network error during delivery: {e}")
                
        # Reset the engine flag at 2:00 AM so it can run again the following night
        if now.hour == 2:
            msg_sent = False
            
        time.sleep(10) # Review the clock loops every 10 seconds

if __name__ == "__main__":
    # Launch web service thread
    Thread(target=run_server, daemon=True).start()
    # Launch background clock routine
    whatsapp_cloud_clock()
