import axios from "axios";
import { Bet, Market, Comment } from "./types";
import moment from "moment";

export const getMarket = async (url: string): Promise<Market> => {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error occurred while getting market: ${error}`);
    throw error;
  }
}

export const getMarkets = async (): Promise<Market[]> => {
  try {
    const response = await axios.get('https://manifold.markets/api/v0/markets?limit=10');
    return response.data;
  } catch (error) {
    console.error(`Error occurred while getting markets: ${error}`);
    throw error;
  }
};

export const getComments = async (marketId: string, t: number): Promise<Comment[]> => {
  try {
    const response = await axios.get(`https://manifold.markets/api/v0/comments?contractId=${marketId}`);
    const allComments:Comment[] = response.data;
  
    const recentComments = allComments.filter(comment => moment().diff(moment(comment.createdTime), 'hours') <= t);
    return recentComments;
  } catch (error) {
    console.error(`Error occurred while getting comments: ${error}`);
    throw error;
  }
};

export const getBets = async (marketId: string): Promise<Bet[]> => {
  try {
    const response = await axios.get(`https://manifold.markets/api/v0/bets?contractId=${marketId}`);
    return response.data;
  } catch (error) {
    console.error(`Error occurred while getting bets: ${error}`);
    throw error;
  }
};