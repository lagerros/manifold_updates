import 'dotenv/config';

import { fetchTrackedQuestions } from './database';
import { checkAndSendUpdates } from './market_ops';
import { sleep } from './util';

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application specific logging, throwing an error, or other logic here
});

const loop = async () => {
  while (true) {
    try {
      const questions = await fetchTrackedQuestions();
      await checkAndSendUpdates(questions);
    } catch (error) {
      console.error(error);
    }
    await sleep(60 * 60 * 1000); 
  }
};

loop();
