import React from 'react';
import { Search } from 'lucide-react';
import { AWSResource } from '../types/aws';
import { resourceTypeIcons } from '../App';

interface ResourceFiltersProps {
  selectedResourceTypes: Set<AWSResource['type']>;
  onResourceTypeToggle: (type: AWSResource['type']) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export const ResourceFilters: React.FC<ResourceFiltersProps> = ({
  selectedResourceTypes,
  onResourceTypeToggle,
  searchTerm,
  onSearchChange,
}) => {
  return (
    <div className="p-4 space-y-6">
      {/* Search */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Search</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search resources..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Resource Types */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Resource Types</h2>
        <div className="space-y-2">
          {(Object.entries(resourceTypeIcons) as [AWSResource['type'], { icon: React.ElementType, label: string }][]).map(([type, { icon: Icon, label }]) => (
            <button
              key={type}
              onClick={() => onResourceTypeToggle(type)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                selectedResourceTypes.has(type)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="space-y-2">
          <button
            onClick={() => onSearchChange('')}
            className="w-full text-left text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear search
          </button>
          <button
            onClick={() => selectedResourceTypes.size > 0 && onResourceTypeToggle(Array.from(selectedResourceTypes)[0])}
            className="w-full text-left text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear filters
          </button>
        </div>
      </div>
    </div>
  );
};