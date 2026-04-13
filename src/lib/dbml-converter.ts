import { PrismaSchema } from './prisma-parser';

/**
 * Converts a Prisma Schema (parsed) to DBML.
 * Inspired by the logic of prisma-dbml-generator to ensure maximum compatibility with dbdiagram.io
 */
export function convertPrismaToDBML(schema: PrismaSchema): string {
  let dbml = '// Use https://dbdiagram.io to visualize this schema\n\n';

  // 1. Enums
  dbml += '// ==========================================\n';
  dbml += '// ENUMS\n';
  dbml += '// ==========================================\n\n';
  schema.enums.forEach(en => {
    dbml += `Enum ${en.name} {\n`;
    en.values.forEach(val => {
      dbml += `  ${val}\n`;
    });
    dbml += `}\n\n`;
  });

  // 2. Tables
  dbml += '// ==========================================\n';
  dbml += '// TABLES\n';
  dbml += '// ==========================================\n\n';
  schema.models.forEach(model => {
    const tableName = model.mappedName || model.name;
    dbml += `Table ${tableName} {\n`;
    
    model.fields.forEach(field => {
      // Skip relation fields that don't have scalar storage (Prisma virtual relations)
      const isModelType = schema.models.some(m => m.name === field.type);
      if (isModelType && !field.relation?.fields) {
        return;
      }
      if (isModelType) return; // We only want scalar fields in the table definition

      const isEnum = schema.enums.some(e => e.name === field.type);
      let type = isEnum ? field.type : (field.nativeType || mapPrismaTypeToDBML(field.type));
      
      // Special case for uuid
      if (field.type === 'String' && (field.default === 'uuid()' || field.default === 'cuid()')) {
        type = 'uuid';
      }

      const fieldName = field.mappedName || field.name;
      let attributes: string[] = [];

      if (field.isId) attributes.push('pk');
      if (field.isUnique) attributes.push('unique');
      
      if (field.default) {
        const def = field.default;
        if (def === 'autoincrement()') {
          attributes.push('increment');
        } else if (def === 'now()') {
          attributes.push('default: `now()`');
        } else if (def === 'uuid()' || def === 'cuid()') {
          // If it's uuid/cuid, we already set the type to uuid, 
          // but we might still want the default if it's not just for type identification.
          // In the user's example, they don't show [default: `uuid()`] for uuid fields.
          // So we skip it if it's just the uuid generator.
        } else if (def.startsWith('"') && def.endsWith('"')) {
          attributes.push(`default: '${def.slice(1, -1)}'`);
        } else if (def === 'true' || def === 'false' || !isNaN(Number(def))) {
          attributes.push(`default: ${def}`);
        } else {
          attributes.push(`default: '${def}'`);
        }
      }

      if (!field.isOptional && !field.isId) {
        attributes.push('not null');
      }

      const attrStr = attributes.length > 0 ? ` [${attributes.join(', ')}]` : '';
      dbml += `  ${fieldName} ${type}${field.isList ? '[]' : ''}${attrStr}\n`;
    });

    // Indexes (Separate blocks as requested)
    model.uniques.forEach(u => {
      const mappedFields = u.map(f => {
        const field = model.fields.find(sf => sf.name === f);
        return field?.mappedName || f;
      });
      dbml += `\n  Indexes {\n    (${mappedFields.join(', ')}) [unique]\n  }\n`;
    });
    
    model.indexes.forEach(idx => {
      const mappedFields = idx.map(f => {
        const field = model.fields.find(sf => sf.name === f);
        return field?.mappedName || f;
      });
      dbml += `\n  Indexes {\n    (${mappedFields.join(', ')})\n  }\n`;
    });
    
    dbml += `}\n\n`;
  });

  // 3. Relations (Refs)
  dbml += '// ==========================================\n';
  dbml += '// RELATIONSHIPS\n';
  dbml += '// ==========================================\n\n';
  schema.models.forEach(model => {
    model.fields.forEach(field => {
      if (field.relation && field.relation.fields && field.relation.references) {
        const sourceTable = model.mappedName || model.name;
        const targetTable = schema.models.find(m => m.name === field.type)?.mappedName || field.type;
        
        field.relation.fields.forEach((f, i) => {
          const ref = field.relation!.references![i];
          
          // Determine relationship type
          const targetModel = schema.models.find(m => m.name === field.type);
          const backRelation = targetModel?.fields.find(f => f.type === model.name);
          
          let relChar = '>'; // Many-to-one (default)
          if (backRelation) {
            if (!backRelation.isList) {
              relChar = '-'; // One-to-one
            }
          }

          // In Prisma, the field 'f' might be mapped. We need to find its mapped name.
          const scalarField = model.fields.find(sf => sf.name === f);
          const scalarFieldName = scalarField?.mappedName || f;

          // Same for the reference field in the target table
          const targetField = targetModel?.fields.find(tf => tf.name === ref);
          const targetFieldName = targetField?.mappedName || ref;

          dbml += `Ref: ${sourceTable}.${scalarFieldName} ${relChar} ${targetTable}.${targetFieldName}\n`;
        });
      }
    });
  });

  return dbml;
}

function mapPrismaTypeToDBML(prismaType: string): string {
  const typeMap: Record<string, string> = {
    'Int': 'int',
    'String': 'varchar',
    'Boolean': 'boolean',
    'DateTime': 'timestamp',
    'Float': 'float',
    'Decimal': 'decimal',
    'Json': 'json',
    'BigInt': 'bigint',
    'Bytes': 'bytes',
  };
  return typeMap[prismaType] || prismaType;
}
