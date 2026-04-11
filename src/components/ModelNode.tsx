
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { PrismaModel } from '@/src/lib/prisma-parser';
import { Badge } from '@/components/ui/badge';
import { Key, Hash, Calendar, Type, Link as LinkIcon, AlertCircle } from 'lucide-react';

export const ModelNode = memo(({ data }: { data: PrismaModel }) => {
  return (
    <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl min-w-[240px] overflow-hidden">
      <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
        <h3 className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">{data.name}</h3>
        <Badge variant="outline" className="text-[10px] font-mono opacity-70">Model</Badge>
      </div>
      <div className="p-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50">
              <th className="px-3 py-1 font-medium">Field</th>
              <th className="px-3 py-1 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {data.fields.map((field) => (
              <tr key={field.name} className="border-t border-zinc-100 dark:border-zinc-800 group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <td className="px-3 py-2 flex items-center gap-2">
                  <div className="relative">
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`${data.name}-${field.name}-source`}
                      style={{ visibility: 'hidden' }}
                    />
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={`${data.name}-${field.name}-target`}
                      style={{ visibility: 'hidden' }}
                    />
                    {field.isId ? (
                      <Key size={12} className="text-amber-500" />
                    ) : field.relation ? (
                      <LinkIcon size={12} className="text-blue-500" />
                    ) : (
                      <div className="w-3" />
                    )}
                  </div>
                  <span className={`text-sm font-mono ${field.isId ? 'font-bold text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {field.name}
                    {field.isOptional && <span className="text-zinc-400">?</span>}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono text-zinc-500">
                      {field.type}
                      {field.isList && '[]'}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

ModelNode.displayName = 'ModelNode';
