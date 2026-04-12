import * as React from 'react';
import { BaseEdge, EdgeProps, getSmoothStepPath, EdgeLabelRenderer, useReactFlow } from 'reactflow';

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

  const onEdgeClick = (evt: React.MouseEvent) => {
    if (!selected) return;
    evt.stopPropagation();
    
    // Get click position in flow coordinates
    const point = screenToFlowPosition({ x: evt.clientX, y: evt.clientY });
    
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id === id) {
          const currentWaypoints = e.data?.waypoints || [];
          return { 
            ...e, 
            data: { 
              ...e.data, 
              waypoints: [...currentWaypoints, point] 
            } 
          };
        }
        return e;
      })
    );
  };

  const onHandleDrag = (evt: React.MouseEvent, index: number) => {
    evt.stopPropagation();
    
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

  // Construct path through waypoints
  let edgePath = '';
  const allPoints = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
  
  if (waypoints.length === 0) {
    [edgePath] = getSmoothStepPath({
      sourceX, sourceY, sourcePosition,
      targetX, targetY, targetPosition,
      borderRadius: 16,
    });
  } else {
    edgePath = `M ${allPoints[0].x} ${allPoints[0].y}`;
    for (let i = 0; i < allPoints.length - 1; i++) {
      const p1 = allPoints[i];
      const p2 = allPoints[i+1];
      // Stepped segment logic
      const midX = p1.x + (p2.x - p1.x) / 2;
      edgePath += ` L ${midX} ${p1.y} L ${midX} ${p2.y} L ${p2.x} ${p2.y}`;
    }
  }

  const isSelected = selected;

  return (
    <>
      {/* Invisible wider path for easier clicking to add points */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
        onClick={onEdgeClick}
      />

      {/* Glow effect for selection */}
      {isSelected && (
        <path
          d={edgePath}
          fill="none"
          stroke="#6366f1"
          strokeWidth={6}
          strokeOpacity={0.2}
          className="animate-pulse"
        />
      )}
      
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: isSelected ? '#818cf8' : (style.stroke || '#6366f1'),
          strokeWidth: isSelected ? 2.5 : 1.5,
          transition: 'stroke 0.2s ease-in-out',
        }}
      />

      {/* Dots along the path */}
      <path
        d={edgePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={isSelected ? 3 : 2}
        strokeDasharray="1 15"
        strokeLinecap="round"
        className={`text-indigo-400/50 animate-edge-flow ${isSelected ? 'text-indigo-300' : ''}`}
        style={{
          pointerEvents: 'none',
        }}
      />

      {isSelected && (
        <EdgeLabelRenderer>
          {waypoints.map((p: any, i: number) => (
            <div
              key={i}
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
                className="w-4 h-4 bg-indigo-500 border-2 border-white rounded-full cursor-move shadow-xl hover:scale-125 transition-transform flex items-center justify-center"
                title="Arraste para ajustar, clique duplo para remover"
              >
                <div className="w-1 h-1 bg-white rounded-full" />
              </div>
            </div>
          ))}
        </EdgeLabelRenderer>
      )}
    </>
  );
};
