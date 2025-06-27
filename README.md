<div align="center">

# 🎵 AuraBot

**Voice-controlled music bot — install and use like any program**

Say the song name, AuraBot plays it. No terminal, no technical setup.  
Works like Spotify — you install and open it.

[![CI](https://github.com/DykstraBruno/AuraBot/actions/workflows/ci.yml/badge.svg)](https://github.com/DykstraBruno/AuraBot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron&logoColor=white)](https://electronjs.org)

<br />

![AuraBot Demo](.github/demo.gif)

<br />

**Available in:** [🇺🇸 English](#) · [🇧🇷 Português](README.pt-BR.md)

[Download](#-download) · [Installation](#-installation) · [Configuration](#-api-configuration) · [Voice Commands](#-voice-commands) · [Discord Bot](#-discord-bot) · [For Developers](#-for-developers)

</div>

---

## 📥 Download

Download the installer for your system:

| System      | Download            | Size   |
| ----------- | ------------------- | ------ |
| **Windows** | `AuraBot-Setup.exe` | ~120MB |
| **macOS**   | `AuraBot.dmg`       | ~140MB |
| **Linux**   | `AuraBot.AppImage`  | ~130MB |

> Visit the [releases page](https://github.com/DykstraBruno/AuraBot/releases/latest) to download the latest version.

---

## 🚀 Installation

### Windows

1. Download `AuraBot-Setup.exe`
2. Run the installer
3. Click **Install**
4. AuraBot opens automatically

### macOS

1. Download `AuraBot.dmg`
2. Open the `.dmg` file
3. Drag AuraBot to the **Applications** folder
4. Open AuraBot for the first time

> **Security warning on macOS:** the first time might show "developer unverified". Go to **System Preferences → Privacy & Security → Open Anyway**.

### Linux

```bash
# Give execution permission and run
chmod +x AuraBot-*.AppImage
./AuraBot-*.AppImage
```

---

## 🔑 API Configuration

The **first time** you open AuraBot, a configuration screen appears asking for API keys. This is only done once.

> Your keys are saved on your computer and never sent to any external server except the services themselves (Spotify, YouTube, OpenAI).

### Spotify _(required)_

Required to search for songs and view metadata.

1. Visit [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and log in
2. Click **Create app**
3. Fill in any name and add `http://localhost:3001` in Redirect URIs
4. Copy the **Client ID** and **Client Secret**

### YouTube _(required)_

Required for alternative music search.

1. Visit [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → **APIs and Services** → **Library**
3. Enable **YouTube Data API v3**
4. **Credentials** → **Create Credentials** → **API Key**

> Free quota: 10,000 searches per day — more than enough for personal use.

### OpenAI _(optional — for voice commands)_

Required only if you want to use the microphone to control playback by voice.

1. Visit [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **Create new secret key**

> Cost: ~$0.006 per minute of audio. An hour of intensive use costs less than $0.50.

---

## 🎙 Voice Commands

Click the microphone button and speak naturally. AuraBot understands **Portuguese** and **English**.

### 🇧🇷 Portuguese

| What to say                 | Action           |
| --------------------------- | ---------------- |
| `"Toque Bohemian Rhapsody"` | Plays the song   |
| `"Coloca Hotel California"` | Plays the song   |
| `"Quero ouvir Queen"`       | Search by artist |
| `"Para"`                    | Stop playback    |
| `"Próxima"`                 | Skip to next     |
| `"Mais alto"`               | Volume +10%      |
| `"Mais baixo"`              | Volume −10%      |

### 🇺🇸 English

| What to say                 | Action         |
| --------------------------- | -------------- |
| `"Play Bohemian Rhapsody"`  | Plays the song |
| `"Put on Hotel California"` | Plays the song |
| `"Stop"`                    | Stops playback |
| `"Next"`                    | Skips to next  |
| `"Turn up"`                 | Volume +10%    |
| `"Turn down"`               | Volume −10%    |

> Just saying the song name without a prefix also works:  
> `"Bohemian Rhapsody"` → plays the song directly.

---

## 🎮 Discord Bot

AuraBot also works as a bot on Discord. The bot searches and plays songs from YouTube directly, without depending on the backend or database.

### Slash commands

```
/play query:Bohemian Rhapsody
/stop
/next
/turnup
/turndown
/queue
```

The autocomplete suggests songs as you type — no need to send the command first.

### Bot dependencies

The bot requires **yt-dlp** and **ffmpeg** installed on your machine. On Windows via winget:

```powershell
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

### Setting up the Discord bot

1. Visit [discord.com/developers/applications](https://discord.com/developers/applications)
2. **New Application** → give it a name → **Create**
3. Sidebar → **Bot** → **Reset Token** → copy the token
4. Enable all **Privileged Gateway Intents**
5. **OAuth2** → **URL Generator** → check `bot` and `applications.commands`
6. Add **Administrator** permission (or minimum: Connect, Speak, Use Slash Commands)
7. Copy the generated link and add the bot to your server

Configure the `discord/.env` file:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=application_id
DISCORD_GUILD_ID=server_id
```

Register slash commands on the server (only needed once or when adding new commands):

```bash
cd discord
node dist/deploy-commands.js
```

Start the bot:

```bash
node dist/index.js
```

---

## 🛠 For Developers

This section is for those who want to modify the code or contribute to the project.

### Technologies

| Layer       | Stack                                     |
| ----------- | ----------------------------------------- |
| **Desktop** | Electron 28, packages frontend + backend  |
| **UI**      | React 18, Vite, TypeScript, Zustand       |
| **API**     | Node.js 20, Express, Prisma, PostgreSQL   |
| **Voice**   | OpenAI Whisper (STT) + TTS                |
| **Music**   | Spotify API + yt-dlp + ffmpeg             |
| **Discord** | discord.js v14, @discordjs/voice v0.19    |
| **Tests**   | Vitest, Testing Library (~220 test cases) |
| **CI/CD**   | GitHub Actions                            |

### Project structure

```
aurabot/
├── electron/        # Packages everything as an installable app
│   └── src/
│       ├── main.js          # Main process — starts backend, creates window
│       ├── preload.js       # Secure bridge between Electron and React
│       ├── setup.js         # Auto-configuration on first run
│       ├── ipc.js           # Inter-process communication
│       └── config-screen.html  # Initial configuration screen
│
├── frontend/        # React UI (becomes the app window)
├── backend/         # Node.js API (runs in background in the app)
├── discord/         # Standalone Discord bot
└── desktop/         # Optional CLI for terminal
```

### Development prerequisites

| Tool    | Version                 |
| ------- | ----------------------- |
| Node.js | ≥ 20                    |
| npm     | ≥ 10                    |
| Docker  | ≥ 24 (for the database) |

### Running in development mode

```bash
# 1. Clone and install
git clone https://github.com/DykstraBruno/AuraBot.git
cd AuraBot
npm install

# 2. Set up environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# 3. Start the database
npm run docker:up
npm run db:migrate
npm run db:seed

# 4. Start the full app (backend + frontend + Electron)
npm run dev:app

# Or separately:
npm run dev          # just backend + frontend in the browser
npm run dev:discord  # Discord bot (separate terminal)
```

### Building installers

```bash
# Windows (.exe)
npm run build:app:win

# macOS (.dmg)
npm run build:app:mac

# Linux (.AppImage)
npm run build:app:linux
```

Installers are placed in `electron/dist/`.

> **Note:** To generate the `.exe` on Windows, `.dmg` on macOS, and `.AppImage` on Linux, the build needs to run on the corresponding operating system (or via GitHub Actions).

### Building installers via GitHub Actions

When you create a version tag, GitHub Actions automatically generates installers for all 3 systems and publishes them on the releases page:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The `build-installers.yml` pipeline runs on Windows, macOS, and Linux in parallel and attaches the installers to the release.

### Running tests

```bash
# All workspaces
npm test

# Backend with coverage
cd backend && npm run test:coverage

# Watch mode
cd backend && npm run test:watch
```

### Icon setup

To generate application icons, place a 1024×1024 PNG in `electron/assets/logo.png` and run:

```bash
npm install -g electron-icon-builder
electron-icon-builder --input=electron/assets/logo.png --output=electron/assets/
```

This generates `icon.ico` (Windows), `icon.icns` (macOS), and `icon.png` (Linux).

---

## 🔧 Troubleshooting

**The app opens but doesn't play music**  
→ Check if API keys are filled in. Go to **Menu → Settings** to edit them.

**"Developer not verified" on macOS**  
→ System Preferences → Privacy & Security → Open Anyway.

**Microphone doesn't work**  
→ OpenAI key is required for voice commands. Without it, only text search works.

**Discord bot not responding**  
→ Run `cd discord && node dist/deploy-commands.js` to register slash commands.

**Bot joins channel but no sound**  
→ Check if `yt-dlp` and `ffmpeg` are installed and in PATH (`winget install yt-dlp.yt-dlp` and `winget install Gyan.FFmpeg`).

**Autocomplete doesn't appear in /play**  
→ Run deploy-commands again and wait 1-2 minutes for Discord to update.

---

## 🤝 Contributing

Contributions are welcome! Whether fixing bugs, adding features, or improving documentation, your help is valuable.

### Reporting bugs

Found a problem? Open an [issue on GitHub](https://github.com/DykstraBruno/AuraBot/issues) with:

- Clear description of the bug
- Steps to reproduce
- What happened vs. what should happen
- Your operating system and AuraBot version
- Logs (if available)

### Suggesting features

Have a cool idea? Open a [discussion](https://github.com/DykstraBruno/AuraBot/discussions) or [issue](https://github.com/DykstraBruno/AuraBot/issues) labeled as `enhancement`.

### Contribution process

1. **Fork the repository** — click "Fork" on GitHub
2. **Clone your copy**:
   ```bash
   git clone https://github.com/your_username/AuraBot.git
   cd AuraBot
   ```
3. **Create a branch** for your feature/fix:
   ```bash
   git checkout -b fix/bug-name
   # or
   git checkout -b feature/my-feature
   ```
4. **Install dependencies and set up environment** (see [For Developers](#-for-developers)):
   ```bash
   npm install
   npm run docker:up
   npm run db:migrate
   ```
5. **Make changes** and test locally:
   ```bash
   npm run dev          # test in browser
   npm run dev:app      # test in Electron
   npm test             # run tests
   ```
6. **Commit with clear messages**:
   ```bash
   git commit -m "fix: correct audio playback"
   git commit -m "feat: add shuffle to queue"
   ```
7. **Push to your branch**:
   ```bash
   git push origin fix/bug-name
   ```
8. **Open a Pull Request** on the original repository — describe what was done

### Code standards

- **TypeScript**: use explicit types, avoid `any`
- **Formatting**: the project uses Prettier — run `npm run format`
- **Linting**: run `npm run lint` to check
- **Tests**: add tests for new features
- **Commits**: use semantic format (fix:, feat:, docs:, test:, etc.)

### General guidelines

- Work on small, focused features
- Rebase your branch before opening the PR to keep history clean
- Describe well what your PR does in the message body
- Be respectful — we're a friendly community!

### Questions?

Open a [discussion](https://github.com/DykstraBruno/AuraBot/discussions) if you have questions about the process or architecture.

---

## 📄 License

MIT © 2025 — AuraBot Contributors

See the [LICENSE](LICENSE) file for full details.

