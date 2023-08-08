import axios from "axios";
import { aws4Interceptor } from "aws4-axios";
const interceptor = aws4Interceptor({
  region: "eu-west-1",
  service: "execute-api",
});

axios.interceptors.request.use(interceptor);
const defaultBaseUrl = "http://your-api.example.com";

interface Token {
  id: string;
  details: string;
}
interface RequestError {
  error: string;
}
const api = (baseUrl = defaultBaseUrl) => ({
  postToken: (data:string) =>
    axios
      .post(baseUrl + "/", {details: data})
      .then((response: { data: Token | { error: string } }) => response.data)
      .catch((error) => {
        if (
          error.response.data.message === "Missing Authentication Token" ||
          error.code === "403"
        ) {
          return { error: "Unauthorized." };
        } else {
          console.log(error);
          return { error: error.response?.data.message ?? "An error occurred" };
        }
      }),
  /* other endpoints here */
});

import { PactV3, MatchersV3 } from "@pact-foundation/pact";

const provider = new PactV3({
  consumer: "post-secrets-proxy-api-secret-store",
  provider: "post-secrets-secret-store-proxy-api",
});

const {
  eachLike,
  atLeastLike,
  integer,
  datetime,
  boolean,
  string,
  regex,
  like,
  eachKeyLike,
} = MatchersV3;

describe("aws signed gateway test", () => {
  it("should be able to store creds", () => {
    const apiPath = "/";
    const expectedStatusCode = 201;
    const details = "AQICAHgfObFEEgKhfV7w69GBqVV2nG64WMK4O2h6CBt0qrbnJQGkOo9R3aoSX2MWItcSCLBzAAAAcDBuBgkqhkiG9w0BBwagYTBfAgEAMFoGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMcJp6YEAQwlPXRuyLAgEQgC37w7Su/AmWOZXhaYymUxhXVUI8bq2VxOySQiGbCSbKVO507QF5GOR46ug5j+M="
    const expectedResponseBody = {
      id: "c08b1650-f6d6-440f-90d5-3e901534a90e",
      details
    }

    provider
      .given("I post credentials token")
      .uponReceiving("A Request for storing credentials")
      .withRequest({
        method: "POST",
        path: apiPath,
        body: {
          "details":  MatchersV3.like(details)
        },
        headers: {
          'content-type': 'application/json',
          'host': MatchersV3.string(),
          authorization: [
            like(
              "AWS4-HMAC-SHA256 Credential=FOOBAR/20230224/eu-west-2/execute-api/aws4_request"
            ),
            like(
              "SignedHeaders=content-length;content-type;host;x-amz-date;x-amz-security-token"
            ),
            like(
              "Signature=65406528656037c6a3642f9408a01638869635752815b452450f03803a7923b7"
            ),
          ],
        },
      })
      .willRespondWith({
        status: expectedStatusCode,
        body: {
          id: MatchersV3.like("c08b1650-f6d6-440f-90d5-3e901534a90e"),
          details: MatchersV3.like("AQICAHgfObFEEgKhfV7w69GBqVV2nG64WMK4O2h6CBt0qrbnJQGkOo9R3aoSX2MWItcSCLBzAAAAcDBuBgkqhkiG9w0BBwagYTBfAgEAMFoGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMcJp6YEAQwlPXRuyLAgEQgC37w7Su/AmWOZXhaYymUxhXVUI8bq2VxOySQiGbCSbKVO507QF5GOR46ug5j+M=")
        },
      });
    return provider.executeTest((mockserver) => {
      const client = api(mockserver.url);
      return client.postToken(details).then((response: Token | RequestError) => {
        expect(response).toEqual(expectedResponseBody);
      });
    });
  });
});
