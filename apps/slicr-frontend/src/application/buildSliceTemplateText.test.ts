import { describe, expect, it } from 'vitest';
import { buildSliceTemplateText } from './buildSliceTemplateText';

describe('buildSliceTemplateText', () => {
  it('emits state-change text with optional read model', () => {
    const result = buildSliceTemplateText({
      targetMode: 'create-new',
      sliceName: 'Payment Fulfillment',
      templateId: 'state-change',
      includeReadModelInStateChange: true,
      nodes: {
        'entry-ui': { type: 'ui', name: 'checkout-form', alias: 'Checkout Form' },
        'change-cmd': { type: 'cmd', name: 'submit-payment', alias: 'Submit Payment' },
        'result-evt': { type: 'evt', name: 'payment-submitted', alias: 'Payment Submitted' },
        'projection-rm': { type: 'rm', name: 'payment-status', alias: 'Payment Status' }
      }
    });

    expect(result).toBe(
      'slice "Payment Fulfillment"\n\n'
      + 'ui:checkout-form "Checkout Form"\n'
      + '\n'
      + 'cmd:submit-payment "Submit Payment"\n'
      + '<- ui:checkout-form\n'
      + '\n'
      + 'evt:payment-submitted "Payment Submitted"\n'
      + '<- cmd:submit-payment\n'
      + '\n'
      + 'rm:payment-status "Payment Status"\n'
      + '<- evt:payment-submitted'
    );
  });

  it('omits optional read model in state-change when disabled', () => {
    const result = buildSliceTemplateText({
      targetMode: 'create-new',
      sliceName: 'Payment Fulfillment',
      templateId: 'state-change',
      includeReadModelInStateChange: false,
      nodes: {
        'entry-ui': { type: 'ui', name: 'checkout-form', alias: 'Checkout Form' },
        'change-cmd': { type: 'cmd', name: 'submit-payment', alias: 'Submit Payment' },
        'result-evt': { type: 'evt', name: 'payment-submitted', alias: 'Payment Submitted' },
        'projection-rm': { type: 'rm', name: 'payment-status', alias: 'Payment Status' }
      }
    });

    expect(result).toBe(
      'slice "Payment Fulfillment"\n\n'
      + 'ui:checkout-form "Checkout Form"\n'
      + '\n'
      + 'cmd:submit-payment "Submit Payment"\n'
      + '<- ui:checkout-form\n'
      + '\n'
      + 'evt:payment-submitted "Payment Submitted"\n'
      + '<- cmd:submit-payment'
    );
  });

  it('emits state-view block without slice header for add-current mode', () => {
    const result = buildSliceTemplateText({
      targetMode: 'add-current',
      sliceName: 'Ignored',
      templateId: 'state-view',
      includeReadModelInStateChange: true,
      nodes: {
        'source-evt': { type: 'evt', name: 'payment-updated', alias: '' },
        'projection-rm': { type: 'rm', name: 'payment-view', alias: 'Payment View' },
        'consumer-ui': { type: 'ui', name: 'payment-screen', alias: 'Payment Screen' }
      }
    });

    expect(result).toBe(
      'evt:payment-updated\n'
      + '\n'
      + 'rm:payment-view "Payment View"\n'
      + '<- evt:payment-updated\n'
      + '\n'
      + 'ui:payment-screen "Payment Screen"\n'
      + '<- rm:payment-view'
    );
    expect(result.includes('slice "')).toBe(false);
  });
});
