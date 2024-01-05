import 'dotenv/config';

import { fetchTrackedQuestions, keepAwakeHack, copyProdToDev } from './database';
import { runMigrations } from './database_migrations';
import { checkAndSendUpdates, checkForNewAdditions } from './market_ops';
import { systemHealthUpdate, systemStartUpdate, listenAndSendErrorsToSlack } from './system_health';

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

runMigrations();

setInterval(keepAwakeHack, 4 * 60 * 1000); // 4 minutes
setInterval(hourlyTask, 60 * 60 * 1000); // 1 hour
setInterval(systemHealthUpdate, 24 * 60 * 60 * 1000); // 1 day
setInterval(copyProdToDev, 24 * 60 * 60 * 1000); // 1 day

systemStartUpdate()
hourlyTask();
listenAndSendErrorsToSlack();