/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  ReactFlowProvider,
  ConnectionLineType,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { parsePrismaSchema, PrismaSchema, PrismaModel } from '@/src/lib/prisma-parser';
import { generateMockValue } from '@/src/lib/data-generator';
import { ModelNode } from '@/src/components/ModelNode';
import { EnumNode } from '@/src/components/EnumNode';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { 
  Download, 
  Code, 
  Trash2, 
  AlertCircle, 
  Info,
  Database,
  Search,
  Play,
  Plus,
  X,
  Table as TableIcon,
  Wand2,
  RefreshCw,
  ArrowRight,
  Layout
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

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  dagreGraph.setGraph({ 
    rankdir: direction, 
    ranksep: 200, // Increased for hierarchy
    nodesep: 150, 
    marginx: 100,
    marginy: 100
  });

  nodes.forEach((node) => {
    // Estimate height based on field count to avoid overlapping
    const fieldCount = (node.data as any).fields?.length || 5;
    const estimatedHeight = 60 + (fieldCount * 35) + 40;
    dagreGraph.setNode(node.id, { width: 300, height: estimatedHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - 150,
      y: nodeWithPosition.y - (dagreGraph.node(node.id).height / 2),
    };
    return node;
  });
};

function Flow() {
  const [schemaText, setSchemaText] = useState(DEFAULT_SCHEMA);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [parsedSchema, setParsedSchema] = useState<PrismaSchema | null>(null);
  const [activeTab, setActiveTab] = useState('editor');
  const [searchQuery, setSearchQuery] = useState('');
  const [mockData, setMockData] = useState<Record<string, any[]>>({});
  const [selectedModelForPlayground, setSelectedModelForPlayground] = useState<string | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();

  const updateDiagram = useCallback((schema: string) => {
    const result = parsePrismaSchema(schema);
    setParsedSchema(result);

    const modelNodes: Node[] = [];
    const enumNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Create Model Nodes
    result.models.forEach((model) => {
      modelNodes.push({
        id: model.name,
        type: 'model',
        data: { ...model, enums: result.enums },
        position: { x: 0, y: 0 },
      });

      model.fields.forEach(field => {
        if (field.relation) {
          const targetModel = result.models.find(m => m.name === field.type);
          if (targetModel) {
            // Find the corresponding field in the target model that is an ID
            const targetIdField = targetModel.fields.find(f => f.isId) || targetModel.fields[0];
            
            newEdges.push({
              id: `${model.name}-${field.name}-${field.type}`,
              source: model.name,
              target: field.type,
              sourceHandle: `${model.name}-${field.name}-source`,
              targetHandle: `${field.type}-${targetIdField.name}-target`,
              label: field.name,
              animated: true,
              style: { stroke: '#6366f1', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
            });
          }
        }
      });
    });

    const layoutedModelNodes = getLayoutedElements(modelNodes, newEdges, 'TB');

    // Create Enum Nodes (Separated in a corner)
    result.enums.forEach((prismaEnum, index) => {
      enumNodes.push({
        id: prismaEnum.name,
        type: 'enum',
        data: prismaEnum,
        position: { x: 1800, y: index * 250 }, // Far right
      });
    });

    setNodes([...layoutedModelNodes, ...enumNodes]);
    setEdges(newEdges);
  }, [setNodes, setEdges]);

  useEffect(() => {
    updateDiagram(schemaText);
  }, [schemaText, updateDiagram]);

  // Search Filtering
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return nodes;
    const query = searchQuery.toLowerCase();
    return nodes.map(node => {
      const isMatch = node.id.toLowerCase().includes(query) || 
                      (node.type === 'model' && (node.data as PrismaModel).fields.some(f => f.name.toLowerCase().includes(query)));
      return {
        ...node,
        style: { ...node.style, opacity: isMatch ? 1 : 0.2, filter: isMatch ? 'none' : 'grayscale(100%)' }
      };
    });
  }, [nodes, searchQuery]);

  const handleExport = async (format: 'png' | 'svg') => {
    if (reactFlowWrapper.current === null) return;
    try {
      const dataUrl = format === 'png' 
        ? await toPng(reactFlowWrapper.current, { backgroundColor: '#09090b', quality: 1, pixelRatio: 2 })
        : await toSvg(reactFlowWrapper.current, { backgroundColor: '#09090b' });

      const link = document.createElement('a');
      link.download = `prisma-schema-${new Date().getTime()}.${format}`;
      link.href = dataUrl;
      link.click();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      toast.success(`Exportado com sucesso!`);
    } catch (err) {
      toast.error('Erro ao exportar.');
    }
  };

  // Playground Logic
  const addRecord = (modelName: string) => {
    const model = parsedSchema?.models.find(m => m.name === modelName);
    if (!model) return;
    const newRecord: any = {};
    model.fields.forEach(f => {
      if (f.isList) newRecord[f.name] = [];
      else if (f.type === 'Int') newRecord[f.name] = 0;
      else if (f.type === 'Boolean') newRecord[f.name] = false;
      else newRecord[f.name] = '';
    });
    setMockData(prev => ({
      ...prev,
      [modelName]: [...(prev[modelName] || []), newRecord]
    }));
    toast.success(`Registro adicionado a ${modelName}`);
  };

  const generateDataForField = (modelName: string, index: number, fieldName: string, type: string) => {
    const val = generateMockValue(type, fieldName);
    updateRecordValue(modelName, index, fieldName, val);
  };

  const generateAllDataForRecord = (modelName: string, index: number) => {
    const model = parsedSchema?.models.find(m => m.name === modelName);
    if (!model) return;
    model.fields.forEach(f => {
      if (!f.relation && !f.isList) {
        const val = generateMockValue(f.type, f.name);
        updateRecordValue(modelName, index, f.name, val);
      }
    });
    toast.success('Dados gerados com sucesso!');
  };

  const deleteRecord = (modelName: string, index: number) => {
    setMockData(prev => ({
      ...prev,
      [modelName]: prev[modelName].filter((_, i) => i !== index)
    }));
    toast.info('Registro removido');
  };

  const updateRecordValue = (modelName: string, index: number, field: string, value: any) => {
    setMockData(prev => {
      const newData = [...(prev[modelName] || [])];
      newData[index] = { ...newData[index], [field]: value };
      return { ...prev, [modelName]: newData };
    });
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden dark">
      <header className="h-14 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Database size={18} />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight uppercase">Prisma Visualizer Pro</h1>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">Advanced Data Cycle Edition</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative mr-4 hidden md:block">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Buscar modelos ou campos..."
              className="pl-9 h-9 w-64 bg-zinc-800 border-zinc-700 text-xs focus-visible:ring-indigo-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => handleExport('png')} className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700">
            <Download size={14} className="mr-2" /> PNG
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('svg')} className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700">
            <RefreshCw size={14} className="mr-2" /> SVG
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1 bg-zinc-700" />
          <Button variant="outline" size="sm" onClick={() => fitView()} className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700">
            <Layout size={14} className="mr-2" /> Fit
          </Button>
          <Button variant="outline" size="sm" onClick={() => updateDiagram(schemaText)} className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700">
            <RefreshCw size={14} className="mr-2" /> Layout
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1 bg-zinc-700" />
          <Button variant="ghost" size="icon" onClick={() => setSchemaText('')} className="text-zinc-500 hover:text-red-500">
            <Trash2 size={18} />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="w-[480px] border-r border-zinc-800 bg-zinc-900 flex flex-col shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-4 py-2 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <TabsList className="bg-transparent border-none p-0 h-auto gap-2">
                <TabsTrigger value="editor" className="data-[state=active]:bg-zinc-800 h-8 px-3 text-xs">
                  <Code size={14} className="mr-2" /> Schema
                </TabsTrigger>
                <TabsTrigger value="playground" className="data-[state=active]:bg-zinc-800 h-8 px-3 text-xs">
                  <Play size={14} className="mr-2" /> Playground
                </TabsTrigger>
                <TabsTrigger value="cycle" className="data-[state=active]:bg-zinc-800 h-8 px-3 text-xs">
                  <RefreshCw size={14} className="mr-2" /> Ciclo
                </TabsTrigger>
                <TabsTrigger value="info" className="data-[state=active]:bg-zinc-800 h-8 px-3 text-xs">
                  <Info size={14} className="mr-2" /> Status
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="editor" className="flex-1 m-0 p-0 overflow-hidden relative">
              <textarea
                value={schemaText}
                onChange={(e) => setSchemaText(e.target.value)}
                className="w-full h-full p-6 font-mono text-sm bg-transparent resize-none focus:outline-none text-zinc-300 leading-relaxed"
                placeholder="Cole seu schema Prisma aqui..."
                spellCheck={false}
              />
            </TabsContent>

            <TabsContent value="playground" className="flex-1 m-0 p-0 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
                <Label className="text-[10px] uppercase font-bold text-zinc-500 mb-2 block tracking-widest">Modelos Disponíveis</Label>
                <div className="flex flex-wrap gap-2">
                  {parsedSchema?.models.map(m => (
                    <Button 
                      key={m.name} 
                      variant={selectedModelForPlayground === m.name ? "default" : "outline"} 
                      size="sm"
                      onClick={() => setSelectedModelForPlayground(m.name)}
                      className="h-7 text-[10px] font-mono"
                    >
                      {m.name}
                    </Button>
                  ))}
                </div>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                  {selectedModelForPlayground ? (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold flex items-center gap-2">
                          <TableIcon size={16} className="text-indigo-400" />
                          {selectedModelForPlayground}
                          <Badge variant="secondary" className="text-[9px] py-0">{ (mockData[selectedModelForPlayground] || []).length } registros</Badge>
                        </h3>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] bg-indigo-600/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/20" onClick={() => addRecord(selectedModelForPlayground)}>
                          <Plus size={14} className="mr-1" /> Novo Registro
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {(mockData[selectedModelForPlayground] || []).map((record, idx) => (
                          <div key={idx} className="p-4 bg-zinc-800/40 border border-zinc-700/50 rounded-xl space-y-4 relative group shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono text-zinc-500 uppercase">Registro #{idx + 1}</span>
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-zinc-500 hover:text-indigo-400"
                                  onClick={() => generateAllDataForRecord(selectedModelForPlayground, idx)}
                                  title="Gerar todos os dados"
                                >
                                  <Wand2 size={14} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-zinc-500 hover:text-red-400"
                                  onClick={() => deleteRecord(selectedModelForPlayground, idx)}
                                >
                                  <X size={14} />
                                </Button>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4">
                              {parsedSchema?.models.find(m => m.name === selectedModelForPlayground)?.fields.map(field => {
                                const isEnum = parsedSchema.enums.some(e => e.name === field.type);
                                const isRelation = parsedSchema.models.some(m => m.name === field.type);
                                
                                if (field.isList) return null; // Skip lists for now in playground

                                return (
                                  <div key={field.name} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                                        {field.name} 
                                        <span className="text-[9px] text-zinc-600">({field.type})</span>
                                      </Label>
                                      {!isRelation && !isEnum && (
                                        <button 
                                          onClick={() => generateDataForField(selectedModelForPlayground, idx, field.name, field.type)}
                                          className="text-[9px] text-indigo-500 hover:text-indigo-400 flex items-center gap-1 transition-colors"
                                        >
                                          <Wand2 size={10} /> Gerar
                                        </button>
                                      )}
                                    </div>

                                    {isEnum ? (
                                      <Select 
                                        value={record[field.name]} 
                                        onValueChange={(val) => updateRecordValue(selectedModelForPlayground, idx, field.name, val)}
                                      >
                                        <SelectTrigger className="h-8 text-[11px] bg-zinc-900 border-zinc-700">
                                          <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-900 border-zinc-800">
                                          {parsedSchema.enums.find(e => e.name === field.type)?.values.map(v => (
                                            <SelectItem key={v} value={v} className="text-[11px]">{v}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : isRelation ? (
                                      <div className="space-y-2">
                                        <Select 
                                          value={record[field.name]} 
                                          onValueChange={(val) => updateRecordValue(selectedModelForPlayground, idx, field.name, val)}
                                        >
                                          <SelectTrigger className="h-8 text-[11px] bg-zinc-900 border-zinc-700">
                                            <SelectValue placeholder={`Relacionar com ${field.type}...`} />
                                          </SelectTrigger>
                                          <SelectContent className="bg-zinc-900 border-zinc-800">
                                            {(mockData[field.type] || []).map((relatedRecord, rIdx) => {
                                              const idVal = relatedRecord.id || relatedRecord.uuid || Object.values(relatedRecord)[0];
                                              return (
                                                <SelectItem key={rIdx} value={String(idVal)} className="text-[11px]">
                                                  {String(idVal)} (Registro #{rIdx + 1})
                                                </SelectItem>
                                              );
                                            })}
                                          </SelectContent>
                                        </Select>
                                        {(mockData[field.type] || []).length === 0 && (
                                          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] text-amber-400 flex items-center gap-2">
                                            <AlertCircle size={10} />
                                            <span>Nenhum dado em <b>{field.type}</b>. Adicione dados lá primeiro para relacionar.</span>
                                          </div>
                                        )}
                                      </div>
                                    ) : field.type === 'Boolean' ? (
                                      <Select 
                                        value={String(record[field.name])} 
                                        onValueChange={(val) => updateRecordValue(selectedModelForPlayground, idx, field.name, val === 'true')}
                                      >
                                        <SelectTrigger className="h-8 text-[11px] bg-zinc-900 border-zinc-700">
                                          <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-900 border-zinc-800">
                                          <SelectItem value="true" className="text-[11px]">true</SelectItem>
                                          <SelectItem value="false" className="text-[11px]">false</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Input 
                                        className="h-8 text-[11px] bg-zinc-900 border-zinc-700 focus-visible:ring-indigo-500"
                                        value={record[field.name] || ''}
                                        onChange={(e) => updateRecordValue(selectedModelForPlayground, idx, field.name, e.target.value)}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {(mockData[selectedModelForPlayground] || []).length === 0 && (
                          <div className="py-16 text-center border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
                            <Play size={32} className="mx-auto text-zinc-800 mb-3" />
                            <p className="text-xs text-zinc-500">Comece adicionando um registro para testar.</p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-24 text-center">
                      <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-zinc-700">
                        <Database size={32} className="text-zinc-600" />
                      </div>
                      <h4 className="text-sm font-bold mb-1">Data Playground</h4>
                      <p className="text-xs text-zinc-500 max-w-[240px] mx-auto leading-relaxed">
                        Selecione um modelo acima para simular a inserção de dados e testar os relacionamentos do seu schema.
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="cycle" className="flex-1 m-0 p-0 overflow-hidden">
              <ScrollArea className="h-full p-6">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Ciclo de Dados</h3>
                    <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-400">Live View</Badge>
                  </div>

                  <div className="space-y-4">
                    {Object.entries(mockData).map(([modelName, records]) => {
                      const dataRecords = records as any[];
                      return dataRecords.length > 0 && (
                        <div key={modelName} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
                          <div className="flex items-center gap-2 text-sm font-bold">
                            <TableIcon size={14} className="text-indigo-400" />
                            {modelName}
                            <span className="text-[10px] text-zinc-500 font-normal">({dataRecords.length} registros)</span>
                          </div>
                          <div className="space-y-2">
                            {dataRecords.map((record, idx) => (
                              <div key={idx} className="text-[11px] p-2 bg-zinc-800/30 rounded border border-zinc-700/50 font-mono flex items-center justify-between">
                                <span className="truncate max-w-[200px]">
                                  {record.id || record.uuid || record.name || `Registro #${idx + 1}`}
                                </span>
                                <div className="flex gap-1">
                                  {parsedSchema?.models.find(m => m.name === modelName)?.fields.filter(f => f.relation).map(f => (
                                    record[f.name] && (
                                      <Badge key={f.name} variant="secondary" className="text-[8px] px-1 h-4 bg-indigo-500/10 text-indigo-400 border-none">
                                        → {f.type}
                                      </Badge>
                                    )
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {Object.values(mockData).every(r => (r as any[]).length === 0) && (
                      <div className="py-20 text-center">
                        <RefreshCw size={32} className="mx-auto text-zinc-800 mb-3 animate-spin-slow" />
                        <p className="text-xs text-zinc-500">Nenhum dado inserido para visualizar o ciclo.</p>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="info" className="flex-1 m-0 p-0 overflow-hidden">
              <ScrollArea className="h-full p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Resumo do Schema</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Modelos</p>
                        <p className="text-2xl font-bold">{parsedSchema?.models.length || 0}</p>
                      </div>
                      <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Enums</p>
                        <p className="text-2xl font-bold">{parsedSchema?.enums.length || 0}</p>
                      </div>
                    </div>
                  </div>

                  {parsedSchema && parsedSchema.errors.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-red-500 mb-3">Erros Detectados</h3>
                      <div className="space-y-2">
                        {parsedSchema.errors.map((error, idx) => (
                          <div key={idx} className="p-3 bg-red-900/10 border border-red-900/30 rounded-lg text-xs text-red-400 flex gap-3">
                            <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex-1 relative bg-zinc-950" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={filteredNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            connectionLineType={ConnectionLineType.SmoothStep}
            minZoom={0.1}
            maxZoom={2}
          >
            <Background color="#27272a" gap={20} size={1} />
            <Controls className="fill-zinc-100" />
            <MiniMap className="!bg-zinc-900 !border-zinc-800" nodeColor="#27272a" />
            <Panel position="top-right">
              <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 p-2 rounded-lg shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Auto-Layout Active</span>
              </div>
            </Panel>
          </ReactFlow>
        </div>
      </main>
      <Toaster theme="dark" position="bottom-right" />
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
