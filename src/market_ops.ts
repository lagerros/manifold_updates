import moment from "moment";
import { updateLocalMarket } from "./database";
import { getBets, getComments, getMarket } from "./manifold_api";
import { sendSlackMessage } from "./slack";
import { BinaryMarketWithProbChanges, Market, TrackedMarket } from "./types";
import { formatProb, getJsonUrl, isTimeForNewUpdate } from "./util";

const SLACK_ON = true;
const isDeploy = process.env[`IS_DEPLOY`] === `true`;

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


const getCommentsNote = async (marketId: string, t: number): Promise<string> => {
  const comments = await getComments(marketId, t);
  if (!comments) { return "" }
  const filteredComments = comments.filter(comment => !comment.replyToCommentId);
  const latestComments = filteredComments.slice(0, 3);

  const report = latestComments.map(comment => {
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

  return report;
};

const getChangeReport = async (market: Market): Promise<{ reportWorthy: boolean, changeNote: string, commentsNote: string, timeWindow: number }> => {
  const delta = 0.1;
  const periods: ('day' | 'week' | 'month')[] = ['day', 'week', 'month'];
  const periodHours = { day: 24, week: 24 * 7, month: 24 * 30 };

  const calculateChangeAndNote = (change: number, period: 'day' | 'week' | 'month'): { direction: string, changeNote: string, time: number } => {
    if (Math.abs(change) <= delta) {
      return { direction: '', changeNote: '', time: 72 }
    } else {
      const direction = change > 0 ? ':chart_with_upwards_trend: Up' : ':chart_with_downwards_trend: Down';
      const changeNote = `${direction} ${formatProb(change)}% in the last ${period}`;
      const time = periodHours[period];
      return { direction, changeNote, time };
    }
  };

  const getProbChangesForPeriods = async (contractId: string) => {
    const probChanges = {
      day: await getProbChange(contractId, 24),
      week: await getProbChange(contractId, 24 * 7),
      month: await getProbChange(contractId, 24 * 7 * 4),
    };
    return probChanges;
  };

  const evaluateOutcomeType = async (id: string) => {
    const probChanges = await getProbChangesForPeriods(id);
    const changes = periods.map(period => ({ ...calculateChangeAndNote(probChanges[period], period), period }));
    const significantChange = changes.find(change => change.changeNote !== '');
    return significantChange ? { reportWorthy: true, changeNote: significantChange.changeNote, commentTime: significantChange.time } : { reportWorthy: false, changeNote: '', commentTime: 72 };
  };

  const evaluateMarket = async (m: Market) => {
    switch (m.outcomeType) {
      case 'BINARY':
        return evaluateOutcomeType(m.id);
      case 'MULTIPLE_CHOICE':
        const reportNotes = await Promise.all(m.answers.map(async answer => {
          const { reportWorthy, changeNote } = await evaluateOutcomeType(answer.contractId);
          return reportWorthy ? `Answer "${answer.text}": ${changeNote}` : '';
        }));
        const significantReportNotes = reportNotes.filter(note => note !== '');
        return { reportWorthy: significantReportNotes.length > 0, changeNote: significantReportNotes.join(' '), commentTime: 72 };
      default:
        return { reportWorthy: false, changeNote: '', commentTime: 72 };
    }
  };

  const { reportWorthy, changeNote, commentTime } = await evaluateMarket(market);
  const commentsNote = reportWorthy ? await getCommentsNote(market.id, commentTime) : '';
  return { reportWorthy, changeNote, commentsNote, timeWindow: 24 };
};

export const checkAndSendUpdates = async (localMarkets: TrackedMarket[]): Promise<void> => {
  const fetchedMarkets = await Promise.all(localMarkets.map(m => getMarket(getJsonUrl(m.url))));
  if (!fetchedMarkets) return

  fetchedMarkets.forEach(async (fetchedMarket) => {
    if (!fetchedMarket) return;
    const localMarket = localMarkets.find(q => q.url === fetchedMarket.url);
    const { reportWorthy, changeNote, commentsNote, timeWindow } = await getChangeReport(fetchedMarket);
    const isUpdateTime = !!localMarket && isTimeForNewUpdate(localMarket, timeWindow);
    const toSendReport = reportWorthy && SLACK_ON && isUpdateTime

    console.log(`Send report? ${toSendReport}! (reportWorthy ${reportWorthy}, SLACK_ON ${SLACK_ON}, isTimeForNewUpdate ${isUpdateTime})`, changeNote, fetchedMarket.url);

    const channelId = isDeploy ? "C069HTSPS69" : "C06ACLAUTDE";

    if (toSendReport) {
      const marketName = (fetchedMarket.outcomeType === "BINARY" ? `(${formatProb(fetchedMarket.probability)}%) ` : "") + fetchedMarket.question;
      await sendSlackMessage({ url: fetchedMarket.url, market_name: marketName, market_id: fetchedMarket.id, report: changeNote, comments: commentsNote, channelId, timeWindow });
    }
  });
};
