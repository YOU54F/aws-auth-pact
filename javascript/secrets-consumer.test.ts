import axios from "axios";
import { aws4Interceptor } from "aws4-axios";
const interceptor = aws4Interceptor({
  region: "eu-west-2",
  service: "execute-api",
});

axios.interceptors.request.use(interceptor);
const defaultBaseUrl = "http://your-api.example.com";

interface Pet {
  id: number;
  type: string;
  price: number;
}
interface RequestError {
  error: string;
}
const api = (baseUrl = defaultBaseUrl) => ({
  getPets: () =>
    axios
      .post(baseUrl + "/pets")
      .then((response: { data: Pet[] | { error: string } }) => response.data)
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
  consumer: "secrets-consumer",
  provider: "secrets-provider",
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
  it("should be able to retrieve all pets when authenticated", () => {
    const apiPath = "/pets";
    const expectedStatusCode = 200;
    const expectedResponseBody = [
      {
        id: 1,
        type: "dog",
        price: 249.99,
      },
      {
        id: 2,
        type: "cat",
        price: 124.99,
      },
      {
        id: 3,
        type: "fish",
        price: 0.99,
      },
    ];

    provider
      .given("I post credentials token")
      .uponReceiving("A Request for storing credentials")
      .withRequest({
        method: "POST",
        path: apiPath,
        headers: {
          Host: like("127.0.0.1:55715"),
          "X-Amz-Date": like("bar"),
          Authorization: [
            like(
              "AWS4-HMAC-SHA256 Credential=FOOBAR/20230224/eu-west-2/execute-api/aws4_request"
            ),
            like(
              "SignedHeaders=host;x-amz-date"
            ),
            like(
              "Signature=e4a49d954be3e0beadfb1577b317e511e1a0864a57d828c6812e2035ee755ad8"
            ),
          ],
        },
      })
      .willRespondWith({
        status: expectedStatusCode,
        body: expectedResponseBody,
      });
    return provider.executeTest((mockserver) => {
      const client = api(mockserver.url);
      return client.getPets().then((response: Pet[] | RequestError) => {
        expect(response).toEqual(expectedResponseBody);
      });
    });
  });
});
