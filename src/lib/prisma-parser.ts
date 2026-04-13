
export interface PrismaField {
  name: string;
  mappedName?: string;
  nativeType?: string;
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
  mappedName?: string;
  fields: PrismaField[];
  uniques: string[][];
  indexes: string[][];
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
        currentModel = { name: match[1], fields: [], uniques: [], indexes: [] };
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

        // Extract native type
        let nativeType = undefined;
        const dbTypeMatch = attributes.match(/@db\.(\w+)/);
        if (dbTypeMatch) nativeType = dbTypeMatch[1].toLowerCase();

        // Extract mapped name
        let mappedName = undefined;
        const mapMatch = attributes.match(/@map\("([^"]*)"\)/);
        if (mapMatch) mappedName = mapMatch[1];

        // Extract default - improved to handle nested parentheses like autoincrement()
        let defaultValue = '';
        const defaultMatch = attributes.match(/@default\s*\(/);
        if (defaultMatch) {
          const startIdx = defaultMatch.index!;
          const openParenIdx = attributes.indexOf('(', startIdx);
          
          if (openParenIdx !== -1) {
            let depth = 1;
            let content = '';
            for (let j = openParenIdx + 1; j < attributes.length; j++) {
              const char = attributes[j];
              if (char === '(') depth++;
              else if (char === ')') {
                depth--;
                if (depth === 0) break;
              }
              content += char;
            }
            defaultValue = content.trim();
          }
        }

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
          mappedName,
          nativeType,
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

      // Model attributes
      if (line.startsWith('@@map(')) {
        const match = line.match(/@@map\("([^"]*)"\)/);
        if (match) currentModel.mappedName = match[1];
      }
      if (line.startsWith('@@unique([')) {
        const match = line.match(/@@unique\(\[([^\]]*)\]\)/);
        if (match) {
          const fields = match[1].split(',').map(s => {
            const fieldName = s.trim().split('(')[0]; // Remove (sort: Desc) etc
            return fieldName;
          });
          currentModel.uniques.push(fields);
        }
      }
      if (line.startsWith('@@index([')) {
        const match = line.match(/@@index\(\[([^\]]*)\]\)/);
        if (match) {
          const fields = match[1].split(',').map(s => {
            const fieldName = s.trim().split('(')[0]; // Remove (sort: Desc) etc
            return fieldName;
          });
          currentModel.indexes.push(fields);
        }
      }
    }

    // Inside enum
    if (currentEnum) {
      const valueMatch = line.match(/^(\w+)/);
      if (valueMatch && !line.startsWith('enum ')) {
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
