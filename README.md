<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1UsRBwD513NwzuSGalen_bX5SDWeWTDCw

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Desktop application

You can run the editor inside an Electron shell or produce a Windows installer/executable.

### Develop with Electron

1. Ensure the API key is available as either the `API_KEY` or `GEMINI_API_KEY` environment variable.
2. Start the combined Angular dev server and Electron wrapper:
   `npm run electron:dev`

This command opens the desktop window once the Angular dev server becomes available. The window automatically reloads when you make changes to the UI.

### Build a Windows executable

1. Ensure you have installed the dependencies and that the API key environment variable is configured.
2. Build the production bundle and package it:
   `npm run package:win`

The generated installer (`.exe`) and unpacked application are placed inside the `release/` directory. Building Windows binaries requires running the command on Windows (or on another platform with the necessary Electron Builder tooling, such as Wine).
