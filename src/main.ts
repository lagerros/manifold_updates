import 'dotenv/config';

import { fetchTrackedQuestions } from './database';
import { checkAndSendUpdates } from './market_ops';
import { sleep } from './util';

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
