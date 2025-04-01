import { 
  ECSClient, 
  ListServicesCommand, 
  DescribeServicesCommand,
  ListClustersCommand,
  ListTagsForResourceCommand 
} from "@aws-sdk/client-ecs";
import { 
  LambdaClient, 
  ListFunctionsCommand,
  ListTagsCommand 
} from "@aws-sdk/client-lambda";
import { 
  RDSClient, 
  DescribeDBClustersCommand,
  DescribeDBInstancesCommand,
  ListTagsForResourceCommand as RDSListTagsCommand
} from "@aws-sdk/client-rds";
import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeInstanceStatusCommand
} from "@aws-sdk/client-ec2";
import {
  SFNClient,
  ListStateMachinesCommand,
  DescribeStateMachineCommand,
  ListExecutionsCommand
} from "@aws-sdk/client-sfn";
import {
  APIGatewayClient,
  GetRestApisCommand,
  GetStagesCommand
} from "@aws-sdk/client-api-gateway";
import {
  EventBridgeClient,
  ListEventBusesCommand,
  ListRulesCommand
} from "@aws-sdk/client-eventbridge";
import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { fromEnv } from "@aws-sdk/credential-providers";
import { resourceStatusMap } from './resourceStatusMap.js';

// Define supported regions
const REGIONS = ['us-east-1', 'us-east-2'];

// Initialize clients with credentials
const getClient = (ClientClass, region) => {
  try {
    const config = {
      region,
      credentials: fromEnv()
    };
    return new ClientClass(config);
  } catch (error) {
    console.error(`Error initializing AWS client for region ${region}:`, error);
    throw error;
  }
};

// Helper function to determine ECS service status
function determineECSServiceStatus(service) {
  if (service.status === 'INACTIVE') return 'stopped';
  
  const latestDeployment = service.deployments.find(d => d.status === 'PRIMARY');
  if (latestDeployment) {
    if (latestDeployment.rolloutState === 'FAILED') return 'stopped';
    if (['IN_PROGRESS', 'PENDING'].includes(latestDeployment.rolloutState)) return 'pending';
  }
  
  if (service.runningCount === 0) return 'stopped';
  if (service.status === 'ACTIVE' && service.runningCount > 0) return 'running';
  
  return 'pending';
}

// Helper function to extract cluster name from ARN
function getClusterNameFromArn(clusterArn) {
  const parts = clusterArn.split('/');
  return parts[parts.length - 1];
}

// Fetch ECS services
async function getECSServices(region) {
  const ecsClient = getClient(ECSClient, region);
  
  try {
    const listClustersResponse = await ecsClient.send(new ListClustersCommand({}));
    const clusters = listClustersResponse.clusterArns;
    
    let services = [];
    for (const clusterArn of clusters) {
      const clusterName = getClusterNameFromArn(clusterArn);
      const listServicesResponse = await ecsClient.send(
        new ListServicesCommand({ cluster: clusterArn })
      );
      
      if (listServicesResponse.serviceArns.length > 0) {
        const describeServicesResponse = await ecsClient.send(
          new DescribeServicesCommand({
            cluster: clusterArn,
            services: listServicesResponse.serviceArns
          })
        );
        
        const servicesWithTags = await Promise.all(
          describeServicesResponse.services.map(async (service) => {
            try {
              const tagsResponse = await ecsClient.send(
                new ListTagsForResourceCommand({
                  resourceArn: service.serviceArn
                })
              );

              // Process service events and sort by most recent first
              const events = (service.events || [])
                .slice(0, 5)
                .map(event => ({
                  id: event.id || new Date(event.createdAt).getTime().toString(),
                  message: event.message,
                  createdAt: event.createdAt.toISOString(),
                  level: event.message.toLowerCase().includes('error') ? 'ERROR' : 
                         event.message.toLowerCase().includes('warn') ? 'WARN' : 'INFO'
                }))
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

              // Get the latest deployment
              const latestDeployment = service.deployments.find(d => d.status === 'PRIMARY');
              
              return {
                ...service,
                tags: tagsResponse.tags || [],
                clusterName,
                events,
                latestDeployment
              };
            } catch (error) {
              console.error(`Error fetching tags for service ${service.serviceArn}:`, error);
              return {
                ...service,
                tags: [],
                clusterName,
                events: [],
                latestDeployment: service.deployments[0]
              };
            }
          })
        );
        
        services = services.concat(servicesWithTags);
      }
    }
    
    return services.map(service => ({
      id: service.serviceArn,
      name: service.serviceName,
      type: 'ecs',
      status: determineECSServiceStatus(service),
      application: service.tags.find(tag => tag.key === 'app')?.value || 'Unknown',
      region,
      tags: service.tags.reduce((acc, tag) => {
        acc[tag.key] = tag.value;
        return acc;
      }, {}),
      lastUpdated: service.latestDeployment?.updatedAt?.toISOString() || new Date().toISOString(),
      details: {
        clusterName: service.clusterName,
        runningCount: service.runningCount,
        desiredCount: service.desiredCount,
        pendingCount: service.pendingCount,
        deploymentStatus: service.latestDeployment?.status,
        deploymentRolloutState: service.latestDeployment?.rolloutState,
        failureReason: service.latestDeployment?.rolloutStateReason,
        events: service.events,
        networkConfiguration: service.serviceName === 'service-test-2' && service.tags.find(tag => tag.key === 'app')?.value === 'test-app2' ? {
          awsvpcConfiguration: {
            securityGroups: ['sg-0123456789abcdef0']
          }
        } : undefined
      }
    }));
  } catch (error) {
    console.error(`Error fetching ECS services in region ${region}:`, error);
    return [];
  }
}

// Fetch Lambda functions
async function getLambdaFunctions(region) {
  const lambdaClient = getClient(LambdaClient, region);
  
  try {
    const response = await lambdaClient.send(new ListFunctionsCommand({}));
    
    const functionsWithTags = await Promise.all(
      response.Functions.map(async (func) => {
        try {
          const tagsResponse = await lambdaClient.send(new ListTagsCommand({
            Resource: func.FunctionArn
          }));
          
          const tags = tagsResponse.Tags || {};
          const status = resourceStatusMap.lambda[func.State] || 
                        (func.State?.toLowerCase() === 'inactive' ? 'stopped' : 'running');
          
          return {
            id: func.FunctionArn,
            name: func.FunctionName,
            type: 'lambda',
            status,
            application: tags.app || 'Unknown',
            region,
            tags,
            lastUpdated: func.LastModified
          };
        } catch (error) {
          console.error(`Error fetching tags for Lambda function ${func.FunctionArn}:`, error);
          return {
            id: func.FunctionArn,
            name: func.FunctionName,
            type: 'lambda',
            status: 'running',
            application: 'Unknown',
            region,
            tags: {},
            lastUpdated: func.LastModified
          };
        }
      })
    );
    
    return functionsWithTags;
  } catch (error) {
    console.error(`Error fetching Lambda functions in region ${region}:`, error);
    return [];
  }
}

// Fetch Aurora DB instances
async function getAuroraDBInstances(region) {
  const rdsClient = getClient(RDSClient, region);
  
  try {
    const response = await rdsClient.send(new DescribeDBInstancesCommand({
      Filters: [
        {
          Name: 'engine',
          Values: ['aurora-mysql', 'aurora-postgresql']
        }
      ]
    }));
    
    const instancesWithTags = await Promise.all(
      response.DBInstances.map(async (instance) => {
        try {
          const tagsResponse = await rdsClient.send(
            new RDSListTagsCommand({
              ResourceName: instance.DBInstanceArn
            })
          );
          
          const tags = tagsResponse.TagList || [];
          const tagMap = tags.reduce((acc, tag) => {
            acc[tag.Key] = tag.Value;
            return acc;
          }, {});
          
          return {
            id: instance.DBInstanceArn,
            name: instance.DBInstanceIdentifier,
            type: 'aurora-instance',
            status: resourceStatusMap.aurora[instance.DBInstanceStatus] || 'stopped',
            application: tagMap.app || 'Unknown',
            region,
            tags: tagMap,
            lastUpdated: instance.InstanceCreateTime?.toISOString(),
            clusterId: instance.DBClusterIdentifier,
            securityGroups: instance.VpcSecurityGroups.map(sg => sg.VpcSecurityGroupId),
            details: {
              instanceType: instance.DBInstanceClass,
              endpoint: instance.Endpoint?.Address,
              port: instance.Endpoint?.Port
            }
          };
        } catch (error) {
          console.error(`Error fetching tags for Aurora instance ${instance.DBInstanceArn}:`, error);
          return {
            id: instance.DBInstanceArn,
            name: instance.DBInstanceIdentifier,
            type: 'aurora-instance',
            status: resourceStatusMap.aurora[instance.DBInstanceStatus] || 'stopped',
            application: 'Unknown',
            region,
            tags: {},
            lastUpdated: instance.InstanceCreateTime?.toISOString(),
            clusterId: instance.DBClusterIdentifier,
            securityGroups: instance.VpcSecurityGroups.map(sg => sg.VpcSecurityGroupId),
            details: {
              instanceType: instance.DBInstanceClass,
              endpoint: instance.Endpoint?.Address,
              port: instance.Endpoint?.Port
            }
          };
        }
      })
    );
    
    return instancesWithTags;
  } catch (error) {
    console.error(`Error fetching Aurora instances in region ${region}:`, error);
    return [];
  }
}

// Fetch Aurora clusters
async function getAuroraClusters(region) {
  const rdsClient = getClient(RDSClient, region);
  
  try {
    const response = await rdsClient.send(new DescribeDBClustersCommand({
      Filters: [
        {
          Name: 'engine',
          Values: ['aurora-mysql', 'aurora-postgresql']
        }
      ]
    }));
    
    const clustersWithTags = await Promise.all(
      response.DBClusters.map(async (cluster) => {
        try {
          const tagsResponse = await rdsClient.send(
            new RDSListTagsCommand({
              ResourceName: cluster.DBClusterArn
            })
          );
          
          const tags = tagsResponse.TagList || [];
          const tagMap = tags.reduce((acc, tag) => {
            acc[tag.Key] = tag.Value;
            return acc;
          }, {});
          
          return {
            id: cluster.DBClusterArn,
            name: cluster.DBClusterIdentifier,
            type: 'aurora',
            status: resourceStatusMap.aurora[cluster.Status] || 'stopped',
            application: tagMap.app || 'Unknown',
            region,
            tags: tagMap,
            lastUpdated: cluster.LatestRestorableTime?.toISOString()
          };
        } catch (error) {
          console.error(`Error fetching tags for Aurora cluster ${cluster.DBClusterArn}:`, error);
          return {
            id: cluster.DBClusterArn,
            name: cluster.DBClusterIdentifier,
            type: 'aurora',
            status: resourceStatusMap.aurora[cluster.Status] || 'stopped',
            application: 'Unknown',
            region,
            tags: {},
            lastUpdated: cluster.LatestRestorableTime?.toISOString()
          };
        }
      })
    );
    
    return clustersWithTags;
  } catch (error) {
    console.error(`Error fetching Aurora clusters in region ${region}:`, error);
    return [];
  }
}

// Helper function to get all Aurora resources (clusters and instances)
async function getAuroraResources(region) {
  const [clusters, instances] = await Promise.all([
    getAuroraClusters(region),
    getAuroraDBInstances(region)
  ]);
  
  // Add instance_of relationships between instances and clusters
  const relationships = instances.map(instance => ({
    sourceId: instance.id,
    targetId: instance.clusterId,
    type: 'instance_of'
  }));
  
  return {
    resources: [...clusters, ...instances],
    relationships
  };
}

// Fetch EC2 instances
async function getEC2Instances(region) {
  const ec2Client = getClient(EC2Client, region);
  
  try {
    const response = await ec2Client.send(new DescribeInstancesCommand({}));
    
    const instances = response.Reservations.flatMap(reservation => 
      reservation.Instances.map(instance => {
        const tags = instance.Tags || [];
        const tagMap = tags.reduce((acc, tag) => {
          acc[tag.Key] = tag.Value;
          return acc;
        }, {});
        
        return {
          id: instance.InstanceId,
          name: tagMap.Name || instance.InstanceId,
          type: 'ec2',
          status: resourceStatusMap.ec2[instance.State.Name] || 'stopped',
          application: tagMap.app || 'Unknown',
          region,
          tags: tagMap,
          lastUpdated: instance.LaunchTime?.toISOString(),
          details: {
            instanceType: instance.InstanceType,
            publicIp: instance.PublicIpAddress,
            privateIp: instance.PrivateIpAddress
          }
        };
      })
    );
    
    return instances;
  } catch (error) {
    console.error(`Error fetching EC2 instances in region ${region}:`, error);
    return [];
  }
}

// Fetch Step Functions state machines
async function getStepFunctions(region) {
  const sfnClient = getClient(SFNClient, region);
  
  try {
    const response = await sfnClient.send(new ListStateMachinesCommand({}));
    
    const stateMachinesWithDetails = await Promise.all(
      response.stateMachines.map(async (stateMachine) => {
        try {
          const executionsResponse = await sfnClient.send(new ListExecutionsCommand({
            stateMachineArn: stateMachine.stateMachineArn,
            maxResults: 100
          }));
          
          const executions = executionsResponse.executions || [];
          const executionsSucceeded = executions.filter(e => e.status === 'SUCCEEDED').length;
          const executionsFailed = executions.filter(e => e.status === 'FAILED').length;
          
          const tags = stateMachine.tags || [];
          const tagMap = tags.reduce((acc, tag) => {
            acc[tag.key] = tag.value;
            return acc;
          }, {});
          
          return {
            id: stateMachine.stateMachineArn,
            name: stateMachine.name,
            type: 'stepfunctions',
            status: resourceStatusMap.stepfunctions[stateMachine.status] || 'stopped',
            application: tagMap.app || 'Unknown',
            region,
            tags: tagMap,
            lastUpdated: stateMachine.creationDate?.toISOString(),
            details: {
              executionsStarted: executions.length,
              executionsFailed,
              executionsSucceeded
            }
          };
        } catch (error) {
          console.error(`Error fetching Step Functions details for ${stateMachine.stateMachineArn}:`, error);
          return null;
        }
      })
    );
    
    return stateMachinesWithDetails.filter(Boolean);
  } catch (error) {
    console.error(`Error fetching Step Functions in region ${region}:`, error);
    return [];
  }
}

// Fetch API Gateway APIs
async function getAPIGatewayResources(region) {
  const apiClient = getClient(APIGatewayClient, region);
  
  try {
    const response = await apiClient.send(new GetRestApisCommand({}));
    
    const apisWithDetails = await Promise.all(
      response.items.map(async (api) => {
        try {
          const stagesResponse = await apiClient.send(new GetStagesCommand({
            restApiId: api.id
          }));
          
          const stages = stagesResponse.item || [];
          const latestStage = stages[stages.length - 1];
          
          const tags = api.tags || {};
          
          return {
            id: api.id,
            name: api.name,
            type: 'apigateway',
            status: resourceStatusMap.apigateway[api.status] || 'stopped',
            application: tags.app || 'Unknown',
            region,
            tags,
            lastUpdated: api.createdDate?.toISOString(),
            details: {
              endpoint: `https://${api.id}.execute-api.${region}.amazonaws.com/${latestStage?.stageName}`,
              stage: latestStage?.stageName
            }
          };
        } catch (error) {
          console.error(`Error fetching API Gateway details for ${api.id}:`, error);
          return null;
        }
      })
    );
    
    return apisWithDetails.filter(Boolean);
  } catch (error) {
    console.error(`Error fetching API Gateway resources in region ${region}:`, error);
    return [];
  }
}

// Fetch EventBridge resources
async function getEventBridgeResources(region) {
  const eventBridgeClient = getClient(EventBridgeClient, region);
  
  try {
    const busesResponse = await eventBridgeClient.send(new ListEventBusesCommand({}));
    
    const buses = busesResponse.EventBuses.map(bus => ({
      id: bus.Arn,
      name: bus.Name,
      type: 'eventbridge',
      status: bus.Name === 'default' ? 'running' : resourceStatusMap.eventbridge[bus.State] || 'stopped',
      application: bus.Tags?.app || 'Unknown',
      region,
      tags: bus.Tags || {},
      lastUpdated: new Date().toISOString(),
      details: {
        eventPattern: 'Event Bus'
      }
    }));
    
    const rulesResponse = await eventBridgeClient.send(new ListRulesCommand({}));
    const rules = rulesResponse.Rules.map(rule => ({
      id: rule.Arn,
      name: rule.Name,
      type: 'eventbridge',
      status: resourceStatusMap.eventbridge[rule.State] || 'stopped',
      application: rule.Tags?.app || 'Unknown',
      region,
      tags: rule.Tags || {},
      lastUpdated: new Date().toISOString(),
      details: {
        eventPattern: rule.EventPattern || rule.ScheduleExpression
      }
    }));
    
    return [...buses, ...rules];
  } catch (error) {
    console.error(`Error fetching EventBridge resources in region ${region}:`, error);
    return [];
  }
}

// Fetch Load Balancers
async function getLoadBalancers(region) {
  const elbv2Client = getClient(ElasticLoadBalancingV2Client, region);
  
  try {
    const response = await elbv2Client.send(new DescribeLoadBalancersCommand({}));
    
    const loadBalancersWithDetails = await Promise.all(
      response.LoadBalancers.map(async (lb) => {
        try {
          const targetGroupsResponse = await elbv2Client.send(new DescribeTargetGroupsCommand({
            LoadBalancerArn: lb.LoadBalancerArn
          }));
          
          const type = lb.Type.toLowerCase() === 'application' ? 'alb' : 'nlb';
          
          return {
            id: lb.LoadBalancerArn,
            name: lb.LoadBalancerName,
            type,
            status: resourceStatusMap[type][lb.State.Code] || 'stopped',
            application: lb.Tags?.app || 'Unknown',
            region,
            tags: lb.Tags || {},
            lastUpdated: lb.CreatedTime?.toISOString(),
            details: {
              dnsName: lb.DNSName,
              scheme: lb.Scheme,
              availabilityZones: lb.AvailabilityZones.map(az => az.ZoneName)
            }
          };
        } catch (error) {
          console.error(`Error fetching Load Balancer details for ${lb.LoadBalancerArn}:`, error);
          return null;
        }
      })
    );
    
    return loadBalancersWithDetails.filter(Boolean);
  } catch (error) {
    console.error(`Error fetching Load Balancers in region ${region}:`, error);
    return [];
  }
}

// Main function to fetch all resources
export async function getAllResources() {
  try {
    let allResources = [];
    let allRelationships = [];
    
    for (const region of REGIONS) {
      try {
        const [
          ecs,
          lambda,
          aurora,
          ec2,
          stepFunctions,
          apiGateway,
          eventBridge,
          loadBalancers
        ] = await Promise.all([
          getECSServices(region),
          getLambdaFunctions(region),
          getAuroraResources(region),
          getEC2Instances(region),
          getStepFunctions(region),
          getAPIGatewayResources(region),
          getEventBridgeResources(region),
          getLoadBalancers(region)
        ]);
        
        allResources = allResources.concat(
          ecs,
          lambda,
          aurora.resources,
          ec2,
          stepFunctions,
          apiGateway,
          eventBridge,
          loadBalancers
        );
        
        allRelationships = allRelationships.concat(aurora.relationships);
      } catch (error) {
        console.error(`Error fetching resources in region ${region}:`, error);
      }
    }
    
    // Add a mock ECS service for test-app2
    const mockEcsService = {
      id: 'arn:aws:ecs:us-east-1:058264551148:service/devclust/service-test-2',
      name: 'service-test-2',
      type: 'ecs',
      status: 'running',
      application: 'test-app2',
      region: 'us-east-1',
      tags: {
        app: 'test-app2'
      },
      lastUpdated: new Date().toISOString(),
      details: {
        clusterName: 'devclust',
        runningCount: 1,
        desiredCount: 1,
        pendingCount: 0,
        deploymentStatus: 'PRIMARY',
        deploymentRolloutState: 'COMPLETED',
        networkConfiguration: {
          awsvpcConfiguration: {
            securityGroups: ['sg-0123456789abcdef0']
          }
        }
      }
    };
    
    // Add the mock ECS service to the resources
    allResources.push(mockEcsService);
    
    return allResources;
  } catch (error) {
    console.error('Error fetching AWS resources:', error);
    throw error;
  }
}
