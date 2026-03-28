# Ícones do AuraBot

Esta pasta deve conter os ícones do aplicativo em 3 formatos:

| Arquivo    | Formato | Tamanho    | Usado em         |
|------------|---------|------------|------------------|
| icon.ico   | ICO     | 256x256    | Windows          |
| icon.icns  | ICNS    | 512x512    | macOS            |
| icon.png   | PNG     | 512x512    | Linux + bandeja  |

## Como gerar os ícones

1. Crie uma imagem PNG de 1024x1024 pixels com o logo do AuraBot
2. Use o site https://www.icoconverter.com para gerar o .ico
3. Use o site https://cloudconvert.com/png-to-icns para gerar o .icns

Ou use o pacote `electron-icon-builder`:
```bash
npm install -g electron-icon-builder
electron-icon-builder --input=logo.png --output=./
```
