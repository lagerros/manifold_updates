import { sendDevSlackUpdate } from './slack';
import { devChannelId, devWebhook, isDeploy } from './run_settings';

export const listenAndSendErrorsToSlack = async () => {
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (devWebhook) {
      sendDevSlackUpdate(devWebhook, {channelId: devChannelId, message: `Error in program. Uncaught Exception at: ${error}`})
    }
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    if (devWebhook) {
      sendDevSlackUpdate(devWebhook, {channelId: devChannelId, message: `Error in program. Unhandled Rejection at: ${promise} reason: ${reason}`})
    }
  });
}
  
export const systemHealthUpdate = async (): Promise<void> => {
  if (devWebhook) {
    sendDevSlackUpdate(devWebhook, {channelId: devChannelId, message: `Bot is running (${isDeploy ? ":tophat: production" : ":computer: dev"}). :white_check_mark:`})
  }
}