import {SLACK_ON, microDebugging} from "./run_settings";

export const logReportStatus = (
  reportWorthy: boolean,
  isUpdateTime: boolean,
  changeNote: string,
  url: string
): void => {
  console.log(
    `Send report? ${reportWorthy && isUpdateTime}! (reportWorthy ${reportWorthy}, SLACK_ON ${SLACK_ON}, microDebugging ${microDebugging.length > 0}, isTimeForNewUpdate ${isUpdateTime})`,
    changeNote,
    url,
    "\n"
  );
};