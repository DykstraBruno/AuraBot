<div align="center">

# 🎵 AuraBot

**Bot de música controlado por voz — instale e use como qualquer programa**

Fale o nome da música, o AuraBot toca. Sem terminal, sem configuração técnica.  
Funciona como o Spotify — você instala e abre.

[![CI](https://github.com/SEU_USER/AuraBot/actions/workflows/ci.yml/badge.svg)](https://github.com/SEU_USER/AuraBot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron&logoColor=white)](https://electronjs.org)

<br />

![AuraBot Demo](.github/demo.gif)

<br />

[Download](#-download) · [Instalação](#-instalação) · [Configuração](#-configuração-de-apis) · [Comandos de voz](#-comandos-de-voz) · [Discord bot](#-discord-bot) · [Para desenvolvedores](#-para-desenvolvedores)

</div>

---

## 📥 Download

Baixe o instalador para o seu sistema:

| Sistema | Download | Tamanho |
|---------|----------|---------|
| **Windows** | `AuraBot-Setup.exe` | ~120 MB |
| **macOS** | `AuraBot.dmg` | ~140 MB |
| **Linux** | `AuraBot.AppImage` | ~130 MB |

> Acesse a [página de releases](https://github.com/SEU_USER/AuraBot/releases/latest) para baixar a versão mais recente.

---

## 🚀 Instalação

### Windows

1. Baixe o `AuraBot-Setup.exe`
2. Execute o instalador
3. Clique em **Instalar**
4. O AuraBot abre automaticamente

### macOS

1. Baixe o `AuraBot.dmg`
2. Abra o arquivo `.dmg`
3. Arraste o AuraBot para a pasta **Aplicativos**
4. Abra o AuraBot pela primeira vez

> **Aviso de segurança no macOS:** na primeira vez pode aparecer "desenvolvedor não verificado". Vá em **Ajustes → Privacidade e Segurança → Abrir assim mesmo**.

### Linux

```bash
# Dê permissão de execução e rode
chmod +x AuraBot-*.AppImage
./AuraBot-*.AppImage
```

---

## 🔑 Configuração de APIs

Na **primeira vez** que abrir o AuraBot, uma tela de configuração aparece pedindo as chaves de API. Isso só é feito uma vez.

> As chaves ficam salvas no seu computador e nunca são enviadas para nenhum servidor externo além dos próprios serviços (Spotify, YouTube, OpenAI).

### Spotify *(obrigatório)*

Necessário para buscar músicas e ver metadados.

1. Acesse [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) e faça login
2. Clique em **Create app**
3. Preencha qualquer nome e adicione `http://localhost:3001` em Redirect URIs
4. Copie o **Client ID** e **Client Secret**

### YouTube *(obrigatório)*

Necessário para busca alternativa de músicas.

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto → **APIs e serviços** → **Biblioteca**
3. Ative a **YouTube Data API v3**
4. **Credenciais** → **Criar credenciais** → **Chave de API**

> Cota gratuita: 10.000 buscas por dia — mais do que suficiente para uso pessoal.

### OpenAI *(opcional — para comandos por voz)*

Necessário apenas se quiser usar o microfone para controlar o player por voz.

1. Acesse [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Clique em **Create new secret key**

> Custo: ~$0.006 por minuto de áudio. Uma sessão de 1 hora de uso intenso custa menos de $0.50.

---

## 🎙 Comandos de voz

Clique no botão de microfone e fale naturalmente. O AuraBot entende **Português** e **Inglês**.

### 🇧🇷 Português

| O que dizer | Ação |
|------------|------|
| `"Toque Bohemian Rhapsody"` | Toca a música |
| `"Coloca Hotel California"` | Toca a música |
| `"Quero ouvir Queen"` | Busca por artista |
| `"Para"` | Para a reprodução |
| `"Próxima"` | Avança na fila |
| `"Mais alto"` | Volume +10% |
| `"Mais baixo"` | Volume −10% |

### 🇺🇸 English

| What to say | Action |
|------------|--------|
| `"Play Bohemian Rhapsody"` | Plays the song |
| `"Put on Hotel California"` | Plays the song |
| `"Stop"` | Stops playback |
| `"Next"` | Skips to next |
| `"Turn up"` | Volume +10% |
| `"Turn down"` | Volume −10% |

> Falar apenas o nome da música sem prefixo também funciona:  
> `"Bohemian Rhapsody"` → toca a música diretamente.

---

## 🎮 Discord bot

O AuraBot também funciona como bot no Discord. Cada usuário do servidor tem sua própria fila e volume independentes.

### Slash commands

```
/play musica:Bohemian Rhapsody
/play musica:Queen  fonte:spotify
/stop
/next
/turnup
/turndown
/queue
```

O autocomplete sugere músicas enquanto você digita.

### Configurar o bot Discord

1. Acesse [discord.com/developers/applications](https://discord.com/developers/applications)
2. **New Application** → dê um nome → **Create**
3. Menu lateral → **Bot** → **Reset Token** → copie o token
4. Ative todos os **Privileged Gateway Intents**
5. **OAuth2** → **URL Generator** → marque `bot` e `applications.commands`
6. Copie o link e adicione o bot ao seu servidor

Configure o arquivo `discord/.env`:

```env
DISCORD_TOKEN=token_do_bot
DISCORD_CLIENT_ID=application_id
DISCORD_GUILD_ID=id_do_servidor
AURABOT_API_URL=http://localhost:3001/api
AURABOT_BOT_TOKEN=mesmo_valor_do_backend
```

Inicie o bot:

```bash
npm run dev:discord
```

---

## 🛠 Para desenvolvedores

Esta seção é para quem quer modificar o código ou contribuir com o projeto.

### Tecnologias

| Camada | Stack |
|--------|-------|
| **App desktop** | Electron 28, empacota frontend + backend |
| **Interface** | React 18, Vite, TypeScript, Zustand |
| **API** | Node.js 20, Express, Prisma, PostgreSQL |
| **Voz** | OpenAI Whisper (STT) + TTS |
| **Música** | Spotify API + YouTube Data API v3 |
| **Discord** | discord.js v14 |
| **Testes** | Vitest, Testing Library (~220 casos) |
| **CI/CD** | GitHub Actions |

### Estrutura do projeto

```
aurabot/
├── electron/        # Empacota tudo como app instalável
│   └── src/
│       ├── main.js          # Processo principal — inicia backend, cria janela
│       ├── preload.js       # Bridge segura entre Electron e React
│       ├── setup.js         # Configuração automática no primeiro uso
│       ├── ipc.js           # Comunicação entre processos
│       └── config-screen.html  # Tela de configuração inicial
│
├── frontend/        # Interface React (vira a janela do app)
├── backend/         # API Node.js (roda em segundo plano no app)
├── discord/         # Bot Discord independente
└── desktop/         # CLI opcional para terminal
```

### Pré-requisitos para desenvolvimento

| Ferramenta | Versão |
|-----------|--------|
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| Docker | ≥ 24 (para o banco de dados) |

### Rodando em modo desenvolvimento

```bash
# 1. Clonar e instalar
git clone https://github.com/SEU_USER/AuraBot.git
cd AuraBot
npm install

# 2. Configurar variáveis de ambiente
cp backend/.env.example backend/.env
# Edite backend/.env com suas chaves de API

# 3. Subir banco de dados
npm run docker:up
npm run db:migrate
npm run db:seed

# 4. Iniciar o app completo (backend + frontend + Electron)
npm run dev:app

# Ou separadamente:
npm run dev          # só backend + frontend no navegador
npm run dev:discord  # bot Discord (terminal separado)
```

### Gerando os instaladores

```bash
# Windows (.exe)
npm run build:app:win

# macOS (.dmg)
npm run build:app:mac

# Linux (.AppImage)
npm run build:app:linux
```

Os instaladores ficam em `electron/dist/`.

> **Nota:** para gerar o `.exe` no Windows, o `.dmg` no macOS e o `.AppImage` no Linux, o build precisa rodar no sistema operacional correspondente (ou via GitHub Actions).

### Gerando instaladores via GitHub Actions

Ao criar uma tag de versão, o GitHub Actions gera automaticamente os instaladores para os 3 sistemas e os publica na página de releases:

```bash
git tag v1.0.0
git push origin v1.0.0
```

O pipeline `build-installers.yml` roda em Windows, macOS e Linux em paralelo e anexa os instaladores à release.

### Rodando os testes

```bash
# Todos os workspaces
npm test

# Backend com cobertura
cd backend && npm run test:coverage

# Watch mode
cd backend && npm run test:watch
```

### Configuração de ícones

Para gerar os ícones do aplicativo, coloque um PNG de 1024×1024 pixels em `electron/assets/logo.png` e execute:

```bash
npm install -g electron-icon-builder
electron-icon-builder --input=electron/assets/logo.png --output=electron/assets/
```

Isso gera `icon.ico` (Windows), `icon.icns` (macOS) e `icon.png` (Linux).

---

## 🔧 Problemas comuns

**O app abre mas não toca música**  
→ Verifique se as chaves de API estão preenchidas. Vá em **Menu → Configurações** para editá-las.

**"Desenvolvedor não verificado" no macOS**  
→ Ajustes → Privacidade e Segurança → Abrir assim mesmo.

**O microfone não funciona**  
→ A chave da OpenAI é necessária para comandos de voz. Sem ela, apenas a busca por texto funciona.

**Bot Discord não responde**  
→ Execute `npm run discord:deploy` para registrar os slash commands.

---

## 📄 Licença

MIT © 2025 — AuraBot Contributors

Veja o arquivo [LICENSE](LICENSE) para detalhes completos.
