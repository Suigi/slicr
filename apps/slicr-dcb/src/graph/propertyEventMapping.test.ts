import type { EditableProperty } from '@slicr/react-ui';
import { describe, expect, it } from 'vitest';
import {
  deriveNodePropertyExampleValues,
  deriveNodePropertySchema,
  mergeNodePropertyEditorProperties,
} from './propertyEventMapping';

const editorProperties: EditableProperty[] = [
  {
    id: 'prop-title',
    name: 'title',
    type: 'string',
    optional: true,
    example: 'Checkout completed',
  },
  {
    id: 'prop-flags',
    name: 'flags',
    type: 'boolean',
    list: true,
    exampleValues: ['true', null] as unknown as EditableProperty['exampleValues'],
  },
  {
    id: 'prop-customer',
    name: 'customer',
    type: 'Object',
    properties: [
      { id: 'prop-name', name: 'name', type: 'string', example: 'Alice' },
      {
        id: 'prop-address',
        name: 'address',
        type: 'Object',
        properties: [
          { id: 'prop-city', name: 'city', type: 'string', example: 'Springfield' },
        ],
      },
    ],
  },
  {
    id: 'prop-lines',
    name: 'lines',
    type: 'Object',
    list: true,
    properties: [
      { id: 'prop-sku', name: 'sku', type: 'string' },
      { id: 'prop-quantity', name: 'quantity', type: 'number' },
      {
        id: 'prop-discount',
        name: 'discount',
        type: 'Object',
        properties: [{ id: 'prop-code', name: 'code', type: 'string' }],
      },
    ],
    rows: [
      {
        'prop-sku': 'ABC-123',
        'prop-quantity': '2',
        'prop-discount': { 'prop-code': 'SPRING' },
      },
    ] as unknown as EditableProperty['rows'],
  },
];

describe('property event mapping', () => {
  it('splits editable properties into schema and examples and merges them back by stable property id', () => {
    expect(deriveNodePropertySchema(editorProperties)).toEqual([
      { propertyId: 'prop-title', name: 'title', type: 'string', optional: true },
      { propertyId: 'prop-flags', name: 'flags', type: 'boolean', list: true },
      {
        propertyId: 'prop-customer',
        name: 'customer',
        type: 'Object',
        properties: [
          { propertyId: 'prop-name', name: 'name', type: 'string' },
          {
            propertyId: 'prop-address',
            name: 'address',
            type: 'Object',
            properties: [{ propertyId: 'prop-city', name: 'city', type: 'string' }],
          },
        ],
      },
      {
        propertyId: 'prop-lines',
        name: 'lines',
        type: 'Object',
        list: true,
        properties: [
          { propertyId: 'prop-sku', name: 'sku', type: 'string' },
          { propertyId: 'prop-quantity', name: 'quantity', type: 'number' },
          {
            propertyId: 'prop-discount',
            name: 'discount',
            type: 'Object',
            properties: [{ propertyId: 'prop-code', name: 'code', type: 'string' }],
          },
        ],
      },
    ]);

    expect(JSON.stringify(deriveNodePropertySchema(editorProperties))).not.toContain('example');
    expect(JSON.stringify(deriveNodePropertySchema(editorProperties))).not.toContain('rows');

    const exampleValues = deriveNodePropertyExampleValues(editorProperties);
    expect(exampleValues).toEqual([
      { propertyId: 'prop-title', scalarValue: 'Checkout completed' },
      { propertyId: 'prop-flags', scalarListValues: ['true', null] },
      {
        propertyId: 'prop-customer',
        complexValue: {
          'prop-name': 'Alice',
          'prop-address': { 'prop-city': 'Springfield' },
        },
      },
      {
        propertyId: 'prop-lines',
        complexListValues: [
          {
            'prop-sku': 'ABC-123',
            'prop-quantity': '2',
            'prop-discount': { 'prop-code': 'SPRING' },
          },
        ],
      },
    ]);
    expect(exampleValues.every((exampleValue) => !('name' in exampleValue))).toBe(true);
    expect(exampleValues.every((exampleValue) => !('type' in exampleValue))).toBe(true);
    expect(JSON.stringify(exampleValues)).not.toContain('optional');

    expect(mergeNodePropertyEditorProperties(deriveNodePropertySchema(editorProperties), exampleValues)).toEqual(editorProperties);
  });
});
