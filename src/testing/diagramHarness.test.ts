import { describe, expect, it } from 'vitest';
import { computeDiagramGeometry, matchDiagramGeometry } from './diagramHarness';
import type { DiagramExpectation } from './diagramHarness';

async function assertGeometry(dsl: string, expectedGeometry: DiagramExpectation) {
  const actualGeometry = await computeDiagramGeometry(dsl);
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
        {"key":"simple-event","x":50,"y":52,"w":180,"h":42}
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
        {"key":"simple-event","x":50,"y":296,"w":180,"h":42},
        {"key":"simple-read-model","x":90,"y":174,"w":180,"h":42},
        {"key":"simple-ui","x":130,"y":52,"w":180,"h":42}
      ],
      "edges": [
        {"key":"simple-event->simple-read-model#0","from":"simple-event","to":"simple-read-model","d":"M 160 296 L 160 282.7 L 160 282.7 L 160 216","points":[{"x":160,"y":296},{"x":160,"y":282.7},{"x":160,"y":282.7},{"x":160,"y":216}]},
        {"key":"simple-read-model->simple-ui#1","from":"simple-read-model","to":"simple-ui","d":"M 200 174 L 200 160.7 L 200 160.7 L 200 94","points":[{"x":200,"y":174},{"x":200,"y":160.7},{"x":200,"y":160.7},{"x":200,"y":94}]}
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
        {"key":"first-event","x":50,"y":296,"w":180,"h":42},
        {"key":"second-event","x":790,"y":418,"w":180,"h":42},
        {"key":"simple-command","x":530,"y":174,"w":180,"h":42},
        {"key":"simple-read-model","x":310,"y":174,"w":180,"h":42},
        {"key":"simple-ui","x":350,"y":52,"w":180,"h":42}
      ],
      "edges": [
        {"key":"first-event->simple-read-model#0","from":"first-event","to":"simple-read-model","d":"M 160 296 L 160 282.7 L 380 282.7 L 380 216","points":[{"x":160,"y":296},{"x":160,"y":282.7},{"x":380,"y":282.7},{"x":380,"y":216}]},
        {"key":"simple-command->second-event#3","from":"simple-command","to":"second-event","d":"M 640 216 L 640 230.5 L 860 230.5 L 860 418","points":[{"x":640,"y":216},{"x":640,"y":230.5},{"x":860,"y":230.5},{"x":860,"y":418}]},
        {"key":"simple-read-model->simple-ui#1","from":"simple-read-model","to":"simple-ui","d":"M 420 174 L 420 160.7 L 420 160.7 L 420 94","points":[{"x":420,"y":174},{"x":420,"y":160.7},{"x":420,"y":160.7},{"x":420,"y":94}]},
        {"key":"simple-ui->simple-command#2","from":"simple-ui","to":"simple-command","d":"M 460 94 L 460 107.3 L 600 107.3 L 600 174","points":[{"x":460,"y":94},{"x":460,"y":107.3},{"x":600,"y":107.3},{"x":600,"y":174}]}
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
        {"key":"first-event","x":50,"y":468,"w":180,"h":128},
        {"key":"second-event","x":350,"y":676,"w":180,"h":42},
        {"key":"simple-command","x":310,"y":260,"w":180,"h":42},
        {"key":"simple-read-model","x":90,"y":260,"w":180,"h":128},
        {"key":"simple-ui","x":130,"y":52,"w":180,"h":128}
      ],
      "edges": [
        {"key":"first-event->simple-read-model#0","from":"first-event","to":"simple-read-model","d":"M 160 468 L 160 454.7 L 160 454.7 L 160 388","points":[{"x":160,"y":468},{"x":160,"y":454.7},{"x":160,"y":454.7},{"x":160,"y":388}]},
        {"key":"simple-command->second-event#3","from":"simple-command","to":"second-event","d":"M 420 302 L 420 316.5 L 420 316.5 L 420 676","points":[{"x":420,"y":302},{"x":420,"y":316.5},{"x":420,"y":316.5},{"x":420,"y":676}]},
        {"key":"simple-read-model->simple-ui#1","from":"simple-read-model","to":"simple-ui","d":"M 200 260 L 200 246.7 L 200 246.7 L 200 180","points":[{"x":200,"y":260},{"x":200,"y":246.7},{"x":200,"y":246.7},{"x":200,"y":180}]},
        {"key":"simple-ui->simple-command#2","from":"simple-ui","to":"simple-command","d":"M 240 180 L 240 193.3 L 380 193.3 L 380 260","points":[{"x":240,"y":180},{"x":240,"y":193.3},{"x":380,"y":193.3},{"x":380,"y":260}]}
      ]
    };

    await assertGeometry(dsl, expectedGeometry);
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
        {"key":"first-event","x":50,"y":296,"w":180,"h":42},
        {"key":"second-event","x":790,"y":418,"w":180,"h":42},
        {"key":"simple-command","x":530,"y":174,"w":180,"h":42},
        {"key":"simple-read-model","x":310,"y":174,"w":180,"h":42},
        {"key":"simple-ui","x":350,"y":52,"w":180,"h":42}
      ],
      "edges": [
        {"key":"first-event->simple-read-model#0","from":"first-event","to":"simple-read-model","d":"M 160 296 L 160 282.7 L 380 282.7 L 380 216","points":[{"x":160,"y":296},{"x":160,"y":282.7},{"x":380,"y":282.7},{"x":380,"y":216}]},
        {"key":"simple-command->second-event#3","from":"simple-command","to":"second-event","d":"M 640 216 L 640 230.5 L 860 230.5 L 860 418","points":[{"x":640,"y":216},{"x":640,"y":230.5},{"x":860,"y":230.5},{"x":860,"y":418}]},
        {"key":"simple-read-model->simple-ui#1","from":"simple-read-model","to":"simple-ui","d":"M 420 174 L 420 160.7 L 420 160.7 L 420 94","points":[{"x":420,"y":174},{"x":420,"y":160.7},{"x":420,"y":160.7},{"x":420,"y":94}]},
        {"key":"simple-ui->simple-command#2","from":"simple-ui","to":"simple-command","d":"M 460 94 L 460 107.3 L 600 107.3 L 600 174","points":[{"x":460,"y":94},{"x":460,"y":107.3},{"x":600,"y":107.3},{"x":600,"y":174}]}
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
          "x": 1231,
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
          "x": 971,
          "y": 644,
          "w": 180,
          "h": 96
        },
        {
          "key": "ui:available-concerts",
          "x": 751,
          "y": 40,
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
    const geometry = await computeDiagramGeometry(dsl);

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
        {"key":"a","x":594,"y":52,"w":180,"h":42},
        {"key":"available-rooms@2","x":114,"y":52,"w":180,"h":96},
        {"key":"pending-bookings","x":374,"y":52,"w":180,"h":96},
        {"key":"room-booked","x":50,"y":228,"w":180,"h":80}
      ],
      "edges": [
        {"key":"room-booked->a#2","from":"room-booked","to":"a","d":"M 170 228 L 170 220 L 664 220 L 664 94","points":[{"x":170,"y":228},{"x":170,"y":220},{"x":664,"y":220},{"x":664,"y":94}]},
        {"key":"room-booked->available-rooms@2#0","from":"room-booked","to":"available-rooms@2","d":"M 150 228 L 150 200 L 184 200 L 184 148","points":[{"x":150,"y":228},{"x":150,"y":200},{"x":184,"y":200},{"x":184,"y":148}]},
        {"key":"room-booked->pending-bookings#1","from":"room-booked","to":"pending-bookings","d":"M 160 228 L 160 210 L 444 210 L 444 148","points":[{"x":160,"y":228},{"x":160,"y":210},{"x":444,"y":210},{"x":444,"y":148}]}
      ]
    };

    await assertGeometry(dsl, expectedGeometry);
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
        {"key":"a","x":50,"y":296,"w":180,"h":42},
        {"key":"available-rooms","x":322,"y":174,"w":180,"h":42},
        {"key":"b","x":270,"y":296,"w":180,"h":42},
        {"key":"book-room","x":634,"y":174,"w":180,"h":42},
        {"key":"select-room","x":362,"y":52,"w":180,"h":42},
        {"key":"session","x":582,"y":52,"w":180,"h":42}
      ],
      "edges": [
        {"key":"a->available-rooms#3","from":"a","to":"available-rooms","d":"M 160 296 L 160 270 L 387 270 L 387 216","points":[{"x":160,"y":296},{"x":160,"y":270},{"x":387,"y":270},{"x":387,"y":216}]},
        {"key":"available-rooms->select-room#0","from":"available-rooms","to":"select-room","d":"M 432 174 L 432 160.2 L 432 160.2 L 432 94","points":[{"x":432,"y":174},{"x":432,"y":160},{"x":432,"y":160},{"x":432,"y":94}]},
        {"key":"b->available-rooms#4","from":"b","to":"available-rooms","d":"M 380 296 L 380 280 L 397 280 L 397 216","points":[{"x":380,"y":296},{"x":380,"y":280},{"x":397,"y":280},{"x":397,"y":216}]},
        {"key":"select-room->book-room#1","from":"select-room","to":"book-room","d":"M 472 94 L 472 120 L 699 120 L 699 174","points":[{"x":472,"y":94},{"x":472,"y":120},{"x":699,"y":120},{"x":699,"y":174}]},
        {"key":"session->book-room#2","from":"session","to":"book-room","d":"M 692 94 L 692 110 L 709 110 L 709 174","points":[{"x":692,"y":94},{"x":692,"y":110},{"x":709,"y":110},{"x":709,"y":174}]}
      ]
    };

    await assertGeometry(dsl, expectedGeometry);
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
        {"key":"a","x":322,"y":196,"w":180,"h":42},
        {"key":"b","x":270,"y":318,"w":180,"h":42},
        {"key":"cmd:a","x":634,"y":196,"w":180,"h":42},
        {"key":"evt:a","x":50,"y":318,"w":180,"h":42},
        {"key":"generic","x":582,"y":52,"w":180,"h":64},
        {"key":"ui:a","x":362,"y":52,"w":180,"h":42}
      ],
      "edges": [
        {"key":"a->ui:a#0","from":"a","to":"ui:a","d":"M 432 196 L 432 181 L 432 181 L 432 94","points":[{"x":432,"y":196},{"x":432,"y":181},{"x":432,"y":181},{"x":432,"y":94}]},
        {"key":"b->a#4","from":"b","to":"a","d":"M 380 318 L 380 300 L 397 300 L 397 238","points":[{"x":380,"y":318},{"x":380,"y":300},{"x":397,"y":300},{"x":397,"y":238}]},
        {"key":"evt:a->a#3","from":"evt:a","to":"a","d":"M 160 318 L 160 290 L 387 290 L 387 238","points":[{"x":160,"y":318},{"x":160,"y":290},{"x":387,"y":290},{"x":387,"y":238}]},
        {"key":"generic->cmd:a#2","from":"generic","to":"cmd:a","d":"M 692 116 L 692 130 L 709 130 L 709 196","points":[{"x":692,"y":116},{"x":692,"y":130},{"x":709,"y":130},{"x":709,"y":196}]},
        {"key":"ui:a->cmd:a#1","from":"ui:a","to":"cmd:a","d":"M 472 94 L 472 140 L 699 140 L 699 196","points":[{"x":472,"y":94},{"x":472,"y":140},{"x":699,"y":140},{"x":699,"y":196}]}
      ]
    };

    await assertGeometry(dsl, expectedGeometry);
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
        {"key":"available-concerts","x":310,"y":212,"w":180,"h":112},
        {"key":"available-concerts@2","x":922,"y":212,"w":180,"h":112},
        {"key":"buy-ticket","x":622,"y":212,"w":180,"h":96},
        {"key":"buy-ticket-form","x":350,"y":52,"w":180,"h":80},
        {"key":"ct-sched","x":50,"y":404,"w":180,"h":96},
        {"key":"session","x":570,"y":52,"w":180,"h":64},
        {"key":"ticket-sold","x":662,"y":404,"w":180,"h":96}
      ],
      "edges": [
        {"key":"available-concerts->buy-ticket-form#2","from":"available-concerts","to":"buy-ticket-form","d":"M 420 212 L 420 198.7 L 420 198.7 L 420 132","points":[{"x":420,"y":212},{"x":420,"y":199},{"x":420,"y":199},{"x":420,"y":132}]},
        {"key":"buy-ticket->ticket-sold#5","from":"buy-ticket","to":"ticket-sold","d":"M 732 308 L 732 322.76 L 732 322.76 L 732 404","points":[{"x":732,"y":308},{"x":732,"y":323},{"x":732,"y":323},{"x":732,"y":404}]},
        {"key":"buy-ticket-form->buy-ticket#3","from":"buy-ticket-form","to":"buy-ticket","d":"M 460 132 L 460 160 L 687 160 L 687 212","points":[{"x":460,"y":132},{"x":460,"y":160},{"x":687,"y":160},{"x":687,"y":212}]},
        {"key":"ct-sched->available-concerts@2#1","from":"ct-sched","to":"available-concerts@2","d":"M 165 404 L 165 380 L 987 380 L 987 324","points":[{"x":165,"y":404},{"x":165,"y":380},{"x":987,"y":380},{"x":987,"y":324}]},
        {"key":"ct-sched->available-concerts#0","from":"ct-sched","to":"available-concerts","d":"M 155 404 L 155 370 L 380 370 L 380 324","points":[{"x":155,"y":404},{"x":155,"y":370},{"x":380,"y":370},{"x":380,"y":324}]},
        {"key":"session->buy-ticket#4","from":"session","to":"buy-ticket","d":"M 680 116 L 680 130 L 697 130 L 697 212","points":[{"x":680,"y":116},{"x":680,"y":130},{"x":697,"y":130},{"x":697,"y":212}]},
        {"key":"ticket-sold->available-concerts@2#6","from":"ticket-sold","to":"available-concerts@2","d":"M 772 404 L 772 390 L 997 390 L 997 324","points":[{"x":772,"y":404},{"x":772,"y":390},{"x":997,"y":390},{"x":997,"y":324}]}
      ]
    };

    await assertGeometry(dsl, expectedGeometry);
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
        {"key":"avail@2","x":270,"y":52,"w":180,"h":42},
        {"key":"buy","x":50,"y":52,"w":180,"h":42},
        {"key":"sold","x":195,"y":170,"w":180,"h":42},
        {"key":"tp","x":102,"y":296,"w":180,"h":42},
        {"key":"wallet","x":490,"y":52,"w":180,"h":42}
      ],
      "edges": [
        {"key":"buy->sold#0","from":"buy","to":"sold","d":"M 165 94 L 165 110 L 265 110 L 265 170","points":[{"x":165,"y":94},{"x":165,"y":110},{"x":265,"y":110},{"x":265,"y":170}]},
        {"key":"buy->tp#1","from":"buy","to":"tp","d":"M 155 94 L 155 120 L 172 120 L 172 296","points":[{"x":155,"y":94},{"x":155,"y":120},{"x":172,"y":120},{"x":172,"y":296}]},
        {"key":"sold->avail@2#2","from":"sold","to":"avail@2","d":"M 305 170 L 305 156.94 L 340 156.94 L 340 94","points":[{"x":305,"y":170},{"x":305,"y":157},{"x":340,"y":157},{"x":340,"y":94}]},
        {"key":"tp->wallet#3","from":"tp","to":"wallet","d":"M 212 296 L 212 281.5 L 560 281.5 L 560 94","points":[{"x":212,"y":296},{"x":212,"y":282},{"x":560,"y":282},{"x":560,"y":94}]}
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
        {"key":"a","x":102,"y":174,"w":180,"h":42},
        {"key":"b","x":322,"y":174,"w":180,"h":42},
        {"key":"command","x":50,"y":52,"w":180,"h":42}
      ],
      "edges": [
        {"key":"command->a#0","from":"command","to":"a","d":"M 155 94 L 155 120 L 172 120 L 172 174","points":[{"x":155,"y":94},{"x":155,"y":120},{"x":172,"y":120},{"x":172,"y":174}]},
        {"key":"command->b#1","from":"command","to":"b","d":"M 165 94 L 165 110 L 392 110 L 392 174","points":[{"x":165,"y":94},{"x":165,"y":110},{"x":392,"y":110},{"x":392,"y":174}]}
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
        {"key":"add","x":50,"y":212,"w":180,"h":80},
        {"key":"my-cmd","x":808,"y":212,"w":180,"h":80},
        {"key":"my-evt","x":848,"y":420,"w":180,"h":80},
        {"key":"my-rm","x":588,"y":212,"w":180,"h":128},
        {"key":"my-rm@2","x":1108,"y":212,"w":180,"h":128},
        {"key":"my-ui","x":628,"y":52,"w":180,"h":80},
        {"key":"thing-added@1","x":108,"y":420,"w":180,"h":80},
        {"key":"thing-added@2","x":328,"y":420,"w":180,"h":80}
      ],
      "edges": [
        {"key":"add->thing-added@1#0","from":"add","to":"thing-added@1","d":"M 160 292 L 160 310 L 178 310 L 178 420","points":[{"x":160,"y":292},{"x":160,"y":310},{"x":178,"y":310},{"x":178,"y":420}]},
        {"key":"my-cmd->my-evt#5","from":"my-cmd","to":"my-evt","d":"M 918 292 L 918 320 L 918 320 L 918 420","points":[{"x":918,"y":292},{"x":918,"y":320},{"x":918,"y":320},{"x":918,"y":420}]},
        {"key":"my-evt->my-rm@2#7","from":"my-evt","to":"my-rm@2","d":"M 958 420 L 958 410 L 1183 410 L 1183 340","points":[{"x":958,"y":420},{"x":958,"y":410},{"x":1183,"y":410},{"x":1183,"y":340}]},
        {"key":"my-rm->my-ui#3","from":"my-rm","to":"my-ui","d":"M 698 212 L 698 198.2 L 698 198.2 L 698 132","points":[{"x":698,"y":212},{"x":698,"y":198},{"x":698,"y":198},{"x":698,"y":132}]},
        {"key":"my-ui->my-cmd#4","from":"my-ui","to":"my-cmd","d":"M 738 132 L 738 145.3 L 878 145.3 L 878 212","points":[{"x":738,"y":132},{"x":738,"y":145},{"x":878,"y":145},{"x":878,"y":212}]},
        {"key":"thing-added@1->my-rm#1","from":"thing-added@1","to":"my-rm","d":"M 218 420 L 218 380 L 653 380 L 653 340","points":[{"x":218,"y":420},{"x":218,"y":380},{"x":653,"y":380},{"x":653,"y":340}]},
        {"key":"thing-added@2->my-rm@2#6","from":"thing-added@2","to":"my-rm@2","d":"M 443 420 L 443 400 L 1173 400 L 1173 340","points":[{"x":443,"y":420},{"x":443,"y":400},{"x":1173,"y":400},{"x":1173,"y":340}]},
        {"key":"thing-added@2->my-rm#2","from":"thing-added@2","to":"my-rm","d":"M 433 420 L 433 390 L 663 390 L 663 340","points":[{"x":433,"y":420},{"x":433,"y":390},{"x":663,"y":390},{"x":663,"y":340}]}
      ]
    };

    await assertGeometry(dsl, expectedGeometry);
  });
});
