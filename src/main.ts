import "dotenv/config";

import {
  fetchTrackedQuestions,
  updateLastSlackInfo,
  updateNewTrackedSlackInfo,
  keepAwakeHack,
  copyProdToDev,
} from "./airtable.js";
import { runMigrations } from "./database_migrations.js";
import { checkAndSendUpdates, checkForNewAdditions } from "./market_ops.js";
import {
  systemHealthUpdate,
  systemStartUpdate,
  listenAndSendErrorsToSlack,
} from "./system_health.js";
import chalk from "chalk";

const hourlyTask = async () => {
  try {
    console.log(chalk.bgGrey("Starting hourlyTask..."));
    const questions = await fetchTrackedQuestions();
    if (!!questions) {
      console.log(`Fetched ${questions.length} tracked questions.`);
      await checkForNewAdditions(questions);
      await checkAndSendUpdates(questions);
    } else {
      console.log("No tracked questions fetched.");
    }
    console.log(chalk.bgGrey("Finished hourlyTask.\n"));
  } catch (error) {
    console.error(chalk.red("Error in hourlyTask:", error));
  }
};

// runMigrations();

setInterval(() => {
  console.log("Running keepAwakeHack...");
  keepAwakeHack();
}, 4 * 60 * 1000); // 4 minutes

setInterval(() => {
  console.log("Running hourlyTask...");
  hourlyTask();
}, 20 * 1000); // 60 * 60 * 1000); // 1 hour

setInterval(() => {
  console.log("Running systemHealthUpdate...");
  systemHealthUpdate();
}, 24 * 60 * 60 * 1000); // 1 day

setInterval(() => {
  console.log("Running copyProdToDev...");
  copyProdToDev();
}, 24 * 60 * 60 * 1000); // 1 day

console.log(chalk.bold(chalk.bgWhite(">>>> Starting application...")));
systemStartUpdate();
hourlyTask();
listenAndSendErrorsToSlack();
