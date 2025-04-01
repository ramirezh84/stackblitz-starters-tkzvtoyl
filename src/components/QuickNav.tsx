import React from 'react';
import Select from 'react-select';
import { AWSResource } from '../types/aws';

interface QuickNavProps {
  resources: AWSResource[];
  onApplicationSelect: (application: string | null) => void;
  selectedApp: string | null;
}

export const QuickNav: React.FC<QuickNavProps> = ({ resources, onApplicationSelect, selectedApp }) => {
  const applications = React.useMemo(() => {
    const apps = Array.from(new Set(resources.map(r => r.application)));
    return apps.map(app => ({
      value: app,
      label: app,
      resourceCount: resources.filter(r => r.application === app).length
    }));
  }, [resources]);

  const selectedOption = selectedApp 
    ? applications.find(app => app.value === selectedApp)
    : null;

  return (
    <div className="w-full md:w-64">
      <div className="relative">
        <Select
          options={applications}
          value={selectedOption}
          onChange={(option) => onApplicationSelect(option?.value || null)}
          placeholder="Jump to application..."
          isClearable={true}
          classNamePrefix="react-select"
          className="react-select-container"
          components={{
            ClearIndicator: ({ innerProps }) => (
              <div 
                {...innerProps} 
                className="flex items-center px-2 cursor-pointer text-gray-400 hover:text-red-500"
              >
                ×
              </div>
            )
          }}
          styles={{
            control: (base) => ({
              ...base,
              minHeight: '40px',
              borderColor: '#E5E7EB',
              '&:hover': {
                borderColor: '#3B82F6'
              }
            }),
            clearIndicator: (base) => ({
              ...base,
              padding: '0px 8px',
              cursor: 'pointer',
              fontSize: '20px',
              lineHeight: '1'
            }),
            option: (base, state) => ({
              ...base,
              backgroundColor: state.isFocused ? '#EFF6FF' : state.isSelected ? '#BFDBFE' : 'white',
              color: '#111827',
              cursor: 'pointer',
              '&:active': {
                backgroundColor: '#BFDBFE'
              }
            }),
            menu: (base) => ({
              ...base,
              zIndex: 50
            })
          }}
          formatOptionLabel={({ label, resourceCount }) => (
            <div className="flex justify-between items-center">
              <span>{label}</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                {resourceCount}
              </span>
            </div>
          )}
        />
      </div>
    </div>
  );
};