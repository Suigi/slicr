import { describe, expect, it } from 'vitest';
import { computeDiagramGeometry, matchDiagramGeometry } from './diagramHarness';
import type { DiagramExpectation } from './diagramHarness';
import type { GeometryHarnessOptions } from './diagramHarness';

async function assertGeometry(dsl: string, expectedGeometry: DiagramExpectation, options?: GeometryHarnessOptions) {
  const actualGeometry = await computeDiagramGeometry(dsl, options);
  const failures = matchDiagramGeometry(actualGeometry, expectedGeometry);
  expect(failures).toEqual([]);
}

describe('diagramHarness', () => {

  it('renders single, simple node', async () => {
    const dsl = `
slice "Harness"

evt:simple-event
`;
    const expectedGeometry = {
      "nodes": [
        {"key":"simple-event","x":50,"y":0,"w":180,"h":42}
      ],
      "edges": [  ]
    };

    await assertGeometry(dsl, expectedGeometry);
  });

  it('renders simple flow with three lanes', async () => {
    const dsl = `
slice "Harness"

evt:simple-event

rm:simple-read-model
<- evt:simple-event

ui:simple-ui
<- rm:simple-read-model
`;
    const expectedGeometry = {
      "nodes": [
        {"key":"simple-event","x":50,"y":268,"w":180,"h":42},
        {"key":"simple-read-model","x":170,"y":134,"w":180,"h":42},
        {"key":"simple-ui","x":290,"y":0,"w":180,"h":42}
      ],
      "edges": [
        {"key":"simple-event->simple-read-model#0","from":"simple-event","to":"simple-read-model","d":"M 150 268 L 150 248 L 150 150 L 170 150"},
        {"key":"simple-read-model->simple-ui#1","from":"simple-read-model","to":"simple-ui","d":"M 270 134 L 270 114 L 270 16 L 290 16"}
      ]
    };

    await assertGeometry(dsl, expectedGeometry);
  });

  it('renders multiple event lanes', async () => {
    const dsl = `
slice "Harness"

evt:first-event
stream:first

---

rm:simple-read-model
<- evt:first-event

ui:simple-ui
<- rm:simple-read-model

cmd:simple-command
<- ui:simple-ui
-> evt:second-event

---

evt:second-event
stream:second
`;
    const expectedGeometry = {
      "nodes": [
        {"key":"first-event","x":50,"y":268,"w":180,"h":42},
        {"key":"second-event","x":800,"y":402,"w":180,"h":42},
        {"key":"simple-command","x":540,"y":134,"w":180,"h":42},
        {"key":"simple-read-model","x":310,"y":134,"w":180,"h":42},
        {"key":"simple-ui","x":430,"y":0,"w":180,"h":42}
      ],
      "edges": [
        {"key":"first-event->simple-read-model#0","from":"first-event","to":"simple-read-model","d":"M 150 268 L 150 248 L 150 150 L 310 150"},
        {"key":"simple-command->second-event#3","from":"simple-command","to":"second-event","d":"M 640 176 L 640 196 L 880 196 L 880 402"},
        {"key":"simple-read-model->simple-ui#1","from":"simple-read-model","to":"simple-ui","d":"M 410 134 L 410 114 L 410 16 L 430 16"},
        {"key":"simple-ui->simple-command#2","from":"simple-ui","to":"simple-command","d":"M 530 42 L 530 62 L 620 62 L 620 134"}
      ]
    };

    await assertGeometry(dsl, expectedGeometry);
  });

  it('renders nodes with big height', async () => {
    const dsl = `
slice "Harness"

evt:first-event
stream:first
data:
  array:
    - a
    - b
    - c
    - d

evt:second-event
stream:second

rm:simple-read-model
<- evt:first-event
data:
  array:
    - a
    - b
    - c
    - d

ui:simple-ui
<- rm:simple-read-model
data:
  array:
    - a
    - b
    - c
    - d

cmd:simple-command
<- ui:simple-ui
-> evt:second-event
`;
    const expectedGeometry = {
      "nodes": [
        {"key":"first-event","x":50,"y":440,"w":180,"h":128},
        {"key":"second-event","x":510,"y":660,"w":180,"h":42},
        {"key":"simple-command","x":400,"y":220,"w":180,"h":42},
        {"key":"simple-read-model","x":170,"y":220,"w":180,"h":128},
        {"key":"simple-ui","x":290,"y":0,"w":180,"h":128}
      ],
      "edges": [
        {"key":"first-event->simple-read-model#0","from":"first-event","to":"simple-read-model","d":"M 150 440 L 150 420 L 150 279 L 170 279"},
        {"key":"simple-command->second-event#3","from":"simple-command","to":"second-event","d":"M 500 262 L 500 282 L 590 282 L 590 660"},
        {"key":"simple-read-model->simple-ui#1","from":"simple-read-model","to":"simple-ui","d":"M 270 220 L 270 200 L 270 59 L 290 59"},
        {"key":"simple-ui->simple-command#2","from":"simple-ui","to":"simple-command","d":"M 390 128 L 390 148 L 480 148 L 480 220"}
      ]
    };

    await assertGeometry(dsl, expectedGeometry, {
      nodeDimensions: {
        'first-event': { width: 180, height: 128 },
        'simple-read-model': { width: 180, height: 128 },
        'simple-ui': { width: 180, height: 128 },
        'simple-command': { width: 180, height: 42 },
        'second-event': { width: 180, height: 42 }
      }
    });
  })

  it('renders slice dividers', async () => {
    const dsl = `
slice "Harness"

evt:first-event
stream:first

---

rm:simple-read-model
<- evt:first-event

ui:simple-ui
<- rm:simple-read-model

cmd:simple-command
<- ui:simple-ui
-> evt:second-event

---

evt:second-event
stream:second
`;
    const expectedGeometry = {
      "nodes": [
        {"key":"first-event","x":50,"y":268,"w":180,"h":42},
        {"key":"second-event","x":800,"y":402,"w":180,"h":42},
        {"key":"simple-command","x":540,"y":134,"w":180,"h":42},
        {"key":"simple-read-model","x":310,"y":134,"w":180,"h":42},
        {"key":"simple-ui","x":430,"y":0,"w":180,"h":42}
      ],
      "edges": [
        {"key":"first-event->simple-read-model#0","from":"first-event","to":"simple-read-model","d":"M 150 268 L 150 248 L 150 150 L 310 150"},
        {"key":"simple-command->second-event#3","from":"simple-command","to":"second-event","d":"M 640 176 L 640 196 L 880 196 L 880 402"},
        {"key":"simple-read-model->simple-ui#1","from":"simple-read-model","to":"simple-ui","d":"M 410 134 L 410 114 L 410 16 L 430 16"},
        {"key":"simple-ui->simple-command#2","from":"simple-ui","to":"simple-command","d":"M 530 42 L 530 62 L 620 62 L 620 134"}
      ]
    };

    await assertGeometry(dsl, expectedGeometry);
  });

  it('matches expected rectangles and paths with clear failures', async () => {
    const dsl = `slice "Harness"

cmd:open-room
evt:room-opened <- cmd:open-room`;

    const geometry = await computeDiagramGeometry(dsl);
    const expectedPath = geometry.edges[0].d;

    const failures = matchDiagramGeometry(geometry, {
      nodes: [
        { key: 'open-room', y: geometry.layout.pos['open-room'].y },
        { key: 'room-opened', y: geometry.layout.pos['room-opened'].y }
      ],
      edges: [{ key: 'open-room->room-opened#0', d: expectedPath }]
    });

    expect(failures).toEqual([]);
  });

  it('matches DSL with source node with multiple edges', async () => {
    const dsl = `
   slice "Buy Ticket"

evt:ct-sched "Concert Scheduled"
-> rm:available-concerts
-> rm:available-concerts@2
stream: concert
data:
  artist: The Doors
  startTime: 2026-03-13 18:30
  capacity: 100

---

rm:available-concerts "Available Concerts"
<- evt:ct-sched
data:
  concerts:
    - artist: The Doors
      date: 2026-03-13
      capacity: 100
      a:b
      c:d
      e:f
      g:h

ui:available-concerts <- rm:available-concerts
data:
  concertId: concert_100
  quantity: 5

cmd:buy-ticket <- ui:available-concerts
data:
  concertId: concert_100
  customerId: customer_409
  quantity: 5

evt:ticket-sold "Ticket Sold"
<- cmd:buy-ticket
data:
  concertId: concert_100
  customerId: customer_409
  quantity: 5

---

rm:available-concerts@2 "Available Concerts"
<- evt:ct-sched
<- evt:ticket-sold
data:
  concerts:
    - artist: The Doors
      date: 2026-03-13
      capacity: 95

    `
    const expectedGeometry = {
      "nodes": [
        {
          "key": "available-concerts",
          "x": 711,
          "y": 204,
          "w": 180,
          "h": 176
        },
        {
          "key": "available-concerts@2",
          "x": 1311,
          "y": 204,
          "w": 180,
          "h": 112
        },
        {
          "key": "buy-ticket",
          "x": 931,
          "y": 204,
          "w": 180,
          "h": 96
        },
        {
          "key": "ct-sched",
          "x": 451,
          "y": 464,
          "w": 180,
          "h": 96
        },
        {
          "key": "ticket-sold",
          "x": 1051,
          "y": 644,
          "w": 180,
          "h": 96
        },
        {
          "key": "ui:available-concerts",
          "x": 811,
          "y": -6,
          "w": 180,
          "h": 80
        }
      ],
      "edges": [
        {
          "key": "available-concerts->ui:available-concerts#2",
          "from": "available-concerts",
          "to": "ui:available-concerts",
          "d": "M 821 204 L 821 180 L 821 180 L 821 124",
          "points": [
            {
              "x": 821,
              "y": 204
            },
            {
              "x": 821,
              "y": 180
            },
            {
              "x": 821,
              "y": 180
            },
            {
              "x": 821,
              "y": 124
            }
          ]
        },
        {
          "key": "buy-ticket->ticket-sold#4",
          "from": "buy-ticket",
          "to": "ticket-sold",
          "d": "M 1041 304 L 1041 328 L 1041 328 L 1041 644",
          "points": [
            {
              "x": 1041,
              "y": 304
            },
            {
              "x": 1041,
              "y": 328
            },
            {
              "x": 1041,
              "y": 328
            },
            {
              "x": 1041,
              "y": 644
            }
          ]
        },
        {
          "key": "ct-sched->available-concerts@2#1",
          "from": "ct-sched",
          "to": "available-concerts@2",
          "d": "M 561 464 L 561 432 L 1301 432 L 1301 320",
          "points": [
            {
              "x": 561,
              "y": 464
            },
            {
              "x": 561,
              "y": 432
            },
            {
              "x": 1301,
              "y": 432
            },
            {
              "x": 1301,
              "y": 320
            }
          ]
        },
        {
          "key": "ct-sched->available-concerts#0",
          "from": "ct-sched",
          "to": "available-concerts",
          "d": "M 561 464 L 561 424 L 781 424 L 781 384",
          "points": [
            {
              "x": 561,
              "y": 464
            },
            {
              "x": 561,
              "y": 424
            },
            {
              "x": 781,
              "y": 424
            },
            {
              "x": 781,
              "y": 384
            }
          ]
        },
        {
          "key": "ticket-sold->available-concerts@2#5",
          "from": "ticket-sold",
          "to": "available-concerts@2",
          "d": "M 1081 644 L 1081 620 L 1301 620 L 1301 320",
          "points": [
            {
              "x": 1081,
              "y": 644
            },
            {
              "x": 1081,
              "y": 620
            },
            {
              "x": 1301,
              "y": 620
            },
            {
              "x": 1301,
              "y": 320
            }
          ]
        },
        {
          "key": "ui:available-concerts->buy-ticket#3",
          "from": "ui:available-concerts",
          "to": "buy-ticket",
          "d": "M 861 124 L 861 148 L 1001 148 L 1001 204",
          "points": [
            {
              "x": 861,
              "y": 124
            },
            {
              "x": 861,
              "y": 148
            },
            {
              "x": 1001,
              "y": 148
            },
            {
              "x": 1001,
              "y": 204
            }
          ]
        }
      ]
    }
    const geometry = await computeDiagramGeometry(dsl, {
      nodeDimensions: {
        'available-concerts': { width: 180, height: 176 },
        'available-concerts@2': { width: 180, height: 112 },
        'buy-ticket': { width: 180, height: 96 },
        'ct-sched': { width: 180, height: 96 },
        'ticket-sold': { width: 180, height: 96 },
        'ui:available-concerts': { width: 180, height: 80 }
      }
    });

    expect(
      matchDiagramGeometry(geometry, expectedGeometry, {
        offset: { x: 401, y: -6 },
        nodeTolerance: 40,
        edgePathMode: 'endpoints',
        edgeTolerance: 140
      })
    ).toEqual([]);
  });

  it('normalizes far-right ELK layouts so left-most node starts at x=50', async () => {
    const dsl = `
slice "Buy Ticket (no slice bounds)"

evt:ct-sched "Concert Scheduled"
-> rm:available-concerts
-> rm:available-concerts@2
stream: concert
data:
  artist: The Doors
  startTime: 2026-03-13 18:30
  capacity: 100

rm:available-concerts "Available Concerts"
<- evt:ct-sched
data:
  concerts:
    - artist: The Doors
      date: 2026-03-13
      capacity: 100
      a:b
      c:d
      e:f
      g:h

ui:available-concerts <- rm:available-concerts
data:
  concertId: concert_100
  quantity: 5

cmd:buy-ticket <- ui:available-concerts
data:
  concertId: concert_100
  customerId: customer_409
  quantity: 5

evt:ticket-sold "Ticket Sold"
<- cmd:buy-ticket
data:
  concertId: concert_100
  customerId: customer_409
  quantity: 5

rm:available-concerts@2 "Available Concerts"
<- evt:ct-sched
<- evt:ticket-sold
data:
  concerts:
    - artist: The Doors
      date: 2026-03-13
      capacity: 95
`;
    const geometry = await computeDiagramGeometry(dsl);
    const minX = Math.min(...geometry.nodes.map((node) => node.x));
    expect(minX).toBe(50);
  });

  it('renders multiple edges from same source without collisions', async () => {
    const dsl = `
slice "Harness"

evt:room-booked "Room Booked" <- cmd:book-room
  uses:
    room-number
    customer-id

rm:available-rooms@2 "Available Rooms"
<- evt:room-booked
  data:
    rooms:
      - room-number: 102
        capacity: 4

---

rm:pending-bookings "Pending Bookings"
<- evt:room-booked
  data:
    bookings:
      - room-number: 101
        customer-id: C_400

rm:a <- evt:room-booked
`;
    const expectedGeometry = {
      "nodes": [
        {"key":"a","x":650,"y":0,"w":180,"h":42},
        {"key":"available-rooms@2","x":170,"y":0,"w":180,"h":96},
        {"key":"pending-bookings","x":430,"y":0,"w":180,"h":96},
        {"key":"room-booked","x":50,"y":188,"w":180,"h":80}
      ],
      "edges": [
        {"key":"room-booked->a#2","from":"room-booked","to":"a","d":"M 170 188 L 170 166 L 170 116 L 630 116 L 630 16 L 650 16"},
        {"key":"room-booked->available-rooms@2#0","from":"room-booked","to":"available-rooms@2","d":"M 150 188 L 150 168 L 150 43 L 170 43"},
        {"key":"room-booked->pending-bookings#1","from":"room-booked","to":"pending-bookings","d":"M 160 188 L 160 166 L 160 106 L 410 106 L 410 43 L 430 43"}
      ]
    };

    await assertGeometry(dsl, expectedGeometry, {
      nodeDimensions: {
        'room-booked': { width: 180, height: 80 },
        'available-rooms@2': { width: 180, height: 96 },
        'pending-bookings': { width: 180, height: 96 },
        a: { width: 180, height: 42 }
      }
    });
  });

  it('renders multiple edges to same target without collisions', async () => {
    const dsl = `
slice "Harness"

rm:available-rooms "Available Rooms"

ui:select-room "Select Room"
<- rm:available-rooms

session "Browser Session"

cmd:book-room "Book Room"
<- ui:select-room
<- session

evt:a
-> rm:available-rooms

evt:b
-> rm:available-rooms
`;
    const expectedGeometry = {
      "nodes": [
        {"key":"a","x":50,"y":268,"w":180,"h":42},
        {"key":"available-rooms","x":390,"y":134,"w":180,"h":42},
        {"key":"b","x":270,"y":268,"w":180,"h":42},
        {"key":"book-room","x":920,"y":134,"w":180,"h":42},
        {"key":"select-room","x":580,"y":0,"w":180,"h":42},
        {"key":"session","x":800,"y":0,"w":180,"h":42}
      ],
      "edges": [
        {"key":"a->available-rooms#3","from":"a","to":"available-rooms","d":"M 150 268 L 150 248 L 150 150 L 390 150"},
        {"key":"available-rooms->select-room#0","from":"available-rooms","to":"select-room","d":"M 490 134 L 490 114 L 490 16 L 580 16"},
        {"key":"b->available-rooms#4","from":"b","to":"available-rooms","d":"M 370 268 L 370 248 L 370 160 L 390 160"},
        {"key":"select-room->book-room#1","from":"select-room","to":"book-room","d":"M 680 42 L 680 80 L 1000 80 L 1000 134"},
        {"key":"session->book-room#2","from":"session","to":"book-room","d":"M 900 42 L 900 70 L 1010 70 L 1010 134"}
      ]
    };

    await assertGeometry(dsl, expectedGeometry, {
      nodeDimensions: {
        generic: { width: 180, height: 64 }
      }
    });
  });

  it('renders multiple edges to same target without collision and node avoidance', async () => {
    const dsl = `
slice "Harness"

rm:a

ui:a
<- rm:a

generic
data:
  a: a

cmd:a
<- ui:a
<- generic

evt:a
-> rm:a

evt:b
-> rm:a
`;
    const expectedGeometry = {
      "nodes": [
        {"key":"a","x":390,"y":156,"w":180,"h":42},
        {"key":"b","x":270,"y":290,"w":180,"h":42},
        {"key":"cmd:a","x":920,"y":156,"w":180,"h":42},
        {"key":"evt:a","x":50,"y":290,"w":180,"h":42},
        {"key":"generic","x":800,"y":0,"w":180,"h":64},
        {"key":"ui:a","x":580,"y":0,"w":180,"h":42}
      ],
      "edges": [
        {"key":"a->ui:a#0","from":"a","to":"ui:a","d":"M 490 156 L 490 136 L 490 16 L 580 16"},
        {"key":"b->a#4","from":"b","to":"a","d":"M 370 290 L 370 270 L 370 182 L 390 182"},
        {"key":"evt:a->a#3","from":"evt:a","to":"a","d":"M 150 290 L 150 270 L 150 172 L 390 172"},
        {"key":"generic->cmd:a#2","from":"generic","to":"cmd:a","d":"M 900 64 L 900 90 L 1010 90 L 1010 156"},
        {"key":"ui:a->cmd:a#1","from":"ui:a","to":"cmd:a","d":"M 680 42 L 680 100 L 1000 100 L 1000 156"}
      ]
    };

    await assertGeometry(dsl, expectedGeometry, {
      nodeDimensions: {
        generic: { width: 180, height: 64 }
      }
    });
  });

  it('does not cause edges crossing by avoiding sharing paths with other edges', async () => {
    const dsl = `
slice "Buy Ticket"

evt:ct-sched "Concert Scheduled"
-> rm:available-concerts
-> rm:available-concerts@2
data:
  artist: The Doors
  startTime: 2026-03-13 18:30
  capacity: 100

---

rm:available-concerts "Available Concerts"
data:
  concerts:
    - artist: The Doors
      date: 2026-03-13
      capacity: 100

ui:buy-ticket-form "Buy Form"
<- rm:available-concerts
data:
  concertId: concert_100
  quantity: 5

session "Browser Session"
data:
  customerID: C_400

cmd:buy-ticket
<- ui:buy-ticket-form
<- session
data:
  concertId: concert_100
  customerId: customer_409
  quantity: 5

evt:ticket-sold "Ticket Sold"
<- cmd:buy-ticket
data:
  concertId: concert_100
  customerId: customer_409
  quantity: 5

---

rm:available-concerts@2 "Available Concerts"
<- evt:ct-sched
<- evt:ticket-sold
data:
  concerts:
    - artist: The Doors
      date: 2026-03-13
      capacity: 95
`;
    const expectedGeometry = {
      "nodes": [
        {"key":"available-concerts","x":310,"y":172,"w":180,"h":112},
        {"key":"available-concerts@2","x":1140,"y":172,"w":180,"h":112},
        {"key":"buy-ticket","x":770,"y":172,"w":180,"h":96},
        {"key":"buy-ticket-form","x":430,"y":0,"w":180,"h":80},
        {"key":"ct-sched","x":50,"y":376,"w":180,"h":96},
        {"key":"session","x":650,"y":0,"w":180,"h":64},
        {"key":"ticket-sold","x":880,"y":376,"w":180,"h":96}
      ],
      "edges": [
        {"key":"available-concerts->buy-ticket-form#2","from":"available-concerts","to":"buy-ticket-form","d":"M 410 172 L 410 152 L 410 35 L 430 35"},
        {"key":"buy-ticket->ticket-sold#5","from":"buy-ticket","to":"ticket-sold","d":"M 870 268 L 870 288 L 960 288 L 960 376"},
        {"key":"buy-ticket-form->buy-ticket#3","from":"buy-ticket-form","to":"buy-ticket","d":"M 530 80 L 530 110 L 850 110 L 850 172"},
        {"key":"ct-sched->available-concerts@2#1","from":"ct-sched","to":"available-concerts@2","d":"M 160 376 L 160 354 L 160 294 L 1120 294 L 1120 223 L 1140 223"},
        {"key":"ct-sched->available-concerts#0","from":"ct-sched","to":"available-concerts","d":"M 150 376 L 150 356 L 150 223 L 310 223"},
        {"key":"session->buy-ticket#4","from":"session","to":"buy-ticket","d":"M 750 64 L 750 90 L 860 90 L 860 172"},
        {"key":"ticket-sold->available-concerts@2#6","from":"ticket-sold","to":"available-concerts@2","d":"M 980 376 L 980 356 L 980 233 L 1140 233"}
      ]
    };

    await assertGeometry(dsl, expectedGeometry, {
      nodeDimensions: {
        'available-concerts': { width: 180, height: 112 },
        'available-concerts@2': { width: 180, height: 112 },
        'buy-ticket': { width: 180, height: 96 },
        'buy-ticket-form': { width: 180, height: 80 },
        'ct-sched': { width: 180, height: 96 },
        session: { width: 180, height: 64 },
        'ticket-sold': { width: 180, height: 96 }
      }
    });
  });

  it('moves nodes horizontally to avoid edges crossing them', async () => {
    const dsl = `

slice "Harness"

cmd:buy "Buy Ticket"

evt:sold "Tickets Sold"
<- cmd:buy
stream: concert

evt:tp "Tickets Purchased"  <- cmd:buy
stream: customer


rm:avail@2 "Available Concerts"
<- evt:sold

rm:wallet "Customer Wallet"
<- evt:tp
`;
    const expectedGeometry = {
      "nodes": [
        {"key":"avail@2","x":360,"y":0,"w":180,"h":42},
        {"key":"buy","x":50,"y":0,"w":180,"h":42},
        {"key":"sold","x":170,"y":134,"w":180,"h":42},
        {"key":"tp","x":170,"y":268,"w":180,"h":42},
        {"key":"wallet","x":580,"y":0,"w":180,"h":42}
      ],
      "edges": [
        {"key":"buy->sold#0","from":"buy","to":"sold","d":"M 160 42 L 160 62 L 250 62 L 250 134"},
        {"key":"buy->tp#1","from":"buy","to":"tp","d":"M 150 42 L 150 186 L 250 186 L 250 268"},
        {"key":"sold->avail@2#2","from":"sold","to":"avail@2","d":"M 270 134 L 270 114 L 270 16 L 360 16"},
        {"key":"tp->wallet#3","from":"tp","to":"wallet","d":"M 270 268 L 270 246 L 270 52 L 560 52 L 560 16 L 580 16"}
      ]
    };

    await assertGeometry(dsl, expectedGeometry);
  });

  it('avoids crossover of fan-out down-stream edges', async () => {
    const dsl = `
slice "Harness"

cmd:command
evt:a <- cmd:command
evt:b <- cmd:command
`;
    const expectedGeometry = {
      "nodes": [
        {"key":"a","x":170,"y":134,"w":180,"h":42},
        {"key":"b","x":390,"y":134,"w":180,"h":42},
        {"key":"command","x":50,"y":0,"w":180,"h":42}
      ],
      "edges": [
        {"key":"command->a#0","from":"command","to":"a","d":"M 150 42 L 150 72 L 250 72 L 250 134"},
        {"key":"command->b#1","from":"command","to":"b","d":"M 160 42 L 160 62 L 470 62 L 470 134"}
      ]
    };

    await assertGeometry(dsl, expectedGeometry);
  });

  it('orders edge y values based on source node x values', async () => {
    const dsl = `
slice "Data Mapping"

cmd:add "Add Todo"
data:
  id: 100
  name: alpha

evt:thing-added@1 "Todo Added"
<- cmd:add
uses:
  id
  name

evt:thing-added@2 "Todo Added"
data:
  id: 200
  name: bravo

---

rm:my-rm "All Todos"
<- evt:thing-added@1
<- evt:thing-added@2
uses:
  things <- collect({id,name})

ui:my-ui "Rename Todo Form"
<- rm:my-rm
data:
  newName: ALPHA
uses:
  id <- $.things[0].id

cmd:my-cmd "Rename Todo"
<- ui:my-ui
uses:
  id
  newName

evt:my-evt "Todo Renamed"
<- cmd:my-cmd
uses:
  id
  name <- newName

---

rm:my-rm@2 "All Todos"
<- evt:thing-added@2
<- evt:my-evt
uses:
  things <- collect({id,name})
`;
    const expectedGeometry = {
      "nodes": [
        {"key":"add","x":50,"y":172,"w":180,"h":80},
        {"key":"my-cmd","x":880,"y":172,"w":180,"h":80},
        {"key":"my-evt","x":990,"y":392,"w":180,"h":80},
        {"key":"my-rm","x":650,"y":172,"w":180,"h":128},
        {"key":"my-rm@2","x":1250,"y":172,"w":180,"h":128},
        {"key":"my-ui","x":770,"y":0,"w":180,"h":80},
        {"key":"thing-added@1","x":170,"y":392,"w":180,"h":80},
        {"key":"thing-added@2","x":390,"y":392,"w":180,"h":80}
      ],
      "edges": [
        {"key":"add->thing-added@1#0","from":"add","to":"thing-added@1","d":"M 150 252 L 150 272 L 250 272 L 250 392"},
        {"key":"my-cmd->my-evt#5","from":"my-cmd","to":"my-evt","d":"M 980 252 L 980 272 L 1070 272 L 1070 392"},
        {"key":"my-evt->my-rm@2#7","from":"my-evt","to":"my-rm@2","d":"M 1090 392 L 1090 372 L 1090 241 L 1250 241"},
        {"key":"my-rm->my-ui#3","from":"my-rm","to":"my-ui","d":"M 750 172 L 750 152 L 750 35 L 770 35"},
        {"key":"my-ui->my-cmd#4","from":"my-ui","to":"my-cmd","d":"M 870 80 L 870 100 L 960 100 L 960 172"},
        {"key":"thing-added@1->my-rm#1","from":"thing-added@1","to":"my-rm","d":"M 270 392 L 270 372 L 270 231 L 650 231"},
        {"key":"thing-added@2->my-rm@2#6","from":"thing-added@2","to":"my-rm@2","d":"M 500 392 L 500 370 L 500 310 L 1230 310 L 1230 231 L 1250 231"},
        {"key":"thing-added@2->my-rm#2","from":"thing-added@2","to":"my-rm","d":"M 490 392 L 490 372 L 490 241 L 650 241"}
      ]
    };

    await assertGeometry(dsl, expectedGeometry, {
      nodeDimensions: {
        add: { width: 180, height: 80 },
        'my-cmd': { width: 180, height: 80 },
        'my-evt': { width: 180, height: 80 },
        'my-rm': { width: 180, height: 128 },
        'my-rm@2': { width: 180, height: 128 },
        'my-ui': { width: 180, height: 80 },
        'thing-added@1': { width: 180, height: 80 },
        'thing-added@2': { width: 180, height: 80 }
      }
    });
  });
});
