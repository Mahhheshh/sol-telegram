# Minimalistic Telegram Solana Crypto Wallet

This is a minimalistic Telegram Solana crypto wallet. It is meant to be used for educational purposes only. The private keys are stored in bs58 plaintext, so it is not recommended to send Solana to it.

## Features

- Basic wallet functionalities
- Integration with Telegram for easy access
- Educational tool for understanding Solana wallet operations

## Libraries Used

- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- [@solona/web3.js](https://solana-labs.github.io/solana-web3.js/)

## Setup Locally

To set up the project locally, follow these steps:

1. **Clone the repository:**
```bash
git clone https://github.com/Mahhheshh/sol-telegram.git
```
2. **Install dependencies:**
```bash
npm install
```
3. **Configure environment variables:**
```bash
TELEGRAM_BOT_TOKEN="Telegram bot token"
DATABASE_URL="postgresql://postgres:mysecretpassword@localhost:5432/solonadb"
```
4. **Run Prisma Migration:**
```bash
npx prisma migrate dev
```
5. **Start The Bot:**
```bash
npm run dev
```