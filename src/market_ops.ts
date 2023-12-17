import moment from "moment";
import { updateLocalMarket, updateLastSlackInfo as updateDbLastSlackInfo, updateNewTrackedSlackInfo } from "./database";
import { getBets, getComments, getMarket, getUniquePositions, getAggregateMoveData, fetchCorrespondingMarkets } from "./manifold_api";
import { sendSlackMessage } from "./slack";
import { FetchedMarket, LocalMarket, Answer, probChangesType, ChangeNote, ChangeReport } from "./types";
import { formatProb, getCorrespondingMarket, getJsonUrl, getName, ignoreDueToMicroDebugging, isTimeForNewUpdate } from "./util";
import { microDebugging, SLACK_ON, isDeploy, delta, channelId } from "./run_settings";
import {logReportStatus} from "./logging";

const getProbChange = async (contractId: string, t: number): Promise<number> => {
  const bets = await getBets(contractId);
  const recentBets = bets?.filter(bet => moment().diff(moment(bet.createdTime), 'hours') <= t);

  if (recentBets && recentBets.length > 0) {
    const firstBet = recentBets[0];
    const lastBet = recentBets[recentBets.length - 1];
    return firstBet.probBefore - lastBet.probAfter;
  }

  return 0;
};


const getCommentsNote = async (marketId: string, t: number): Promise<{commentsNote:string, num_comments:number}> => {
  if (t === 0) { return {commentsNote:"", num_comments:0} }
  
  const comments = await getComments(marketId, t);
  if (!comments) { return {commentsNote:"", num_comments:0} }
  const filteredComments = comments.filter(comment => !comment.replyToCommentId);
  const latestComments = filteredComments.slice(0, 3);

  const commentsNote = latestComments.map(comment => {
    const commentTexts = comment?.content?.content.map(contentItem => {
      if (contentItem.type === 'paragraph' && contentItem.content) {
        return contentItem?.content.map(textItem => textItem.text).join(' ');
      } else if (contentItem.type === 'iframe') {
        return `(link: ${contentItem.attrs.src})`;
      }
      return '';
    }).join(' ');

    if (commentTexts.length > 0) {
      const text = `:speech_balloon: ${comment.userName}: ${commentTexts.slice(0, 200)}${commentTexts.length > 200 ? '...' : ''}`;
      return text
    } else {
      return ""
    }
  }).join('\n');

  return {commentsNote, num_comments: latestComments.length};
};

const getProbChangesForPeriods = async (contractId: string) => {
  const probChanges = {
    day: await getProbChange(contractId, 24),
    week: await getProbChange(contractId, 24 * 7),
    month: await getProbChange(contractId, 24 * 7 * 4),
  };
  return probChanges;
};

const formatNote = (change: number, period: 'day' | 'week' | 'month'): string => {
  if (change === 0) return ''
  const directionNote = change > 0 ? ':chart_with_upwards_trend: Up' : ':chart_with_downwards_trend: Down';
  return `${directionNote} ${formatProb(change)}% in the last ${period}`;
};

const periods: ('day' | 'week' | 'month')[] = ['day', 'week', 'month'];
const periodHours = { day: 24, week: 24 * 7, month: 24 * 30 };

const checkSignificant = (change: number): boolean => {
  return Math.abs(change) > delta;
}

const getChangeNote = (change:number, period:'day' | 'week' | 'month'): ChangeNote => ({
  reportWorthy: checkSignificant(change),
  changeNote: formatNote(change, period),
  timeWindow: periodHours[period]
})

const changeReportObj = (probChanges:probChangesType) => ({
  day: getChangeNote(probChanges['day'], 'day'),
  week: getChangeNote(probChanges['week'], 'week'),
  month: getChangeNote(probChanges['month'], 'month')
})
  
const zeroProbChanges = { day: 0, week: 0, month: 0 };

const getChangeReport = async (market: FetchedMarket): Promise<ChangeReport> => {
  switch (market.outcomeType) {
    case 'BINARY':
      const probChangesBinary = await getProbChangesForPeriods(market.id);
      return changeReportObj(probChangesBinary);
    case 'MULTIPLE_CHOICE':
      const reportNotes = await Promise.all(market.answers.map(async answer => {
        const probChanges = answer.probChanges ?? zeroProbChanges;
        return changeReportObj(probChanges);
      }));
        
      return reportNotes.reduce((acc: ChangeReport, curr) => {
        return {
          day: !curr.day.reportWorthy ? acc.day : { ...acc.day, changeNote: acc.day.changeNote + curr.day.changeNote + '/n', reportWorthy: true },
          week: !curr.week.reportWorthy ? acc.week : { ...acc.week, changeNote: acc.week.changeNote + curr.week.changeNote + '/n', reportWorthy: true },
          month: !curr.month.reportWorthy ? acc.month : { ...acc.month, changeNote: acc.month.changeNote + curr.month.changeNote + '/n', reportWorthy: true }
        };
      }, changeReportObj(zeroProbChanges));
  }
};

const getMoversNote = async (marketId: string, t: number): Promise<{moversNote:string}> => {
  if (t === 0) return {moversNote:""} 
  const moversResult = await getAggregateMoveData(marketId, t);
  if (!moversResult) {
    console.log("No movers result");
    return { moversNote: "" };
  }
  // TODO
  const { move, counterMove } = moversResult;
  return { moversNote: "" }
}

const getMarketReport = async (market: FetchedMarket): Promise<{ reportWorthy: boolean, changeNote: string, comments: string, num_comments: number, timeWindow: number }> => {
  const allPeriodReports = await getChangeReport(market);
  const earliest = allPeriodReports.day.reportWorthy ? "day" :
                               allPeriodReports.week.reportWorthy ? "week" :
                               allPeriodReports.month.reportWorthy ? "month" : 
                               null;
  if (!earliest) return { reportWorthy: false, changeNote: "", comments: "", num_comments: 0, timeWindow: 0 }; // avoiding calculating some queries if not reportWorthy
  const { reportWorthy, changeNote, timeWindow } = allPeriodReports[earliest]
  const { commentsNote, num_comments } = await getCommentsNote(market.id, timeWindow) 
  const { moversNote } = await getMoversNote(market.id, timeWindow) 
  return { reportWorthy, changeNote, comments: commentsNote, num_comments, timeWindow };
};

const getMoreInfo = async (market: FetchedMarket): Promise<string> => {
  const r = await getUniquePositions(market.id)
  let positionNote = '';
  if (r) {
    positionNote = (
    `:warning: (position data might be somewhat inaccurate)\n`+
    `:large_green_square: YES positions\n`+
    `${r.yesPositions.slice(0, 3).map(p => `--- ${p.userName}: :heavy_dollar_sign:${Math.round(p.shares)}`).join('\n')}\n`+
    `:large_red_square: NO positions:\n`+
    `${r.noPositions.slice(0, 3).map(p => `--- ${p.userName}: :heavy_dollar_sign:${Math.round(p.shares)}`).join('\n')}\n`
    )
  }
  return (
    `Total liquidity: :heavy_dollar_sign:${market.totalLiquidity}\n`+
    `Volume: :heavy_dollar_sign:${Math.round(market.volume24Hours)} (24h), :heavy_dollar_sign:${Math.round(market.volume)} (total)\n`+
    `Unique traders: ${market.uniqueBettorCount}\n\n`+
    `${positionNote}`
  )
}

export const checkAndSendUpdates = async (localMarkets: LocalMarket[]): Promise<void> => {
  const fetchedMarkets = await fetchCorrespondingMarkets(localMarkets);

  fetchedMarkets.forEach(async (fetchedMarket) => {
    const localMarket = getCorrespondingMarket(fetchedMarket, localMarkets);
    if (!localMarket) { console.log("No local market found for fetched market", fetchedMarket.url); return }
   // const reportWorthy = await isReportWorthy(fetchedMarket);
    // TODO add some branching here?
    const { reportWorthy, changeNote, comments, num_comments, timeWindow } = await getMarketReport(fetchedMarket);
    const isUpdateTime = isTimeForNewUpdate(localMarket, timeWindow);
    logReportStatus(reportWorthy, isUpdateTime, changeNote, fetchedMarket.url);

    if (reportWorthy && isUpdateTime) {
      if (SLACK_ON) {
        const slackResponse = await sendSlackMessage({ 
            url: fetchedMarket.url, 
            market_name: getName(fetchedMarket), 
            market_id: fetchedMarket.id, 
            report: changeNote+`${num_comments > 0 ? `\n(${num_comments} comments)` : ""}`, 
            comments, 
            channelId, 
            more_info: await getMoreInfo(fetchedMarket)
          });  
        if (slackResponse?.status === 200 && isDeploy) {
          await updateDbLastSlackInfo(fetchedMarket.url, timeWindow, changeNote);
        }
      }
    }
  })
};


export const checkForNewAdditions = async (localMarkets: LocalMarket[]): Promise<void> => {
  const fetchedMarkets = await fetchCorrespondingMarkets(localMarkets);
  
  fetchedMarkets.forEach(async (fm) => {
    const lm = getCorrespondingMarket(fm, localMarkets);
    if (!lm) {
      console.log("No local market found for fetched market", fm.url);
      return;
    }
    if (!lm.last_track_status_slack_time && !ignoreDueToMicroDebugging(fm.url)) {
      console.log("new tracked market found", fm.url, "\n");

      if (SLACK_ON) {
        const response = await sendSlackMessage({ 
          url: lm.url, 
          market_name: ":seedling: "+fm.question, 
          market_id: fm.id, 
          report: ":eyes: Now tracking this market ^", 
          channelId 
        });
        if (response?.status === 200) {
          console.log("Messaged slack about new market addition, ", fm.question)
          if (isDeploy) {
            await updateNewTrackedSlackInfo(fm.url);
          }
        }
      }
    }
  })  
}
