export interface TrackedMarket {
  _id: string, 
  url: string, 
  lastslacktime?: Date,
  lastslackhourwindow?: number,
  tracked: boolean,
  last_report_sent?: string
  last_track_status_slack_time?: Date,
}

export interface Bet {
  id: string;
  fees: {
    creatorFee: number;
    platformFee: number;
    liquidityFee: number;
  };
  fills?: {
    amount: number, 
    shares: number, 
    timestamp: number,
    matchedBetId: string|null,
  }[];
  isApi?: boolean;
  amount: number;
  isAnte: boolean;
  shares: number;
  userId: string;
  outcome: 'YES' | 'NO';
  isFilled?: boolean;
  userName?: string;
  expiresAt?: number;
  limitProb?: number;
  probAfter: number;
  contractId: string;
  loanAmount: number;
  probBefore: number;
  visibility: 'public' | 'private';
  createdTime: number;
  isCancelled?: boolean;
  isChallenge: boolean;
  orderAmount?: number;
  isRedemption?: boolean;
  userUsername?: string;
  userAvatarUrl?: string;
}

export interface Position {
  id: string;
  fees: {
    creatorFee: number;
    platformFee: number;
    liquidityFee: number;
  };
  fills?: {
    amount: number, 
    shares: number, 
    timestamp: number,
    matchedBetId: string|null,
  }[]; 
  isApi?: boolean;
  amount: number;
  isAnte: boolean;
  shares: number;
  userId: string;
  outcome: 'YES' | 'NO';
  isFilled?: boolean;
  userName?: string;
  probAfter: number;
  contractId: string;
  loanAmount: number;
  probBefore: number;
  visibility: 'public' | 'private'; // Assuming visibility is either 'public' or 'private' based on common usage
  createdTime: number;
  isCancelled?: boolean;
  isChallenge: boolean;
  orderAmount?: number;
  isRedemption?: boolean;
  userUsername?: string;
  userAvatarUrl?: string;
}


export interface probChangesType {
    day: number;
    week: number;
    month: number;
  };

export interface Answer {
  id: string;
  text: string;
  index: number;
  userId: string;
  isOther: boolean;
  textFts: string;
  contractId: string;
  createdTime: number;
  probChanges?: probChangesType;
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

export interface Mover {
  userId: string;
  probChangeTotal: number;
  userName?: string;
  numBets: number;
  probChanges: number[];
  responsibleShare?: number;
}

export interface MoveStats {
  moveSize: number, 
  effect20cohort: number, // proportion of traders responsible for 20% of the move
  effect50cohort: number, // proportion of traders responsible for 50% of the move
  effect80cohort: number, // proportion of traders responsible for 80% of the move
  top3moversEffect: number // proportion effect of the top 3 movers
}

export interface AggregateMove {
  movers: Mover[],
  stats: MoveStats
}