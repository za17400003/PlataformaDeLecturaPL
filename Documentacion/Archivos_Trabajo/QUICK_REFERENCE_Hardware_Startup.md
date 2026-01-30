QUICK REFERENCE - HARDWARE AND STARTUP

1 STARTUP COMMAND

Correct method:
npm start

This starts:
- React frontend (http://localhost:3000)
- Express backend (http://localhost:5000)
- Build system with live reload

NOT recommended:
node server.js (only backend, missing React)

2 HARDWARE PORTS

Gazepoint GP3 Eye Tracker:
- Host: 127.0.0.1 (localhost)
- Port: 4242
- Protocol: TCP
- Data: Eye gaze coordinates (250 samples/second)

Serial Port (COM9) for Stimuli:
- Port: COM9
- Speed: 115200 baud
- Commands: K {duration}   (kinesthetic/vibration)
           A {duration}   (audio stimulus)

Webcam/Microphone:
- Native browser APIs (no special port)
- Video: 1920x1080, 30 fps
- Audio: 48000 Hz, 2 channels

3 ENVIRONMENT VARIABLES

Create .env in project root:

REACT_APP_API_URL=http://localhost:5000
REACT_APP_GP3_HOST=127.0.0.1
REACT_APP_GP3_PORT=4242

4 HARDWARE STATUS CHECK

Verify hardware available before session:

GET /api/gazepoint/status
→ { connected: true/false }

POST /api/serial/vibrate { duration: 0.5 }
→ { success: true/false }

GET /api/webcam/status
→ { available: true/false }

5 CONFIGURATION FILE

All hardware settings in: src/hardwareConfig.js

Contains:
- Gazepoint settings
- Serial port settings  
- Video/audio specifications
- Stimulus timing parameters
- Block configuration

6 KEY FILES FOR DEVELOPERS

CONFIGURACION_HARDWARE_CONEXIONES.md
- Complete hardware specifications
- Code examples for React hooks
- Implementation patterns

ACLARACION_npm_start.md
- Why npm start is correct
- Startup troubleshooting
- npm vs node.js explanation

USER_MANUAL_PL_System.md
- Complete user guide
- Troubleshooting (Section 8)
- Technical specs (Section 9)

FASE1_HARDWARE_INTEGRATION_UPDATE.md
- Hardware integration details
- Implementation sequence
- Testing procedures

7 COMMON COMMANDS

npm install              (install dependencies)
npm start               (start development servers)
npm run build           (compile for production)
npm test                (run tests)

node db/check-schema.js (verify database)
node db/seed-admin.js   (create admin user)

8 BACKEND ENDPOINTS (Phase 1)

Gazepoint:
GET /api/gazepoint/status
GET /api/gazepoint/sample

Serial:
POST /api/serial/vibrate
POST /api/serial/audio

Multimedia:
(Uses browser APIs, no backend needed)

9 STIMULUS PARAMETERS

From Python configuration:

Visual (V): 2 per session, 3000 ms display
Kinesthetic (K): 2 per session, 2000 ms vibration
Audio (A): 2 per session, variable duration
Questions on-task (PST): 3 per session
Questions off-task (PFT): 6 per session

Block timing:
- Total: 5 blocks
- Duration each: 5.22 minutes
- Rest between: 60 seconds
- Stimulus blocks: 0, 2, 4 (indices)
- Stimulus interval: 45-60 seconds random

10 ERROR MESSAGES AND SOLUTIONS

"Port 3000 already in use"
→ npm start -- --port 3001

"Cannot find module"
→ npm install

"Cannot POST /api/..."
→ npm start is not running, check terminal

"Gazepoint not available"
→ Normal, uses mock data instead

"COM9 not found"
→ Normal, skips vibration stimuli

"Webcam permission denied"
→ User must click Allow on permission dialog

---

Quick Reference Sheet - PL System
Prepared: January 27, 2024
For: Developers and Administrators

