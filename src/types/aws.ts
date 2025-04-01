export type AWSResourceType = 
  | 'ecs' 
  | 'aurora' 
  | 'aurora-instance'
  | 'lambda' 
  | 'ec2' 
  | 'stepfunctions' 
  | 'apigateway' 
  | 'eventbridge' 
  | 'alb' 
  | 'nlb';

export interface AWSResource {
  id: string;
  name: string;
  type: AWSResourceType;
  status: 'running' | 'stopped' | 'pending' | 'terminated';
  application: string;
  region: string;
  tags: Record<string, string>;
  lastUpdated: string;
  securityGroups?: string[];
  clusterId?: string; // For Aurora instances to reference their cluster
  details?: {
    // ECS specific
    clusterName?: string;
    runningCount?: number;
    desiredCount?: number;
    pendingCount?: number;
    deploymentStatus?: string;
    deploymentRolloutState?: string;
    failureReason?: string;
    events?: Array<{
      id: string;
      message: string;
      createdAt: string;
      level: 'INFO' | 'WARN' | 'ERROR';
    }>;
    
    // EC2 specific
    instanceType?: string;
    publicIp?: string;
    privateIp?: string;
    
    // Load Balancer specific
    dnsName?: string;
    scheme?: string;
    availabilityZones?: string[];
    
    // Step Functions specific
    executionsStarted?: number;
    executionsFailed?: number;
    executionsSucceeded?: number;
    
    // API Gateway specific
    endpoint?: string;
    stage?: string;
    
    // EventBridge specific
    eventPattern?: string;
    scheduleExpression?: string;
  };
}

export interface RegionGroup {
  region: string;
  resources: AWSResource[];
}

export interface ResourceGroup {
  application: string;
  regions: RegionGroup[];
}

export type HealthStatus = 'healthy' | 'warning' | 'error';

export type RelationshipType = 
  | 'routes_to' 
  | 'depends_on' 
  | 'triggers' 
  | 'connects_to' 
  | 'part_of'
  | 'instance_of';

export interface SecurityGroupRule {
  protocol: string;
  fromPort?: number;
  toPort?: number;
  securityGroupId: string;
  direction: 'inbound' | 'outbound';
}

export interface ResourceRelationship {
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  metadata?: {
    protocol?: string;
    port?: number | string;
    eventType?: string;
    method?: string;
    path?: string;
    accessType?: string;
    targetId?: string;
    stateType?: string;
    securityGroups?: {
      source: string[];
      target: string[];
      rules: SecurityGroupRule[];
    };
    [key: string]: any;
  };
}
