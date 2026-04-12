import * as React from 'react';
import { BaseEdge, EdgeProps, getSmoothStepPath, EdgeLabelRenderer, useReactFlow } from 'reactflow';
import { RotateCcw, Plus } from 'lucide-react';

export const RelationEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  data,
}: EdgeProps) => {
  const { setEdges, screenToFlowPosition } = useReactFlow();
  const waypoints = data?.waypoints || [];
  const [isHovered, setIsHovered] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    if (!selected) return;
    
    const point = screenToFlowPosition({ x: evt.clientX, y: evt.clientY });
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id === id) {
          const currentWaypoints = e.data?.waypoints || [];
          return { ...e, data: { ...e.data, waypoints: [...currentWaypoints, point] } };
        }
        return e;
      })
    );
  };

  const onHandleDrag = (evt: React.MouseEvent, index: number) => {
    evt.stopPropagation();
    evt.preventDefault();
    setIsDragging(true);
    
    const handleMouseMove = (moveEvt: MouseEvent) => {
      const point = screenToFlowPosition({ x: moveEvt.clientX, y: moveEvt.clientY });
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id === id) {
            const newWaypoints = [...(e.data?.waypoints || [])];
            newWaypoints[index] = point;
            return { ...e, data: { ...e.data, waypoints: newWaypoints } };
          }
          return e;
        })
      );
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const startDragPotential = (evt: React.MouseEvent, point: {x: number, y: number}, insertIndex: number, isHorizontal: boolean) => {
    evt.stopPropagation();
    evt.preventDefault();
    setIsDragging(true);

    // When dragging a potential point, we insert it as a new waypoint
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id === id) {
          const newWaypoints = [...(e.data?.waypoints || [])];
          newWaypoints.splice(insertIndex, 0, point);
          return { ...e, data: { ...e.data, waypoints: newWaypoints } };
        }
        return e;
      })
    );

    const handleMouseMove = (moveEvt: MouseEvent) => {
      const currentPoint = screenToFlowPosition({ x: moveEvt.clientX, y: moveEvt.clientY });
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id === id) {
            const newWaypoints = [...(e.data?.waypoints || [])];
            // Orthogonal constraint: if segment was horizontal, move vertically, and vice-versa
            if (isHorizontal) {
              newWaypoints[insertIndex] = { x: point.x, y: currentPoint.y };
            } else {
              newWaypoints[insertIndex] = { x: currentPoint.x, y: point.y };
            }
            return { ...e, data: { ...e.data, waypoints: newWaypoints } };
          }
          return e;
        })
      );
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const onHandleRemove = (evt: React.MouseEvent, index: number) => {
    evt.stopPropagation();
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id === id) {
          const newWaypoints = [...(e.data?.waypoints || [])];
          newWaypoints.splice(index, 1);
          return { ...e, data: { ...e.data, waypoints: newWaypoints } };
        }
        return e;
      })
    );
  };

  const clearWaypoints = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id === id) {
          return { ...e, data: { ...e.data, waypoints: [] } };
        }
        return e;
      })
    );
  };

  // Construct path through waypoints using strictly orthogonal segments
  let edgePath = '';
  const allPoints = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
  
  // Helper to generate a stepped path between two points
  const getSteppedPath = (p1: {x: number, y: number}, p2: {x: number, y: number}) => {
    const midX = p1.x + (p2.x - p1.x) / 2;
    return [
      { x: p1.x, y: p1.y },
      { x: midX, y: p1.y },
      { x: midX, y: p2.y },
      { x: p2.x, y: p2.y }
    ];
  };

  if (waypoints.length === 0) {
    [edgePath] = getSmoothStepPath({
      sourceX, sourceY, sourcePosition,
      targetX, targetY, targetPosition,
      borderRadius: 16,
    });
  } else {
    edgePath = `M ${sourceX} ${sourceY}`;
    for (let i = 0; i < allPoints.length - 1; i++) {
      const segments = getSteppedPath(allPoints[i], allPoints[i+1]);
      for (let j = 1; j < segments.length; j++) {
        edgePath += ` L ${segments[j].x} ${segments[j].y}`;
      }
    }
  }

  const isSelected = selected || isHovered;

  // Calculate potential points (midpoints of the ACTUAL segments)
  const potentialPoints = [];
  if (selected) {
    for (let i = 0; i < allPoints.length - 1; i++) {
      const p1 = allPoints[i];
      const p2 = allPoints[i+1];
      const segments = getSteppedPath(p1, p2);
      
      for (let j = 0; j < segments.length - 1; j++) {
        const s1 = segments[j];
        const s2 = segments[j+1];
        // Skip zero-length segments
        if (s1.x === s2.x && s1.y === s2.y) continue;
        
        const isHorizontal = s1.y === s2.y;
        potentialPoints.push({
          x: (s1.x + s2.x) / 2,
          y: (s1.y + s2.y) / 2,
          insertIndex: i, 
          isHorizontal,
          segmentIndex: j 
        });
      }
    }
  }

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onEdgeClick}
      />

      {isSelected && (
        <path
          d={edgePath}
          fill="none"
          stroke="#22d3ee"
          strokeWidth={isSelected ? 6 : 4}
          strokeOpacity={isSelected ? 0.3 : 0.1}
          className={selected && !isDragging ? "animate-pulse" : ""}
        />
      )}
      
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? '#22d3ee' : (isHovered ? '#06b6d4' : (style.stroke || '#0891b2')),
          strokeWidth: selected ? 3 : 2,
          // Remove transition during dragging to eliminate delay
          transition: isDragging ? 'none' : 'all 0.2s ease-in-out',
        }}
      />

      <path
        d={edgePath}
        fill="none"
        stroke="white"
        strokeWidth={isSelected ? 3 : 2}
        strokeDasharray="1 20"
        strokeLinecap="round"
        className={`opacity-60 ${!isDragging ? 'animate-edge-flow' : ''} ${selected ? 'opacity-100' : ''}`}
        style={{ pointerEvents: 'none' }}
      />

      <EdgeLabelRenderer>
        {selected && (
          <>
            {waypoints.map((p: any, i: number) => (
              <div
                key={`wp-${i}`}
                style={{
                  position: 'absolute',
                  transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`,
                  pointerEvents: 'all',
                }}
                className="nodrag nopan"
              >
                <div
                  onMouseDown={(evt) => onHandleDrag(evt, i)}
                  onDoubleClick={(evt) => onHandleRemove(evt, i)}
                  className="w-4 h-4 bg-white border-2 border-cyan-500 rounded-full cursor-move shadow-[0_0_10px_rgba(34,211,238,0.5)] hover:scale-125 transition-transform flex items-center justify-center group"
                >
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full group-hover:scale-150 transition-transform" />
                </div>
              </div>
            ))}

            {potentialPoints.map((p: any, i: number) => (
              <div
                key={`mid-${i}`}
                style={{
                  position: 'absolute',
                  transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`,
                  pointerEvents: 'all',
                }}
                className="nodrag nopan"
              >
                <div
                  onMouseDown={(evt) => startDragPotential(evt, { x: p.x, y: p.y }, p.insertIndex, p.isHorizontal)}
                  className="w-3 h-3 bg-white/40 border border-cyan-400/50 rounded-full cursor-move shadow-sm hover:bg-white hover:scale-125 transition-all flex items-center justify-center group"
                >
                  <Plus size={8} className="text-cyan-600 opacity-0 group-hover:opacity-100" />
                </div>
              </div>
            ))}

            {waypoints.length > 0 && !isDragging && (
              <div
                style={{
                  position: 'absolute',
                  transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px, ${(sourceY + targetY) / 2 - 20}px)`,
                  pointerEvents: 'all',
                }}
                className="nodrag nopan"
              >
                <button
                  onClick={clearWaypoints}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-rose-400 p-1.5 rounded-md shadow-lg flex items-center gap-1 text-[10px] transition-colors"
                >
                  <RotateCcw size={10} />
                  Resetar
                </button>
              </div>
            )}
          </>
        )}
      </EdgeLabelRenderer>
    </>
  );
};
