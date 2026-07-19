// Reproducible extractor skeleton for an Editor commandlet/module.
// Register UMaterialSemanticExtractorCommandlet in an Editor-only module and run with -run=MaterialSemanticExtractor.

#include "Commandlets/Commandlet.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "Dom/JsonObject.h"
#include "Misc/App.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "Materials/MaterialExpression.h"
#include "Materials/MaterialExpressionFunctionInput.h"
#include "Materials/MaterialExpressionFunctionOutput.h"
#include "Materials/MaterialExpressionMaterialFunctionCall.h"
#include "Materials/MaterialFunction.h"
#include "Materials/MaterialValueType.h"

#include "MaterialSemanticExtractorCommandlet.generated.h"

UCLASS()
class UMaterialSemanticExtractorCommandlet final : public UCommandlet
{
	GENERATED_BODY()
public:
	virtual int32 Main(const FString& Params) override;
};

static FString NormalizeMaterialType(EMaterialValueType Type)
{
	switch (Type)
	{
	case MCT_Float1: case MCT_Float: return TEXT("float");
	case MCT_Float2: return TEXT("float2");
	case MCT_Float3: return TEXT("float3");
	case MCT_Float4: return TEXT("float4");
	case MCT_Bool: return TEXT("bool");
	case MCT_StaticBool: return TEXT("static-bool");
	case MCT_Texture2D: return TEXT("texture2d");
	case MCT_TextureCube: return TEXT("texture-cube");
	case MCT_MaterialAttributes: return TEXT("material-attributes");
	default: return TEXT("unknown");
	}
}

static FString EnumMaterialType(EMaterialValueType Type)
{
	return FString::Printf(TEXT("0x%llx"), (uint64)Type);
}

int32 UMaterialSemanticExtractorCommandlet::Main(const FString& Params)
{
	FString OutputPath;
	FParse::Value(*Params, TEXT("Output="), OutputPath);
	if (OutputPath.IsEmpty())
	{
		OutputPath = FPaths::ProjectSavedDir() / TEXT("MaterialSemantics.json");
	}

	TSharedRef<FJsonObject> Root = MakeShared<FJsonObject>();
	Root->SetNumberField(TEXT("schemaVersion"), 1);
	TSharedRef<FJsonObject> Engine = MakeShared<FJsonObject>();
	Engine->SetStringField(TEXT("version"), FApp::GetBuildVersion());
	Engine->SetStringField(TEXT("branch"), FApp::GetBranchName());
	Engine->SetStringField(TEXT("commit"), FApp::GetEngineIsPromotedBuild() ? TEXT("promoted") : TEXT("local/non-promoted"));
	Root->SetObjectField(TEXT("engine"), Engine);

	TArray<TSharedPtr<FJsonValue>> ExpressionArray;
	for (TObjectIterator<UClass> It; It; ++It)
	{
		UClass* Class = *It;
		if (!Class->IsChildOf(UMaterialExpression::StaticClass()) || Class->HasAnyClassFlags(CLASS_Abstract | CLASS_Deprecated | CLASS_NewerVersionExists))
		{
			continue;
		}
		UMaterialExpression* CDO = Cast<UMaterialExpression>(Class->GetDefaultObject());
		TSharedRef<FJsonObject> Node = MakeShared<FJsonObject>();
		Node->SetStringField(TEXT("class"), Class->GetName());
		TArray<FString> Captions; CDO->GetCaption(Captions);
		Node->SetStringField(TEXT("displayName"), FString::Join(Captions, TEXT(" ")));
		TArray<TSharedPtr<FJsonValue>> Outputs;
		const TArray<FExpressionOutput>& ExprOutputs = CDO->GetOutputs();
		for (int32 Index = 0; Index < ExprOutputs.Num(); ++Index)
		{
			EMaterialValueType Type = CDO->GetOutputValueType(Index);
			TSharedRef<FJsonObject> Out = MakeShared<FJsonObject>();
			Out->SetStringField(TEXT("name"), ExprOutputs[Index].OutputName.ToString());
			Out->SetStringField(TEXT("unrealEnumValue"), EnumMaterialType(Type));
			Out->SetStringField(TEXT("normalizedType"), NormalizeMaterialType(Type));
			Outputs.Add(MakeShared<FJsonValueObject>(Out));
		}
		Node->SetArrayField(TEXT("outputs"), Outputs);
		ExpressionArray.Add(MakeShared<FJsonValueObject>(Node));
	}
	Root->SetArrayField(TEXT("materialExpressions"), ExpressionArray);

	TArray<TSharedPtr<FJsonValue>> FunctionArray;
	FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>(TEXT("AssetRegistry"));
	TArray<FAssetData> Functions;
	AssetRegistryModule.Get().GetAssetsByClass(UMaterialFunctionInterface::StaticClass()->GetClassPathName(), Functions, true);
	for (const FAssetData& Asset : Functions)
	{
		if (!Asset.PackageName.ToString().StartsWith(TEXT("/Engine/")))
		{
			continue;
		}
		UMaterialFunctionInterface* Function = Cast<UMaterialFunctionInterface>(Asset.GetAsset());
		if (!Function) { continue; }
		Function->UpdateFromFunctionResource();
		TArray<FFunctionExpressionInput> Inputs;
		TArray<FFunctionExpressionOutput> Outputs;
		Function->GetInputsAndOutputs(Inputs, Outputs);
		TSharedRef<FJsonObject> Fn = MakeShared<FJsonObject>();
		Fn->SetStringField(TEXT("assetPath"), Asset.GetObjectPathString());
		Fn->SetStringField(TEXT("name"), Asset.AssetName.ToString());
		// Full implementation serializes InputName, InputType, preview/default flags, SortPriority, OutputName, dependencies, and compile-probed type chunks.
		FunctionArray.Add(MakeShared<FJsonValueObject>(Fn));
	}
	Root->SetArrayField(TEXT("materialFunctions"), FunctionArray);

	FString Json;
	TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Json);
	FJsonSerializer::Serialize(Root, Writer);
	return FFileHelper::SaveStringToFile(Json, *OutputPath) ? 0 : 1;
}
