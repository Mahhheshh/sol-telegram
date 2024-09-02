import TelegramBot, { Message, CallbackQuery } from "node-telegram-bot-api";
import bs58 from "bs58";
import { Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction, SendTransactionError, ComputeBudgetProgram } from "@solana/web3.js";
import RpcConnection from "./web3/connection";
import db from "./lib/db";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const bot = new TelegramBot(TOKEN, { polling: true });

const HOME_BUTTONS = [
  [
    { text: "create a new wallet", callback_data: "create_wallet" },
    { text: "Wallets", callback_data: "list_wallets" },
  ],
  [{ text: "close", callback_data: "close" }],
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
    `Gm, ${
      msg.chat.username || msg.chat.first_name
    }\nManage your solona wallets below.`,
    { reply_markup: { inline_keyboard: HOME_BUTTONS } }
  );
};

const handleListWalletCommand = async (msg: Message) => {
  const chatId = msg.chat.id;
  await listWallets(chatId);
};

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
        await handleDelete(chatId, data.split("delete_")[1]);
      } else if (data?.startsWith("confirm_delete_")) {
        const deleted = await deleteWallet(data.split("confirm_delete_")[1])
        if (deleted) {
          bot.sendMessage(chatId, "Wallet deleted successfully.");
        }
      } else if (data?.startsWith("withdraw_")) {
        await handleWithdraw(chatId, data.split("withdraw_")[1]);
      }
      break;
  }
};

const createWallet = async (chatId: number) => {
  try {
    const keypair = new Keypair();
    await db.wallet.create({
      data: {
        chatId: chatId,
        public: keypair.publicKey.toString(),
        private: bs58.encode(keypair.secretKey),
      },
    });
    bot.sendMessage(
      chatId,
      `Success: Your new wallet is:\n\n${keypair.publicKey.toString()}\n\nYou can receive payments at this address`
    );
  } catch (error) {
    console.error("Error creating wallet:", error);
    bot.sendMessage(chatId, "Failed to create wallet. Please try again.");
  }
};

const listWallets = async (chatId: number) => {
  try {
    const wallets = await db.wallet.findMany({
      where: { chatId: chatId },
      select: { public: true },
    });

    if (wallets.length === 0) {
      bot.sendMessage(chatId, "You don't have any wallet.\nCreate a New wallet: ", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "create a new wallet", callback_data: "create_wallet" }],
            [{ text: "close", callback_data: "close" }],
          ],
        },
      });
      return;
    }

    const buttons = wallets.map((wallet) => ({
      text: wallet.public,
      callback_data: `wallet_${wallet.public}`,
    }));

    bot.sendMessage(chatId, "Here is the list of wallets you own.", {
      reply_markup: {
        inline_keyboard: buttons.map((button) => [button]),
      },
    });
  } catch (error) {
    console.error("Error listing wallets:", error);
    bot.sendMessage(chatId, "Failed to list wallets. Please try again.");
  }
};

const showWalletDetails = async (chatId: number, pubKey: string) => {
  try {
    const keys = await db.wallet.findFirst({
      where: { public: pubKey },
      select: { public: true, private: true },
    });
    const accountBalance = await RpcConnection.getRpcConnection().getBalance(new PublicKey(pubKey));
    bot.sendMessage(
      chatId,
      `\`\`\`===============================\n|      Wallet Details          |\n===============================\nPublic Key: ${pubKey}\nBalance: ${(accountBalance / LAMPORTS_PER_SOL).toFixed(2)} SOL\nPrivate Key: ${keys?.private} \`\`\``,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "View on SolScan", url: `https://solscan.io/account/${pubKey}` }, { text: "close", callback_data: "close" }],
            [{text: "withdraw", callback_data: `withdraw_${pubKey}`}],
            [{ text: "Delete Wallet", callback_data: `delete_${pubKey}` }],
          ],
        },
        parse_mode: "Markdown",
      }
    );
  } catch (error) {
    console.error("Error showing wallet details:", error);
    bot.sendMessage(chatId, "Failed to show wallet details. Please try again.");
  }
};

const deleteWallet = async (publicKey: string): Promise<boolean> => {
  try {
    const row = await db.wallet.findFirst({ where: { public: publicKey } });
    if (row) {
      await db.wallet.delete({ where: { id: row.id } });
    }
    return true;
  } catch (error) {
    console.error("Error deleting wallet:", error);
    return false;
  }
};

const handleDelete = async (chatId: number, pubKey: string) => {
  bot.sendMessage(chatId, `Are you sure?\nThis action cannot be undone and will delete wallet ${pubKey}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Confirm", callback_data: `confirm_delete_${pubKey}` }],
        [{ text: "cancel", callback_data: "close" }],
      ],
    },
  });
};

async function handleWithdraw(chatId: number, publicKey: any) {
  const connection = RpcConnection.getRpcConnection();
  const balance = (await connection.getBalance(new PublicKey(publicKey))) / LAMPORTS_PER_SOL;

  if (balance <= 0.0000001) {
    bot.sendMessage(chatId, "Insufficient Funds!", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "close", callback_data: "close" }]
        ]
      }
    });
    return;
  }

  bot.sendMessage(chatId, "Please provide your wallet address:");

  bot.once('message', async (msg) => {
    const walletAddress = msg.text;

    if (!walletAddress) {
      return;
    }

    const recentBlockHash = await connection.getLatestBlockhash();
    const row = await db.wallet.findFirst({
      where: { public: publicKey },
      select: { private: true }
    });

    if (!row) {
      return;
    }

    const dbKeyPair = Keypair.fromSecretKey(bs58.decode(row.private));
    const transaction = new Transaction({
      blockhash: recentBlockHash.blockhash,
      lastValidBlockHeight: recentBlockHash.lastValidBlockHeight,
      feePayer: dbKeyPair.publicKey,
    });

    const fees = await transaction.getEstimatedFee(connection) || 5000;
    const balanceToTransfer = (balance * LAMPORTS_PER_SOL) - fees;

    transaction.add(
      SystemProgram.transfer({
        fromPubkey: dbKeyPair.publicKey,
        toPubkey: new PublicKey(walletAddress),
        lamports: balanceToTransfer
      })
    );

    try {
      await sendAndConfirmTransaction(connection, transaction, [dbKeyPair]);
      bot.sendMessage(chatId, "Sol Transferred..");
    } catch (error) {
      if (error instanceof SendTransactionError) {
        const logs = await error.getLogs(connection);
        console.error("Transaction failed with logs:", logs);
      } else {
        console.error("An unexpected error occurred:", error);
      }
    }
  });
}

bot.on("message", handleGmMessage);
bot.onText(/\/home/, handleHomeCommand);
bot.onText(/\/settings/, async (msg: Message) => {});
bot.onText(/\/wallets/, handleListWalletCommand);
bot.on("callback_query", handleCallbackQuery);
