import React from 'react';
import { 
  Ship, 
  Database, 
  FunctionSquare, 
  Circle, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  Server,
  GitFork,
  Network,
  Calendar,
  BarChart3,
  Globe
} from 'lucide-react';
import { AWSResource } from '../types/aws';

const resourceIcons = {
  ecs: Ship,
  aurora: Database,
  'aurora-instance': Database,
  lambda: FunctionSquare,
  ec2: Server,
  stepfunctions: GitFork,
  apigateway: Globe,
  eventbridge: Calendar,
  alb: Network,
  nlb: BarChart3,
};

const statusColors = {
  running: 'text-green-500',
  stopped: 'text-red-500',
  pending: 'text-yellow-500',
  terminated: 'text-gray-500',
};

const statusBgColors = {
  running: 'bg-green-50 border-green-200',
  stopped: 'bg-red-50 border-red-200',
  pending: 'bg-yellow-50 border-yellow-200',
  terminated: 'bg-gray-50 border-gray-200',
};

const statusIcons = {
  running: CheckCircle2,
  stopped: Circle,
  pending: Clock,
  terminated: AlertCircle,
};

interface ResourceCardProps {
  resource: AWSResource;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({ resource }) => {
  // Safely get the icon, with a fallback if the resource type is not found
  const Icon = resourceIcons[resource.type] || Server;
  const StatusIcon = statusIcons[resource.status];

  const renderDetails = () => {
    switch (resource.type) {
      case 'ecs':
        return (
          <div className="space-y-3 text-sm">
            {/* Cluster Name */}
            <div className="flex justify-between">
              <span className="text-gray-500">Cluster:</span>
              <span className="text-gray-900 font-medium">{resource.details?.clusterName}</span>
            </div>

            {/* Container Counts */}
            <div className="flex justify-between">
              <span className="text-gray-500">Containers:</span>
              <span className="text-gray-900">
                {resource.details?.runningCount} / {resource.details?.desiredCount}
                {resource.details?.pendingCount && resource.details.pendingCount > 0 && ` (${resource.details.pendingCount} pending)`}
              </span>
            </div>

            {/* Deployment Status */}
            {resource.details?.deploymentRolloutState && (
              <div className="flex justify-between">
                <span className="text-gray-500">Deployment:</span>
                <span className={`font-medium ${
                  resource.details.deploymentRolloutState === 'FAILED' 
                    ? 'text-red-600' 
                    : resource.details.deploymentRolloutState === 'COMPLETED'
                    ? 'text-green-600'
                    : 'text-yellow-600'
                }`}>
                  {resource.details.deploymentRolloutState.toLowerCase()}
                </span>
              </div>
            )}

            {/* Failure Reason */}
            {resource.details?.failureReason && (
              <div className="mt-2 p-2 bg-red-50 text-red-700 text-xs rounded">
                <span className="font-medium">Failure Reason:</span>
                <p className="mt-1">{resource.details.failureReason}</p>
              </div>
            )}

            {/* Recent Events */}
            {(resource.status === 'stopped' || resource.details?.deploymentRolloutState === 'FAILED') && 
             resource.details?.events && resource.details.events.length > 0 && (
              <div className="mt-4">
                <div className="text-gray-500 mb-2">Recent Events:</div>
                <div className="space-y-2">
                  {resource.details.events.map(event => (
                    <div 
                      key={event.id} 
                      className={`text-xs p-2 rounded ${
                        event.level === 'ERROR' ? 'bg-red-50 text-red-700' :
                        event.level === 'WARN' ? 'bg-yellow-50 text-yellow-700' :
                        'bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">{event.level}</span>
                        <span className="text-gray-500">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p>{event.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'ec2':
        return (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Instance Type:</span>
              <span className="text-gray-900">{resource.details?.instanceType}</span>
            </div>
            {resource.details?.publicIp && (
              <div className="flex justify-between">
                <span className="text-gray-500">Public IP:</span>
                <span className="text-gray-900">{resource.details.publicIp}</span>
              </div>
            )}
          </div>
        );

      case 'stepfunctions':
        return (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Executions:</span>
              <span className="text-gray-900">
                {resource.details?.executionsSucceeded} succeeded / {resource.details?.executionsFailed} failed
              </span>
            </div>
          </div>
        );

      case 'apigateway':
        return (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Stage:</span>
              <span className="text-gray-900">{resource.details?.stage}</span>
            </div>
            {resource.details?.endpoint && (
              <div className="flex justify-between">
                <span className="text-gray-500">Endpoint:</span>
                <span className="text-gray-900 truncate">{resource.details.endpoint}</span>
              </div>
            )}
          </div>
        );

      case 'eventbridge':
        return (
          <div className="space-y-2 text-sm">
            {resource.details?.scheduleExpression && (
              <div className="flex justify-between">
                <span className="text-gray-500">Schedule:</span>
                <span className="text-gray-900">{resource.details.scheduleExpression}</span>
              </div>
            )}
            {resource.details?.eventPattern && (
              <div className="flex justify-between">
                <span className="text-gray-500">Pattern:</span>
                <span className="text-gray-900 truncate">{resource.details.eventPattern}</span>
              </div>
            )}
          </div>
        );

      case 'alb':
      case 'nlb':
        return (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Scheme:</span>
              <span className="text-gray-900">{resource.details?.scheme}</span>
            </div>
            {resource.details?.dnsName && (
              <div className="flex justify-between">
                <span className="text-gray-500">DNS:</span>
                <span className="text-gray-900 truncate">{resource.details.dnsName}</span>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`bg-white rounded-lg border ${statusBgColors[resource.status]} p-4 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-white rounded-lg border border-current">
            <Icon className={`w-5 h-5 ${statusColors[resource.status]}`} />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{resource.name}</h3>
            <p className="text-sm text-gray-500">{resource.type.toUpperCase()}</p>
          </div>
        </div>
        <StatusIcon className={`w-5 h-5 ${statusColors[resource.status]}`} />
      </div>
      
      <div className="mt-4 space-y-2">
        {renderDetails()}
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Last Updated:</span>
          <span className="text-gray-900">
            {new Date(resource.lastUpdated).toLocaleString()}
          </span>
        </div>
      </div>
      
      {Object.keys(resource.tags).length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(resource.tags).map(([key, value]) => (
              <span
                key={key}
                className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600"
              >
                {key}: {value}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
