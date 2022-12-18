import { WebSocketServer, WebSocket } from 'ws';

export interface IWsExtended extends WebSocket {
  uid?: string;
}

export interface IWssExtended extends WebSocketServer {
  usersOnline?: Set<string>;
  isTimerActive?: boolean;
  interval?: NodeJS.Timer;
  sendToAll?: (obj: {}) => void;
  runInterval?: (cb: () => void, totalMinutes: number) => void;
}

interface IParameters {
  [key: string]: string;
}

export interface IAuctionState {
  parameters: IParameters;
  participants: {
    id: string;
    name: string;
    currentOffer: {
      [key: keyof IParameters]:
        | string
        | {
            [key: string]: string;
          };
    };
  }[];
  activeParticipantId: string;
  startTime: number | null;
  waitTime: number;
}
