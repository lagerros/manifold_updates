import 'dotenv/config';

import { fetchTrackedQuestions, keepAwakeHack } from './database';
import { checkAndSendUpdates, checkForNewAdditions } from './market_ops';

const keepAwakeInterval = 4 * 60 * 1000; // 4 minutes
const loopInterval = 60 * 60 * 1000; // 1 hour

const hourlyTask = async () => {
  try {
    const questions = await fetchTrackedQuestions();
    if (!!questions) {
      await checkForNewAdditions(questions);
      await checkAndSendUpdates(questions);
    }
  } catch (error) {
    console.error(error);
  }
};

setInterval(keepAwakeHack, keepAwakeInterval);
setInterval(hourlyTask, loopInterval);

hourlyTask();
