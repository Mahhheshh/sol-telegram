import TelegramBot, { Message, CallbackQuery } from "node-telegram-bot-api";

import { Keypair } from "@solana/web3.js";
import db from "./lib/db";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const bot = new TelegramBot(TOKEN, { polling: true });

const HOME_BUTTONS = [
  { text: "create a new wallet", callback_data: "create_wallet" },
  { text: "Wallets", callback_data: "list_wallets" },
  { text: "close", callback_data: "close" },
];

const handleGmMessage = (msg: Message) => {
  if (msg.text?.toLowerCase() !== "gm") return;
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `Gm, ${msg.chat.username || msg.chat.first_name}`);
};

const handleHomeCommand = async (msg: Message) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `Gm, ${msg.chat.username || msg.chat.first_name}\nManage your solona wallets below.`,
    { reply_markup: { inline_keyboard: [HOME_BUTTONS] } }
  );
};

const handleListWalletCommand = async (msg: Message) => {
  const chatId = msg.chat.id;

  await listWallets(chatId);
}

const createWallet = async (chatId: number) => {
  const keypair = new Keypair();
  await db.wallet.create({
    data: {
      chatId: chatId,
      public: keypair.publicKey.toString(),
      private: keypair.secretKey.toString(),
    },
  });
  bot.sendMessage(
    chatId,
    `Success: Your new wallet is:\n\n${keypair.publicKey.toString()}\n\nYou can receive payments at this address`
  );
};

const listWallets = async (chatId: number) => {
  const wallets = await db.wallet.findMany({
    where: { chatId: chatId },
    select: { public: true },
  });

  const buttons = wallets.map((wallet) => ({
    text: wallet.public,
    callback_data: `wallet_${wallet.public}`,
  }));

  bot.sendMessage(chatId, "Here is the list of wallets you own.", {
    reply_markup: { 
      inline_keyboard: buttons.map((button) => {
        return [button];
      })
    }
  });
};

const showWalletDetails = async (chatId: number, pubKey: string) => {
  const keys = await db.wallet.findFirst({
    where: { public: pubKey },
    select: { public: true, private: true },
  });

  bot.sendMessage(
    chatId,
    `Showing wallet details for:\nPublic Key: ${pubKey}\nPrivate Key: ${keys?.private}`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "View on SolScan", url: `https://solscan.io/account/${pubKey}` },
            { text: "close", callback_data: "close" },
          ],
          [
            {
              text: "Delete Wallet", callback_data: `delete_${pubKey}`
            }
          ]
        ],
      },
    }
  );
};

const deleteWallet = async (publicKey: string) => {
  try {
    const row = await db.wallet.findFirst({
      where: { 
        public: publicKey
      }
    })
    await db.wallet.delete({
      where: {
        id: row?.id,
      }
    })
  } catch (error) {
    console.error(error);
  }
}

const handleCallbackQuery = async (query: CallbackQuery) => {
  const chatId = query.message?.chat.id;
  if (!chatId) return;

  const data = query.data;
  bot.answerCallbackQuery(query.id);

  switch (data) {
    case "create_wallet":
      await createWallet(chatId);
      break;
    case "close":
      if (query.message?.message_id) {
        bot.deleteMessage(chatId, query.message.message_id);
      }
      break;
    case "list_wallets":
      await listWallets(chatId);
      break;
    default:
      if (data?.startsWith("wallet_")) {
        await showWalletDetails(chatId, data.split("wallet_")[1]);
      } else if (data?.startsWith("delete_")) {
        await deleteWallet(data.split("delete_")[1]);
        bot.sendMessage(chatId, "Wallet deleted..");
      }
      break;
  }
};

bot.on("message", handleGmMessage);
bot.onText(/\/home/, handleHomeCommand);
bot.onText(/\/settings/, async (msg: Message) => {});
bot.onText(/\/wallets/, handleListWalletCommand);
bot.on("callback_query", handleCallbackQuery);