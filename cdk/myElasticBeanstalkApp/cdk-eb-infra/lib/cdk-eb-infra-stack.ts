import * as cdk from '@aws-cdk/core';
import s3assets = require('@aws-cdk/aws-s3-assets');
import * as eb from '@aws-cdk/aws-elasticbeanstalk'
import * as ec2 from '@aws-cdk/aws-ec2'
import iam = require('@aws-cdk/aws-iam');
// import * as sqs from '@aws-cdk/aws-sqs';


export class CdkEbInfraStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Construct an S3 asset from the ZIP located from directory up.
    const webAppZipArchive = new s3assets.Asset(this, 'WebAppZip', {
      path: `${__dirname}/../app.zip`,
    });

    //VPC 
    const vpc1 = new ec2.Vpc(this, 'VPC', {
      natGateways:1,
      cidr: "10.10.0.0/16",
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: 'private-subnet-1',
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
          cidrMask: 24
        },
        {
          name: 'public-subnet-1',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24

        }
      ]
    })

    // Create a ElasticBeanStalk app.
    const appName = 'MyWebApp';
    const app = new eb.CfnApplication(this, 'Application', {
        applicationName: appName,
    });

    // This is the role that my application will assume
    const myRole = new iam.Role(this, `My-app-aws-elasticbeanstalk-ec2-role`, {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies:[
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWebTier'),
        // iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2FullAccess'),
        // iam.ManagedPolicy.fromAwsManagedPolicyName('AutoScalingFullAccess'),
        // iam.ManagedPolicy.fromAwsManagedPolicyName('ElasticLoadBalancingFullAccess')
      ]
    });

    // Policies for Instance Profile role
    // const ebWebTierManagedPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWebTier')
    // const ec2FullAccessManagedPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2FullAccess')
    // const autoScalingFullAccessManagedPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName('AutoScalingFullAccess ')
    // const elasticLoadBalancingFullAccessManagedPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName('ElasticLoadBalancingFullAccess  ')
    // myRole.addManagedPolicy(ebWebTierManagedPolicy);
    // myRole.addManagedPolicy(ec2FullAccessManagedPolicy);
    // myRole.addManagedPolicy(autoScalingFullAccessManagedPolicy);
    // myRole.addManagedPolicy(elasticLoadBalancingFullAccessManagedPolicy);

    //This is the Instance Profile which will allow the application to use the above role
    const myProfileName = 'myWebAppInstanceProfile'
    const instanceProfile = new iam.CfnInstanceProfile(this, myProfileName, {
      instanceProfileName: myProfileName,
      roles: [
          myRole.roleName
      ]
    });
    // Needed for all those extra things

     //Create an app version from the S3 asset defined earlier
    // const appVersionProps = new eb.CfnApplicationVersion(this, 'AppVersion', {
    //   applicationName: appName,
    //   sourceBundle: {
    //       s3Bucket: webAppZipArchive.s3BucketName,
    //       s3Key: webAppZipArchive.s3ObjectKey,
    //   },
    // });

    // appVersionProps.addDependsOn(app);



      // Option settings for the the environment
    const optionSettingProperties: eb.CfnEnvironment.OptionSettingProperty[] = [
      {
        namespace: 'aws:autoscaling:asg',
        optionName: 'MinSize',
        value: '2',
      },
      {
        namespace: 'aws:autoscaling:asg',
        optionName: 'MaxSize',
        value: '4',
      },
      {
        namespace: 'aws:autoscaling:launchconfiguration',
        optionName: 'InstanceType',
        value: 't2.micro',
      },
      {
        namespace: 'aws:autoscaling:launchconfiguration',
        optionName: 'IamInstanceProfile',
        value: instanceProfile.attrArn,
      },
      {
        namespace: 'aws:ec2:vpc',
        optionName: 'VPCId',
        value:  vpc1.vpcId,
      },
      {
        namespace: 'aws:ec2:vpc',
        optionName: 'Subnets',
        value: vpc1.privateSubnets.map(value => value.subnetId).join(','),
      },
      {
        namespace: 'aws:ec2:vpc',
        optionName: 'ELBSubnets',
        value: vpc1.publicSubnets.map(value => value.subnetId).join(','),
      },
      {
        namespace: 'aws:elasticbeanstalk:environment',
        optionName: 'ServiceRole',
        value: myProfileName,
      },
      {
        namespace: 'aws:elasticbeanstalk:environment',
        optionName: 'LoadBalancerType',
        value: 'application',
      }
      
    ];

    // Create an Elastic Beanstalk environment to run my application
    const elbEnv = new eb.CfnEnvironment(this, 'Environment', {
      environmentName: 'MyHelloAppEnvironment',
      applicationName: app.applicationName || appName,
      solutionStackName: '64bit Amazon Linux 2 v5.4.8 running Node.js 14',
      optionSettings: optionSettingProperties,
    });


  }

  
}
