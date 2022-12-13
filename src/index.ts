import { WebSocketServer, WebSocket } from 'ws';

interface IWsExtended extends WebSocket {
  isAlive?: boolean;
}

interface IWssExtended extends WebSocketServer {
  timer?: NodeJS.Timeout;
}

interface IAuctionState {
  participants: string[];
  activeParticipant: string;
  startTime: number | null;
  delay: number;
}

const auctionState: IAuctionState = {
  participants: ['1', '2', '3', '4'],
  activeParticipant: '1',
  startTime: null,
  delay: 5000
};

function heartbeat(this: IWsExtended) {
  this.isAlive = true;
}

const wss: IWssExtended = new WebSocketServer({
  port: 8081,
  clientTracking: true
});

function setAuctionState() {
  auctionState.startTime = Date.now();
  const current = auctionState.participants.indexOf(
    auctionState.activeParticipant
  );
  auctionState.activeParticipant =
    auctionState.participants[current + 1] || auctionState.participants[0];

  console.log(auctionState);

  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(auctionState));
    }
  });
}

wss.on('connection', function connection(ws: IWsExtended) {
  console.log('new connection', 'total clients: ', wss.clients.size);
  if (wss.clients.size === 1) {
    setAuctionState();
    wss.timer = setInterval(setAuctionState, auctionState.delay);
  }
  ws.send(JSON.stringify(auctionState));

  ws.isAlive = true;
  ws.on('pong', heartbeat);
  ws.on('close', () => {
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

