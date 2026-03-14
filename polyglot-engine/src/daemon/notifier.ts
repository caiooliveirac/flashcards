const TELEGRAM_API = "https://api.telegram.org";

export async function sendNotification(message: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) return;

    try {
        const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
        await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: "HTML",
                disable_web_page_preview: true,
            }),
        });
    } catch (err) {
        console.error("[NOTIFIER] Failed to send Telegram message:", err);
    }
}
