export interface TrackedMarket {
  _id: string, 
  url: string, 
  lastslacktime?: Date,
  lastslackhourwindow?: number,
  tracked: boolean,
  last_report_sent?: string
}

export interface Bet {
  createdTime: string;
  probBefore: number;
  probAfter: number;
}

export interface Answer {
  id: string;
  text: string;
  index: number;
  userId: string;
  isOther: boolean;
  textFts: string;
  contractId: string;
  createdTime: number;
  probChanges?: {
    day: number;
    week: number;
    month: number;
  };
  subsidyPool: number;
  fsUpdatedTime: string;
  totalLiquidity: number;
  pool: {
    YES: number;
    NO: number;
  };
  probability: number;
}

export interface MultipleChoiceMarket {
  id: string;
  creatorId: string;
  creatorUsername: string;
  creatorName: string;
  createdTime: number;
  creatorAvatarUrl: string;
  closeTime: number;
  question: string;
  slug: string;
  url: string;
  totalLiquidity: number;
  outcomeType: "MULTIPLE_CHOICE";
  mechanism: string;
  volume: number;
  volume24Hours: number;
  isResolved: boolean;
  uniqueBettorCount: number;
  lastUpdatedTime: number;
  lastBetTime: number;
  answers: Answer[];
  description: {
    type: string;
    content: any[];
  };
  groupSlugs: string[];
  textDescription: string;
}

export interface BinaryMarket {
  id: string;
  creatorId: string;
  creatorUsername: string;
  creatorName: string;
  createdTime: number;
  creatorAvatarUrl: string;
  closeTime: number;
  question: string;
  slug: string;
  url: string;
  pool: {
    NO: number;
    YES: number;
  };
  probability: number;
  p: number;
  totalLiquidity: number;
  outcomeType: "BINARY";
  mechanism: string;
  volume: number;
  volume24Hours: number;
  isResolved: boolean;
  uniqueBettorCount: number;
  lastUpdatedTime: number;
  lastBetTime: number;
  description: {
    type: string;
    content: any[];
  };
  groupSlugs: string[];
  textDescription: string;
}

export type Market = MultipleChoiceMarket | BinaryMarket;

export type ParagraphContent = {
  type: "paragraph";
  content: {
    text: string;
    type: string;
  }[];
};

export type IframeContent = {
  type: "iframe";
  attrs: {
    src: string;
    frameBorder: number;
  };
};

export type ContentItem = ParagraphContent | IframeContent;


export type Comment = {
  id: string;
  isApi: boolean;
  userId: string;
  content: {
    type: string;
    content: ContentItem[];
  };
  userName: string;
  contractId: string;
  visibility: string;
  commentType: string;
  createdTime: number;
  contractSlug: string;
  userUsername: string;
  userAvatarUrl: string;
  contractQuestion: string;
  replyToCommentId?: string;
  commenterPositionProb?: number;
  commenterPositionShares?: number;
  commenterPositionOutcome?: string;
  commentId: string;
  betId?: string;
  likes?: number;
  betAmount?: number;
  betOutcome?: string;
  editedTime?: number;
};

export interface BinaryMarketWithProbChanges extends BinaryMarket {
  probChanges: {
    day: number;
    week: number;
    month: number;
  };
}