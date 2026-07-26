# Public clipboard fixtures

Hand-authored, synthetic Unreal clipboard fragments used by the public test suite.

They contain artificial identifiers, asset paths, values, and Custom HLSL. Each fixture
isolates one parser or semantic contract; none is copied from the private `samples/`
corpus. The private corpus remains a broader local integration check.

| Fixture | Contract |
| --- | --- |
| `material-root-all-outputs` | Material Root output discovery and `All outputs` |
| `function-call-root` + `function-definition` | stable function IDs and helper generation |
| `static-switch` | serialized Static Bool branch selection |
| `named-reroute` | declaration/usage reconstruction |
| `convert-swizzle` | dynamic Convert metadata and component swizzle |
| `custom-chain` | default Custom output type propagation |
| `truncated-object` | bounded structural parser error |
