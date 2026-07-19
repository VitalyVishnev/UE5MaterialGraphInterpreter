\# Material Semantic Extractor



This folder contains a reproducible Unreal Editor commandlet design for collecting semantic metadata for material expressions and material functions without parsing `.uasset` bytes.  The implementation uses Unreal reflection, `AssetRegistry`, `UMaterialFunctionInterface`, `UMaterialExpression`, `FExpressionInput`, `FExpressionOutput`, and optional compile probes through the material compiler.



\## Run command



Build or place the commandlet in an Editor module, then run from the installed UE root:



```bash

UnrealEditor-Cmd.exe <AnyProject>.uproject -run=MaterialSemanticExtractor -IncludeEnginePlugins -Output=<repo>/Tools/MaterialSemanticExtractor/Output/material\_semantics.json -unattended -nop4

```



On Linux:



```bash

./Engine/Binaries/Linux/UnrealEditor-Cmd <AnyProject>.uproject -run=MaterialSemanticExtractor -IncludeEnginePlugins -Output=/workspace/UnrealEngine/Tools/MaterialSemanticExtractor/Output/material\_semantics.json -unattended -nop4

```



The commandlet intentionally loads assets through Unreal packages and the asset registry. It never decodes `.uasset` files as an unknown binary format.



