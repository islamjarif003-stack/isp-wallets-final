import { getAccountWalletDb } from '../../config/database';

class SystemService {
  async getSupportChannels() {
    const db = getAccountWalletDb();

    const settings = await db.systemSetting.findMany({
      where: {
        key: {
          in: [
            'support_whatsapp_number',
            'support_telegram_link',
            'support_message_template',
          ],
        },
      },
      select: {
        key: true,
        value: true,
      },
    });

    const settingsMap = Object.fromEntries(
      settings.map(s => [s.key, s.value])
    );

    return {
      whatsappNumber: settingsMap.support_whatsapp_number || null,
      telegramLink: settingsMap.support_telegram_link || null,
      messageTemplate: settingsMap.support_message_template || null,
    };
  }
}

export const systemService = new SystemService();
