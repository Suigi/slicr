import type {EditableProperty} from '@slicr/react-ui';
import type {NodeComplexExampleValue, NodeExamplePrimitive, NodePropertyExampleValues, NodePropertySchema} from '@slicr/core/events';

type ComplexRow = Record<string, unknown>;

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

const primitiveExample = (value: unknown): NodeExamplePrimitive | undefined => {
  if (value === null) {
    return null;
  }

  return typeof value === 'string' ? value : undefined;
};

const hasMeaningfulPrimitive = (value: NodeExamplePrimitive | undefined) => value !== undefined && value !== '';

export function deriveNodePropertySchema(properties: readonly EditableProperty[]): NodePropertySchema[] {
  return properties.map((property) => {
    const schema: NodePropertySchema = {
      propertyId: property.id,
      name: property.name,
      type: property.type,
    };

    if (property.list) {
      schema.list = true;
    }

    if (property.optional) {
      schema.optional = true;
    }

    if (property.generated) {
      schema.generated = true;
    }

    if (property.type === 'Object') {
      schema.properties = deriveNodePropertySchema(property.properties ?? []);
    }

    return schema;
  });
}

export function deriveNodePropertyExampleValues(properties: readonly EditableProperty[]): NodePropertyExampleValues[] {
  return collectExampleValues(properties);
}

function collectExampleValues(properties: readonly EditableProperty[], includeNonListProperties = true): NodePropertyExampleValues[] {
  return properties.flatMap((property) => {
    const exampleValues = deriveExampleValue(property);
    const nestedExampleValues = property.type === 'Object' ? collectExampleValues(property.properties ?? [], false) : [];

    return [...((includeNonListProperties || property.list) && exampleValues ? [exampleValues] : []), ...nestedExampleValues];
  });
}

function deriveExampleValue(property: EditableProperty): NodePropertyExampleValues | undefined {
  if (property.type === 'Object') {
    if (property.list) {
      const complexListValues = (property.rows ?? []).map((row) => deriveComplexValueFromRow(property.properties ?? [], row));
      return complexListValues.length > 0 ? {propertyId: property.id, complexListValues} : undefined;
    }

    const complexValue = deriveComplexValueFromProperties(property.properties ?? []);
    return Object.keys(complexValue).length > 0 ? {propertyId: property.id, complexValue} : undefined;
  }

  if (property.list) {
    const scalarListValues = (property.exampleValues ?? [])
      .map((value) => primitiveExample(value))
      .filter((value): value is NodeExamplePrimitive => value !== undefined);
    return scalarListValues.length > 0 ? {propertyId: property.id, scalarListValues} : undefined;
  }

  const scalarValue = primitiveExample(property.example);
  return hasMeaningfulPrimitive(scalarValue) ? {propertyId: property.id, scalarValue} : undefined;
}

function deriveComplexValueFromProperties(properties: readonly EditableProperty[]): NodeComplexExampleValue {
  const complexValue: NodeComplexExampleValue = {};

  for (const property of properties) {
    if (property.type === 'Object') {
      const nestedValue = deriveComplexValueFromProperties(property.properties ?? []);
      if (Object.keys(nestedValue).length > 0) {
        complexValue[property.id] = nestedValue;
      }
      continue;
    }

    const scalarValue = primitiveExample(property.example);
    if (scalarValue !== undefined && scalarValue !== '') {
      complexValue[property.id] = scalarValue;
    }
  }

  return complexValue;
}

function deriveComplexValueFromRow(properties: readonly EditableProperty[], row: ComplexRow): NodeComplexExampleValue {
  const complexValue: NodeComplexExampleValue = {};

  for (const property of properties) {
    const rawValue = hasOwn(row, property.id) ? row[property.id] : row[property.name];

    if (property.type === 'Object') {
      if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
        complexValue[property.id] = deriveComplexValueFromRow(property.properties ?? [], rawValue as ComplexRow);
      }
      continue;
    }

    const scalarValue = primitiveExample(rawValue);
    if (scalarValue !== undefined) {
      complexValue[property.id] = scalarValue;
    }
  }

  return complexValue;
}

export function mergeNodePropertyEditorProperties(
  schema: readonly NodePropertySchema[],
  exampleValues: readonly NodePropertyExampleValues[],
): EditableProperty[] {
  const examplesById = new Map(exampleValues.map((exampleValue) => [exampleValue.propertyId, exampleValue]));
  return schema.map((propertySchema) => mergeProperty(propertySchema, examplesById.get(propertySchema.propertyId), examplesById));
}

function mergeProperty(
  schema: NodePropertySchema,
  examples: NodePropertyExampleValues | undefined,
  examplesById: ReadonlyMap<string, NodePropertyExampleValues>,
): EditableProperty {
  const property: EditableProperty = {
    id: schema.propertyId,
    name: schema.name,
    type: schema.type,
  };

  if (schema.list) {
    property.list = true;
  }

  if (schema.optional) {
    property.optional = true;
  }

  if (schema.generated) {
    property.generated = true;
  }

  if (schema.type === 'Object') {
    if (schema.list) {
      property.properties = mergeNodePropertyEditorProperties(schema.properties ?? [], []);
      if (examples?.complexListValues) {
        property.rows = examples.complexListValues.map((complexValue) =>
          complexValueToRow(schema.properties ?? [], complexValue),
        ) as EditableProperty['rows'];
      }
      return property;
    }

    property.properties = mergeObjectProperties(schema.properties ?? [], examples?.complexValue, examplesById);
    return property;
  }

  if (schema.list) {
    if (examples?.scalarListValues) {
      property.exampleValues = examples.scalarListValues as EditableProperty['exampleValues'];
    }
    return property;
  }

  if (examples && hasOwn(examples, 'scalarValue')) {
    property.example = examples.scalarValue ?? '';
  }

  return property;
}

function mergeObjectProperties(
  schema: readonly NodePropertySchema[],
  complexValue: NodeComplexExampleValue | undefined,
  examplesById: ReadonlyMap<string, NodePropertyExampleValues>,
): EditableProperty[] {
  return schema.map((propertySchema) => {
    const nestedValue = complexValue?.[propertySchema.propertyId];

    if (propertySchema.list) {
      return mergeProperty(propertySchema, examplesById.get(propertySchema.propertyId), examplesById);
    }

    if (propertySchema.type === 'Object') {
      return mergeProperty(
        propertySchema,
        nestedValue && typeof nestedValue === 'object' ? {propertyId: propertySchema.propertyId, complexValue: nestedValue} : undefined,
        examplesById,
      );
    }

    return mergeProperty(
      propertySchema,
      nestedValue === null || typeof nestedValue === 'string'
        ? {propertyId: propertySchema.propertyId, scalarValue: nestedValue}
        : undefined,
      examplesById,
    );
  });
}

function complexValueToRow(schema: readonly NodePropertySchema[], complexValue: NodeComplexExampleValue): ComplexRow {
  const row: ComplexRow = {};

  for (const propertySchema of schema) {
    const value = complexValue[propertySchema.propertyId];

    if (value === undefined) {
      continue;
    }

    row[propertySchema.propertyId] =
      propertySchema.type === 'Object' && value !== null && typeof value === 'object'
        ? complexValueToRow(propertySchema.properties ?? [], value)
        : value;
  }

  return row;
}
