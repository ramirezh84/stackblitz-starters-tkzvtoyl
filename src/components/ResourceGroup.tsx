import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, AlertTriangle, XCircle, Globe, Server, Network } from 'lucide-react';
import { ResourceCard } from './ResourceCard';
import { ResourceDependencyGraph } from './ResourceDependencyGraph';
import { ResourceGroup as ResourceGroupType, HealthStatus, RegionGroup, ResourceRelationship, AWSResource } from '../types/aws';

interface ResourceGroupProps {
  group: ResourceGroupType;
  allResources: AWSResource[]; // All resources for finding external dependencies
}

interface RegionSectionProps {
  region: RegionGroup;
  isExpanded: boolean;
  onToggle: () => void;
}

const healthStatusConfig: Record<HealthStatus, {
  icon: React.ElementType;
  label: string;
  className: string;
  bgClass: string;
}> = {
  healthy: {
    icon: CheckCircle,
    label: 'Healthy',
    className: 'text-green-500',
    bgClass: 'bg-green-50 border-green-200',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Warning',
    className: 'text-yellow-500',
    bgClass: 'bg-yellow-50 border-yellow-200',
  },
  error: {
    icon: XCircle,
    label: 'Error',
    className: 'text-red-500',
    bgClass: 'bg-red-50 border-red-200',
  },
};

const RegionSection: React.FC<RegionSectionProps> = ({ region, isExpanded, onToggle }) => {
  const calculateHealthStatus = (resources: RegionGroup['resources']): HealthStatus => {
    const totalResources = resources.length;
    const runningResources = resources.filter(r => r.status === 'running').length;
    const stoppedResources = resources.filter(r => r.status === 'stopped').length;
    
    if (runningResources === totalResources) {
      return 'healthy';
    } else if (stoppedResources === totalResources) {
      return 'error';
    }
    return 'warning';
  };

  const healthStatus = calculateHealthStatus(region.resources);
  const { icon: HealthIcon, label: healthLabel, className: healthClassName, bgClass: healthBgClass } = healthStatusConfig[healthStatus];

  const resourceCounts = region.resources.reduce((acc, resource) => {
    acc[resource.type] = (acc[resource.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={`flex-1 border rounded-lg ${healthBgClass} transition-all duration-200 hover:shadow-md`}>
      <button
        className="w-full px-4 py-3 flex items-center justify-between"
        onClick={onToggle}
      >
        <div className="flex items-center space-x-3">
          <Globe className={`w-5 h-5 ${healthClassName}`} />
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-medium text-gray-900">
                {region.region}
              </h3>
              <span className={`text-sm px-2 py-0.5 rounded-full border ${healthBgClass}`}>
                {healthLabel}
              </span>
            </div>
            <div className="flex items-center space-x-2 mt-1">
              {Object.entries(resourceCounts).map(([type, count]) => (
                <span key={type} className="text-xs text-gray-600 bg-white bg-opacity-50 px-2 py-1 rounded-full">
                  {type}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 bg-white rounded-b-lg">
          <div className="mb-4">
            <div className="flex items-center space-x-2 flex-wrap gap-y-2">
              {Object.entries(
                region.resources.reduce((acc, resource) => {
                  acc[resource.status] = (acc[resource.status] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([status, count]) => (
                <span
                  key={status}
                  className={`text-sm px-2 py-1 rounded-full border ${
                    status === 'running'
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : status === 'stopped'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                  }`}
                >
                  {status}: {count}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {region.resources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const ResourceGroup: React.FC<ResourceGroupProps> = ({ group, allResources }) => {
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [showDependencyView, setShowDependencyView] = useState(false);
  const [relationships, setRelationships] = useState<ResourceRelationship[]>([]);
  const [loadingRelationships, setLoadingRelationships] = useState(false);
  const [showExternalResources, setShowExternalResources] = useState(true);
  
  // Get all resources in this application group
  const appResources = React.useMemo(() => {
    return group.regions.flatMap(region => region.resources);
  }, [group]);
  
  // Fetch relationships when dependency view is shown
  useEffect(() => {
    if (showDependencyView && relationships.length === 0) {
      fetchRelationships();
    }
  }, [showDependencyView, appResources]);
  
  const fetchRelationships = async () => {
    try {
      setLoadingRelationships(true);
      
      // Fetch relationships for this specific application
      const response = await fetch(`/api/resource-relationships?application=${encodeURIComponent(group.application)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch resource relationships');
      }
      
      try {
        const data = await response.json();
        console.log('API Response:', data);
        
        // Log the relationships data in more detail
        if (data && Array.isArray(data.relationships)) {
          console.log('Relationships from API:', JSON.stringify(data.relationships, null, 2));
          setRelationships(data.relationships);
        } else if (Array.isArray(data)) {
          // If data is already an array, use it directly
          console.log('Relationships from API (array):', JSON.stringify(data, null, 2));
          setRelationships(data);
        } else {
          // Default to empty array if data is not in expected format
          console.error('Unexpected data format:', data);
          setRelationships([]);
        }
        
        setLoadingRelationships(false);
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        // Try to handle malformed JSON by manually fixing common issues
        try {
          const text = await response.text();
          console.log('Raw response:', text);
          // Try to fix missing commas between properties
          const fixedText = text.replace(/"\s*"/g, '","').replace(/\]\s*"/g, '],"').replace(/\}\s*"/g, '},"');
          const fixedData = JSON.parse(fixedText);
          
          if (fixedData && Array.isArray(fixedData.relationships)) {
            setRelationships(fixedData.relationships);
          } else {
            setRelationships([]);
          }
        } catch (fallbackError) {
          console.error('Failed to parse response even after fixing:', fallbackError);
          setRelationships([]);
        }
        setLoadingRelationships(false);
      }
    } catch (error) {
      console.error('Error fetching relationships:', error);
      setLoadingRelationships(false);
    }
  };

  const toggleRegion = (region: string) => {
    setExpandedRegions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(region)) {
        newSet.delete(region);
      } else {
        newSet.add(region);
      }
      return newSet;
    });
  };

  const calculateOverallHealth = (regions: RegionGroup[]): HealthStatus => {
    const hasError = regions.some(region => 
      region.resources.some(resource => resource.status === 'stopped')
    );
    const hasWarning = regions.some(region =>
      region.resources.some(resource => resource.status === 'pending')
    );
    if (hasError) return 'error';
    if (hasWarning) return 'warning';
    return 'healthy';
  };

  const healthStatus = calculateOverallHealth(group.regions);
  const { icon: HealthIcon, label: healthLabel, className: healthClassName, bgClass: healthBgClass } = healthStatusConfig[healthStatus];

  const totalResources = group.regions.reduce((sum, region) => sum + region.resources.length, 0);
  
  // Get external resources that have relationships with this application's resources
  const externalResources = React.useMemo(() => {
    if (!relationships.length) return [];
    
    const appResourceIds = new Set(appResources.map(r => r.id));
    const externalResourceIds = new Set<string>();
    
    // Find external resource IDs from relationships
    relationships.forEach(rel => {
      if (!appResourceIds.has(rel.sourceId) && !externalResourceIds.has(rel.sourceId)) {
        externalResourceIds.add(rel.sourceId);
      }
      if (!appResourceIds.has(rel.targetId) && !externalResourceIds.has(rel.targetId)) {
        externalResourceIds.add(rel.targetId);
      }
    });
    
    // Get the actual resources
    return allResources.filter(r => externalResourceIds.has(r.id));
  }, [relationships, appResources, allResources]);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border hover:shadow-md transition-shadow duration-200">
      <div className="px-6 py-4">
        <div className="flex items-center space-x-4">
          <div className={`p-2.5 rounded-xl ${healthBgClass}`}>
            <Server className={`w-6 h-6 ${healthClassName}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-semibold text-gray-900">
                {group.application}
              </h2>
              <span className={`px-2.5 py-1 rounded-full text-sm font-medium border ${healthBgClass} ${healthClassName}`}>
                {healthLabel}
              </span>
            </div>
            <div className="flex items-center space-x-3 mt-1 text-sm text-gray-500">
              <span>{group.regions.length} {group.regions.length === 1 ? 'region' : 'regions'}</span>
              <span>•</span>
              <span>{totalResources} {totalResources === 1 ? 'resource' : 'resources'}</span>
            </div>
          </div>
        </div>
        
        {/* Add dependency view toggle */}
        <div className="flex justify-end mt-2">
          <button
            onClick={() => setShowDependencyView(!showDependencyView)}
            className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <Network className="w-4 h-4" />
            <span>{showDependencyView ? 'Hide Dependencies' : 'Show Dependencies'}</span>
          </button>
        </div>
      </div>
      
      {/* Dependency View Section */}
      {showDependencyView && (
        <div className="px-6 pb-6 border-t border-gray-100 pt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Resource Dependencies</h3>
            <label className="flex items-center text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showExternalResources}
                onChange={() => setShowExternalResources(!showExternalResources)}
                className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Show external dependencies
            </label>
          </div>
          
          {loadingRelationships ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <ResourceDependencyGraph 
              resources={appResources}
              relationships={relationships}
              externalResources={externalResources}
              showExternalResources={showExternalResources}
            />
          )}
        </div>
      )}
      
      <div className="px-6 pb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {group.regions.map((region) => (
            <RegionSection
              key={region.region}
              region={region}
              isExpanded={expandedRegions.has(region.region)}
              onToggle={() => toggleRegion(region.region)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
