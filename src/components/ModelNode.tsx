
import * as React from 'react';
import { memo } from 'react';
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

export const ModelNode = ({ data }: ModelNodeProps) => {
  return (
    <div className="bg-[#1e1e24] border border-zinc-800 rounded-md shadow-2xl min-w-[280px] transition-all hover:border-indigo-500/50">
      <div className="bg-[#18181b] px-3 py-2 border-b border-zinc-800 flex items-center justify-between rounded-t-md overflow-hidden">
        <h3 className="font-bold text-zinc-100 font-mono text-xs tracking-tight">{data.name.toLowerCase()}</h3>
      </div>
      <div className="p-0">
        <table className="w-full text-left border-collapse">
          <tbody>
            {data.fields.map((field) => {
              const enumData = data.enums.find(e => e.name === field.type);
              
              return (
                <tr key={field.name} className="group hover:bg-zinc-800/40 transition-colors relative">
                  <td className="px-3 py-1.5 flex items-center gap-2 relative">
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={`${data.name}-${field.name}-target`}
                      className="!opacity-0 !w-1 !h-1 !border-none !left-[-2px] !top-1/2 !-translate-y-1/2"
                    />
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`${data.name}-${field.name}-source`}
                      className="!opacity-0 !w-1 !h-1 !border-none !right-[-2px] !top-1/2 !-translate-y-1/2"
                    />
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-mono flex items-center gap-1.5 ${field.isId ? 'font-bold text-zinc-100' : 'text-zinc-300'}`}>
                        {field.name}
                        {field.isId && <Key size={10} className="text-zinc-500" />}
                        {field.relation && <LinkIcon size={10} className="text-zinc-500" />}
                        {enumData && <List size={10} className="text-zinc-500" />}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {enumData ? (
                      <TooltipProvider delay={0}>
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="text-[10px] font-mono text-zinc-500 cursor-help flex items-center justify-end gap-1">
                              {field.type}
                              <span className="bg-zinc-800 text-[8px] px-1 rounded border border-zinc-700">E</span>
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
                      <span className="text-[10px] font-mono text-zinc-500">
                        {field.type.toLowerCase()}
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
};

ModelNode.displayName = 'ModelNode';
