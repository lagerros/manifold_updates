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
const getMarkets = () => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield axios_1.default.get('https://manifold.markets/api/v0/markets?limit=10');
    return response.data;
});
const getBets = (marketId) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield axios_1.default.get(`https://manifold.markets/api/v0/bets?contractId=${marketId}`);
    return response.data;
});
const sendSlackMessage = (url, marketName, marketId, report) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = {
        url,
        market_name: marketName,
        market_id: marketId,
        report,
    };
    yield axios_1.default.post('https://hooks.slack.com/triggers/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', payload, {
        headers: {
            'Content-Type': 'application/json',
        },
    });
});
const checkBets = () => __awaiter(void 0, void 0, void 0, function* () {
    const markets = yield getMarkets();
    for (const market of markets) {
        const bets = yield getBets(market.id);
        const recentBets = bets.filter(bet => (0, moment_1.default)().diff((0, moment_1.default)(bet.createdTime), 'hours') <= 24);
        if (recentBets.length > -10) {
            const firstBet = recentBets[0];
            const lastBet = recentBets[recentBets.length - 1];
            if (Math.abs(firstBet.probBefore - lastBet.probAfter) > 0.1) {
                yield sendSlackMessage(market.url, market.question, market.id, 'The probability difference is more than 0.1');
            }
        }
    }
});
checkBets();
