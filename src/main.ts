import 'dotenv/config';

import { fetchTrackedQuestions, keepAwakeHack } from './database';
import { checkAndSendUpdates } from './market_ops';

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const keepAwakeInterval = 4 * 60 * 1000; // 4 minutes
const loopInterval = 60 * 60 * 1000; // 1 hour

const hourlyTask = async () => {
  try {
    const questions = await fetchTrackedQuestions();
    if (!!questions) {
      await checkAndSendUpdates(questions);
    }
  } catch (error) {
    console.error(error);
  }
};

setInterval(keepAwakeHack, keepAwakeInterval);
setInterval(hourlyTask, loopInterval);

hourlyTask();
