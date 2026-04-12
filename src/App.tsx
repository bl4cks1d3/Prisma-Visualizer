/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  Panel,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  updateEdge,
  Connection,
  NodeChange,
  EdgeChange,
  MarkerType,
  Node,
  Edge,
  ReactFlowProvider,
  ConnectionLineType,
  useReactFlow,
  getNodesBounds,
  getTransformForBounds
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { parsePrismaSchema, PrismaSchema, PrismaModel } from '@/src/lib/prisma-parser';
import { generateMockValue } from '@/src/lib/data-generator';
import { ModelNode } from '@/src/components/ModelNode';
import { EnumNode } from '@/src/components/EnumNode';
import { RelationEdge } from '@/src/components/RelationEdge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Layout,
  Save,
  CheckCircle2,
  CheckCircle,
  Activity,
  ChevronRight,
  ChevronDown,
  Edit2,
  List as ListIcon,
  Key
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toPng, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import { 
  generateSchemaFromPrompt, 
  explainSchema, 
  generateRealisticData,
  setAIConfig,
  AIProvider,
  ChatMessage
} from '@/src/services/geminiService';
import { PrismaEnum } from '@/src/lib/prisma-parser';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

const edgeTypes = {
  relation: RelationEdge,
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  dagreGraph.setGraph({ 
    rankdir: direction, 
    ranksep: 180, 
    nodesep: 140, 
    marginx: 80,
    marginy: 80
  });

  nodes.forEach((node) => {
    const fieldCount = (node.data as any).fields?.length || 5;
    const estimatedHeight = 40 + (fieldCount * 28) + 20;
    dagreGraph.setNode(node.id, { width: 280, height: estimatedHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - 140,
      y: nodeWithPosition.y - (dagreGraph.node(node.id).height / 2),
    };
    return node;
  });
};

function SortableSimulationStep(props: any) {
  const { 
    step, 
    idx, 
    simulationResults, 
    onRemove, 
    isEditing, 
    onEdit, 
    onUpdateData, 
    parsedSchema, 
    mockData 
  } = props;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const model = parsedSchema?.models.find((m: any) => m.name === step.model);

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg relative group touch-none"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-zinc-800 rounded">
            <ListIcon size={12} className="text-zinc-600" />
          </div>
          <Badge className={
            step.type === 'INSERT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            step.type === 'DELETE' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
            'bg-blue-500/10 text-blue-400 border-blue-500/20'
          }>
            {step.type}
          </Badge>
          <span className="text-xs font-mono font-bold">{step.model}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-6 w-6 ${isEditing ? 'text-indigo-400' : 'text-zinc-600 hover:text-indigo-400'}`}
            onClick={() => onEdit(isEditing ? null : step.id)}
          >
            <Edit2 size={12} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-zinc-600 hover:text-rose-400"
            onClick={() => onRemove(step.id)}
          >
            <Trash2 size={12} />
          </Button>
        </div>
      </div>
      
      {isEditing ? (
        <div className="space-y-3 mt-3 p-3 bg-black/40 rounded-md border border-zinc-800 max-h-[50vh] overflow-auto no-scrollbar">
          {model?.fields.filter((f: any) => !f.isList && (step.type !== 'DELETE' || f.isId)).map((field: any) => {
            const isEnum = parsedSchema.enums.some((e: any) => e.name === field.type);
            const isRelation = parsedSchema.models.some((m: any) => m.name === field.type);
            
            return (
              <div key={field.name} className="space-y-1">
                <Label className="text-[9px] text-zinc-500 uppercase font-bold">{field.name}</Label>
                {isEnum ? (
                  <Select value={step.data[field.name] ?? ""} onValueChange={(val) => onUpdateData(step.id, field.name, val)}>
                    <SelectTrigger className="h-7 text-[10px] bg-zinc-950 border-zinc-800"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {parsedSchema.enums.find((e: any) => e.name === field.type)?.values.map((v: any) => (
                        <SelectItem key={v} value={v} className="text-[10px]">{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : isRelation ? (
                  <Select value={step.data[field.name] ?? ""} onValueChange={(val) => onUpdateData(step.id, field.name, val)}>
                    <SelectTrigger className="h-7 text-[10px] bg-zinc-950 border-zinc-800"><SelectValue placeholder="Relacionar..." /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {(mockData[field.type] || []).filter((r: any) => !r._isNew).map((r: any, i: number) => (
                        <SelectItem key={i} value={String(r.id || r.uuid || i)} className="text-[10px]">{String(r.id || r.uuid || `ID:${i}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === 'Boolean' ? (
                  <Select value={String(step.data[field.name] ?? false)} onValueChange={(val) => onUpdateData(step.id, field.name, val === 'true')}>
                    <SelectTrigger className="h-7 text-[10px] bg-zinc-950 border-zinc-800"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="true" className="text-[10px]">true</SelectItem>
                      <SelectItem value="false" className="text-[10px]">false</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input 
                    className="h-7 text-[10px] bg-zinc-950 border-zinc-800" 
                    value={step.data[field.name] || ''} 
                    onChange={(e) => onUpdateData(step.id, field.name, e.target.value)} 
                  />
                )}
              </div>
            );
          })}
          <Button 
            size="sm" 
            className="w-full h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700 mt-2"
            onClick={() => onEdit(null)}
          >
            Concluir Edição
          </Button>
        </div>
      ) : (
        <div className="text-[10px] font-mono text-zinc-500 bg-black/20 p-2 rounded border border-zinc-800/50">
          {JSON.stringify(step.data, null, 2)}
        </div>
      )}

      {simulationResults[idx] && (
        <div className={`mt-2 p-2 rounded text-[10px] flex items-start gap-2 ${
          simulationResults[idx].success ? 'bg-emerald-500/5 text-emerald-400 border border-emerald-500/10' : 'bg-rose-500/5 text-rose-400 border border-rose-500/10'
        }`}>
          {simulationResults[idx].success ? <CheckCircle size={12} className="shrink-0 mt-0.5" /> : <AlertCircle size={12} className="shrink-0 mt-0.5" />}
          <span>{simulationResults[idx].message}</span>
        </div>
      )}
    </div>
  );
}

function Flow() {
  const [schemaText, setSchemaText] = React.useState(DEFAULT_SCHEMA);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);

  const onConnect = React.useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ 
      ...params, 
      animated: true, 
      style: { stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '5 5' }, 
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' } 
    }, eds)),
    [setEdges]
  );

  const onEdgeUpdate = React.useCallback(
    (oldEdge: Edge, newConnection: Connection) => setEdges((els) => updateEdge(oldEdge, newConnection, els)),
    [setEdges]
  );

  const onEdgeClick = React.useCallback((_: any, edge: Edge) => {
    setSelectedEdgeId(edge.id);
  }, []);

  const onPaneClick = React.useCallback(() => {
    setSelectedEdgeId(null);
  }, []);

  const updateEdgeStyle = (edgeId: string, color: string, animated: boolean) => {
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id === edgeId) {
          return {
            ...e,
            animated,
            style: { ...e.style, stroke: color },
            markerEnd: { ...(e.markerEnd as any), color },
          };
        }
        return e;
      })
    );
  };
  
  const [parsedSchema, setParsedSchema] = React.useState<PrismaSchema | null>(null);
  const [activeTab, setActiveTab] = React.useState('editor');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [mockData, setMockData] = React.useState<Record<string, any[]>>({});
  const [selectedModelForPlayground, setSelectedModelForPlayground] = React.useState<string | null>(null);
  const [showEnumSidebar, setShowEnumSidebar] = React.useState(false);
  const [showToolbar, setShowToolbar] = React.useState(true);
  const [simulationSteps, setSimulationSteps] = React.useState<any[]>([]);
  const [editingStepId, setEditingStepId] = React.useState<string | null>(null);
  const [isSimulating, setIsSimulating] = React.useState(false);
  const [simulationResults, setSimulationResults] = React.useState<any[]>([]);
  const [editingRecord, setEditingRecord] = React.useState<{model: string, index: number} | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = React.useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = React.useState('');
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [schemaExplanation, setSchemaExplanation] = React.useState<string | null>(null);
  const [apiKey, setApiKey] = React.useState('');
  const [aiProvider, setAiProvider] = React.useState<AIProvider>('gemini');
  const [openRouterModel, setOpenRouterModel] = React.useState('google/gemini-2.0-pro-exp-02-05:free');
  const [showApiKeyDialog, setShowApiKeyDialog] = React.useState(false);
  const [chatHistory, setChatHistory] = React.useState<ChatMessage[]>([]);
  const reactFlowWrapper = React.useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();

  const updateSimulationStepData = (stepId: string, field: string, value: any) => {
    setSimulationSteps(prev => prev.map(s => s.id === stepId ? { ...s, data: { ...s.data, [field]: value } } : s));
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSimulationSteps((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      setSimulationResults([]);
    }
  };

  const updateDiagram = React.useCallback((schema: string) => {
    const result = parsePrismaSchema(schema);
    setParsedSchema(result);

    const modelNodes: Node[] = [];
    const newEdges: Edge[] = [];

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
            const targetIdField = targetModel.fields.find(f => f.isId) || targetModel.fields[0];
            newEdges.push({
              id: `${model.name}-${field.name}-${field.type}`,
              source: model.name,
              target: field.type,
              sourceHandle: `${model.name}-${field.name}-source`,
              targetHandle: `${field.type}-${targetIdField.name}-target`,
              animated: true,
              type: 'relation',
              style: { stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '5 5' },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
            });
          }
        }
      });
    });

    const layoutedModelNodes = getLayoutedElements(modelNodes, newEdges, 'TB');
    setNodes(layoutedModelNodes);
    setEdges(newEdges);
  }, [setNodes, setEdges]);

  React.useEffect(() => {
    updateDiagram(schemaText);
  }, [schemaText, updateDiagram]);

  // Search Filtering
  const filteredNodes = React.useMemo(() => {
    if (!searchQuery) return nodes;
    const query = searchQuery.toLowerCase();
    return nodes.map(node => {
      const isMatch = node.id.toLowerCase().includes(query) || 
                      (node.type === 'model' && (node.data as unknown as PrismaModel).fields.some(f => f.name.toLowerCase().includes(query)));
      return {
        ...node,
        style: { ...node.style, opacity: isMatch ? 1 : 0.2, filter: isMatch ? 'none' : 'grayscale(100%)' }
      };
    });
  }, [nodes, searchQuery]);

  const handleExport = async (format: 'png' | 'svg' | 'pdf') => {
    if (reactFlowWrapper.current === null) return;
    
    const nodesBounds = getNodesBounds(nodes);
    const transform = getTransformForBounds(nodesBounds, 2000, 2000, 0.5, 2);
    
    try {
      const el = reactFlowWrapper.current.querySelector('.react-flow__viewport') as HTMLElement;
      if (!el) return;

      if (format === 'pdf') {
        const dataUrl = await toPng(el, { 
          backgroundColor: '#09090b', 
          pixelRatio: 1.5,
          width: nodesBounds.width + 100,
          height: nodesBounds.height + 100,
          style: {
            transform: `translate(${-nodesBounds.x + 50}px, ${-nodesBounds.y + 50}px) scale(1)`,
          }
        });
        
        const pdf = new jsPDF({
          orientation: nodesBounds.width > nodesBounds.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [nodesBounds.width + 100, nodesBounds.height + 100],
          compress: true
        });
        
        pdf.addImage(dataUrl, 'PNG', 0, 0, nodesBounds.width + 100, nodesBounds.height + 100, undefined, 'FAST');
        pdf.save(`prisma-schema-${new Date().getTime()}.pdf`);
        toast.success(`Exportado como PDF com sucesso!`);
        return;
      }

      const dataUrl = format === 'png' 
        ? await toPng(el, { 
            backgroundColor: '#09090b', 
            quality: 1, 
            pixelRatio: 2,
            width: nodesBounds.width + 100,
            height: nodesBounds.height + 100,
            style: {
              transform: `translate(${-nodesBounds.x + 50}px, ${-nodesBounds.y + 50}px) scale(1)`,
            }
          })
        : await toSvg(el, { 
            backgroundColor: '#09090b',
            width: nodesBounds.width + 100,
            height: nodesBounds.height + 100,
            style: {
              transform: `translate(${-nodesBounds.x + 50}px, ${-nodesBounds.y + 50}px) scale(1)`,
            }
          });

      const link = document.createElement('a');
      link.download = `prisma-schema-${new Date().getTime()}.${format}`;
      link.href = dataUrl;
      link.click();
      toast.success(`Exportado como ${format.toUpperCase()} com sucesso!`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao exportar.');
    }
  };

  const addRecord = (modelName: string) => {
    const model = parsedSchema?.models.find(m => m.name === modelName);
    if (!model) return;
    const newRecord: any = { _isNew: true };
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
  };

  const saveRecord = (modelName: string, index: number) => {
    setMockData(prev => {
      const newData = [...(prev[modelName] || [])];
      newData[index] = { ...newData[index], _isNew: false };
      return { ...prev, [modelName]: newData };
    });
    setEditingRecord(null);
    toast.success('Registro salvo com sucesso!');
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

  const handleGenerateSchemaWithAi = async () => {
    if (!aiPrompt.trim()) return;
    
    // Se não houver chave configurada, abre o diálogo
    const hasKey = aiProvider === 'gemini' ? (apiKey || process.env.GEMINI_API_KEY) : apiKey;
    if (!hasKey) {
      setShowApiKeyDialog(true);
      toast.info(`Por favor, configure sua API Key do ${aiProvider === 'gemini' ? 'Gemini' : 'OpenRouter'} para continuar.`);
      return;
    }

    setIsAiLoading(true);
    const userMessage = aiPrompt;
    try {
      const newSchema = await generateSchemaFromPrompt(userMessage, chatHistory, schemaText);
      setSchemaText(newSchema);
      
      // Update history
      setChatHistory(prev => [
        ...prev,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: 'Schema updated successfully.' }
      ]);
      
      toast.success('Schema ajustado com sucesso!');
      setAiPrompt('');
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao gerar schema: ${err.message || 'Verifique sua API Key.'}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleExplainSchema = async () => {
    setIsAiLoading(true);
    try {
      const explanation = await explainSchema(schemaText);
      setSchemaExplanation(explanation);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao explicar schema.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleGenerateRealisticData = async (modelName: string) => {
    setIsAiLoading(true);
    try {
      const data = await generateRealisticData(modelName, schemaText);
      setMockData(prev => ({
        ...prev,
        [modelName]: [...(prev[modelName] || []), ...data.map(d => ({ ...d, _isNew: true }))]
      }));
      toast.success(`${data.length} registros gerados com IA!`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar dados com IA.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const updateRecordValue = (modelName: string, index: number, field: string, value: any) => {
    setMockData(prev => {
      const newData = [...(prev[modelName] || [])];
      newData[index] = { ...newData[index], [field]: value };
      return { ...prev, [modelName]: newData };
    });
  };

  const clearAllData = () => {
    setMockData({});
    toast.info('Todos os dados foram limpos.');
  };

  const runAutomatedTest = () => {
    if (!parsedSchema) return;
    
    setIsSimulating(true);
    setSimulationResults([]);
    
    toast.promise(new Promise(async (resolve) => {
      const results = [];
      const tempMockData = JSON.parse(JSON.stringify(mockData));
      
      for (const step of simulationSteps) {
        const result = validateOperation(step, tempMockData);
        results.push(result);
        if (result.success && result.updatedData) {
          Object.assign(tempMockData, result.updatedData);
        }
      }
      
      setSimulationResults(results);
      setTimeout(() => {
        setIsSimulating(false);
        const allSuccess = results.every(r => r.success);
        if (allSuccess) {
          setMockData(tempMockData);
        }
        resolve(results);
      }, 1000);
    }), {
      loading: 'Simulando fluxo de dados...',
      success: (results: any) => {
        const allSuccess = (results as any[]).every(r => r.success);
        if (allSuccess) {
          return 'Simulação concluída! Dados aplicados ao banco.';
        }
        return 'Simulação concluída com alertas/erros. Nenhuma alteração foi aplicada.';
      },
      error: 'Erro na simulação.',
    });
  };

  const validateOperation = (step: any, currentData: any) => {
    const { type, model: modelName, data } = step;
    const model = parsedSchema?.models.find(m => m.name === modelName);
    
    if (!model) return { success: false, message: `Modelo ${modelName} não encontrado.` };

    const operationData = { ...data };

    if (type === 'INSERT') {
      // Handle ID generation if missing
      const idField = model.fields.find(f => f.isId);
      if (idField && !operationData[idField.name]) {
        if (idField.default === 'autoincrement()') {
          const existing = currentData[modelName] || [];
          const maxId = existing.reduce((max: number, r: any) => Math.max(max, Number(r[idField.name]) || 0), 0);
          operationData[idField.name] = maxId + 1;
        } else {
          operationData[idField.name] = Math.random().toString(36).substr(2, 9);
        }
      }

      // Check for unique ID
      if (idField && operationData[idField.name]) {
        const existing = currentData[modelName] || [];
        if (existing.some((r: any) => r[idField.name] == operationData[idField.name])) {
          return { success: false, message: `Erro de chave primária: ID ${operationData[idField.name]} já existe em ${modelName}.` };
        }
      }

      // Check required fields
      for (const field of model.fields) {
        if (!field.isOptional && !field.isList && field.default === '' && !operationData[field.name] && operationData[field.name] !== 0 && operationData[field.name] !== false) {
          if (field.isId && field.default === 'autoincrement()') continue;
          return { success: false, message: `Campo obrigatório ausente: ${field.name}` };
        }
        
        // Check relations
        if (field.relation && field.relation.fields && field.relation.fields.length > 0) {
          const relField = field.relation.fields[0];
          const relValue = operationData[relField];
          if (relValue) {
            const targetModel = field.type;
            const targetRecords = currentData[targetModel] || [];
            const refField = field.relation.references?.[0] || 'id';
            const exists = targetRecords.some((r: any) => r[refField] == relValue);
            if (!exists) {
              return { success: false, message: `Erro de integridade: ${targetModel} com ${refField}=${relValue} não existe.` };
            }
          }
        }
      }
      
      const updatedData = { ...currentData };
      updatedData[modelName] = [...(currentData[modelName] || []), operationData];
      return { success: true, message: `Inserção em ${modelName} realizada.`, updatedData };
    }

    if (type === 'DELETE') {
      const recordToDelete = (currentData[modelName] || []).find((r: any) => {
        const idField = model.fields.find(f => f.isId)?.name || 'id';
        return r[idField] == data[idField];
      });

      if (!recordToDelete) return { success: false, message: `Registro para deletar não encontrado em ${modelName}.` };

      // Check cascade/orphans
      const idField = model.fields.find(f => f.isId)?.name || 'id';
      const idValue = recordToDelete[idField];
      
      for (const m of parsedSchema?.models || []) {
        for (const f of m.fields) {
          if (f.type === modelName && f.relation?.fields) {
            const foreignKey = f.relation.fields[0];
            const dependents = (currentData[m.name] || []).filter((r: any) => r[foreignKey] == idValue);
            if (dependents.length > 0) {
              return { 
                success: false, 
                message: `Conflito de deleção: ${dependents.length} registros em ${m.name} dependem deste ${modelName}. (Simulação de erro de chave estrangeira)` 
              };
            }
          }
        }
      }

      const updatedData = { ...currentData };
      updatedData[modelName] = (currentData[modelName] || []).filter((r: any) => {
        const idField = model.fields.find(f => f.isId)?.name || 'id';
        return r[idField] != data[idField];
      });
      return { success: true, message: `Deleção em ${modelName} realizada.`, updatedData };
    }

    if (type === 'UPDATE') {
      const idField = model.fields.find(f => f.isId)?.name || 'id';
      const recordIndex = (currentData[modelName] || []).findIndex((r: any) => r[idField] == data[idField]);
      
      if (recordIndex === -1) return { success: false, message: `Registro para atualizar não encontrado em ${modelName}.` };

      // Validate relations if they are being updated
      for (const field of model.fields) {
        if (field.relation && field.relation.fields && data[field.relation.fields[0]]) {
          const relField = field.relation.fields[0];
          const relValue = data[relField];
          const targetModel = field.type;
          const targetRecords = currentData[targetModel] || [];
          const refField = field.relation.references?.[0] || 'id';
          const exists = targetRecords.some((r: any) => r[refField] == relValue);
          if (!exists) {
            return { success: false, message: `Erro de integridade no Update: ${targetModel} com ${refField}=${relValue} não existe.` };
          }
        }
      }

      const updatedData = { ...currentData };
      const newRecords = [...(currentData[modelName] || [])];
      newRecords[recordIndex] = { ...newRecords[recordIndex], ...data };
      updatedData[modelName] = newRecords;
      return { success: true, message: `Atualização em ${modelName} realizada.`, updatedData };
    }

    return { success: true, message: 'Operação validada.' };
  };

  return (
    <div className="flex flex-col h-screen bg-[#09090b] text-zinc-100 overflow-hidden dark">
      <header className="h-14 border-b border-zinc-800 bg-[#09090b] flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Database size={18} />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight uppercase">Prisma Visualizer Pro</h1>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">Enterprise Edition</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowToolbar(!showToolbar)} className={`bg-zinc-900 border-zinc-800 hover:bg-zinc-800 ${!showToolbar ? 'text-indigo-400 border-indigo-500/30' : ''}`}>
            {showToolbar ? <ChevronRight size={14} /> : <ChevronDown size={14} className="-rotate-90" />}
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1 bg-zinc-800" />
          <Button variant="outline" size="sm" onClick={runAutomatedTest} className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-emerald-400">
            <CheckCircle2 size={14} className="mr-2" /> Testar Schema
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1 bg-zinc-800" />
          <div className="relative mr-4 hidden md:block">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Buscar..."
              className="pl-9 h-9 w-48 bg-zinc-900 border-zinc-800 text-xs focus-visible:ring-indigo-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="outline" size="sm" className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800">
                <Download size={14} className="mr-2" /> Exportar
              </Button>
            } />
            <DropdownMenuContent align="end" className="w-32 bg-zinc-900 border-zinc-800">
              <DropdownMenuItem onClick={() => handleExport('png')}>
                PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('svg')}>
                SVG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Separator orientation="vertical" className="h-6 mx-1 bg-zinc-800" />
          <Button variant="outline" size="sm" onClick={() => fitView()} className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800">
            <Layout size={14} className="mr-2" /> Fit
          </Button>
          <Button variant="outline" size="sm" onClick={() => updateDiagram(schemaText)} className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800">
            <RefreshCw size={14} className="mr-2" /> Layout
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <AnimatePresence mode="wait">
          {showToolbar && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 520, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="border-r border-zinc-800 bg-[#09090b] flex flex-col shrink-0 overflow-hidden"
            >
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-4 py-2 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/20">
              <TabsList className="bg-transparent border-none p-0 h-auto gap-2">
                <TabsTrigger value="editor" className="data-[state=active]:bg-zinc-800 h-8 px-3 text-xs">
                  <Code size={14} className="mr-2" /> Editor
                </TabsTrigger>
                <TabsTrigger value="playground" className="data-[state=active]:bg-zinc-800 h-8 px-3 text-xs">
                  <Play size={14} className="mr-2" /> Playground
                </TabsTrigger>
                <TabsTrigger value="data" className="data-[state=active]:bg-zinc-800 h-8 px-3 text-xs">
                  <Database size={14} className="mr-2" /> Dados
                </TabsTrigger>
                <TabsTrigger value="simulador" className="data-[state=active]:bg-zinc-800 h-8 px-3 text-xs">
                  <Activity size={14} className="mr-2" /> Simulador
                </TabsTrigger>
              </TabsList>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowEnumSidebar(!showEnumSidebar)}
                className={`h-7 text-[10px] ${showEnumSidebar ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-500'}`}
              >
                <ListIcon size={14} className="mr-2" /> Enums
              </Button>
            </div>

            <TabsContent value="editor" className="flex-1 m-0 p-0 overflow-hidden flex flex-col relative">
              <div className="p-3 border-b border-zinc-800 bg-zinc-900/40 flex flex-col gap-2">
                <div className="relative">
                  <Textarea 
                    placeholder="Descreva seu banco de dados (ex: 'Um sistema de blog com posts e tags')..." 
                    className="min-h-[100px] text-[11px] bg-black/50 border-zinc-800 pr-24 resize-y"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleGenerateSchemaWithAi();
                      }
                    }}
                  />
                  <div className="absolute right-2 bottom-2 flex flex-col gap-2">
                    <Button 
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${apiKey ? 'text-emerald-400' : 'text-zinc-500'} hover:text-indigo-400 bg-black/40 border border-zinc-800`}
                      onClick={() => setShowApiKeyDialog(true)}
                      title="Configurar API Key"
                    >
                      <Key size={14} />
                    </Button>
                    <Button 
                      size="sm" 
                      className="h-8 px-3 text-[10px] bg-indigo-600 hover:bg-indigo-500 shadow-lg"
                      onClick={handleGenerateSchemaWithAi}
                      disabled={isAiLoading || !aiPrompt.trim()}
                    >
                      {isAiLoading ? <RefreshCw size={12} className="animate-spin mr-1" /> : <Wand2 size={12} className="mr-1" />}
                      Gerar
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-[10px] border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-indigo-400"
                    onClick={handleExplainSchema}
                    disabled={isAiLoading}
                  >
                    <Info size={14} className="mr-1" /> Explicar Schema
                  </Button>
                  {chatHistory.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-[10px] text-zinc-500 hover:text-rose-400"
                      onClick={() => {
                        setChatHistory([]);
                        toast.info('Histórico de conversa limpo.');
                      }}
                    >
                      <Trash2 size={12} className="mr-1" /> Limpar Contexto ({chatHistory.length / 2})
                    </Button>
                  )}
                  {aiProvider === 'openrouter' && (
                    <Badge variant="outline" className="text-[9px] border-zinc-800 text-zinc-500">
                      OpenRouter: {openRouterModel.split('/').pop()}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex-1 relative overflow-hidden">
                <textarea
                  value={schemaText}
                  onChange={(e) => setSchemaText(e.target.value)}
                  className="w-full h-full p-6 font-mono text-[13px] bg-transparent resize-none focus:outline-none text-zinc-400 leading-relaxed"
                  placeholder="Prisma Schema..."
                  spellCheck={false}
                />

                <AnimatePresence>
                  {schemaExplanation && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="absolute inset-x-4 bottom-4 p-4 bg-zinc-900/95 border border-indigo-500/30 rounded-xl shadow-2xl backdrop-blur-md z-20 max-h-[60%] overflow-auto no-scrollbar"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-indigo-400">
                          <Info size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Explicação da IA</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSchemaExplanation(null)}>
                          <X size={14} />
                        </Button>
                      </div>
                      <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {schemaExplanation}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </TabsContent>

            <TabsContent value="playground" className="flex-1 m-0 p-0 overflow-hidden flex-col min-h-0 data-[state=active]:flex">
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/30 shrink-0">
                <Label className="text-[10px] uppercase font-bold text-zinc-500 mb-2 block tracking-widest">Modelos</Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto no-scrollbar">
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
              
              <ScrollArea className="flex-1 min-h-0 w-full">
                <div className="p-4 space-y-6 pb-40">
                  {selectedModelForPlayground ? (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold flex items-center gap-2">
                          <TableIcon size={16} className="text-indigo-400" />
                          {selectedModelForPlayground}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-[10px] bg-indigo-600/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/20" 
                            onClick={() => addRecord(selectedModelForPlayground)}
                          >
                            <Plus size={14} className="mr-1" /> Novo
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-[10px] bg-emerald-600/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20" 
                            onClick={() => handleGenerateRealisticData(selectedModelForPlayground)}
                            disabled={isAiLoading}
                          >
                            {isAiLoading ? <RefreshCw size={12} className="animate-spin mr-1" /> : <Wand2 size={12} className="mr-1" />}
                            IA Realista
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {(mockData[selectedModelForPlayground] || []).filter(r => r._isNew).map((record, idx) => (
                          <div key={idx} className="space-y-2">
                            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-4 relative shadow-xl max-h-[60vh] overflow-auto no-scrollbar">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono text-zinc-500 uppercase">Novo Registro</span>
                                <div className="flex items-center gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 text-zinc-500 hover:text-indigo-400"
                                    onClick={() => generateAllDataForRecord(selectedModelForPlayground, idx)}
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
                              
                              <div className="flex flex-col gap-4">
                                {parsedSchema?.models.find(m => m.name === selectedModelForPlayground)?.fields.map(field => {
                                  const isEnum = parsedSchema.enums.some(e => e.name === field.type);
                                  const isRelation = parsedSchema.models.some(m => m.name === field.type);
                                  if (field.isList) return null;

                                  return (
                                    <div key={field.name} className="space-y-1.5">
                                      <Label className="text-[10px] text-zinc-500 font-mono">{field.name}</Label>
                                      {isEnum ? (
                                        <Select value={record[field.name] ?? ""} onValueChange={(val) => updateRecordValue(selectedModelForPlayground, idx, field.name, val)}>
                                          <SelectTrigger className="h-8 text-[11px] bg-zinc-950 border-zinc-800"><SelectValue /></SelectTrigger>
                                          <SelectContent className="bg-zinc-900 border-zinc-800">
                                            {parsedSchema.enums.find(e => e.name === field.type)?.values.map(v => (
                                              <SelectItem key={v} value={v} className="text-[11px]">{v}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : isRelation ? (
                                        <Select value={record[field.name] ?? ""} onValueChange={(val) => updateRecordValue(selectedModelForPlayground, idx, field.name, val)}>
                                          <SelectTrigger className="h-8 text-[11px] bg-zinc-950 border-zinc-800"><SelectValue placeholder="Relacionar..." /></SelectTrigger>
                                          <SelectContent className="bg-zinc-900 border-zinc-800">
                                            {(mockData[field.type] || []).filter(r => !r._isNew).map((r, i) => (
                                              <SelectItem key={i} value={String(r.id || r.uuid || i)} className="text-[11px]">{String(r.id || r.uuid || `ID:${i}`)}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : field.type === 'Boolean' ? (
                                        <Select value={String(record[field.name] ?? false)} onValueChange={(val) => updateRecordValue(selectedModelForPlayground, idx, field.name, val === 'true')}>
                                          <SelectTrigger className="h-8 text-[11px] bg-zinc-950 border-zinc-800"><SelectValue /></SelectTrigger>
                                          <SelectContent className="bg-zinc-900 border-zinc-800">
                                            <SelectItem value="true" className="text-[11px]">true</SelectItem>
                                            <SelectItem value="false" className="text-[11px]">false</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <Input className="h-8 text-[11px] bg-zinc-950 border-zinc-800" value={record[field.name] || ''} onChange={(e) => updateRecordValue(selectedModelForPlayground, idx, field.name, e.target.value)} />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-4 flex justify-end">
                                <Button className="h-8 px-4 w-full sm:w-44 text-[11px] bg-indigo-600 hover:bg-indigo-700" onClick={() => saveRecord(selectedModelForPlayground, idx)}>
                                  <Save size={14} className="mr-2" /> Salvar Registro
                                </Button>
                              </div>
                            </div>
                            <div className="h-10" />
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="py-24 text-center">
                      <Play size={32} className="mx-auto text-zinc-800 mb-4" />
                      <p className="text-xs text-zinc-500">Selecione um modelo para adicionar registros.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="simulador" className="flex-1 m-0 p-0 overflow-hidden flex-col min-h-0 data-[state=active]:flex">
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Fluxo de Teste</h3>
                  <p className="text-[10px] text-zinc-600">Arraste para reordenar a execução</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 text-[10px] bg-zinc-800 border-zinc-700"
                    onClick={() => {
                      setSimulationSteps([]);
                      setSimulationResults([]);
                    }}
                  >
                    Limpar
                  </Button>
                  <Button 
                    size="sm" 
                    className="h-8 text-[10px] bg-indigo-600 hover:bg-indigo-700"
                    onClick={runAutomatedTest}
                    disabled={isSimulating || simulationSteps.length === 0}
                  >
                    {isSimulating ? <RefreshCw size={12} className="animate-spin mr-2" /> : <Play size={12} className="mr-2" />}
                    Executar
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext 
                      items={simulationSteps.map(s => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {simulationSteps.map((step, idx) => (
                        <SortableSimulationStep 
                          key={step.id} 
                          step={step} 
                          idx={idx as number} 
                          simulationResults={simulationResults as any[]}
                          onRemove={(id: string) => setSimulationSteps(prev => prev.filter(s => s.id !== id))}
                          isEditing={editingStepId === step.id}
                          onEdit={setEditingStepId}
                          onUpdateData={updateSimulationStepData}
                          parsedSchema={parsedSchema}
                          mockData={mockData}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>

                  <div className="pt-4 border-t border-zinc-800/50">
                    <Label className="text-[10px] uppercase font-bold text-zinc-500 mb-3 block">Adicionar Operação</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {parsedSchema?.models.map(model => (
                        <div key={model.name}>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={
                              <Button variant="outline" size="sm" className="h-8 text-[10px] w-full justify-between bg-zinc-900 border-zinc-800">
                                {model.name} <Plus size={12} />
                              </Button>
                            } />
                            <DropdownMenuContent align="start" className="w-40 bg-zinc-900 border-zinc-800">
                              <DropdownMenuItem 
                                className="text-xs text-emerald-400"
                                onClick={() => {
                                  const data: any = {};
                                  model.fields.forEach(f => {
                                    if (!f.isList && !f.relation) {
                                      data[f.name] = generateMockValue(f.type, f.name);
                                    } else if (f.relation && f.relation.fields && f.relation.fields.length > 0) {
                                      // Try to correlate with existing data
                                      const relField = f.relation.fields[0];
                                      const targetModel = f.type;
                                      const existingTargetRecords = mockData[targetModel] || [];
                                      if (existingTargetRecords.length > 0) {
                                        const refField = f.relation.references?.[0] || 'id';
                                        const randomRecord = existingTargetRecords[Math.floor(Math.random() * existingTargetRecords.length)];
                                        data[relField] = randomRecord[refField];
                                      } else {
                                        data[relField] = ''; // No data to correlate yet
                                      }
                                    }
                                  });
                                  setSimulationSteps(prev => [...prev, {
                                    id: Math.random().toString(36).substr(2, 9),
                                    type: 'INSERT',
                                    model: model.name,
                                    data
                                  }]);
                                }}
                              >
                                <Plus size={12} className="mr-2" /> Inserir
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-xs text-blue-400"
                                onClick={() => {
                                  const idField = model.fields.find(f => f.isId)?.name || 'id';
                                  const existingRecords = mockData[model.name] || [];
                                  const lastRecord = existingRecords[existingRecords.length - 1];
                                  const idValue = lastRecord ? lastRecord[idField] : '';
                                  
                                  setSimulationSteps(prev => [...prev, {
                                    id: Math.random().toString(36).substr(2, 9),
                                    type: 'UPDATE',
                                    model: model.name,
                                    data: { [idField]: idValue, title: 'Exemplo Update' }
                                  }]);
                                }}
                              >
                                <RefreshCw size={12} className="mr-2" /> Atualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-xs text-rose-400"
                                onClick={() => {
                                  const idField = model.fields.find(f => f.isId)?.name || 'id';
                                  const existingRecords = mockData[model.name] || [];
                                  const lastRecord = existingRecords[existingRecords.length - 1];
                                  const idValue = lastRecord ? lastRecord[idField] : '';

                                  setSimulationSteps(prev => [...prev, {
                                    id: Math.random().toString(36).substr(2, 9),
                                    type: 'DELETE',
                                    model: model.name,
                                    data: { [idField]: idValue }
                                  }]);
                                }}
                              >
                                <Trash2 size={12} className="mr-2" /> Deletar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  </div>

                  {simulationSteps.length === 0 && (
                    <div className="py-20 text-center">
                      <Activity size={32} className="mx-auto text-zinc-800 mb-4" />
                      <p className="text-xs text-zinc-500">Nenhuma operação no fluxo.</p>
                      <p className="text-[10px] text-zinc-600 mt-1">Adicione operações para testar a integridade.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="data" className="flex-1 m-0 p-0 overflow-hidden flex-col min-h-0 data-[state=active]:flex">
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Banco de Dados Mock</h3>
                <Button variant="outline" size="sm" onClick={clearAllData} className="h-7 text-[10px] text-rose-400 border-rose-500/20 hover:bg-rose-500/10">
                  <Trash2 size={12} className="mr-2" /> Limpar Tudo
                </Button>
              </div>
              <ScrollArea className="flex-1 p-4">
                <Accordion type="multiple" className="space-y-4">
                  {Object.entries(mockData).map(([modelName, recordsData]) => {
                    const records = recordsData as any[];
                    const savedRecords = records.filter(r => !r._isNew);
                    if (savedRecords.length === 0) return null;
                    return (
                      <AccordionItem key={modelName} value={modelName} className="border border-zinc-800 rounded-lg bg-zinc-900/20 px-4">
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center gap-2 text-xs font-bold">
                            <TableIcon size={14} className="text-indigo-400" />
                            {modelName}
                            <Badge variant="secondary" className="text-[9px]">{savedRecords.length}</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="rounded-md border border-zinc-800 overflow-hidden">
                            <Table>
                              <TableHeader className="bg-zinc-900/50">
                                <TableRow className="border-zinc-800 hover:bg-transparent">
                                  {parsedSchema?.models.find(m => m.name === modelName)?.fields.filter(f => !f.isList && !parsedSchema.models.some(m => m.name === f.type)).map(f => (
                                    <TableHead key={f.name} className="text-[10px] h-8 font-mono">{f.name}</TableHead>
                                  ))}
                                  <TableHead className="w-[40px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {savedRecords.map((record) => {
                                  const originalIndex = (records as any[]).indexOf(record);
                                  return (
                                    <TableRow key={originalIndex} className="border-zinc-800 hover:bg-zinc-800/30">
                                      {parsedSchema?.models.find(m => m.name === modelName)?.fields.filter(f => !f.isList && !parsedSchema.models.some(m => m.name === f.type)).map(f => (
                                        <TableCell key={f.name} className="text-[10px] py-2 font-mono truncate max-w-[100px]">{String(record[f.name])}</TableCell>
                                      ))}
                                      <TableCell className="py-2">
                                        <div className="flex items-center gap-1">
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6 text-zinc-500 hover:text-indigo-400"
                                            onClick={() => {
                                              setSelectedModelForPlayground(modelName);
                                              setActiveTab('playground');
                                              setEditingRecord({ model: modelName, index: originalIndex });
                                              setMockData(prev => {
                                                const newData = [...prev[modelName]];
                                                newData[originalIndex] = { ...newData[originalIndex], _isNew: true };
                                                return { ...prev, [modelName]: newData };
                                              });
                                            }}
                                          >
                                            <Code size={12} />
                                          </Button>
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6 text-zinc-500 hover:text-rose-400"
                                            onClick={() => deleteRecord(modelName, originalIndex)}
                                          >
                                            <Trash2 size={12} />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
                {Object.values(mockData).every(r => (r as any[]).filter(x => !x._isNew).length === 0) && (
                  <div className="py-24 text-center">
                    <Database size={32} className="mx-auto text-zinc-800 mb-4" />
                    <p className="text-xs text-zinc-500">Nenhum dado salvo ainda.</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 relative bg-[#09090b]" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={filteredNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeUpdate={onEdgeUpdate}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            connectionLineType={ConnectionLineType.SmoothStep}
            minZoom={0.1}
            maxZoom={2}
          >
            <Background color="#18181b" gap={20} size={1} />
            <Controls className="fill-zinc-100" />
            
            {selectedEdgeId && (
              <Panel position="top-right" className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-xl shadow-2xl backdrop-blur-md w-64 mr-4 mt-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Propriedades da Linha</h4>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedEdgeId(null)}>
                    <X size={14} />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] text-zinc-500 uppercase font-bold">Cor da Relação</Label>
                    <div className="flex gap-2">
                      {['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444'].map(color => (
                        <button
                          key={color}
                          className={`w-6 h-6 rounded-full border-2 ${edges.find(e => e.id === selectedEdgeId)?.style?.stroke === color ? 'border-white' : 'border-transparent'}`}
                          style={{ backgroundColor: color }}
                          onClick={() => updateEdgeStyle(selectedEdgeId, color, edges.find(e => e.id === selectedEdgeId)?.animated || false)}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-zinc-500 uppercase font-bold">Animar Fluxo</Label>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={`h-7 text-[10px] ${edges.find(e => e.id === selectedEdgeId)?.animated ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : ''}`}
                      onClick={() => updateEdgeStyle(selectedEdgeId, edges.find(e => e.id === selectedEdgeId)?.style?.stroke as string || '#6366f1', !edges.find(e => e.id === selectedEdgeId)?.animated)}
                    >
                      {edges.find(e => e.id === selectedEdgeId)?.animated ? 'Ativo' : 'Inativo'}
                    </Button>
                  </div>

                  <div className="pt-2 border-t border-zinc-800">
                    <p className="text-[10px] text-zinc-600 leading-tight">
                      Esta linha representa a relação entre <span className="text-indigo-400 font-mono">{selectedEdgeId.split('-')[0]}</span> e <span className="text-indigo-400 font-mono">{selectedEdgeId.split('-')[2]}</span>.
                    </p>
                  </div>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        <AnimatePresence>
          {showEnumSidebar && (
            <motion.div 
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              className="w-[300px] border-l border-zinc-800 bg-[#09090b] flex flex-col shrink-0 z-20 shadow-2xl"
            >
              <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/20">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Dicionário Enums</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowEnumSidebar(false)} className="h-8 w-8 text-zinc-500">
                  <X size={16} />
                </Button>
              </div>
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-8">
                  {parsedSchema?.enums.map(e => (
                    <div key={e.name} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400">Enum</Badge>
                        <h4 className="text-sm font-bold font-mono">{e.name}</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {e.values.map(v => (
                          <Badge key={v} variant="secondary" className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px] py-0.5">
                            {v}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                  {parsedSchema?.enums.length === 0 && (
                    <div className="py-20 text-center">
                      <ListIcon size={32} className="mx-auto text-zinc-800 mb-4" />
                      <p className="text-xs text-zinc-500">Nenhum enum definido.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      <AnimatePresence>
        {isAiLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center"
          >
            <div className="bg-zinc-900 border border-indigo-500/30 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                <Wand2 className="absolute inset-0 m-auto text-indigo-400 animate-pulse" size={24} />
              </div>
              <div className="text-center">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">IA em Ação</h3>
                <p className="text-[10px] text-zinc-500 mt-1">Processando sua solicitação com Gemini...</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toaster theme="dark" position="bottom-right" />

      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="size-4 text-indigo-400" />
              Configurar IA
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Escolha o provedor e insira sua chave de API.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-zinc-300">Provedor</Label>
              <Select value={aiProvider} onValueChange={(val: AIProvider) => setAiProvider(val)}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="gemini">Google Gemini (Nativo)</SelectItem>
                  <SelectItem value="openrouter">OpenRouter (Multi-model)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {aiProvider === 'openrouter' && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-zinc-300">Modelo OpenRouter</Label>
                <Input 
                  value={openRouterModel}
                  onChange={(e) => setOpenRouterModel(e.target.value)}
                  placeholder="ex: google/gemini-2.0-pro-exp-02-05:free"
                  className="bg-zinc-900 border-zinc-800 text-xs"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="api-key" className="text-xs font-medium text-zinc-300">
                API Key
              </Label>
              <Textarea
                id="api-key"
                placeholder={`Insira sua chave do ${aiProvider === 'gemini' ? 'Gemini' : 'OpenRouter'} aqui...`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-zinc-900 border-zinc-800 focus:ring-indigo-500 min-h-[80px] text-xs font-mono"
              />
            </div>
            
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3">
              <AlertCircle className="size-5 text-amber-400 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-amber-200">Aviso Importante</p>
                <p className="text-[11px] text-amber-200/70 leading-relaxed">
                  Não guardamos sua API Key em nossos servidores. 
                  Em caso de atualizar a página, o dado será perdido e você precisará inseri-la novamente.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              className="w-full bg-indigo-600 hover:bg-indigo-500" 
              onClick={() => {
                setAIConfig({ key: apiKey, provider: aiProvider, model: openRouterModel });
                setShowApiKeyDialog(false);
                if (apiKey) {
                  toast.success(`Configurações do ${aiProvider} salvas!`);
                }
              }}
            >
              Salvar Configurações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
