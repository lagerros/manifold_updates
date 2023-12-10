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
const SLACK_ON = true;
const trackedQuestions = [
    "https://manifold.markets/MichaelWheatley/who-first-builds-an-artificial-gene",
    "https://manifold.markets/Ledger/will-china-be-competitive-in-the-ll",
    "https://manifold.markets/ZviMowshowitz/will-google-have-the-best-llm-by-eo-b4ad29f8b98d",
    "https://manifold.markets/MatthewBarnett/will-a-machine-learning-training-ru-1fc7686995d5",
    "https://manifold.markets/MatthewBarnett/will-an-entity-purchase-at-least-10",
    "https://manifold.markets/MatthewBarnett/will-an-entity-be-confirmed-to-have",
    "https://manifold.markets/MatthewBarnett/will-nvidias-market-capitalization",
    "https://manifold.markets/MatthewBarnett/will-the-world-economy-grow-by-more-990c1df2ab63",
    "https://manifold.markets/MatthewBarnett/will-any-top-ai-lab-commit-to-a-mor",
    "https://manifold.markets/Duncn/will-humans-deliberately-cause-an-a",
    "https://manifold.markets/BestGuess/will-there-be-a-global-pause-on-cut",
    "https://manifold.markets/SimeonCampos/will-openai-pause-capabilities-rd-b",
    "https://manifold.markets/CalebW/in-2030-will-we-think-flis-6-month",
    "https://manifold.markets/MatthewBarnett/will-we-have-nearcomplete-automatio",
    "https://manifold.markets/MatthewBarnett/will-ais-be-widely-recognized-as-ha-6d69b9aa5a3a",
    "https://manifold.markets/NoaNabeshima/whole-brain-emulation-will-come-bef",
    "https://manifold.markets/logaems/human-whole-brain-emulation-before",
    "https://manifold.markets/rotatingpaguro/whole-primate-brain-connectome-by-2",
    "https://manifold.markets/SneakySly/will-llm-hallucinations-be-a-fixed-0f4541372303",
    "https://manifold.markets/vluzko/will-there-be-an-advance-in-llms-co",
    "https://manifold.markets/PeterWildeford/will-an-llm-have-been-reported-to-e",
    "https://manifold.markets/Austin/will-an-ai-get-gold-on-any-internat",
    "https://manifold.markets/EliezerYudkowsky/is-lecun-right-that-opensource-ai-w",
    "https://manifold.markets/EliezerYudkowsky/will-artificial-superintelligence-e",
    "https://manifold.markets/IsaacKing/by-the-end-of-2028-will-there-be-a-9a7a1b6d31a7",
    "https://manifold.markets/MartinRandall/will-ai-wipe-out-humanity-before-th-d8733b2114a8",
    "https://manifold.markets/EliezerYudkowsky/will-ai-wipe-out-humanity-by-2030-r",
    "https://manifold.markets/EliezerYudkowsky/if-artificial-general-intelligence",
    "https://manifold.markets/EliezerYudkowsky/will-hamas-carry-out-at-least-3-let",
    "https://manifold.markets/levifinkelstein/will-we-find-out-in-2023-about-a-na-0818ad690161",
    "https://manifold.markets/ZviMowshowitz/will-ai-write-75-of-social-media-vi"
];
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
const sendSlackMessage = (url, marketName, marketId, report, comments) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = {
        url,
        market_name: marketName,
        market_id: marketId,
        report,
        comments
    };
    try {
        yield axios_1.default.post('https://hooks.slack.com/triggers/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', payload, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
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
const getChangeReport = (market) => __awaiter(void 0, void 0, void 0, function* () {
    let reportWorthy = false;
    let changeNote = '';
    let commentsNote = '';
    let commentTime = 72; // default value
    const getDirectionAndNote = (change, period) => {
        let direction = '';
        let changeNote = '';
        let time = 72;
        if (change > 0.1) {
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
        if (probChanges.day > 0.1 || probChanges.week > 0.1 || probChanges.month > 0.1) {
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
            if (probChanges.day > 0.1 || probChanges.week > 0.1 || probChanges.month > 0.1) {
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
    return { reportWorthy, changeNote, commentsNote };
});
const checkAndSendUpdates = () => __awaiter(void 0, void 0, void 0, function* () {
    const markets = yield Promise.all(trackedQuestions.map(url => getMarket(getJsonUrl(url))));
    for (const market of markets) {
        const { reportWorthy, changeNote, commentsNote } = yield getChangeReport(market);
        console.log(market.url, "Send report: ", reportWorthy, changeNote);
        if (reportWorthy && SLACK_ON) {
            yield sendSlackMessage(market.url, (market.outcomeType === "BINARY" ? `(${formatProb(market.probability)}%) ` : "") + market.question, market.id, changeNote, commentsNote);
        }
    }
});
checkAndSendUpdates();
