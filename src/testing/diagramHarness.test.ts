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
        {"key":"first-event","x":50,"y":476,"w":180,"h":132},
        {"key":"second-event","x":350,"y":688,"w":180,"h":42},
        {"key":"simple-command","x":310,"y":264,"w":180,"h":42},
        {"key":"simple-read-model","x":90,"y":264,"w":180,"h":132},
        {"key":"simple-ui","x":130,"y":52,"w":180,"h":132}
      ],
      "edges": [
        {"key":"first-event->simple-read-model#0","from":"first-event","to":"simple-read-model","d":"M 160 476 L 160 462.7 L 160 462.7 L 160 396","points":[{"x":160,"y":476},{"x":160,"y":462.7},{"x":160,"y":462.7},{"x":160,"y":396}]},
        {"key":"simple-command->second-event#3","from":"simple-command","to":"second-event","d":"M 420 306 L 420 320.5 L 420 320.5 L 420 688","points":[{"x":420,"y":306},{"x":420,"y":320.5},{"x":420,"y":320.5},{"x":420,"y":688}]},
        {"key":"simple-read-model->simple-ui#1","from":"simple-read-model","to":"simple-ui","d":"M 200 264 L 200 250.7 L 200 250.7 L 200 184","points":[{"x":200,"y":264},{"x":200,"y":250.7},{"x":200,"y":250.7},{"x":200,"y":184}]},
        {"key":"simple-ui->simple-command#2","from":"simple-ui","to":"simple-command","d":"M 240 184 L 240 197.3 L 380 197.3 L 380 264","points":[{"x":240,"y":184},{"x":240,"y":197.3},{"x":380,"y":197.3},{"x":380,"y":264}]}
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
          "h": 180
        },
        {
          "key": "available-concerts@2",
          "x": 1231,
          "y": 204,
          "w": 180,
          "h": 116
        },
        {
          "key": "buy-ticket",
          "x": 931,
          "y": 204,
          "w": 180,
          "h": 100
        },
        {
          "key": "ct-sched",
          "x": 451,
          "y": 464,
          "w": 180,
          "h": 100
        },
        {
          "key": "ticket-sold",
          "x": 971,
          "y": 644,
          "w": 180,
          "h": 100
        },
        {
          "key": "ui:available-concerts",
          "x": 751,
          "y": 40,
          "w": 180,
          "h": 84
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
});
