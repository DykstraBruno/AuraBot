# Como gerar o instalador AuraBot.exe

## Pré-requisitos

1. **Node.js 20+** instalado — [nodejs.org](https://nodejs.org) (versão LTS)
2. **Git** instalado (se clonou o repositório)

## Passo a passo

### Opção A — Script automático (mais fácil)

1. Abra a pasta do projeto no Explorador de Arquivos
2. Dê duplo clique em **`build-windows.bat`**
3. Aguarde (pode levar 5–10 minutos na primeira vez)
4. O instalador abre automaticamente quando terminar

### Opção B — Pelo terminal

Abra o **Prompt de Comando** ou **PowerShell** na pasta do projeto e rode:

```bat
build-windows.bat
```

Ou passo a passo:

```bat
cd backend
npm install
npx prisma generate
npm run build

cd ..\frontend
npm install
npm run build:electron:win

cd ..\electron
npm install
npm run build:win
```

## Onde fica o instalador

Após o build, o arquivo estará em:

```
electron\dist\AuraBot-Setup-1.0.0.exe
```

## O que o instalador faz

1. Instala o AuraBot no seu PC (Arquivos de Programas)
2. Cria atalho na Área de Trabalho e no Menu Iniciar
3. Na primeira execução, abre uma tela para configurar as chaves de API

## Requisito para o usuário final

O usuário que instalar o AuraBot precisa ter o **Node.js instalado** no computador,
porque o AuraBot usa o Node.js para rodar o servidor interno.

Para distribuir sem essa dependência, seria necessário empacotar o Node.js junto
com o instalador (aumenta o tamanho do .exe em ~80MB).

