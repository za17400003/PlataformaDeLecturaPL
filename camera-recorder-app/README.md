# Camera Recorder App

## Overview
The Camera Recorder App is a web application that allows users to access their webcam and prepare for video recording without actually recording. The application prompts for webcam permissions upon logging in and is designed to save video files in MP4 format to a designated folder within the application files.

## Features
- User authentication through a login interface.
- Webcam access with permission prompts.
- Background preparation for video recording.
- Error handling for camera access issues.
- Organized structure for client and server components.

## Project Structure
```
camera-recorder-app
├── client
│   ├── public
│   │   └── index.html
│   ├── src
│   │   ├── index.js
│   │   ├── App.js
│   │   ├── components
│   │   │   ├── Login.js
│   │   │   └── LectorCamara.js
│   │   ├── contexts
│   │   │   └── AuthContext.js
│   │   ├── hooks
│   │   │   └── useCameraPermission.js
│   │   ├── services
│   │   │   └── api.js
│   │   └── styles
│   │       └── App.css
│   └── README.md
├── server
│   ├── index.js
│   ├── routes
│   │   └── upload.js
│   ├── recordings
│   │   └── .gitkeep
│   └── package.json
├── .gitignore
└── README.md
```

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the client directory:
   ```
   cd camera-recorder-app/client
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Navigate to the server directory:
   ```
   cd ../server
   ```
5. Install server dependencies:
   ```
   npm install
   ```

## Usage
1. Start the server:
   ```
   cd server
   node index.js
   ```
2. Start the client application:
   ```
   cd client
   npm start
   ```
3. Open your browser and navigate to `http://localhost:3000` to access the application.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.