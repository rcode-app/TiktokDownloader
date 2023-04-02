process.env["NTBA_FIX_350"] = 1;

const { TELEGRAM_BOT_TOKEN } = require('./settings.json');
const Telegram = require('node-telegram-bot-api');
const Downloader = require('./components/downloader');

const bot = new Telegram(TELEGRAM_BOT_TOKEN, { polling: true });

bot.onText(/\/start/, msg => {
    bot.sendMessage(msg.chat.id, "✅ Bot started. Send tiktok video link to this chat😉");
});

bot.onText(/https:\/\/vm\.tiktok\.com\/([A-Za-z0-9]+)/, async (msg, match) => {
    console.log(`[User: ${msg.from.id} | Chat: ${msg.chat.id} | Service: Tiktok] ${msg.text}`);
    try {
        const video_url = match[0];
        const buffer = await new Downloader().download(video_url);
    
        let caption = ``;
        if(msg.chat.type !== 'private' && "username" in msg.from) {
            caption += `👤 Відео від: <code>@${msg.from.username}</code>\n`;
        }

        bot.sendVideo(
            msg.chat.id, 
            buffer, 
            { 
                reply_to_message_id: msg.message_id, 
                caption, 
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: '🧲 Відкрити в TikTok',
                            url: video_url
                        }]
                    ]
                }
            },
            { filename: `video_${Date.now()}.mp4`, contentType: 'video/mp4' }
        );        
    } catch (error) {
        console.log('⛔️ ' + error.message)
    }
}) 

bot.onText(/https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/([a-zA-Z0-9_-]+)\//, async (msg, match) => {
    console.log(`[User: ${msg.from.id} | Chat: ${msg.chat.id} | Service: Instagram] ${msg.text}`);
    
    try {
        const video_url = match[0];
        const buffer = await new Downloader().downloadInstagramReels(video_url);

        let caption = ``;
        if(msg.chat.type !== 'private' && "username" in msg.from) {
            caption += `👤 Відео від: <code>@${msg.from.username}</code>\n`;
        }

        if(buffer.owner && buffer.owner.url) {
            caption += `✍️ Автор: <a href="${buffer.owner.url}">${buffer.owner.name}</a>${((buffer.caption && buffer.caption.length) || (buffer.likes || buffer.published)) ? "\n" : ""}`;
        }

        if(buffer.caption && buffer.caption.length) {
            caption += `📃 Опис: <i>${buffer.caption.trim()}</i>${(buffer.likes || buffer.published) ? "\n" : ""}`
        }

        if(buffer.likes) {
            caption += `❤️ Вподобаєк: <strong>${buffer.likes}</strong>${buffer.published ? "\n" : ""}`;
        }

        if(buffer.published) {
            caption += `📅 Опубліковано: <strong>${buffer.published}</strong>`;
        }

        bot.sendVideo(
            msg.chat.id, 
            buffer.url, 
            { 
                reply_to_message_id: msg.message_id, 
                caption, 
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: '🧲 Відкрити в Instagram',
                            url: video_url
                        }]
                    ]
                }
            },
            { filename: `video_${Date.now()}.mp4`, contentType: 'video/mp4' }
        );        
    } catch (error) {
        console.log('⛔️ ' + error.message)
    }
}) 

