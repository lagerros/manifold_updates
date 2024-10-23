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

const minutelyTask = async () => {
  try {
    console.log(chalk.bgGrey("Starting minutelyTask..."));
    const questions = await fetchTrackedQuestions();
    if (!!questions) {
      console.log(`Fetched ${questions.length} tracked questions.`);
      await checkForNewAdditions(questions);
      await checkAndSendUpdates(questions);
    } else {
      console.log("No tracked questions fetched.");
    }
    console.log(chalk.bgGrey("Finished minutelyTask.\n"));
  } catch (error) {
    console.error(chalk.red("Error in minutelyTask:", error));
  }
};

// runMigrations();

// setInterval(() => {
//   console.log("Running keepAwakeHack...");
//   keepAwakeHack();
// }, 4 * 60 * 1000); // 4 minutes

setInterval(() => {
  console.log("Running minutelyTask...");
  minutelyTask();
}, 5 * 60 * 1000); // 1 minute

setInterval(() => {
  console.log("Running systemHealthUpdate...");
  systemHealthUpdate();
}, 24 * 60 * 60 * 1000); // 1 day

// setInterval(() => {
//   console.log("Running copyProdToDev...");
//   copyProdToDev();
// }, 24 * 60 * 60 * 1000); // 1 day

console.log(chalk.bold(chalk.bgWhite(">>>> Starting application...")));
systemStartUpdate();
minutelyTask();
listenAndSendErrorsToSlack();
