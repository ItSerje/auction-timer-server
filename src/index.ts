import { WebSocketServer, WebSocket } from 'ws';
import defaultAuctionState from './defaultAuctionState.json';

interface IWsExtended extends WebSocket {
  uid?: string;
  isAlive?: boolean;
}

interface IWssExtended extends WebSocketServer {
  usersOnline?: Set<string>;
  timer?: NodeJS.Timeout;
}

interface IParameters {
  [key: string]: string;
}

interface IAuctionState {
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

const auctionState: IAuctionState = defaultAuctionState;

function heartbeat(this: IWsExtended) {
  this.isAlive = true;
}

const wss: IWssExtended = new WebSocketServer({
  port: 8081,
  clientTracking: true
});

wss.usersOnline = new Set();

function setAuctionState() {
  auctionState.startTime = Date.now();

  const current = auctionState.participants.findIndex(
    (el) => el.id === auctionState.activeParticipantId
  );

  auctionState.activeParticipantId =
    auctionState.participants[current + 1]?.id ||
    auctionState.participants[0].id;

  console.log(auctionState.activeParticipantId);

  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ auctionState }));
    }
  });
}

wss.on('connection', function connection(ws: IWsExtended, request: any) {
  console.log('new connection', 'total clients: ', wss.clients.size);
  console.log('url: ', request.url.slice(2));
  const uid: string = request.url.slice(2);

  if (
    uid &&
    auctionState.participants.findIndex(
      (participant: { id: any }) => uid === participant.id
    ) !== -1
  ) {
    ws.uid = uid;
    wss.usersOnline?.add(uid);

    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN && wss.usersOnline) {
        client.send(
          JSON.stringify({ usersOnline: Array.from(wss.usersOnline) })
        );
      }
    });
  }

  if (wss.clients.size === 1) {
    setAuctionState();
    wss.timer = setInterval(setAuctionState, auctionState.waitTime);
  }
  ws.send(JSON.stringify(auctionState));

  ws.isAlive = true;
  ws.on('pong', heartbeat);
  ws.on('close', () => {
    if (ws.uid) {
      wss.usersOnline?.delete(ws.uid);
      wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN && wss.usersOnline) {
          client.send(
            JSON.stringify({ usersOnline: Array.from(wss.usersOnline) })
          );
        }
      });
    }

    if (wss.clients.size === 0) {
      clearInterval(wss.timer);
    }
  });
});

const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws: IWsExtended) {
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', function close() {
  console.log('closed');
  clearInterval(interval);
});
