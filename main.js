"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const moment_1 = __importDefault(require("moment"));
const pg_1 = require("pg");
require("dotenv/config");
const isDeploy = process.env[`IS_DEPLOY`] === `true`;
console.log("Is deploy: ", isDeploy);
const client = new pg_1.Client({
    connectionString: process.env['DATABASE_URL'],
    ssl: {
        rejectUnauthorized: false
    }
});
client.connect(err => {
    if (err) {
        console.error('Failed to connect to the database!', err.stack);
    }
    else {
        console.log('Successfully connected to the database.');
        // Here you can proceed to execute queries on the database
    }
});
const SLACK_ON = true;
const fetchTrackedQuestions = () => __awaiter(void 0, void 0, void 0, function* () {
    const queryText = 'SELECT _id, url, lastslacktime, lastslackhourwindow, tracked FROM markets WHERE tracked = true';
    try {
        const res = yield client.query(queryText);
        const trackedMarkets = res.rows.map(row => ({
            _id: row._id,
            url: row.url,
            lastslacktime: row.lastslacktime,
            lastslackhourwindow: row.lastslackhourwindow,
            tracked: row.tracked
        }));
        return trackedMarkets;
    }
    catch (error) {
        console.error('Error fetching tracked questions', error);
        throw error;
    }
});
const getJsonUrl = (url) => {
    const urlObj = new URL(url);
    const slug = urlObj.pathname.split('/').pop();
    return `https://manifold.markets/api/v0/slug/${slug}`;
};
const getMarket = (url) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield axios_1.default.get(url);
        return response.data;
    }
    catch (error) {
        console.error(`Error occurred while getting market: ${error}`);
        throw error;
    }
});
const getMarkets = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield axios_1.default.get('https://manifold.markets/api/v0/markets?limit=10');
        return response.data;
    }
    catch (error) {
        console.error(`Error occurred while getting markets: ${error}`);
        throw error;
    }
});
const getComments = (marketId, t) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield axios_1.default.get(`https://manifold.markets/api/v0/comments?contractId=${marketId}`);
        const allComments = response.data;
        const recentComments = allComments.filter(comment => (0, moment_1.default)().diff((0, moment_1.default)(comment.createdTime), 'hours') <= t);
        return recentComments;
    }
    catch (error) {
        console.error(`Error occurred while getting comments: ${error}`);
        throw error;
    }
});
const getBets = (marketId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield axios_1.default.get(`https://manifold.markets/api/v0/bets?contractId=${marketId}`);
        return response.data;
    }
    catch (error) {
        console.error(`Error occurred while getting bets: ${error}`);
        throw error;
    }
});
const updateLastSlackInfo = (url, timeWindow) => __awaiter(void 0, void 0, void 0, function* () {
    const queryText = `
    UPDATE markets
    SET lastSlackTime = NOW(), lastSlackHourWindow = $1
    WHERE url = $2
  `;
    try {
        yield client.query(queryText, [timeWindow, url]);
        console.log('Updated lastSlackTime and lastSlackHourWindow in the database.');
    }
    catch (error) {
        console.error('Error updating lastSlackTime and lastSlackHourWindow in the database:', error);
    }
});
const sendSlackMessage = (url, marketName, marketId, report, channelId, comments, timeWindow) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = {
        url,
        market_name: marketName,
        market_id: marketId,
        report,
        comments
    };
    try {
        const response = yield axios_1.default.post('https://hooks.slack.com/triggers/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', payload, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (response.status === 200 && timeWindow) {
            // Slack message sent successfully, update database
            yield updateLastSlackInfo(url, timeWindow);
        }
    }
    catch (error) {
        console.error(`Error occurred while sending Slack message: ${error}`);
    }
});
const getProbChange = (contractId, t) => __awaiter(void 0, void 0, void 0, function* () {
    const bets = yield getBets(contractId);
    const recentBets = bets.filter(bet => (0, moment_1.default)().diff((0, moment_1.default)(bet.createdTime), 'hours') <= t);
    if (recentBets.length > 0) {
        const firstBet = recentBets[0];
        const lastBet = recentBets[recentBets.length - 1];
        return Math.abs(firstBet.probBefore - lastBet.probAfter);
    }
    return 0;
});
const formatProb = (prob) => Math.round(prob * 100).toString();
const getCommentsNote = (marketId, t) => __awaiter(void 0, void 0, void 0, function* () {
    const comments = yield getComments(marketId, t);
    const filteredComments = comments.filter(comment => !comment.replyToCommentId);
    const latestComments = filteredComments.slice(0, 3);
    const report = latestComments.map(comment => {
        var _a;
        const commentTexts = (_a = comment === null || comment === void 0 ? void 0 : comment.content) === null || _a === void 0 ? void 0 : _a.content.map(contentItem => {
            if (contentItem.type === 'paragraph' && contentItem.content) {
                return contentItem === null || contentItem === void 0 ? void 0 : contentItem.content.map(textItem => textItem.text).join(' ');
            }
            else if (contentItem.type === 'iframe') {
                return `(link: ${contentItem.attrs.src})`;
            }
            return '';
        }).join(' ');
        if (commentTexts.length > 0) {
            const text = `:speech_balloon: ${comment.userName}: ${commentTexts.slice(0, 200)}${commentTexts.length > 200 ? '...' : ''}`;
            return text;
        }
        else {
            return "";
        }
    }).join('\n');
    return report;
});
// TODO: move commentTime and timeWindow into same variable? 
const getChangeReport = (market) => __awaiter(void 0, void 0, void 0, function* () {
    let reportWorthy = false;
    let changeNote = '';
    let commentsNote = '';
    let timeWindow = 24;
    let commentTime = 72; // default value
    const delta = 0.02;
    const getDirectionAndNote = (change, period) => {
        let direction = '';
        let changeNote = '';
        let time = 72;
        if (change > delta) {
            direction = change > 0 ? ':chart_with_upwards_trend: Up' : ':chart_with_downwards_trend: Down';
            changeNote = `${direction} ${formatProb(change)}% in the last ${period}`;
            time = period === 'day' ? 24 : period === 'week' ? 24 * 7 : 24 * 30;
        }
        return { direction, changeNote, time };
    };
    if (market.outcomeType === 'BINARY') {
        const probChanges = {
            day: yield getProbChange(market.id, 24),
            week: yield getProbChange(market.id, 24 * 7),
            month: yield getProbChange(market.id, 24 * 30),
        };
        const marketWithChanges = Object.assign(Object.assign({}, market), { probChanges });
        if (probChanges.day > delta || probChanges.week > delta || probChanges.month > delta) {
            reportWorthy = true;
            let { changeNote: dayNote, time: dayTime } = getDirectionAndNote(probChanges.day, 'day');
            let { changeNote: weekNote, time: weekTime } = getDirectionAndNote(probChanges.week, 'week');
            let { changeNote: monthNote, time: monthTime } = getDirectionAndNote(probChanges.month, 'month');
            changeNote = dayNote || weekNote || monthNote;
            commentTime = dayNote ? dayTime : weekNote ? weekTime : monthTime;
        }
    }
    else if (market.outcomeType === 'MULTIPLE_CHOICE') {
        const reportNotes = [];
        for (const answer of market.answers) {
            let { probChanges } = answer;
            if (!probChanges) {
                probChanges = {
                    day: yield getProbChange(answer.contractId, 24),
                    week: yield getProbChange(answer.contractId, 24 * 7),
                    month: yield getProbChange(answer.contractId, 24 * 30),
                };
            }
            if (probChanges.day > delta || probChanges.week > delta || probChanges.month > delta) {
                reportWorthy = true;
                let { changeNote: dayNote, time: dayTime } = getDirectionAndNote(probChanges.day, 'day');
                let { changeNote: weekNote, time: weekTime } = getDirectionAndNote(probChanges.week, 'week');
                let { changeNote: monthNote, time: monthTime } = getDirectionAndNote(probChanges.month, 'month');
                const reportNote = dayNote || weekNote || monthNote;
                reportNotes.push(`Answer "${answer.text}": ` + changeNote);
                commentTime = dayNote ? dayTime : weekNote ? weekTime : monthTime;
            }
        }
        changeNote = reportNotes.join(' ');
    }
    if (reportWorthy) {
        commentsNote = yield getCommentsNote(market.id, commentTime);
    }
    return { reportWorthy, changeNote, commentsNote, timeWindow };
});
const updateLocalMarket = (id, lastslacktime, lastslackhourwindow, last_report_sent) => __awaiter(void 0, void 0, void 0, function* () {
    const queryText = `
    UPDATE markets
    SET lastslacktime = $1, lastslackhourwindow = $2, last_report_sent = $3
    WHERE _id = $4
    `;
    try {
        yield client.query(queryText, [lastslacktime, lastslackhourwindow, last_report_sent, id]);
        console.log('Local market updated in the database.');
    }
    catch (error) {
        console.error('Error updating local market in the database:', error);
    }
});
const checkAndSendUpdates = (localMarkets) => __awaiter(void 0, void 0, void 0, function* () {
    const fetchedMarkets = yield Promise.all(localMarkets.map(q => getMarket(getJsonUrl(q.url)))); // todo: this is silly, fix
    for (const fetchedMarket of fetchedMarkets) {
        const localMarket = localMarkets.find(q => q.url === fetchedMarket.url);
        const { reportWorthy, changeNote, commentsNote, timeWindow } = yield getChangeReport(fetchedMarket);
        const isTimeForNewUpdate = !!localMarket && (!localMarket.lastslacktime ? true : ((Date.now() - new Date(localMarket.lastslacktime).getTime()) > (timeWindow * 60 * 60 * 1000)));
        const toSendReport = (reportWorthy && SLACK_ON && isTimeForNewUpdate);
        console.log("Send report? ", toSendReport, changeNote, fetchedMarket.url);
        const channelId = isDeploy ? "C069HTSPS69" : "C069C8Z94RY";
        if (toSendReport) {
            const marketName = (fetchedMarket.outcomeType === "BINARY" ? `(${formatProb(fetchedMarket.probability)}%) ` : "") + fetchedMarket.question;
            yield sendSlackMessage(fetchedMarket.url, marketName, fetchedMarket.id, changeNote, commentsNote, channelId);
            updateLocalMarket(localMarket._id, new Date(), timeWindow, changeNote);
        }
    }
});
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const loop = () => __awaiter(void 0, void 0, void 0, function* () {
    while (true) {
        try {
            const questions = yield fetchTrackedQuestions();
            yield checkAndSendUpdates(questions);
        }
        catch (error) {
            console.error(error);
        }
        yield sleep(60 * 60 * 1000); // 10 seconds delay before proceeding to the next iteration of the loop
    }
});
loop(); // assume takes 1 second to run
