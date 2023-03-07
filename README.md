Problem statement - API Gateways

The core challenge with using Pact with gateways, is that they are usually configuration based tools or pieces of infrastructure that don't store any state (they delegate to other systems). Validating pacts for them can be very cumbersome, because all of the state handling must be stubbed out for any tests to pass because the gateway doesn't actually know about the functionality. Furthermore, they then must recreate all of the scenarios to pass on to the downstream systems to ensure there are no gaps in contract coverage.

Use case: Signed requests

Dealing with authentication to the gateway.

Problem statement - Signed Requests

In some cases, requests need to be signed with dynamic information, for example, when dealing with certain requests to AWS.

In these cases, you can't use static API tokens because you need access to the request information to construct a valid token.

[Read](https://docs.pact.io/provider/handling_auth) our strategies for handling such use cases.

Today we will be focusing on modifying our request, to use real credentials

> Most Pact implementations allow some method of modifying the request before it is replayed (eg. the Pact-JVM request filter, or Ruby Rack middleware). If this is not possible, you could provide your own middleware or proxy during verification.

Our setup

1. AWS API Gateway protected by AWS IAM
2. Swagger 2.0 PetStore API Definition
3. TypeScript consumer example generating contracts between our PetStore provider
4. TypeScript provider verification example, verifying contracts for our PetStore consumer, against our live PetStore provider

Caveats

1. We will not create a full provider implementation, and instead rely on AWS API Gateways route generation from the Swagger/OpenAPI document
2. You would traditionally verify your provider locally, or in CI, prior to deployment to an integrated environment. You can consider our provider codebase is deployed ephemerally on pull requests.

## Pre-Reqs online

1. Follow the AWS guide linked [here](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-create-api-from-example.html) to generate an API gateway from a Swagger 2.0 PetStore definition
2. Update the endpoints to use AWS IAM authentication by following step 1.1 on this AWS guide [here](https://catalog.us-east-1.prod.workshops.aws/workshops/dc413216-deab-4371-9e4a-879a4f14233d/en-US/4-improve-existing-architecture/task1-apigwauth#1.1-enable-api-gateway-authorization-with-aws-iam)
3. Create an assumable IAM role
   1. https://docs.aws.amazon.com/apigateway/latest/developerguide/integrating-api-with-aws-services-lambda.html#api-as-lambda-proxy-setup-iam-role-policies
   2. Add an AWS trust relationship, replacing the following your required `Principal` `ARN`

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "",
            "Effect": "Allow",
            "Principal": {
                "Service": [
                    "apigateway.amazonaws.com",
                    "lambda.amazonaws.com"
                ],
                "AWS": "arn:aws:iam::123456789123:user/you"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
```

We will update our API Gateways resource policy to allow access

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::<ACC_ID>:role/lambda_invoke_function_assume_apigw_role"
            },
            "Action": "execute-api:Invoke",
            "Resource": "arn:aws:execute-api:eu-west-2:<ACC_ID>:iv5q8tg1h5/*/*/*"
        }
    ]
}
```

5. This should allow you to run a command to generate temporary credentials used to access our API. 
   1. `aws sts assume-role --role-arn arn:aws:iam::<YOUR_ACC_ID>:role/lambda_invoke_function_assume_apigw_role --role-session-name api-gw-access`
   2. `verify.sh` will run this for you, requiring you to set `ROLE_ARN` for the `lambda_invoke_function_assume_apigw_role`


## Pre-Reqs locally

1. export the following variables to your shell
   1. PACT_PROVIDER_URL
      1. The URL of your deployed gateway eg `https://iv5q8tg1h5.execute-api.eu-west-2.amazonaws.com/dev`
   2. PACT_BROKER_BASE_URL
   3. PACT_BROKER_TOKEN
      1. if using a PactFlow Broker
   4. PACT_BROKER_USERNAME
      1. if using a Pact Broker
   5. PACT_BROKER_PASSWORD
      1. if using a Pact Broker
   6. AWS_ACCESS_KEY_ID
   7. AWS_SECRET_ACCESS_KEY

## JavaScript

1. Navigate to the `./javascript` folder
   1. `npm install`
   2. `npm run test:consumer`
   3. `npm run publish:pacts`
   4. Verifying the provider
      1. export `ROLE_ARN`
      2. Run `.verify.sh`
         1. This will set your temporary AWS credentials to your shell and then call `npm run test:provider`