/**
 * @generated SignedSource<<2391100b888de9f58bfffd1c26a2e3ba>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type QueueStatusInput = {
  sessionId: string;
};
export type SAM2ModelGetQueueStatusMutation$variables = {
  input: QueueStatusInput;
};
export type SAM2ModelGetQueueStatusMutation$data = {
  readonly getQueueStatus: {
    readonly position: number;
    readonly sessionId: string;
  };
};
export type SAM2ModelGetQueueStatusMutation = {
  response: SAM2ModelGetQueueStatusMutation$data;
  variables: SAM2ModelGetQueueStatusMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "GetQueueStatus",
    "kind": "LinkedField",
    "name": "getQueueStatus",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "sessionId",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "position",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SAM2ModelGetQueueStatusMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SAM2ModelGetQueueStatusMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "ef55dfa6c4f56236fa5e180e728733b6",
    "id": null,
    "metadata": {},
    "name": "SAM2ModelGetQueueStatusMutation",
    "operationKind": "mutation",
    "text": "mutation SAM2ModelGetQueueStatusMutation(\n  $input: QueueStatusInput!\n) {\n  getQueueStatus(input: $input) {\n    sessionId\n    position\n  }\n}\n"
  }
};
})();

(node as any).hash = "a1a09190d08a15e7983b6b07583af9a1";

export default node;
