export type SliceTemplateId = 'state-change' | 'state-view' | 'automation';
export type SliceTargetMode = 'create-new' | 'add-current';
export type SliceNodeType = 'ui' | 'cmd' | 'evt' | 'rm' | 'aut';

export type SliceTemplateNode = {
  slot: string;
  type: SliceNodeType;
  defaultName: string;
  defaultAlias: string;
};

export type SliceTemplateEdge = {
  fromSlot: string;
  toSlot: string;
  optional?: 'state-change-read-model';
};

export type SliceTemplate = {
  id: SliceTemplateId;
  label: string;
  nodes: SliceTemplateNode[];
  edges: SliceTemplateEdge[];
  supportsOptionalReadModel?: boolean;
};

export const SLICE_TEMPLATES: SliceTemplate[] = [
  {
    id: 'state-change',
    label: 'State Change',
    supportsOptionalReadModel: true,
    nodes: [
      { slot: 'entry-ui', type: 'ui', defaultName: 'checkout-form', defaultAlias: 'Checkout Form' },
      { slot: 'change-cmd', type: 'cmd', defaultName: 'submit-payment', defaultAlias: 'Submit Payment' },
      { slot: 'result-evt', type: 'evt', defaultName: 'payment-submitted', defaultAlias: 'Payment Submitted' },
      { slot: 'projection-rm', type: 'rm', defaultName: 'payment-status', defaultAlias: 'Payment Status' }
    ],
    edges: [
      { fromSlot: 'entry-ui', toSlot: 'change-cmd' },
      { fromSlot: 'change-cmd', toSlot: 'result-evt' },
      { fromSlot: 'result-evt', toSlot: 'projection-rm', optional: 'state-change-read-model' }
    ]
  },
  {
    id: 'state-view',
    label: 'State View',
    nodes: [
      { slot: 'source-evt', type: 'evt', defaultName: 'payment-updated', defaultAlias: 'Payment Updated' },
      { slot: 'projection-rm', type: 'rm', defaultName: 'payment-view', defaultAlias: 'Payment View' },
      { slot: 'consumer-ui', type: 'ui', defaultName: 'payment-screen', defaultAlias: 'Payment Screen' }
    ],
    edges: [
      { fromSlot: 'source-evt', toSlot: 'projection-rm' },
      { fromSlot: 'projection-rm', toSlot: 'consumer-ui' }
    ]
  },
  {
    id: 'automation',
    label: 'Automation',
    nodes: [
      { slot: 'trigger-evt', type: 'evt', defaultName: 'payment-overdue', defaultAlias: 'Payment Overdue' },
      { slot: 'projection-rm', type: 'rm', defaultName: 'overdue-accounts', defaultAlias: 'Overdue Accounts' },
      { slot: 'policy-aut', type: 'aut', defaultName: 'auto-reminder', defaultAlias: 'Auto Reminder' },
      { slot: 'dispatch-cmd', type: 'cmd', defaultName: 'send-reminder', defaultAlias: 'Send Reminder' },
      { slot: 'outcome-evt', type: 'evt', defaultName: 'reminder-sent', defaultAlias: 'Reminder Sent' }
    ],
    edges: [
      { fromSlot: 'trigger-evt', toSlot: 'projection-rm' },
      { fromSlot: 'projection-rm', toSlot: 'policy-aut' },
      { fromSlot: 'policy-aut', toSlot: 'dispatch-cmd' },
      { fromSlot: 'dispatch-cmd', toSlot: 'outcome-evt' }
    ]
  }
];

export function getSliceTemplateById(id: SliceTemplateId): SliceTemplate {
  const template = SLICE_TEMPLATES.find((entry) => entry.id === id);
  if (!template) {
    throw new Error(`Unknown slice template: ${id}`);
  }
  return template;
}
