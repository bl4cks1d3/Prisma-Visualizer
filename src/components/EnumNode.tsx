
import * as React from 'react';
import { memo } from 'react';
import { PrismaEnum } from '@/src/lib/prisma-parser';
import { Badge } from '@/components/ui/badge';

export const EnumNode = ({ data }: { data: PrismaEnum }) => {
  return (
    <div className="bg-white dark:bg-zinc-900 border-2 border-indigo-200 dark:border-indigo-900/50 rounded-lg shadow-lg min-w-[180px] overflow-hidden">
      <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 border-b border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between">
        <h3 className="font-bold text-indigo-900 dark:text-indigo-100 font-mono">{data.name}</h3>
        <Badge variant="outline" className="text-[10px] font-mono border-indigo-200 text-indigo-600 dark:text-indigo-400">Enum</Badge>
      </div>
      <div className="p-2 space-y-1">
        {data.values.map((value) => (
          <div key={value} className="px-2 py-1 text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded border border-zinc-100 dark:border-zinc-800">
            {value}
          </div>
        ))}
      </div>
    </div>
  );
};

EnumNode.displayName = 'EnumNode';
