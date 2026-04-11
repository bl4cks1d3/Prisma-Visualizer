
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { PrismaModel, PrismaEnum } from '@/src/lib/prisma-parser';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Key, Link as LinkIcon, List } from 'lucide-react';

interface ModelNodeProps {
  data: PrismaModel & { enums: PrismaEnum[] };
}

export const ModelNode = memo(({ data }: ModelNodeProps) => {
  return (
    <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl min-w-[260px] overflow-hidden transition-all hover:border-indigo-500/50">
      <div className="bg-zinc-100 dark:bg-zinc-800/80 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
        <h3 className="font-bold text-zinc-900 dark:text-zinc-100 font-mono text-sm">{data.name}</h3>
        <Badge variant="outline" className="text-[9px] font-mono opacity-70 uppercase tracking-tighter">Model</Badge>
      </div>
      <div className="p-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[9px] uppercase tracking-widest text-zinc-500 bg-zinc-50/50 dark:bg-zinc-900/30">
              <th className="px-3 py-1.5 font-semibold">Field</th>
              <th className="px-3 py-1.5 font-semibold">Type</th>
            </tr>
          </thead>
          <tbody>
            {data.fields.map((field) => {
              const enumData = data.enums.find(e => e.name === field.type);
              
              return (
                <tr key={field.name} className="border-t border-zinc-100 dark:border-zinc-800 group hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors relative">
                  <td className="px-3 py-2 flex items-center gap-2 relative">
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={`${data.name}-${field.name}-target`}
                      className="!w-2 !h-2 !bg-indigo-500 !border-none !left-[-5px]"
                    />
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`${data.name}-${field.name}-source`}
                      className="!w-2 !h-2 !bg-indigo-500 !border-none !right-[-5px]"
                    />
                    <div className="flex items-center gap-2">
                      {field.isId ? (
                        <Key size={12} className="text-amber-500 shrink-0" />
                      ) : field.relation ? (
                        <LinkIcon size={12} className="text-indigo-500 shrink-0" />
                      ) : enumData ? (
                        <List size={12} className="text-emerald-500 shrink-0" />
                      ) : (
                        <div className="w-3" />
                      )}
                      <span className={`text-xs font-mono truncate max-w-[120px] ${field.isId ? 'font-bold text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        {field.name}
                        {field.isOptional && <span className="text-zinc-400">?</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {enumData ? (
                      <TooltipProvider delay={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 cursor-help border-b border-dotted border-emerald-500/50">
                              {field.type}
                              {field.isList && '[]'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="bg-zinc-900 text-white border-zinc-800 p-2">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Enum Values</p>
                              <div className="flex flex-wrap gap-1 max-w-[200px]">
                                {enumData.values.map(v => (
                                  <Badge key={v} variant="secondary" className="text-[9px] py-0 px-1 bg-zinc-800 text-zinc-300 border-zinc-700">
                                    {v}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className={`text-[11px] font-mono ${field.relation ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500'}`}>
                        {field.type}
                        {field.isList && '[]'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

ModelNode.displayName = 'ModelNode';
