import moment from "moment";
// import { updateLastSlackInfo, updateNewTrackedSlackInfo } from "./database";
import { updateLastSlackInfo, updateNewTrackedSlackInfo } from "./airtable";
import {
  getBets,
  getComments,
  getMarket,
  getUniquePositions,
  getAggregateMoveData,
  fetchCorrespondingMarkets,
} from "./manifold_api";
import { sendSlackMessage } from "./slack";
import {
  FetchedMarket,
  LocalMarket,
  Answer,
  probChangesType,
  ChangeNote,
  ChangeReport,
  AggregateMove,
} from "./types";
import {
  formatProb,
  getCorrespondingMarket,
  getJsonUrl,
  getName,
  ignoreDueToMicroDebugging,
  isTimeForNewUpdate,
} from "./util";
import {
  microDebugging,
  SLACK_ON,
  isDeploy,
  delta,
  channelId,
} from "./run_settings";
import { logReportStatus } from "./logging";

const getProbChange = async (
  contractId: string,
  t: number
): Promise<number> => {
  const bets = await getBets(contractId);
  const recentBets = bets?.filter(
    (bet) => moment().diff(moment(bet.createdTime), "hours") <= t
  );

  if (recentBets && recentBets.length > 0) {
    const firstBet = recentBets[0];
    const lastBet = recentBets[recentBets.length - 1];
    return firstBet.probBefore - lastBet.probAfter;
  }

  return 0;
};

const getCommentsNote = async (
  marketId: string,
  t: number
): Promise<{ commentsNote: string; num_comments: number }> => {
  if (t === 0) {
    return { commentsNote: "", num_comments: 0 };
  }

  const comments = await getComments(marketId, t);
  if (!comments) {
    return { commentsNote: "", num_comments: 0 };
  }
  const filteredComments = comments.filter(
    (comment) => !comment.replyToCommentId
  );
  const latestComments = filteredComments.slice(0, 3);

  const commentsNote = latestComments
    .map((comment) => {
      const commentTexts = comment?.content?.content
        .map((contentItem) => {
          if (contentItem.type === "paragraph" && contentItem.content) {
            return contentItem?.content
              .map((textItem) => textItem.text)
              .join(" ");
          } else if (contentItem.type === "iframe") {
            return `(link: ${contentItem.attrs.src})`;
          }
          return "";
        })
        .join(" ");

      if (commentTexts.length > 0) {
        const text = `:speech_balloon: ${
          comment.userName
        }: ${commentTexts.slice(0, 200)}${
          commentTexts.length > 200 ? "..." : ""
        }`;
        return text;
      } else {
        return "";
      }
    })
    .join("\n");

  return { commentsNote, num_comments: latestComments.length };
};

const getProbChangesForPeriods = async (contractId: string) => {
  const probChanges = {
    day: await getProbChange(contractId, 24),
    week: await getProbChange(contractId, 24 * 7),
    month: await getProbChange(contractId, 24 * 7 * 4),
  };
  return probChanges;
};

const formatNote = (
  change: number,
  period: "day" | "week" | "month"
): string => {
  if (change === 0) return "";
  const directionNote =
    change > 0
      ? " :chart_with_upwards_trend: Up"
      : " :chart_with_downwards_trend: Down";
  return `${directionNote} ${formatProb(change)} in the last ${period}`;
};

const periods: ("day" | "week" | "month")[] = ["day", "week", "month"];
const periodHours = { day: 24, week: 24 * 7, month: 24 * 30 };

const checkSignificant = (change: number): boolean => {
  return Math.abs(change) > delta;
};

const getChangeNote = (
  change: number,
  period: "day" | "week" | "month",
  prefix: string
): ChangeNote => ({
  reportWorthy: checkSignificant(change),
  changeNote: prefix + formatNote(change, period),
  timeWindow: periodHours[period],
});

const changeReportObj = (probChanges: probChangesType, prefix?: string) => {
  const pre = prefix ?? "";
  return {
    day: getChangeNote(probChanges["day"], "day", pre),
    week: getChangeNote(probChanges["week"], "week", pre),
    month: getChangeNote(probChanges["month"], "month", pre),
  };
};

const zeroProbChanges = { day: 0, week: 0, month: 0 };

const getChangeReport = async (
  market: FetchedMarket
): Promise<ChangeReport> => {
  switch (market.outcomeType) {
    case "BINARY":
      const probChangesBinary = await getProbChangesForPeriods(market.id);
      return changeReportObj(probChangesBinary);
    case "MULTIPLE_CHOICE":
      const reportNotes = await Promise.all(
        market.answers.map(async (answer) => {
          const probChanges = answer.probChanges ?? zeroProbChanges;
          return changeReportObj(probChanges, answer.text + ": ");
        })
      );

      return reportNotes.reduce((acc: ChangeReport, curr) => {
        return {
          day: !curr.day.reportWorthy
            ? acc.day
            : {
                ...acc.day,
                changeNote: acc.day.changeNote + curr.day.changeNote + "\n",
                reportWorthy: true,
              },
          week: !curr.week.reportWorthy
            ? acc.week
            : {
                ...acc.week,
                changeNote: acc.week.changeNote + curr.week.changeNote + "\n",
                reportWorthy: true,
              },
          month: !curr.month.reportWorthy
            ? acc.month
            : {
                ...acc.month,
                changeNote: acc.month.changeNote + curr.month.changeNote + "\n",
                reportWorthy: true,
              },
        };
      }, changeReportObj(zeroProbChanges));
  }
};

const getMoveEmoji = (moveSize: number): string => {
  if (moveSize > 0) return ":woman-woman-girl:";
  if (moveSize === 0) return ":family:";
  if (moveSize < 0) return ":man-man-boy:";
  return ":red_circle:";
};

const getLongMoveNote = (move: AggregateMove): string => {
  return `Top 3 traders effect: ${formatProb(move.stats.top3moversEffect)}\n
    Effect percentile (proportion of traders needed to get this percentile of the market move): 20th: ${formatProb(
      move.stats.effect20cohort
    )}, 50th: ${formatProb(move.stats.effect50cohort)}, 80th: ${formatProb(
    move.stats.effect80cohort
  )}\n
    ${move.movers
      .slice(0, 3)
      .map(
        (m) =>
          `--- ${m.userName}: ${formatProb(m.probChangeTotal)} (${
            m.numBets
          } bets)`
      )
      .join("\n")}\n
  `;
};

const getMoversNote = async (
  marketId: string,
  t: number
): Promise<{ briefMoversNote: string; longMoversNote: string }> => {
  if (t === 0) return { briefMoversNote: "", longMoversNote: "" };
  const moversResult = await getAggregateMoveData(marketId, t);
  if (!moversResult) {
    console.log("No movers result");
    return { briefMoversNote: "", longMoversNote: "" };
  }
  // TODO
  const { move, counterMove } = moversResult;

  const longMoversNote =
    `\n${getMoveEmoji(move.stats.moveSize)} ${move.movers.length} Movers\n` +
    getLongMoveNote(move) +
    `${getMoveEmoji(counterMove.stats.moveSize)} ${
      counterMove.movers.length
    } Countermovers\n` +
    getLongMoveNote(counterMove);

  return { briefMoversNote: "", longMoversNote };
};

const getMarketReport = async (
  market: FetchedMarket
): Promise<{
  reportWorthy: boolean;
  changeNote: string;
  comments: string;
  num_comments: number;
  longMoversNote: string;
  timeWindow: number;
}> => {
  const allPeriodReports = await getChangeReport(market);
  const earliest = allPeriodReports.day.reportWorthy
    ? "day"
    : allPeriodReports.week.reportWorthy
    ? "week"
    : allPeriodReports.month.reportWorthy
    ? "month"
    : null;
  if (!earliest)
    return {
      reportWorthy: false,
      changeNote: "",
      comments: "",
      num_comments: 0,
      longMoversNote: "",
      timeWindow: 0,
    }; // avoiding calculating some queries if not reportWorthy
  const { reportWorthy, changeNote, timeWindow } = allPeriodReports[earliest];
  const { commentsNote, num_comments } = await getCommentsNote(
    market.id,
    timeWindow
  );
  const { briefMoversNote, longMoversNote } = await getMoversNote(
    market.id,
    timeWindow
  );
  return {
    reportWorthy,
    changeNote,
    comments: commentsNote,
    num_comments,
    longMoversNote,
    timeWindow,
  };
};

const getMoreInfo = async (market: FetchedMarket): Promise<string> => {
  const r = await getUniquePositions(market.id);
  let positionNote = "";
  if (r) {
    positionNote =
      `:warning: (position data might be somewhat inaccurate)\n` +
      `:large_green_square: YES positions\n` +
      `${r.yesPositions
        .slice(0, 3)
        .map(
          (p) => `--- ${p.userName}: :heavy_dollar_sign:${Math.round(p.shares)}`
        )
        .join("\n")}\n` +
      `:large_red_square: NO positions:\n` +
      `${r.noPositions
        .slice(0, 3)
        .map(
          (p) => `--- ${p.userName}: :heavy_dollar_sign:${Math.round(p.shares)}`
        )
        .join("\n")}\n`;
  }
  return (
    `Total liquidity: :heavy_dollar_sign:${market.totalLiquidity}\n` +
    `Volume: :heavy_dollar_sign:${Math.round(
      market.volume24Hours
    )} (24h), :heavy_dollar_sign:${Math.round(market.volume)} (total)\n` +
    `Unique traders: ${market.uniqueBettorCount}\n\n` +
    `${positionNote}`
  );
};

export const checkAndSendUpdates = async (
  localMarkets: LocalMarket[]
): Promise<void> => {
  console.log("Starting checkAndSendUpdates...");
  const pairs = await fetchCorrespondingMarkets(localMarkets);
  console.log(`Fetched ${pairs.length} market pairs.`);
  if (pairs.length < localMarkets.length) {
    console.warn(
      `!! Warning: Fetched fewer pairs (${pairs.length}) than local markets (${localMarkets.length}). Some markets may be missing.`
    );
  }

  for (const { fetchedMarket, localMarket } of pairs) {
    console.log(`Processing market: ${fetchedMarket.url}`);
    const {
      reportWorthy,
      changeNote,
      comments,
      num_comments,
      longMoversNote,
      timeWindow,
    } = await getMarketReport(fetchedMarket);

    console.log(`Market report for ${fetchedMarket.url}:`, {
      reportWorthy,
      changeNote,
      timeWindow,
    });

    const isUpdateTime = isTimeForNewUpdate(localMarket, timeWindow);
    logReportStatus(reportWorthy, isUpdateTime, changeNote, fetchedMarket.url);

    if (
      (reportWorthy && isUpdateTime) ||
      !isDeploy // && !ignoreDueToMicroDebugging(fetchedMarket.url))
    ) {
      if (SLACK_ON) {
        console.log(`Sending Slack message for market: ${fetchedMarket.url}`);
        const slackResponse = await sendSlackMessage({
          url: fetchedMarket.url,
          market_name: getName(fetchedMarket),
          market_id: fetchedMarket.id,
          report:
            changeNote +
            `${num_comments > 0 ? `\n(${num_comments} comments)` : ""}`,
          comments,
          channelId,
          more_info: (await getMoreInfo(fetchedMarket)) + longMoversNote,
        });
        if (slackResponse?.status === 200) {
          console.log(
            `Slack message sent successfully for ${fetchedMarket.url}`
          );
          await updateLastSlackInfo(localMarket.url, timeWindow, changeNote);
        } else {
          console.error(
            `Failed to send Slack message for ${fetchedMarket.url}`
          );
        }
      }
    }
  }
  console.log("Finished checkAndSendUpdates.\n");
};

export const checkForNewAdditions = async (
  localMarkets: LocalMarket[]
): Promise<void> => {
  console.log("\nStarting checkForNewAdditions...");
  const pairs = await fetchCorrespondingMarkets(localMarkets);
  console.log(`Fetched ${pairs.length} market pairs.`);

  for (const { fetchedMarket, localMarket } of pairs) {
    if (!localMarket) {
      console.log(
        "No local market found for fetched market",
        fetchedMarket.url
      );
      continue;
    }

    console.log(
      `Checking new addition for market: ${fetchedMarket.url}, last_track_status_slack_time: ${localMarket.last_track_status_slack_time}`
    );

    if (
      !localMarket.last_track_status_slack_time ||
      (!isDeploy && !ignoreDueToMicroDebugging(fetchedMarket.url))
    ) {
      console.log("New tracked market found:", fetchedMarket.url);

      if (SLACK_ON) {
        console.log(
          `Sending Slack message for new market addition: ${fetchedMarket.url}`
        );
        const response = await sendSlackMessage({
          url: localMarket.url,
          market_name: ":seedling: " + fetchedMarket.question,
          market_id: fetchedMarket.id,
          report: ":eyes: Now tracking this market ^",
          channelId,
        });
        if (response?.status === 200) {
          console.log(
            "Messaged Slack about new market addition:",
            fetchedMarket.question
          );
          await updateNewTrackedSlackInfo(fetchedMarket.url);
        } else {
          console.error(
            `Failed to send Slack message for ${fetchedMarket.url}`
          );
        }
      }
    }
  }
  console.log("Finished checkForNewAdditions.\n");
};
