# SnipLingo

SnipLingo is a browser extension that allows you to easily select an area on any web page, recognize text from the captured image using OCR, and translate it into your language of choice.

## Features

- ✂️ **Area Selection:** Select any specific area of a webpage to capture text from images, videos, or protected documents.
- 🔍 **Offline OCR:** Built-in optical character recognition (OCR) using [Tesseract.js](https://tesseract.projectnaptha.com/), supporting English and Russian locally without needing external APIs.
- 🌍 **Translation:** Quickly translate recognized text into multiple languages using a dedicated backend server.
- 📋 **Copy to Clipboard:** Easily copy the recognized or translated text with a single click.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm (comes with Node.js)

## Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/Darmanchev/sniplingo.git
cd sniplingo
npm install
```

### Environment Variables

To run the translation backend, you'll need to set up your environment variables. 
Copy the example file to create a new `.env` file:

```bash
cp .env.example .env
```

*Make sure to configure the required API keys or variables inside `.env` depending on your backend setup.*

## Development

SnipLingo consists of the browser extension and a translation backend.

1. **Start the translation backend:**
   ```bash
   npm run dev:backend
   ```
   *This starts the local translation API server on `http://127.0.0.1:8787`.*

2. **Start the extension in development mode:**
   Open a new terminal window and run:
   ```bash
   npm run dev
   ```
   *(For Firefox, run `npm run dev:firefox`)*

This will automatically open a new browser instance with the extension installed.

## Building for Production

To build the extension for production deployment:

```bash
# Build for Chrome
npm run build

# Build for Firefox
npm run build:firefox
```

To create a `.zip` archive ready for publishing to the Chrome Web Store or Firefox Add-ons:

```bash
# Zip for Chrome
npm run zip

# Zip for Firefox
npm run zip:firefox
```

## Technologies Used

- [WXT](https://wxt.dev/) - Next-gen framework for browser extensions.
- [TypeScript](https://www.typescriptlang.org/) - Typed JavaScript.
- [Tesseract.js](https://tesseract.projectnaptha.com/) - Pure Javascript OCR.
