# DoShare

### Send Code & Files Directly Between Browsers

DoShare is a real-time browser-to-browser sharing application that lets users send **code and files directly between browsers** without uploading them to a traditional server.

It also includes an **AI-powered code shortening feature** using Groq and optional **end-to-end encryption with a passcode**.

🌐 **Live Demo:** https://doshare-app.vercel.app/
📦 **GitHub:** https://github.com/globalsufyanenterprise/doshare-app

---

## ✨ Features

### 💻 Real-Time Code Sharing

Share code directly between connected browsers using a peer-to-peer connection.

* Monaco-based code editor
* Real-time peer connection
* Send code between browsers
* Supports multiple programming languages
* Copy code with one click

### 📁 File Sharing

Send files directly between browsers without uploading them to a central storage server.

* Peer-to-peer file transfer
* Chunked file transmission
* Supports files up to **100 MB**
* Download received files directly
* No permanent server-side file storage

### 🔐 Optional Passcode Protection

DoShare provides an optional encryption layer for shared data.

* User-defined passcode
* PBKDF2 key derivation
* AES-256-GCM encryption
* Random initialization vector for every encryption operation
* Passcode remains in the browser

### ✨ AI Code Shortener

DoShare includes an AI-powered tool for simplifying code.

The feature can:

* Remove redundant code
* Remove dead code
* Fix obvious syntax errors
* Simplify code while preserving behavior
* Keep public/exported identifiers unchanged

The AI request is handled server-side through a Next.js API route, keeping the Groq API key away from the browser.

### ⚡ Rate Limiting

The AI endpoint includes basic request protection to prevent excessive requests.

* Request limit per IP
* Maximum code input size
* Request timeout handling
* Error handling for unavailable AI services

---

## 🛠️ Tech Stack

| Technology         | Purpose                                      |
| ------------------ | -------------------------------------------- |
| **Next.js**        | React framework and application architecture |
| **React**          | User interface                               |
| **TypeScript**     | Type-safe development                        |
| **Tailwind CSS**   | Styling and responsive UI                    |
| **PeerJS**         | Peer-to-peer browser communication           |
| **Monaco Editor**  | Code editing experience                      |
| **Web Crypto API** | Client-side encryption                       |
| **Groq API**       | AI-powered code shortening                   |
| **Lucide React**   | Interface icons                              |
| **Vercel**         | Production deployment                        |
| **GitHub**         | Source control and project hosting           |

---

## 🏗️ How It Works

### Code & File Sharing

```text
Browser A
   │
   │ Peer-to-Peer Connection
   ▼
PeerJS
   │
   ▼
Browser B
```

The application establishes a peer-to-peer connection between browsers and transfers code or files through that connection.

### AI Code Shortening

```text
User
  │
  ▼
Next.js Frontend
  │
  ▼
/api/shorten
  │
  ▼
Groq API
  │
  ▼
Shortened Code
  │
  ▼
Editor
```

The Groq API key is stored as a server-side environment variable and is not exposed to the client.

---

## 🔒 Security & Privacy

DoShare is designed around minimizing the need for centralized storage.

### Peer-to-Peer Transfer

Files and code are transferred between connected browsers rather than being permanently stored on a DoShare database.

### Optional Encryption

When a passcode is enabled, the application derives an AES-256-GCM encryption key from the passcode using PBKDF2.

The passcode itself is not sent to the server.

### API Key Protection

The Groq API key is stored as a Vercel environment variable:

```env
GROQ_API_KEY=your_api_key
```

The key is **not included in the GitHub repository**

---

## 📂 Project Structure

```text
doshare-app/
│
├── app/
│   ├── api/
│   │   └── shorten/
│   │       └── route.ts
│   │
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
│
├── lib/
│   └── crypto.ts
│
├── public/
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
│
├── .gitignore
├── eslint.config.mjs
├── next.config.ts
├── next-env.d.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── README.md
└── tsconfig.json
```

---

## 🚀 Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/globalsufyanenterprise/doshare-app.git
```

### 2. Enter the project directory

```bash
cd doshare-app
```

### 3. Install dependencies

```bash
npm install
```

### 4. Create environment variables

Create a `.env.local` file:

```env
GROQ_API_KEY=your_groq_api_key
```

Do not commit this file to GitHub.

### 5. Start the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 🌐 Production Deployment

DoShare is deployed using **Vercel**.

Production URL:

**https://doshare-app.vercel.app/**

The GitHub repository is connected to Vercel, allowing future changes pushed to the production branch to be deployed automatically.

### Required Environment Variable

```text
GROQ_API_KEY
```

This variable should be configured in the Vercel project settings rather than committed to the repository.

---

## 🧪 Tested Features

The deployed application has been tested for:

* [x] Application loading
* [x] Peer-to-peer connection
* [x] Code sharing
* [x] File sharing
* [x] Passcode protection
* [x] Encryption/decryption
* [x] AI code shortening
* [x] Groq API integration
* [x] Production deployment
* [x] Vercel environment variables

---

## 🎯 Project Goals

DoShare was built to explore practical solutions for:

* Peer-to-peer browser communication
* Real-time data transfer
* Client-side cryptography
* Secure API key handling
* AI-assisted developer tools
* Modern Next.js application architecture
* Production deployment with Vercel

---

## 🔮 Future Improvements

Possible future improvements include:

* QR-code based connection sharing
* Improved connection status indicators
* Drag-and-drop file sharing
* Transfer progress indicators
* Multiple file selection
* Improved peer reconnection
* More AI code transformation tools
* Improved rate limiting with
