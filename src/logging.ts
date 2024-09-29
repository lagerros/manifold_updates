import chalk from "chalk";
import { SLACK_ON, microDebugging } from "./run_settings.js";

export const logReportStatus = (
  reportWorthy: boolean,
  isUpdateTime: boolean,
  changeNote: string,
  url: string
): void => {
  console.log(
    chalk.bold(`Send report?`),
    reportWorthy && isUpdateTime ? chalk.green(`Yes`) : chalk.red(`No`),
    chalk.dim(
      `(reportWorthy ${reportWorthy}, SLACK_ON ${SLACK_ON}, microDebugging ${
        microDebugging.length > 0
      }, isTimeForNewUpdate ${isUpdateTime})`,
      changeNote,
      chalk.underline(url),
      "\n"
    )
  );
};
