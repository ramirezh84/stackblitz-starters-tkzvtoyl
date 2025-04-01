// Resource status mappings
export const resourceStatusMap = {
  lambda: {
    'Active': 'running',
    'ACTIVE': 'running',
    'Inactive': 'stopped',
    'INACTIVE': 'stopped',
    'Pending': 'pending',
    'PENDING': 'pending',
    'Failed': 'stopped',
    'FAILED': 'stopped'
  },
  aurora: {
    'available': 'running',
    'stopped': 'stopped',
    'starting': 'pending',
    'stopping': 'pending',
  },
  ecs: {
    'ACTIVE': 'running',
    'DRAINING': 'pending',
    'INACTIVE': 'stopped',
  },
  ec2: {
    'running': 'running',
    'stopped': 'stopped',
    'pending': 'pending',
    'stopping': 'pending',
    'terminated': 'terminated',
  },
  stepfunctions: {
    'ACTIVE': 'running',
    'DELETING': 'pending',
    'FAILED': 'stopped',
  },
  apigateway: {
    'AVAILABLE': 'running',
    'PENDING': 'pending',
    'FAILED': 'stopped',
    'DELETING': 'pending',
  },
  eventbridge: {
    'ENABLED': 'running',
    'DISABLED': 'stopped',
    'PENDING': 'pending',
  },
  alb: {
    'active': 'running',
    'provisioning': 'pending',
    'failed': 'stopped',
    'inactive': 'stopped',
  },
  nlb: {
    'active': 'running',
    'provisioning': 'pending',
    'failed': 'stopped',
    'inactive': 'stopped',
  }
};