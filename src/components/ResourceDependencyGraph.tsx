import React, { useRef, useEffect, useState } from 'react';
import { AWSResource, ResourceRelationship, RelationshipType } from '../types/aws';
// Import resourceTypeIcons if needed for icons
// import { resourceTypeIcons } from '../App';
import { Network } from 'lucide-react';
import * as d3 from 'd3';

// Note: This component requires d3 to be installed
// Please run: npm install d3 @types/d3 --save

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: string;
  application: string;
  status: string;
  isExternal: boolean;
  resource: AWSResource;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface D3Link {
  source: D3Node;
  target: D3Node;
  type: RelationshipType;
  relationship: ResourceRelationship;
  index?: number;
}

type D3LinkDatum = {
  source: D3Node;
  target: D3Node;
  type: RelationshipType;
  relationship: ResourceRelationship;
  index: undefined;
};

interface ResourceDependencyGraphProps {
  resources: AWSResource[];
  relationships: ResourceRelationship[];
  externalResources?: AWSResource[];
  showExternalResources?: boolean;
}

export const ResourceDependencyGraph: React.FC<ResourceDependencyGraphProps> = ({
  resources,
  relationships,
  externalResources = [],
  showExternalResources = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const container = containerRef.current;
      const width = container.clientWidth;
      const height = 400;

      // Clear previous SVG
      container.innerHTML = '';

      // Create SVG
      const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height])
        .attr('style', 'max-width: 100%; height: auto;');

      // Log input data for debugging
      console.log('ResourceDependencyGraph - Input Resources:', resources);
      console.log('ResourceDependencyGraph - Input Relationships:', relationships);
      console.log('ResourceDependencyGraph - Input External Resources:', externalResources);

      // Filter relationships to only include those with resources in the current view
      const resourceIds = new Set(resources.map(r => r.id));
      console.log('Resource IDs in current view:', Array.from(resourceIds));
      
      // Get all resources that should be shown in the graph
      const graphResources = [...resources];
      
      // Make sure relationships is an array before filtering
      const relationshipsArray = Array.isArray(relationships) ? relationships : [];
      
      const relevantRelationships = relationshipsArray.filter(rel => {
        const sourceInApp = resourceIds.has(rel.sourceId);
        const targetInApp = resourceIds.has(rel.targetId);
        
        console.log(`Relationship ${rel.sourceId} -> ${rel.targetId} (${rel.type}): sourceInApp=${sourceInApp}, targetInApp=${targetInApp}`);
        
        // If showing external resources, add them to graphResources
        if (showExternalResources) {
          if (!sourceInApp && targetInApp) {
            const externalResource = externalResources.find(r => r.id === rel.sourceId);
            if (externalResource && !graphResources.some(r => r.id === externalResource.id)) {
              console.log(`Adding external source resource: ${externalResource.name} (${externalResource.id})`);
              graphResources.push(externalResource);
            }
            return true;
          }
          
          if (sourceInApp && !targetInApp) {
            const externalResource = externalResources.find(r => r.id === rel.targetId);
            if (externalResource && !graphResources.some(r => r.id === externalResource.id)) {
              console.log(`Adding external target resource: ${externalResource.name} (${externalResource.id})`);
              graphResources.push(externalResource);
            }
            return true;
          }
        }
        
        return sourceInApp && targetInApp;
      });

      console.log('Filtered Relationships:', relevantRelationships);
      console.log('Graph Resources:', graphResources);

      if (graphResources.length === 0) {
        setMessage('No resources to display');
        return;
      }

      if (relevantRelationships.length === 0) {
        setMessage('No relationships found between resources');
        return;
      }

      setMessage(null);

      // Create nodes and links for the force simulation
      const nodes: D3Node[] = graphResources.map(resource => ({
        id: resource.id,
        name: resource.name,
        type: resource.type,
        application: resource.application,
        status: resource.status,
        isExternal: !resources.some(r => r.id === resource.id),
        resource,
        index: undefined,
        x: undefined,
        y: undefined,
        vx: undefined,
        vy: undefined,
        fx: null,
        fy: null
      }));

      const links: D3Link[] = relevantRelationships
        .map(rel => {
          const source = nodes.find(n => n.id === rel.sourceId);
          const target = nodes.find(n => n.id === rel.targetId);
          
          if (source && target) {
            return {
              source,
              target,
              type: rel.type,
              relationship: rel,
              index: undefined
            };
          }
          return null;
        })
        .filter((link): link is D3LinkDatum => link !== null)
        .map(link => ({...link})) as D3Link[];

      // Create a force simulation
      const simulation = d3.forceSimulation<D3Node>(nodes)
        .force('link', d3.forceLink<D3Node, D3Link>(links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody<D3Node>().strength(-300))
        .force('center', d3.forceCenter<D3Node>(width / 2, height / 2))
        .force('collision', d3.forceCollide<D3Node>().radius(30));

      // Create arrow markers for relationships
      const defs = svg.append('defs');
      
      const relationshipTypes: RelationshipType[] = ['routes_to', 'depends_on', 'triggers', 'connects_to', 'part_of', 'instance_of'];
      
      relationshipTypes.forEach(type => {
        defs.append('marker')
          .attr('id', `arrow-${type}`)
          .attr('viewBox', '0 -5 10 10')
          .attr('refX', 20)
          .attr('refY', 0)
          .attr('markerWidth', 6)
          .attr('markerHeight', 6)
          .attr('orient', 'auto')
          .append('path')
          .attr('fill', getRelationshipColor(type))
          .attr('d', 'M0,-5L10,0L0,5');
      });

      // Create links
      const link = svg.append('g')
        .selectAll<SVGLineElement, D3Link>('line')
        .data(links)
        .join('line')
        .attr('stroke', d => getRelationshipColor(d.type))
        .attr('stroke-width', 2)
        .attr('marker-end', d => `url(#arrow-${d.type})`);

      // Create nodes
      const node = svg.append('g')
        .selectAll<SVGGElement, D3Node>('.node')
        .data(nodes)
        .join('g')
        .attr('class', 'node')
        .call(d3.drag<SVGGElement, D3Node>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended))
        .on('mouseover', function(_event: MouseEvent, d: D3Node) {
          // Highlight connected nodes and links
          const connectedNodeIds = new Set<string>();
          links.forEach(link => {
            if (link.source.id === d.id) connectedNodeIds.add(link.target.id);
            if (link.target.id === d.id) connectedNodeIds.add(link.source.id);
          });
          
          // Update stroke widths based on connection
          node.selectAll<SVGCircleElement, D3Node>('circle')
            .attr('stroke-width', (nodeData: D3Node) => 
              nodeData.id === d.id || connectedNodeIds.has(nodeData.id) ? 3 : 1.5
            );
          
          link
            .attr('stroke-width', (linkData: D3Link) => 
              linkData.source.id === d.id || linkData.target.id === d.id ? 4 : 2
            );
        })
        .on('mouseout', function() {
          // Reset highlights
          node.selectAll<SVGCircleElement, D3Node>('circle')
            .attr('stroke-width', () => 1.5);
          link
            .attr('stroke-width', () => 2);
        });

      // Add circles for nodes
      node.append('circle')
        .attr('r', 20)
        .attr('fill', d => d.isExternal ? '#f3f4f6' : getResourceStatusColor(d.status))
        .attr('stroke', d => d.isExternal ? '#9ca3af' : '#ffffff')
        .attr('stroke-width', 1.5);

      // Add icons for nodes (using text as placeholder)
      node.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('fill', d => d.isExternal ? '#4b5563' : '#ffffff')
        .attr('font-family', 'sans-serif')
        .attr('font-size', '10px')
        .text(d => getResourceTypeIcon(d.type));

      // Add labels for nodes
      node.append('text')
        .attr('dy', 30)
        .attr('text-anchor', 'middle')
        .attr('fill', '#374151')
        .attr('font-family', 'sans-serif')
        .attr('font-size', '10px')
        .text(d => truncateText(d.name, 15));

      // Add application labels for external resources
      // Make sure we're filtering a D3 selection, not a regular array
      node.filter((d: D3Node) => d.isExternal)
        .append('text')
        .attr('dy', 42)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6b7280')
        .attr('font-family', 'sans-serif')
        .attr('font-size', '8px')
        .attr('font-style', 'italic')
        .text(d => truncateText(d.application, 15));

      // Add tooltips
      node.append('title')
        .text(d => `${d.name} (${d.type})\nApplication: ${d.application}\nStatus: ${d.status}`);

      link.append('title')
        .text(d => {
          const rel = d.relationship;
          let tooltip = `${rel.type.replace(/_/g, ' ')}`;
          
          if (rel.metadata?.securityGroups) {
            const sg = rel.metadata.securityGroups;
            const rules = sg.rules[0]; // Get first rule for simplicity
            tooltip += `\nSecurity Groups:`;
            tooltip += `\n  Source: ${sg.source.join(', ')}`;
            tooltip += `\n  Target: ${sg.target.join(', ')}`;
            if (rules) {
              tooltip += `\n  ${rules.direction === 'inbound' ? 'Inbound' : 'Outbound'} Rule:`;
              tooltip += `\n    Protocol: ${rules.protocol}`;
              if (rules.fromPort === rules.toPort) {
                tooltip += `\n    Port: ${rules.fromPort}`;
              } else {
                tooltip += `\n    Ports: ${rules.fromPort}-${rules.toPort}`;
              }
            }
          }
          
          return tooltip;
        });

      // Update positions on simulation tick
      simulation.on('tick', () => {
        link
          .attr('x1', d => (d.source as D3Node).x || 0)
          .attr('y1', d => (d.source as D3Node).y || 0)
          .attr('x2', d => (d.target as D3Node).x || 0)
          .attr('y2', d => (d.target as D3Node).y || 0);

        node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
      });

      // Drag functions
      function dragstarted(event: d3.D3DragEvent<SVGGElement, D3Node, unknown>, d: D3Node) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }

      function dragged(event: d3.D3DragEvent<SVGGElement, D3Node, unknown>, d: D3Node) {
        d.fx = event.x;
        d.fy = event.y;
      }

      function dragended(event: d3.D3DragEvent<SVGGElement, D3Node, unknown>, d: D3Node) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }

      // Add legend
      const legend = svg.append('g')
        .attr('transform', `translate(20, ${height - 100})`);

      // Relationship types legend
      const legendRelationshipTypes = [
        { type: 'routes_to', label: 'Routes To' },
        { type: 'depends_on', label: 'Depends On' },
        { type: 'triggers', label: 'Triggers' },
        { type: 'connects_to', label: 'Connects To' },
        { type: 'instance_of', label: 'Instance Of' }
      ];

      legendRelationshipTypes.forEach((rel, i) => {
        const g = legend.append('g')
          .attr('transform', `translate(0, ${i * 20})`);
          
        g.append('line')
          .attr('x1', 0)
          .attr('y1', 0)
          .attr('x2', 30)
          .attr('y2', 0)
          .attr('stroke', getRelationshipColor(rel.type as RelationshipType))
          .attr('stroke-width', 2)
          .attr('marker-end', `url(#arrow-${rel.type})`);
          
        g.append('text')
          .attr('x', 40)
          .attr('y', 4)
          .attr('font-size', '10px')
          .attr('fill', '#4b5563')
          .text(rel.label);
      });

      // Helper functions
      function getResourceStatusColor(status: string) {
        const colors: Record<string, string> = {
          running: '#22c55e',
          stopped: '#ef4444',
          pending: '#eab308',
          terminated: '#6b7280'
        };
        return colors[status] || '#6b7280';
      }

      function getRelationshipColor(type: RelationshipType) {
        const colors: Record<RelationshipType, string> = {
          routes_to: '#3b82f6',    // Blue
          depends_on: '#8b5cf6',   // Purple
          triggers: '#ec4899',     // Pink
          connects_to: '#14b8a6',  // Teal
          part_of: '#f97316',      // Orange
          instance_of: '#84cc16'   // Lime
        };
        return colors[type] || '#6b7280';
      }

      function getResourceTypeIcon(type: string) {
        // Return a simple letter representation for the icon
        const icons: Record<string, string> = {
          ecs: 'E',
          aurora: 'D',
          'aurora-instance': 'd',
          lambda: 'λ',
          ec2: 'S',
          stepfunctions: 'F',
          apigateway: 'A',
          eventbridge: 'V',
          alb: 'L',
          nlb: 'N'
        };
        return icons[type] || '?';
      }

      function truncateText(text: string, maxLength: number) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
      }

      // Cleanup
      return () => {
        simulation.stop();
      };
    } catch (error) {
      console.error('Error rendering dependency graph:', error);
      setMessage(`Error rendering graph: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [resources, relationships, externalResources, showExternalResources]);

  return (
    <div className="flex flex-col h-full">
      {message ? (
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200 p-4 text-gray-500">
          <div className="text-center">
            <Network className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p>{message}</p>
          </div>
        </div>
      ) : (
        <div 
          ref={containerRef} 
          className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden min-h-[400px]"
        />
      )}
    </div>
  );
};
