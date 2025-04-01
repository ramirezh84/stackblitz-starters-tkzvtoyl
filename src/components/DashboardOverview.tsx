import React from 'react';
import { AWSResource } from '../types/aws';
import { Activity, Server, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { resourceTypeIcons } from '../App';

interface DashboardOverviewProps {
  resources: AWSResource[];
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ resources }) => {
  const stats = React.useMemo(() => {
    const applications = new Set(resources.map(r => r.application));
    const regions = new Set(resources.map(r => r.region));
    
    const statusCount = resources.reduce((acc, resource) => {
      acc[resource.status] = (acc[resource.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typeCount = resources.reduce((acc, resource) => {
      acc[resource.type] = (acc[resource.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalApps: applications.size,
      totalRegions: regions.size,
      totalResources: resources.length,
      running: statusCount.running || 0,
      stopped: statusCount.stopped || 0,
      pending: statusCount.pending || 0,
      resourceTypes: typeCount
    };
  }, [resources]);

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
        {/* Overview Stats */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <div className="flex items-center space-x-2 mb-4">
            <Activity className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900">Infrastructure Overview</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="text-blue-600 text-sm font-medium">Applications</div>
              <div className="mt-2 text-2xl font-bold text-blue-700">{stats.totalApps}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
              <div className="text-purple-600 text-sm font-medium">Regions</div>
              <div className="mt-2 text-2xl font-bold text-purple-700">{stats.totalRegions}</div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
              <div className="text-indigo-600 text-sm font-medium">Total Resources</div>
              <div className="mt-2 text-2xl font-bold text-indigo-700">{stats.totalResources}</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
              <div className="text-emerald-600 text-sm font-medium">Running Resources</div>
              <div className="mt-2 text-2xl font-bold text-emerald-700">{stats.running}</div>
            </div>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="col-span-1">
          <div className="bg-gray-50 rounded-lg p-4 border h-full">
            <div className="flex items-center space-x-2 mb-4">
              <Server className="w-5 h-5 text-gray-500" />
              <h3 className="text-lg font-medium text-gray-900">Status Distribution</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-600">Running</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{stats.running}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-gray-600">Pending</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{stats.pending}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-gray-600">Stopped</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{stats.stopped}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Resource Types Distribution */}
        <div className="col-span-1 md:col-span-1 lg:col-span-2">
          <div className="bg-gray-50 rounded-lg p-4 border h-full">
            <div className="flex items-center space-x-2 mb-4">
              <Server className="w-5 h-5 text-gray-500" />
              <h3 className="text-lg font-medium text-gray-900">Resource Types</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(resourceTypeIcons).map(([type, { icon: Icon, label }]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">{label}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {stats.resourceTypes[type] || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};