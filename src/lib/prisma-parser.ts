
export interface PrismaField {
  name: string;
  type: string;
  isId: boolean;
  isOptional: boolean;
  isList: boolean;
  isUnique: boolean;
  relation?: {
    name?: string;
    fields?: string[];
    references?: string[];
  };
  default?: string;
  isUpdatedAt?: boolean;
}

export interface PrismaModel {
  name: string;
  fields: PrismaField[];
  documentation?: string;
}

export interface PrismaEnum {
  name: string;
  values: string[];
}

export interface PrismaSchema {
  models: PrismaModel[];
  enums: PrismaEnum[];
  errors: string[];
}

export function parsePrismaSchema(schema: string): PrismaSchema {
  const models: PrismaModel[] = [];
  const enums: PrismaEnum[] = [];
  const errors: string[] = [];

  const lines = schema.split('\n');
  let currentModel: PrismaModel | null = null;
  let currentEnum: PrismaEnum | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('//')) continue;

    // Model start
    if (line.startsWith('model ')) {
      const match = line.match(/model\s+(\w+)\s*{/);
      if (match) {
        currentModel = { name: match[1], fields: [] };
        models.push(currentModel);
      } else {
        errors.push(`Line ${i + 1}: Invalid model definition`);
      }
      continue;
    }

    // Enum start
    if (line.startsWith('enum ')) {
      const match = line.match(/enum\s+(\w+)\s*{/);
      if (match) {
        currentEnum = { name: match[1], values: [] };
        enums.push(currentEnum);
      } else {
        errors.push(`Line ${i + 1}: Invalid enum definition`);
      }
      continue;
    }

    // End of block
    if (line === '}') {
      currentModel = null;
      currentEnum = null;
      continue;
    }

    // Inside model
    if (currentModel) {
      // Basic field parsing: name type attributes
      // Example: id Int @id @default(autoincrement())
      // Example: posts Post[]
      const fieldMatch = line.match(/^(\w+)\s+([\w\[\]]+)(\?|)?\s*(.*)$/);
      if (fieldMatch) {
        const [_, name, typeWithList, optional, attributes] = fieldMatch;
        const isList = typeWithList.endsWith('[]');
        const type = isList ? typeWithList.slice(0, -2) : typeWithList;
        const isOptional = optional === '?';

        const isId = attributes.includes('@id');
        const isUnique = attributes.includes('@unique');
        const isUpdatedAt = attributes.includes('@updatedAt');

        // Extract default
        let defaultValue = '';
        const defaultMatch = attributes.match(/@default\(([^)]*)\)/);
        if (defaultMatch) defaultValue = defaultMatch[1];

        // Extract relation
        let relation: PrismaField['relation'] = undefined;
        const relationMatch = attributes.match(/@relation\(([^)]*)\)/);
        if (relationMatch) {
          const relContent = relationMatch[1];
          relation = {};
          
          const nameMatch = relContent.match(/name:\s*"([^"]*)"/);
          if (nameMatch) relation.name = nameMatch[1];
          
          const fieldsMatch = relContent.match(/fields:\s*\[([^\]]*)\]/);
          if (fieldsMatch) relation.fields = fieldsMatch[1].split(',').map(s => s.trim());
          
          const referencesMatch = relContent.match(/references:\s*\[([^\]]*)\]/);
          if (referencesMatch) relation.references = referencesMatch[1].split(',').map(s => s.trim());
        }

        currentModel.fields.push({
          name,
          type,
          isId,
          isOptional,
          isList,
          isUnique,
          isUpdatedAt,
          default: defaultValue,
          relation
        });
      }
    }

    // Inside enum
    if (currentEnum) {
      const valueMatch = line.match(/^(\w+)$/);
      if (valueMatch) {
        currentEnum.values.push(valueMatch[1]);
      }
    }
  }

  // Basic validation: check if types exist
  const allTypeNames = [...models.map(m => m.name), ...enums.map(e => e.name), 'String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'BigInt', 'Decimal', 'Bytes'];
  
  models.forEach(model => {
    model.fields.forEach(field => {
      if (!allTypeNames.includes(field.type)) {
        errors.push(`Model "${model.name}": Field "${field.name}" has unknown type "${field.type}"`);
      }
    });
  });

  return { models, enums, errors };
}
