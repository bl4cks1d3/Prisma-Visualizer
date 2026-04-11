/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import { parsePrismaSchema, PrismaSchema } from '@/src/lib/prisma-parser';
import { ModelNode } from '@/src/components/ModelNode';
import { EnumNode } from '@/src/components/EnumNode';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { 
  Download, 
  Code, 
  Layout, 
  Share2, 
  Trash2, 
  FileJson, 
  AlertCircle, 
  CheckCircle2,
  Maximize2,
  Info,
  Github,
  Database
} from 'lucide-react';
import { toPng, toSvg } from 'html-to-image';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

const DEFAULT_SCHEMA = `// Exemplo de Schema Prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  posts     Post[]
  profile   Profile?
  createdAt DateTime @default(now())
}

model Profile {
  id     Int    @id @default(autoincrement())
  bio    String
  user   User   @relation(fields: [userId], references: [id])
  userId Int    @unique
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
  tags      Tag[]
}

model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique
  posts Post[]
}

enum Role {
  USER
  ADMIN
  MODERATOR
}`;

const nodeTypes = {
  model: ModelNode,
  enum: EnumNode,
};

function Flow() {
  const [schemaText, setSchemaText] = useState(DEFAULT_SCHEMA);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [parsedSchema, setParsedSchema] = useState<PrismaSchema | null>(null);
  const [activeTab, setActiveTab] = useState('editor');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const updateDiagram = useCallback((schema: string) => {
    const result = parsePrismaSchema(schema);
    setParsedSchema(result);

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Create Model Nodes
    result.models.forEach((model, index) => {
      newNodes.push({
        id: model.name,
        type: 'model',
        data: model,
        position: { x: (index % 3) * 350, y: Math.floor(index / 3) * 400 },
      });

      // Create Edges for relations
      model.fields.forEach(field => {
        if (field.relation) {
          // Find the target model
          const targetModel = result.models.find(m => m.name === field.type);
          if (targetModel) {
            newEdges.push({
              id: `${model.name}-${field.name}-${field.type}`,
              source: model.name,
              target: field.type,
              label: field.name,
              animated: true,
              style: { stroke: '#6366f1', strokeWidth: 2 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#6366f1',
              },
            });
          }
        } else if (result.models.some(m => m.name === field.type)) {
          // Implicit relation or missing @relation attribute
          newEdges.push({
            id: `${model.name}-${field.name}-${field.type}-implicit`,
            source: model.name,
            target: field.type,
            label: field.name,
            style: { stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '5,5' },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#94a3b8',
            },
          });
        }

        // Check for Enum relations
        const targetEnum = result.enums.find(e => e.name === field.type);
        if (targetEnum) {
          newEdges.push({
            id: `${model.name}-${field.name}-${field.type}-enum`,
            source: model.name,
            target: field.type,
            style: { stroke: '#818cf8', strokeWidth: 1 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#818cf8',
            },
          });
        }
      });
    });

    // Create Enum Nodes
    result.enums.forEach((prismaEnum, index) => {
      newNodes.push({
        id: prismaEnum.name,
        type: 'enum',
        data: prismaEnum,
        position: { x: 1000, y: index * 200 },
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [setNodes, setEdges]);

  useEffect(() => {
    updateDiagram(schemaText);
  }, [schemaText, updateDiagram]);

  const handleExport = async (format: 'png' | 'svg') => {
    if (reactFlowWrapper.current === null) return;

    try {
      const element = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!element) return;

      let dataUrl = '';
      if (format === 'png') {
        dataUrl = await toPng(reactFlowWrapper.current, {
          backgroundColor: '#ffffff',
          quality: 1,
          pixelRatio: 2,
        });
      } else {
        dataUrl = await toSvg(reactFlowWrapper.current, {
          backgroundColor: '#ffffff',
        });
      }

      const link = document.createElement('a');
      link.download = `prisma-schema-${new Date().getTime()}.${format}`;
      link.href = dataUrl;
      link.click();
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      toast.success(`Exportado com sucesso como ${format.toUpperCase()}!`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao exportar o diagrama.');
    }
  };

  const handleClear = () => {
    if (confirm('Tem certeza que deseja limpar o schema?')) {
      setSchemaText('');
      toast.info('Schema limpo.');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Database size={18} />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 uppercase">Prisma Visualizer</h1>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">Interactive Schema Designer</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('png')} className="gap-2">
            <Download size={14} />
            <span className="hidden sm:inline">PNG</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('svg')} className="gap-2">
            <Share2 size={14} />
            <span className="hidden sm:inline">SVG</span>
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Button variant="ghost" size="icon" onClick={handleClear} className="text-zinc-500 hover:text-red-500">
            <Trash2 size={18} />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar / Editor */}
        <div className="w-[400px] border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
              <TabsList className="bg-transparent border-none p-0 h-auto">
                <TabsTrigger value="editor" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 shadow-none border border-transparent data-[state=active]:border-zinc-200 dark:data-[state=active]:border-zinc-700 h-8 px-3 text-xs">
                  <Code size={14} className="mr-2" />
                  Schema
                </TabsTrigger>
                <TabsTrigger value="info" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 shadow-none border border-transparent data-[state=active]:border-zinc-200 dark:data-[state=active]:border-zinc-700 h-8 px-3 text-xs">
                  <Info size={14} className="mr-2" />
                  Status
                </TabsTrigger>
              </TabsList>
              
              <div className="flex items-center gap-2">
                {parsedSchema?.errors.length === 0 ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 flex items-center gap-1 py-0.5">
                    <CheckCircle2 size={10} />
                    Válido
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="flex items-center gap-1 py-0.5">
                    <AlertCircle size={10} />
                    {parsedSchema?.errors.length} Erros
                  </Badge>
                )}
              </div>
            </div>

            <TabsContent value="editor" className="flex-1 m-0 p-0 overflow-hidden relative">
              <textarea
                value={schemaText}
                onChange={(e) => setSchemaText(e.target.value)}
                className="w-full h-full p-6 font-mono text-sm bg-transparent resize-none focus:outline-none text-zinc-800 dark:text-zinc-200 leading-relaxed"
                placeholder="Cole seu schema Prisma aqui..."
                spellCheck={false}
              />
              <div className="absolute bottom-4 right-4 text-[10px] text-zinc-400 font-mono pointer-events-none uppercase tracking-widest">
                Real-time validation active
              </div>
            </TabsContent>

            <TabsContent value="info" className="flex-1 m-0 p-0 overflow-hidden">
              <ScrollArea className="h-full p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Resumo do Schema</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Modelos</p>
                        <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{parsedSchema?.models.length || 0}</p>
                      </div>
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Enums</p>
                        <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{parsedSchema?.enums.length || 0}</p>
                      </div>
                    </div>
                  </div>

                  {parsedSchema && parsedSchema.errors.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-red-500 mb-3">Erros de Validação</h3>
                      <div className="space-y-2">
                        {parsedSchema.errors.map((error, idx) => (
                          <div key={idx} className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg text-xs text-red-700 dark:text-red-400 flex gap-3">
                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Dicas</h3>
                    <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <li className="flex gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        Use <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">@relation</code> para definir conexões explícitas.
                      </li>
                      <li className="flex gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        O visualizador detecta automaticamente relações implícitas.
                      </li>
                      <li className="flex gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        Arraste os modelos para reorganizar o diagrama.
                      </li>
                    </ul>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Diagram Area */}
        <div className="flex-1 relative bg-zinc-100 dark:bg-zinc-950" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            className="bg-zinc-100 dark:bg-zinc-950"
          >
            <Background color="#cbd5e1" gap={20} size={1} />
            <Controls />
            <MiniMap 
              nodeStrokeColor={(n) => {
                if (n.type === 'model') return '#6366f1';
                if (n.type === 'enum') return '#818cf8';
                return '#eee';
              }}
              nodeColor={(n) => {
                if (n.type === 'model') return '#fff';
                if (n.type === 'enum') return '#f5f3ff';
                return '#fff';
              }}
            />
            <Panel position="top-right">
              <AnimatePresence>
                {parsedSchema?.errors.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 p-2 rounded-lg shadow-sm flex items-center gap-2"
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Live Preview Active</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </Panel>
          </ReactFlow>
        </div>
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
