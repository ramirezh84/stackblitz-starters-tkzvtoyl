import React, { useEffect, useState } from 'react';
import { ResourceGroup as ResourceGroupComponent } from './components/ResourceGroup';
import { QuickNav } from './components/QuickNav';
import { DashboardOverview } from './components/DashboardOverview';
import { ResourceFilters } from './components/ResourceFilters';
import { AWSResource, ResourceGroup } from './types/aws';
import { 
  Ship, 
  Database, 
  FunctionSquare,
  Server,
  GitFork,
  Network,
  Calendar,
  BarChart3,
  Globe,
  Menu,
  X
} from 'lucide-react';

export const resourceTypeIcons = {
  ecs: { icon: Ship, label: 'ECS Services' },
  aurora: { icon: Database, label: 'Aurora Clusters' },
  lambda: { icon: FunctionSquare, label: 'Lambda Functions' },
  ec2: { icon: Server, label: 'EC2 Instances' },
  stepfunctions: { icon: GitFork, label: 'Step Functions' },
  apigateway: { icon: Globe, label: 'API Gateway' },
  eventbridge: { icon: Calendar, label: 'EventBridge' },
  alb: { icon: Network, label: 'Application LB' },
  nlb: { icon: BarChart3, label: 'Network LB' }
};

function App() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedResourceTypes, setSelectedResourceTypes] = React.useState<Set<AWSResource['type']>>(new Set());
  const [resources, setResources] = useState<AWSResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchResources();
    
    // Add event listener for window resize
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setShowFilters(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchResources = async () => {
    try {
      const response = await fetch('/api/resources');
      if (!response.ok) {
        throw new Error('Failed to fetch resources');
      }
      const data = await response.json();
      setResources(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const groupedResources = React.useMemo(() => {
    const filtered = resources.filter(
      (resource) => {
        const matchesSearch = resource.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          resource.application.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = selectedResourceTypes.size === 0 || selectedResourceTypes.has(resource.type);
        const matchesApp = !selectedApp || resource.application === selectedApp;
        return matchesSearch && matchesType && matchesApp;
      }
    );

    return Object.values(
      filtered.reduce<Record<string, ResourceGroup>>((acc, resource) => {
        if (!acc[resource.application]) {
          acc[resource.application] = {
            application: resource.application,
            regions: [],
          };
        }

        let regionGroup = acc[resource.application].regions.find(r => r.region === resource.region);
        if (!regionGroup) {
          regionGroup = {
            region: resource.region,
            resources: [],
          };
          acc[resource.application].regions.push(regionGroup);
        }
        regionGroup.resources.push(resource);

        return acc;
      }, {})
    );
  }, [searchTerm, selectedResourceTypes, resources, selectedApp]);

  const handleResourceTypeToggle = (type: AWSResource['type']) => {
    setSelectedResourceTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const clearAllFilters = () => {
    setSelectedApp(null);
    setSearchTerm('');
    setSelectedResourceTypes(new Set());
  };

  const handleApplicationSelect = (appName: string | null) => {
    if (appName === null) {
      clearAllFilters();
    } else {
      setSelectedApp(appName);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              >
                {showFilters ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
              <h1 className="text-xl font-bold text-gray-900 ml-2 lg:ml-0">
                AWS Resources Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <QuickNav 
                resources={resources}
                onApplicationSelect={handleApplicationSelect}
                selectedApp={selectedApp}
              />
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-16 lg:grid lg:grid-cols-12 lg:gap-x-5">
        {/* Sidebar */}
        <aside className={`
          ${showFilters ? 'block' : 'hidden'}
          lg:block
          lg:col-span-3
          xl:col-span-2
          bg-white
          border-r
          border-gray-200
          fixed
          lg:sticky
          top-16
          h-[calc(100vh-4rem)]
          w-64
          lg:w-auto
          overflow-y-auto
          z-20
        `}>
          <ResourceFilters
            selectedResourceTypes={selectedResourceTypes}
            onResourceTypeToggle={handleResourceTypeToggle}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </aside>

        {/* Main Content */}
        <main className={`
          lg:col-span-9
          xl:col-span-10
          px-4
          sm:px-6
          lg:px-8
          py-8
          ${showFilters ? 'lg:ml-0' : ''}
        `}>
          <div className="max-w-7xl mx-auto">
            <DashboardOverview resources={resources} />

            <div className="space-y-6 mt-8">
              {groupedResources.map((group) => (
                <ResourceGroupComponent 
                  key={group.application} 
                  group={group}
                  allResources={resources}
                />
              ))}
              
              {groupedResources.length === 0 && (
                <div className="text-center py-12">
                  <Server className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No resources found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Try adjusting your search or filters to find what you're looking for.
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
