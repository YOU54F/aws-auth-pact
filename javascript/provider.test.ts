import { Verifier } from '@pact-foundation/pact';
import { VerifierOptions } from '@pact-foundation/pact/src/dsl/verifier/types';
import * as aws4 from 'aws4';
import * as cp from 'child_process';

describe('Verify AWS signed provider', () => {
  let revision: string;
  let branch: string;
  let publishResultsFlag: boolean = false;

  const providerBaseUrl =
    process.env.PACT_PROVIDER_URL ?? 'https://petstore.swagger.io';

  try {
    revision = cp
      .execSync('git rev-parse HEAD', { stdio: 'pipe' })
      .toString()
      .trim();
  } catch (Error) {
    throw new TypeError(
      "Couldn't find a git commit hash, is this a git directory?"
    );
  }

  try {
    branch = cp
      .execSync('git rev-parse --abbrev-ref HEAD', { stdio: 'pipe' })
      .toString()
      .trim();
  } catch (Error) {
    throw new TypeError("Couldn't find a git branch, is this a git directory?");
  }

  const providerVersion = revision;

  if (
    process.env.PACT_PUBLISH_VERIFICATION &&
    process.env.PACT_PUBLISH_VERIFICATION === 'true'
  ) {
    publishResultsFlag = true;
  }
  let setAuth: boolean;

  const opts: VerifierOptions = {
    stateHandlers: {
      'Is authenticated': async () => {
        setAuth = true;
        return Promise.resolve({
          description: 'AWS setAuth flag set'
        });
      },
      'Is not authenticated': async () => {
        setAuth = false;
        return Promise.resolve({
          description: 'AWS setAuth flag unset'
        });
      }
    },
    requestFilter: (req, res, next) => {
      if (setAuth) {
        console.log('setting auth overrides for AWS', {
          path: req.path,
          method: req.method
        });
        const requestUrl = providerBaseUrl;
        const host = new URL(requestUrl).host;
        const apiroute = new URL(requestUrl).pathname;
        let options: aws4.Request = {
          host,
          path: apiroute + req.path,
          headers: {}
        };
        if (req.method === 'POST') {
          options = {
            ...options,
            body: JSON.stringify(req.body),
            headers: { 'Content-Type': 'application/json' }
          };
        }
        aws4.sign(options, {
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          accessKeyId: process.env.AWS_ACCESS_KEY_ID
          // // The following is required if using AWS STS to assume a role
          // sessionToken: process.env.AWS_SESSION_TOKEN
        });
        const authHeaders = options.headers;
        console.log(authHeaders)
        req.headers['Host'] =
          authHeaders && authHeaders['Host']
            ? authHeaders['Host'].toString()
            : '';
        req.headers['X-Amz-Date'] =
          authHeaders && authHeaders['X-Amz-Date']
            ? authHeaders['X-Amz-Date'].toString()
            : '';
        req.headers['Authorization'] =
          authHeaders && authHeaders['Authorization']
            ? authHeaders['Authorization'].toString()
            : '';

        // // The following is required if using AWS STS to assume a role
        // req.headers['X-Amz-Security-Token'] =
        //   authHeaders && authHeaders['X-Amz-Security-Token']
        //     ? authHeaders['X-Amz-Security-Token'].toString()
        //     : '';
        setAuth = false;
      }

      next();
    },
    provider: process.env.PACT_PROVIDER_NAME ?? 'aws-provider', // where your service will be running during the test, either staging or localhost on CI
    providerBaseUrl: providerBaseUrl, // where your service will be running during the test, either staging or localhost on CI
    pactBrokerUrl: process.env.PACT_BROKER_BASE_URL,
    publishVerificationResult: publishResultsFlag || false, // ONLY SET THIS TRUE IN CI!
    validateSSL: true,
    changeOrigin: true,
    providerVersion, // the application version of the provider
    pactBrokerToken: process.env.PACT_BROKER_TOKEN,
    providerVersionBranch: branch,
    logLevel: 'error',
    consumerVersionSelectors: [
      { mainBranch: true },
      { deployedOrReleased: true }
    ]
  };

  it('should verify the provider ', async () => {
    return await new Verifier(opts)
      .verifyProvider()
  });
});
