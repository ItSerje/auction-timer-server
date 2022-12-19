import { WebSocketServer, WebSocket } from 'ws';
import defaultAuctionState from './defaultAuctionState.json';
import { IAuctionState, IWsExtended, IWssExtended } from './types';
import { STOP_TIMER_AFTER, PORT } from './constants';

const auctionState: IAuctionState = defaultAuctionState;

const wss: IWssExtended = new WebSocketServer({
  port: Number(process.env.PORT) || PORT,
  clientTracking: true
});

wss.isTimerActive = false;
wss.usersOnline = new Set();

wss.sendToAll = (obj: {}) => {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(obj));
    }
  });
};

wss.runInterval = (cb: () => void, totalMinutes: number) => {
  if (!wss.isTimerActive) {
    console.log('timer started at: ', new Date());
    wss.interval = setInterval(() => {
      if (wss.runInterval) wss.runInterval(cb, totalMinutes);
    }, auctionState.waitTime);

    setTimeout(() => {
      clearTimeout(wss.interval);
      wss.isTimerActive = false;
      console.log('timer stopped at: ', new Date());
    }, totalMinutes * 60 * 1000);
  }
  console.log('cb called at: ', new Date());
  cb();
};

const updateAuctionState = () => {
  auctionState.startTime = Date.now();
  const current = auctionState.participants.findIndex(
    (participant) => participant.id === auctionState.activeParticipantId
  );

  auctionState.activeParticipantId =
    auctionState.participants[current + 1]?.id ||
    auctionState.participants[0].id;
};

wss.on('connection', function connection(ws: IWsExtended, request: any) {
  console.log('new connection', 'total clients: ', wss.clients.size);

  if (request.url !== '/null') {
    ws.uid = request.url.slice(2);
  }

  if (
    ws.uid &&
    auctionState.participants.findIndex(
      (participant: { id: string }) => ws.uid === participant.id
    ) !== -1
  ) {
    wss.usersOnline?.add(ws.uid);

    if (wss.sendToAll && wss.usersOnline) {
      wss.sendToAll({ usersOnline: Array.from(wss.usersOnline) });
      console.log('authenticated users: ', wss.usersOnline);
    }
  }

  if (!wss.isTimerActive) {
    if (wss.runInterval)
      wss.runInterval(() => {
        updateAuctionState();
        if (wss.sendToAll) wss.sendToAll({ auctionState });
      }, STOP_TIMER_AFTER);
    wss.isTimerActive = true;
  }

  if (wss.sendToAll) wss.sendToAll({ auctionState });

  ws.on('close', () => {
    if (ws.uid && wss.usersOnline) {
      wss.usersOnline.delete(ws.uid);
      if (wss.sendToAll) {
        wss.sendToAll({ usersOnline: Array.from(wss.usersOnline) });
      }
    }
  });
});
