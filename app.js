process.env["NTBA_FIX_350"] = 1;

const { TELEGRAM_BOT_TOKEN } = require('./settings.json');
const Telegram = require('node-telegram-bot-api');
const Downloader = require('./components/downloader');

const bot = new Telegram(TELEGRAM_BOT_TOKEN, { polling: true });

bot.onText(/\/start/, msg => {
    bot.sendMessage(msg.chat.id, "✅ Bot started. Send tiktok video link to this chat😉");
});

bot.onText(/https:\/\/vm\.tiktok\.com\/([A-Za-z0-9]+)/, async (msg, match) => {
    console.log(`[User: ${msg.from.id} | Chat: ${msg.chat.id}] ${msg.text}`);
    try {
        const video_url = match[0];
        const buffer = await new Downloader().download(video_url);
    
        bot.sendVideo(
            msg.chat.id, 
            buffer, 
            { reply_to_message_id: msg.message_id }, 
            { filename: `video_${Date.now()}.mp4`, contentType: 'video/mp4' }
        );        
    } catch (error) {
        console.log('⛔️ ' + error.message)
    }
})