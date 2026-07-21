using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Linq;
using Microsoft.Office.Core;
using Microsoft.Office.Interop.PowerPoint;

namespace RoughPptAddin.Services;

public sealed class PaperStructurePresetService
{
	private sealed class PresetContext
	{
		public Slide Slide { get; set; }

		public string PresetId { get; set; }

		public float Left { get; set; }

		public float Top { get; set; }

		public float Width { get; set; }

		public float Height { get; set; }

		public List<Microsoft.Office.Interop.PowerPoint.Shape> Shapes { get; } = new List<Microsoft.Office.Interop.PowerPoint.Shape>();
	}

	private struct ColorParts(int r, int g, int b)
	{
		public int R { get; } = r;

		public int G { get; } = g;

		public int B { get; } = b;
	}

	public const string PresetTag = "ROUGH_PAPER_STRUCTURE_PRESET";

	public const string PresetTitleTag = "ROUGH_PAPER_STRUCTURE_TITLE";

	public Microsoft.Office.Interop.PowerPoint.Shape Insert(Slide slide, string presetId)
	{
		if (slide == null)
		{
			throw new InvalidOperationException("当前没有可用幻灯片。");
		}
		string id = NormalizePresetId(presetId);
		SizeF size = PresetSize(id);
		PresetContext ctx = CreateContext(slide, id, size.Width, size.Height);
		switch (id)
		{
		case "transformerEncoder":
			BuildTransformerEncoder(ctx);
			break;
		case "encoderDecoder":
			BuildEncoderDecoder(ctx);
			break;
		case "visionTransformer":
			BuildVisionTransformer(ctx);
			break;
		case "contrastiveDualTower":
			BuildContrastiveDualTower(ctx);
			break;
		case "multimodalFusion":
			BuildMultimodalFusion(ctx);
			break;
		case "medicalImageReport":
			BuildMedicalImageReport(ctx);
			break;
		case "unetSegmentation":
			BuildUnetSegmentation(ctx);
			break;
		case "classificationDiagnosis":
			BuildClassificationDiagnosis(ctx);
			break;
		case "largeModelRag":
			BuildLargeModelRag(ctx);
			break;
		case "clinicalValidation":
			BuildClinicalValidation(ctx);
			break;
		case "medicalTriModalDiagnosis":
			BuildMedicalTriModalDiagnosis(ctx);
			break;
		case "medicalVlmReportDiagnosis":
			BuildMedicalVlmReportDiagnosis(ctx);
			break;
		case "tabularClinicalBranch":
			BuildTabularClinicalBranch(ctx);
			break;
		case "crossModalAttentionFusion":
			BuildCrossModalAttentionFusion(ctx);
			break;
		case "llmAdapterFineTune":
			BuildLlmAdapterFineTune(ctx);
			break;
		case "diagnosisEvaluationPanel":
			BuildDiagnosisEvaluationPanel(ctx);
			break;
		case "transformerDecoderBlock":
			BuildTransformerDecoderBlock(ctx);
			break;
		case "blip2QformerBridge":
			BuildBlip2QformerBridge(ctx);
			break;
		case "medicalInstructionVlm":
			BuildMedicalInstructionVlm(ctx);
			break;
		case "medclipSemanticMatching":
			BuildMedclipSemanticMatching(ctx);
			break;
		case "selfSupervisedMaePretrain":
			BuildSelfSupervisedMaePretrain(ctx);
			break;
		case "multimodalRagReportTable":
			BuildMultimodalRagReportTable(ctx);
			break;
		case "swinUnetr3DSegmentation":
			BuildSwinUnetr3DSegmentation(ctx);
			break;
		case "tabTransformerRisk":
			BuildTabTransformerRisk(ctx);
			break;
		case "clinicalDeploymentMonitoring":
			BuildClinicalDeploymentMonitoring(ctx);
			break;
		case "federatedLearningMedical":
			BuildFederatedLearningMedical(ctx);
			break;
		case "diffusionAugmentation":
			BuildDiffusionAugmentation(ctx);
			break;
		case "survivalOutcomePrediction":
			BuildSurvivalOutcomePrediction(ctx);
			break;
		case "activeLearningAnnotation":
			BuildActiveLearningAnnotation(ctx);
			break;
		case "moeExpertRouting":
			BuildMoeExpertRouting(ctx);
			break;
		case "longitudinalFollowupDiagnosis":
			BuildLongitudinalFollowupDiagnosis(ctx);
			break;
		case "weaklySupervisedMil":
			BuildWeaklySupervisedMil(ctx);
			break;
		case "medicalKnowledgeGraphReasoning":
			BuildMedicalKnowledgeGraphReasoning(ctx);
			break;
		case "teacherStudentDistillation":
			BuildTeacherStudentDistillation(ctx);
			break;
		case "foundationPromptTuning":
			BuildFoundationPromptTuning(ctx);
			break;
		default:
			BuildMultimodalFusion(ctx);
			break;
		}
		AddFooter(ctx, "通用示意，非复刻单篇论文图。所有元素均为 PPT 原生对象，可取消组合后编辑。");
		return Group(ctx, PresetTitle(id));
	}

	public static string PresetTitle(string presetId)
	{
		return NormalizePresetId(presetId) switch
		{
			"transformerEncoder" => "Transformer 编码器", 
			"encoderDecoder" => "编码器-解码器", 
			"visionTransformer" => "视觉编码器", 
			"contrastiveDualTower" => "图文对比双塔", 
			"multimodalFusion" => "多模态融合", 
			"medicalImageReport" => "医学图像-报告流程", 
			"unetSegmentation" => "医学分割流程", 
			"classificationDiagnosis" => "分类诊断头", 
			"largeModelRag" => "大模型诊断 RAG", 
			"clinicalValidation" => "临床验证流程", 
			"medicalTriModalDiagnosis" => "三模态医学诊断", 
			"medicalVlmReportDiagnosis" => "医学 VLM 报告诊断", 
			"tabularClinicalBranch" => "表格临床分支", 
			"crossModalAttentionFusion" => "跨模态注意力融合", 
			"llmAdapterFineTune" => "LLM Adapter 微调", 
			"diagnosisEvaluationPanel" => "诊断评估面板", 
			"transformerDecoderBlock" => "Transformer 解码器块", 
			"blip2QformerBridge" => "Q-Former VLM 桥接", 
			"medicalInstructionVlm" => "医学指令 VLM", 
			"medclipSemanticMatching" => "MedCLIP 语义匹配", 
			"selfSupervisedMaePretrain" => "自监督预训练", 
			"multimodalRagReportTable" => "报告表格 RAG", 
			"swinUnetr3DSegmentation" => "3D Swin UNETR 分割", 
			"tabTransformerRisk" => "表格 Transformer 风险", 
			"clinicalDeploymentMonitoring" => "临床部署监测", 
			"federatedLearningMedical" => "多中心联邦学习", 
			"diffusionAugmentation" => "医学扩散增强", 
			"survivalOutcomePrediction" => "生存预后预测", 
			"activeLearningAnnotation" => "主动学习标注", 
			"moeExpertRouting" => "MoE 专家路由", 
			"longitudinalFollowupDiagnosis" => "纵向随访诊断", 
			"weaklySupervisedMil" => "弱监督 MIL", 
			"medicalKnowledgeGraphReasoning" => "医学知识图谱推理", 
			"teacherStudentDistillation" => "教师学生蒸馏", 
			"foundationPromptTuning" => "医学基础模型提示调优", 
			_ => "多模态融合", 
		};
	}

	public static string NormalizePresetId(string presetId)
	{
		switch ((presetId ?? string.Empty).Trim())
		{
		case "paperPresetTransformerEncoder":
			return "transformerEncoder";
		case "paperPresetEncoderDecoder":
			return "encoderDecoder";
		case "paperPresetVisionTransformer":
			return "visionTransformer";
		case "paperPresetContrastiveDualTower":
			return "contrastiveDualTower";
		case "paperPresetMultimodalFusion":
			return "multimodalFusion";
		case "paperPresetMedicalImageReport":
			return "medicalImageReport";
		case "paperPresetUnetSegmentation":
			return "unetSegmentation";
		case "paperPresetClassificationDiagnosis":
			return "classificationDiagnosis";
		case "paperPresetLargeModelRag":
			return "largeModelRag";
		case "paperPresetClinicalValidation":
			return "clinicalValidation";
		case "paperPresetMedicalTriModalDiagnosis":
			return "medicalTriModalDiagnosis";
		case "paperPresetMedicalVlmReportDiagnosis":
			return "medicalVlmReportDiagnosis";
		case "paperPresetTabularClinicalBranch":
			return "tabularClinicalBranch";
		case "paperPresetCrossModalAttentionFusion":
			return "crossModalAttentionFusion";
		case "paperPresetLlmAdapterFineTune":
			return "llmAdapterFineTune";
		case "paperPresetDiagnosisEvaluationPanel":
			return "diagnosisEvaluationPanel";
		case "paperPresetTransformerDecoderBlock":
			return "transformerDecoderBlock";
		case "paperPresetBlip2QformerBridge":
			return "blip2QformerBridge";
		case "paperPresetMedicalInstructionVlm":
			return "medicalInstructionVlm";
		case "paperPresetMedclipSemanticMatching":
			return "medclipSemanticMatching";
		case "paperPresetSelfSupervisedMaePretrain":
			return "selfSupervisedMaePretrain";
		case "paperPresetMultimodalRagReportTable":
			return "multimodalRagReportTable";
		case "paperPresetSwinUnetr3DSegmentation":
			return "swinUnetr3DSegmentation";
		case "paperPresetTabTransformerRisk":
			return "tabTransformerRisk";
		case "paperPresetClinicalDeploymentMonitoring":
			return "clinicalDeploymentMonitoring";
		case "paperPresetFederatedLearningMedical":
			return "federatedLearningMedical";
		case "paperPresetDiffusionAugmentation":
			return "diffusionAugmentation";
		case "paperPresetSurvivalOutcomePrediction":
			return "survivalOutcomePrediction";
		case "paperPresetActiveLearningAnnotation":
			return "activeLearningAnnotation";
		case "paperPresetMoeExpertRouting":
			return "moeExpertRouting";
		case "paperPresetLongitudinalFollowupDiagnosis":
			return "longitudinalFollowupDiagnosis";
		case "paperPresetWeaklySupervisedMil":
			return "weaklySupervisedMil";
		case "paperPresetMedicalKnowledgeGraphReasoning":
			return "medicalKnowledgeGraphReasoning";
		case "paperPresetTeacherStudentDistillation":
			return "teacherStudentDistillation";
		case "paperPresetFoundationPromptTuning":
			return "foundationPromptTuning";
		case "longitudinalFollowupDiagnosis":
		case "medicalVlmReportDiagnosis":
		case "crossModalAttentionFusion":
		case "selfSupervisedMaePretrain":
		case "survivalOutcomePrediction":
		case "clinicalDeploymentMonitoring":
		case "medicalTriModalDiagnosis":
		case "diagnosisEvaluationPanel":
		case "multimodalRagReportTable":
		case "federatedLearningMedical":
		case "activeLearningAnnotation":
		case "medicalKnowledgeGraphReasoning":
		case "clinicalValidation":
		case "tabTransformerRisk":
		case "transformerEncoder":
		case "blip2QformerBridge":
		case "medicalImageReport":
		case "llmAdapterFineTune":
		case "unetSegmentation":
		case "moeExpertRouting":
		case "multimodalFusion":
		case "swinUnetr3DSegmentation":
		case "transformerDecoderBlock":
		case "classificationDiagnosis":
		case "medclipSemanticMatching":
		case "diffusionAugmentation":
		case "medicalInstructionVlm":
		case "tabularClinicalBranch":
		case "encoderDecoder":
		case "visionTransformer":
		case "contrastiveDualTower":
		case "largeModelRag":
		case "weaklySupervisedMil":
		case "teacherStudentDistillation":
		case "foundationPromptTuning":
			return presetId.Trim();
		default:
			return "multimodalFusion";
		}
	}

	private static void BuildTransformerEncoder(PresetContext ctx)
	{
		AddTitle(ctx, "通用 Transformer 编码器");
		AddNode(ctx, 18f, 70f, 84f, 44f, "输入\nToken / Patch", "#f7fbff", "#111111");
		AddArrow(ctx, 102f, 92f, 132f, 92f);
		AddNode(ctx, 132f, 70f, 78f, 44f, "嵌入\n+ 位置", "#e9f2ff", "#2b5f9c");
		AddArrow(ctx, 210f, 92f, 238f, 92f);
		AddFrame(ctx, 238f, 42f, 250f, 126f, "N 层编码器堆叠");
		AddNode(ctx, 260f, 66f, 84f, 38f, "多头\n自注意力", "#fff7df", "#8b6f1d");
		AddNode(ctx, 260f, 118f, 84f, 34f, "残差\n归一化", "#f8f8f8", "#555555");
		AddNode(ctx, 382f, 66f, 84f, 38f, "前馈\n网络", "#f1f8e9", "#3c7d31");
		AddNode(ctx, 382f, 118f, 84f, 34f, "残差\n归一化", "#f8f8f8", "#555555");
		AddArrow(ctx, 344f, 85f, 382f, 85f);
		AddArrow(ctx, 344f, 134f, 382f, 134f, "#555555", arrow: false);
		AddArrow(ctx, 488f, 105f, 530f, 105f);
		AddNode(ctx, 530f, 78f, 92f, 54f, "上下文\n特征", "#e8f7ef", "#2e7d55");
	}

	private static void BuildEncoderDecoder(PresetContext ctx)
	{
		AddTitle(ctx, "编码器-解码器通用结构");
		AddNode(ctx, 18f, 82f, 86f, 48f, "输入数据\n图像/文本/表格", "#f8fbff", "#111111");
		AddArrow(ctx, 104f, 106f, 142f, 106f);
		AddStack(ctx, 142f, 58f, 108f, 96f, "编码器\n抽取表示", "#dbeafe", "#2563eb");
		AddArrow(ctx, 250f, 106f, 296f, 106f);
		AddNode(ctx, 296f, 76f, 92f, 60f, "潜变量\n共享空间", "#fff7df", "#8b6f1d", MsoAutoShapeType.msoShapeHexagon);
		AddArrow(ctx, 388f, 106f, 434f, 106f);
		AddStack(ctx, 434f, 58f, 108f, 96f, "解码器\n生成输出", "#f0fdf4", "#2f855a");
		AddArrow(ctx, 542f, 106f, 584f, 106f);
		AddNode(ctx, 584f, 82f, 88f, 48f, "输出\n标签/报告/掩膜", "#fff1f2", "#b4233c");
		AddArrow(ctx, 202f, 154f, 488f, 154f, "#777777", arrow: false, dashed: true);
		AddText(ctx, 318f, 160f, 120f, 22f, "跳连 / 条件输入", 8f, "#666666");
	}

	private static void BuildVisionTransformer(PresetContext ctx)
	{
		AddTitle(ctx, "视觉编码器 / ViT 通用示意");
		AddNode(ctx, 18f, 78f, 82f, 64f, "医学\n图像", "#eef8ff", "#195a9a", MsoAutoShapeType.msoShapeRectangle);
		AddPatchGrid(ctx, 118f, 70f, 4, 4, 16f, "#f4f8ff", "#6aa6ff");
		AddText(ctx, 110f, 142f, 92f, 20f, "Patch 切分", 8f, "#555555");
		AddArrow(ctx, 186f, 102f, 228f, 102f);
		AddNode(ctx, 228f, 78f, 92f, 48f, "Patch\n嵌入", "#e9f2ff", "#2b5f9c");
		AddArrow(ctx, 320f, 102f, 360f, 102f);
		AddFrame(ctx, 360f, 52f, 166f, 104f, "视觉编码器");
		AddNode(ctx, 382f, 78f, 54f, 48f, "注意力", "#fff7df", "#8b6f1d");
		AddNode(ctx, 450f, 78f, 54f, 48f, "MLP", "#f1f8e9", "#3c7d31");
		AddArrow(ctx, 526f, 102f, 566f, 102f);
		AddNode(ctx, 566f, 78f, 84f, 48f, "CLS / 池化\n分类", "#fff1f2", "#b4233c");
	}

	private static void BuildContrastiveDualTower(PresetContext ctx)
	{
		AddTitle(ctx, "图文对比学习双塔");
		AddFrame(ctx, 22f, 50f, 250f, 74f, "图像塔");
		AddNode(ctx, 42f, 78f, 74f, 34f, "图像", "#eef8ff", "#195a9a");
		AddArrow(ctx, 116f, 95f, 150f, 95f);
		AddNode(ctx, 150f, 78f, 86f, 34f, "图像编码器", "#dbeafe", "#2563eb");
		AddFrame(ctx, 22f, 142f, 250f, 74f, "文本塔");
		AddNode(ctx, 42f, 170f, 74f, 34f, "报告文本", "#fff8e8", "#8b6f1d");
		AddArrow(ctx, 116f, 187f, 150f, 187f);
		AddNode(ctx, 150f, 170f, 86f, 34f, "文本编码器", "#fff7df", "#8b6f1d");
		AddArrow(ctx, 236f, 95f, 312f, 112f);
		AddArrow(ctx, 236f, 187f, 312f, 164f);
		AddNode(ctx, 312f, 92f, 84f, 34f, "投影头", "#f4f4f5", "#555555");
		AddNode(ctx, 312f, 150f, 84f, 34f, "投影头", "#f4f4f5", "#555555");
		AddArrow(ctx, 396f, 109f, 448f, 124f);
		AddArrow(ctx, 396f, 167f, 448f, 152f);
		AddPatchGrid(ctx, 448f, 94f, 4, 4, 17f, "#ffffff", "#d9e4ff");
		AddText(ctx, 442f, 166f, 98f, 20f, "相似度矩阵", 8f, "#555555");
		AddArrow(ctx, 526f, 136f, 574f, 136f);
		AddNode(ctx, 574f, 106f, 88f, 60f, "对比损失\n迁移诊断", "#f0fdf4", "#2f855a");
	}

	private static void BuildMultimodalFusion(PresetContext ctx)
	{
		AddTitle(ctx, "医学多模态融合总览");
		AddNode(ctx, 24f, 58f, 88f, 38f, "医学图像", "#eef8ff", "#195a9a");
		AddNode(ctx, 24f, 114f, 88f, 38f, "报告文本", "#fff8e8", "#8b6f1d");
		AddNode(ctx, 24f, 170f, 88f, 38f, "表格数据", "#f0fdf4", "#2f855a");
		AddNode(ctx, 154f, 58f, 92f, 38f, "视觉编码器", "#dbeafe", "#2563eb");
		AddNode(ctx, 154f, 114f, 92f, 38f, "文本编码器", "#fff7df", "#8b6f1d");
		AddNode(ctx, 154f, 170f, 92f, 38f, "表格编码器", "#dcfce7", "#2f855a");
		AddArrow(ctx, 112f, 77f, 154f, 77f);
		AddArrow(ctx, 112f, 133f, 154f, 133f);
		AddArrow(ctx, 112f, 189f, 154f, 189f);
		AddFrame(ctx, 286f, 70f, 152f, 128f, "跨模态融合");
		AddNode(ctx, 312f, 100f, 100f, 34f, "对齐 / 注意力", "#f4f4f5", "#555555");
		AddNode(ctx, 312f, 150f, 100f, 34f, "共享表示", "#fff7df", "#8b6f1d");
		AddArrow(ctx, 246f, 77f, 312f, 116f);
		AddArrow(ctx, 246f, 133f, 312f, 133f);
		AddArrow(ctx, 246f, 189f, 312f, 166f);
		AddArrow(ctx, 438f, 134f, 488f, 134f);
		AddNode(ctx, 488f, 90f, 88f, 38f, "分类头", "#fff1f2", "#b4233c");
		AddNode(ctx, 488f, 146f, 88f, 38f, "诊断头", "#fef2f2", "#b4233c");
		AddArrow(ctx, 576f, 109f, 626f, 109f);
		AddArrow(ctx, 576f, 165f, 626f, 165f);
		AddNode(ctx, 626f, 118f, 86f, 38f, "结果解释", "#f8fafc", "#334155");
	}

	private static void BuildMedicalImageReport(PresetContext ctx)
	{
		AddTitle(ctx, "医学图像-报告-诊断流程");
		AddNode(ctx, 18f, 84f, 80f, 54f, "影像输入\nCT / MRI / X光", "#eef8ff", "#195a9a");
		AddArrow(ctx, 98f, 111f, 140f, 111f);
		AddStack(ctx, 140f, 68f, 92f, 86f, "视觉特征\n编码", "#dbeafe", "#2563eb");
		AddArrow(ctx, 232f, 111f, 276f, 111f);
		AddNode(ctx, 276f, 76f, 96f, 70f, "病灶区域\nROI / 注意力", "#fff7df", "#8b6f1d");
		AddArrow(ctx, 372f, 111f, 418f, 90f);
		AddArrow(ctx, 372f, 111f, 418f, 132f);
		AddNode(ctx, 418f, 58f, 104f, 42f, "报告生成\n文本解码", "#fff8e8", "#8b6f1d");
		AddNode(ctx, 418f, 122f, 104f, 42f, "诊断输出\n分类 / 风险", "#fff1f2", "#b4233c");
		AddArrow(ctx, 522f, 79f, 574f, 96f);
		AddArrow(ctx, 522f, 143f, 574f, 126f);
		AddNode(ctx, 574f, 92f, 96f, 44f, "医生审阅\n结构化结论", "#f0fdf4", "#2f855a");
	}

	private static void BuildUnetSegmentation(PresetContext ctx)
	{
		AddTitle(ctx, "医学图像分割 / U-Net 通用结构");
		AddNode(ctx, 18f, 92f, 72f, 44f, "输入图像", "#eef8ff", "#195a9a");
		AddNode(ctx, 112f, 78f, 72f, 34f, "编码 1", "#dbeafe", "#2563eb");
		AddNode(ctx, 206f, 96f, 72f, 34f, "编码 2", "#bfdbfe", "#2563eb");
		AddNode(ctx, 300f, 118f, 74f, 38f, "瓶颈", "#fff7df", "#8b6f1d");
		AddNode(ctx, 394f, 96f, 72f, 34f, "解码 2", "#dcfce7", "#2f855a");
		AddNode(ctx, 488f, 78f, 72f, 34f, "解码 1", "#bbf7d0", "#2f855a");
		AddNode(ctx, 582f, 92f, 82f, 44f, "分割掩膜", "#fff1f2", "#b4233c");
		AddArrow(ctx, 90f, 114f, 112f, 95f);
		AddArrow(ctx, 184f, 95f, 206f, 113f);
		AddArrow(ctx, 278f, 113f, 300f, 137f);
		AddArrow(ctx, 374f, 137f, 394f, 113f);
		AddArrow(ctx, 466f, 113f, 488f, 95f);
		AddArrow(ctx, 560f, 95f, 582f, 114f);
		AddArrow(ctx, 148f, 78f, 526f, 78f, "#666666", arrow: false, dashed: true);
		AddArrow(ctx, 242f, 96f, 430f, 96f, "#666666", arrow: false, dashed: true);
		AddText(ctx, 282f, 66f, 118f, 20f, "跳跃连接", 8f, "#666666");
	}

	private static void BuildClassificationDiagnosis(PresetContext ctx)
	{
		AddTitle(ctx, "分类与诊断头");
		AddNode(ctx, 24f, 86f, 90f, 52f, "融合特征\n或编码特征", "#f0f7ff", "#195a9a");
		AddArrow(ctx, 114f, 112f, 154f, 112f);
		AddNode(ctx, 154f, 86f, 78f, 52f, "池化\nFlatten", "#f8fafc", "#334155");
		AddArrow(ctx, 232f, 112f, 274f, 112f);
		AddNode(ctx, 274f, 68f, 96f, 42f, "分类头\nLogits", "#fff1f2", "#b4233c");
		AddNode(ctx, 274f, 132f, 96f, 42f, "诊断头\n风险评分", "#fef2f2", "#b4233c");
		AddArrow(ctx, 370f, 89f, 424f, 100f);
		AddArrow(ctx, 370f, 153f, 424f, 130f);
		AddNode(ctx, 424f, 92f, 98f, 46f, "概率校准\n置信度", "#fff7df", "#8b6f1d");
		AddArrow(ctx, 522f, 115f, 574f, 115f);
		AddNode(ctx, 574f, 82f, 96f, 66f, "类别标签\n诊断结论\n解释提示", "#f0fdf4", "#2f855a");
	}

	private static void BuildLargeModelRag(PresetContext ctx)
	{
		AddTitle(ctx, "大模型诊断 / RAG 通用流程");
		AddNode(ctx, 22f, 62f, 86f, 38f, "影像特征", "#eef8ff", "#195a9a");
		AddNode(ctx, 22f, 118f, 86f, 38f, "报告文本", "#fff8e8", "#8b6f1d");
		AddNode(ctx, 22f, 174f, 86f, 38f, "表格变量", "#f0fdf4", "#2f855a");
		AddFrame(ctx, 150f, 64f, 120f, 132f, "检索增强");
		AddNode(ctx, 168f, 92f, 84f, 34f, "病例库", "#f8fafc", "#334155");
		AddNode(ctx, 168f, 146f, 84f, 34f, "医学知识", "#f8fafc", "#334155");
		AddArrow(ctx, 108f, 81f, 168f, 109f);
		AddArrow(ctx, 108f, 137f, 168f, 137f);
		AddArrow(ctx, 108f, 193f, 168f, 163f);
		AddArrow(ctx, 270f, 130f, 326f, 130f);
		AddNode(ctx, 326f, 88f, 116f, 84f, "多模态\n大模型", "#f4f4ff", "#4f46e5");
		AddArrow(ctx, 442f, 130f, 494f, 104f);
		AddArrow(ctx, 442f, 130f, 494f, 154f);
		AddNode(ctx, 494f, 74f, 118f, 42f, "诊断建议", "#fff1f2", "#b4233c");
		AddNode(ctx, 494f, 142f, 118f, 42f, "可解释报告", "#fff8e8", "#8b6f1d");
		AddNode(ctx, 632f, 108f, 78f, 44f, "人工复核", "#f0fdf4", "#2f855a");
		AddArrow(ctx, 612f, 95f, 632f, 124f);
		AddArrow(ctx, 612f, 163f, 632f, 136f);
	}

	private static void BuildClinicalValidation(PresetContext ctx)
	{
		AddTitle(ctx, "临床验证流程");
		AddFrame(ctx, 20f, 56f, 142f, 142f, "数据划分");
		AddNode(ctx, 42f, 82f, 92f, 28f, "训练队列", "#eef8ff", "#195a9a");
		AddNode(ctx, 42f, 120f, 92f, 28f, "内部验证", "#eef8ff", "#195a9a");
		AddNode(ctx, 42f, 158f, 92f, 28f, "外部测试", "#eef8ff", "#195a9a");
		AddArrow(ctx, 162f, 127f, 218f, 127f);
		AddNode(ctx, 218f, 92f, 112f, 70f, "训练后模型\n冻结参数", "#f4f4ff", "#4f46e5");
		AddArrow(ctx, 330f, 127f, 382f, 92f);
		AddArrow(ctx, 330f, 127f, 382f, 127f);
		AddArrow(ctx, 330f, 127f, 382f, 162f);
		AddNode(ctx, 382f, 72f, 104f, 34f, "分类指标", "#fff1f2", "#b4233c");
		AddNode(ctx, 382f, 118f, 104f, 34f, "ROC / PR", "#fff7df", "#8b6f1d");
		AddNode(ctx, 382f, 164f, 104f, 34f, "校准 / 决策曲线", "#f0fdf4", "#2f855a");
		AddArrow(ctx, 486f, 92f, 542f, 130f);
		AddArrow(ctx, 486f, 135f, 542f, 135f);
		AddArrow(ctx, 486f, 181f, 542f, 140f);
		AddNode(ctx, 542f, 104f, 112f, 60f, "临床报告\n亚组与失败案例", "#f8fafc", "#334155");
	}

	private static void BuildMedicalTriModalDiagnosis(PresetContext ctx)
	{
		AddTitle(ctx, "三模态医学诊断通用结构");
		AddNode(ctx, 22f, 56f, 84f, 36f, "医学图像\nCT / MRI / X光", "#eef8ff", "#195a9a");
		AddNode(ctx, 22f, 118f, 84f, 36f, "报告文本\n检查所见", "#fff8e8", "#8b6f1d");
		AddNode(ctx, 22f, 180f, 84f, 36f, "表格变量\n检验 / 病史", "#f0fdf4", "#2f855a");
		AddStack(ctx, 142f, 48f, 94f, 50f, "视觉编码器\nPatch / CNN", "#dbeafe", "#2563eb");
		AddStack(ctx, 142f, 110f, 94f, 50f, "文本编码器\nToken / LLM", "#fff7df", "#8b6f1d");
		AddStack(ctx, 142f, 172f, 94f, 50f, "表格编码器\n变量嵌入", "#dcfce7", "#2f855a");
		AddArrow(ctx, 106f, 74f, 142f, 74f);
		AddArrow(ctx, 106f, 136f, 142f, 136f);
		AddArrow(ctx, 106f, 198f, 142f, 198f);
		AddFrame(ctx, 276f, 64f, 150f, 132f, "三模态融合");
		AddNode(ctx, 302f, 92f, 98f, 34f, "对齐表示", "#f4f4f5", "#555555");
		AddNode(ctx, 302f, 146f, 98f, 34f, "门控 / 注意力", "#f4f4ff", "#4f46e5");
		AddArrow(ctx, 236f, 74f, 302f, 108f);
		AddArrow(ctx, 236f, 136f, 302f, 136f);
		AddArrow(ctx, 236f, 198f, 302f, 162f);
		AddArrow(ctx, 426f, 130f, 480f, 130f);
		AddNode(ctx, 480f, 82f, 92f, 40f, "分类输出\n二/多/多标签", "#fff1f2", "#b4233c");
		AddNode(ctx, 480f, 148f, 92f, 40f, "风险分层\n诊断建议", "#fef2f2", "#b4233c");
		AddArrow(ctx, 572f, 102f, 626f, 116f);
		AddArrow(ctx, 572f, 168f, 626f, 142f);
		AddNode(ctx, 626f, 100f, 92f, 60f, "解释证据\n病例复核", "#f8fafc", "#334155");
	}

	private static void BuildMedicalVlmReportDiagnosis(PresetContext ctx)
	{
		AddTitle(ctx, "医学 VLM 报告诊断流程");
		AddNode(ctx, 18f, 86f, 80f, 56f, "医学图像\n多视图", "#eef8ff", "#195a9a");
		AddArrow(ctx, 98f, 114f, 140f, 114f);
		AddStack(ctx, 140f, 72f, 94f, 84f, "视觉编码器\nROI / Patch", "#dbeafe", "#2563eb");
		AddArrow(ctx, 234f, 114f, 280f, 94f);
		AddNode(ctx, 280f, 62f, 96f, 44f, "视觉 Token\n投影器", "#f4f4ff", "#4f46e5");
		AddArrow(ctx, 234f, 114f, 280f, 146f);
		AddNode(ctx, 280f, 128f, 96f, 44f, "提示词\n临床问题", "#fff8e8", "#8b6f1d");
		AddArrow(ctx, 376f, 84f, 424f, 110f);
		AddArrow(ctx, 376f, 150f, 424f, 126f);
		AddFrame(ctx, 424f, 70f, 126f, 88f, "医学 VLM / LLM");
		AddNode(ctx, 446f, 98f, 82f, 34f, "多模态推理", "#f4f4ff", "#4f46e5");
		AddArrow(ctx, 550f, 114f, 598f, 88f);
		AddArrow(ctx, 550f, 114f, 598f, 142f);
		AddNode(ctx, 598f, 64f, 104f, 44f, "结构化报告\n所见 / 印象", "#fff8e8", "#8b6f1d");
		AddNode(ctx, 598f, 130f, 104f, 44f, "诊断分类\n置信度", "#fff1f2", "#b4233c");
		AddArrow(ctx, 650f, 174f, 650f, 202f, "#555555", arrow: false);
		AddText(ctx, 584f, 198f, 132f, 20f, "医生复核与反馈闭环", 8f, "#555555");
	}

	private static void BuildTabularClinicalBranch(PresetContext ctx)
	{
		AddTitle(ctx, "表格临床特征分支");
		AddFrame(ctx, 24f, 54f, 164f, 142f, "结构化输入");
		AddNode(ctx, 46f, 78f, 96f, 28f, "人口学信息", "#f0fdf4", "#2f855a");
		AddNode(ctx, 46f, 116f, 96f, 28f, "实验室指标", "#f0fdf4", "#2f855a");
		AddNode(ctx, 46f, 154f, 96f, 28f, "病史 / EHR", "#f0fdf4", "#2f855a");
		AddArrow(ctx, 188f, 126f, 238f, 126f);
		AddNode(ctx, 238f, 84f, 96f, 36f, "缺失值\n掩码", "#fff7df", "#8b6f1d");
		AddNode(ctx, 238f, 138f, 96f, 36f, "标准化\n离散化", "#f8fafc", "#334155");
		AddArrow(ctx, 334f, 102f, 390f, 118f);
		AddArrow(ctx, 334f, 156f, 390f, 136f);
		AddStack(ctx, 390f, 78f, 108f, 82f, "变量嵌入\nTabular Encoder", "#dcfce7", "#2f855a");
		AddArrow(ctx, 498f, 119f, 552f, 119f);
		AddNode(ctx, 552f, 84f, 104f, 70f, "临床表征\n融合接口", "#f4f4ff", "#4f46e5");
		AddArrow(ctx, 656f, 119f, 704f, 94f);
		AddArrow(ctx, 656f, 119f, 704f, 146f);
		AddText(ctx, 676f, 74f, 68f, 20f, "图像分支", 8f, "#195a9a");
		AddText(ctx, 676f, 150f, 68f, 20f, "文本分支", 8f, "#8b6f1d");
	}

	private static void BuildCrossModalAttentionFusion(PresetContext ctx)
	{
		AddTitle(ctx, "跨模态注意力融合");
		AddNode(ctx, 24f, 66f, 86f, 34f, "图像 Token", "#eef8ff", "#195a9a");
		AddNode(ctx, 24f, 120f, 86f, 34f, "文本 Token", "#fff8e8", "#8b6f1d");
		AddNode(ctx, 24f, 174f, 86f, 34f, "表格 Token", "#f0fdf4", "#2f855a");
		AddPatchGrid(ctx, 140f, 62f, 5, 2, 15f, "#ffffff", "#dbeafe");
		AddPatchGrid(ctx, 140f, 116f, 5, 2, 15f, "#ffffff", "#fff1b8");
		AddPatchGrid(ctx, 140f, 170f, 5, 2, 15f, "#ffffff", "#bbf7d0");
		AddArrow(ctx, 110f, 83f, 140f, 77f);
		AddArrow(ctx, 110f, 137f, 140f, 131f);
		AddArrow(ctx, 110f, 191f, 140f, 185f);
		AddFrame(ctx, 270f, 58f, 190f, 154f, "Cross Attention / Gated Fusion");
		AddNode(ctx, 296f, 86f, 52f, 36f, "Q", "#eef8ff", "#195a9a", MsoAutoShapeType.msoShapeOval);
		AddNode(ctx, 354f, 86f, 52f, 36f, "K", "#fff8e8", "#8b6f1d", MsoAutoShapeType.msoShapeOval);
		AddNode(ctx, 354f, 150f, 52f, 36f, "V", "#f0fdf4", "#2f855a", MsoAutoShapeType.msoShapeOval);
		AddNode(ctx, 410f, 118f, 34f, 34f, "α", "#f4f4ff", "#4f46e5", MsoAutoShapeType.msoShapeHexagon);
		AddArrow(ctx, 215f, 77f, 296f, 104f);
		AddArrow(ctx, 215f, 131f, 354f, 104f);
		AddArrow(ctx, 215f, 185f, 354f, 168f);
		AddArrow(ctx, 444f, 135f, 500f, 135f);
		AddNode(ctx, 500f, 96f, 104f, 78f, "共享表示\n对齐特征", "#f8fafc", "#334155");
		AddArrow(ctx, 604f, 135f, 656f, 135f);
		AddNode(ctx, 656f, 102f, 76f, 64f, "下游任务\n分类/诊断", "#fff1f2", "#b4233c");
	}

	private static void BuildLlmAdapterFineTune(PresetContext ctx)
	{
		AddTitle(ctx, "LLM Adapter / LoRA 微调流程");
		AddNode(ctx, 20f, 70f, 86f, 44f, "医学图文\n训练样本", "#eef8ff", "#195a9a");
		AddNode(ctx, 20f, 142f, 86f, 44f, "标签 / 报告\n指令数据", "#fff8e8", "#8b6f1d");
		AddArrow(ctx, 106f, 92f, 154f, 112f);
		AddArrow(ctx, 106f, 164f, 154f, 134f);
		AddFrame(ctx, 154f, 62f, 154f, 126f, "冻结大模型");
		AddNode(ctx, 180f, 92f, 102f, 60f, "LLM / VLM\n主干参数冻结", "#f4f4ff", "#4f46e5");
		AddFrame(ctx, 344f, 54f, 148f, 142f, "可训练小模块");
		AddNode(ctx, 366f, 82f, 100f, 34f, "Adapter", "#f0fdf4", "#2f855a");
		AddNode(ctx, 366f, 132f, 100f, 34f, "LoRA / Prompt", "#fff7df", "#8b6f1d");
		AddArrow(ctx, 308f, 122f, 366f, 99f);
		AddArrow(ctx, 308f, 122f, 366f, 149f);
		AddArrow(ctx, 492f, 122f, 548f, 122f);
		AddNode(ctx, 548f, 78f, 96f, 42f, "医学任务头\n分类/生成", "#fff1f2", "#b4233c");
		AddNode(ctx, 548f, 144f, 96f, 42f, "监督损失\n对齐损失", "#f8fafc", "#334155");
		AddArrow(ctx, 644f, 99f, 704f, 116f);
		AddArrow(ctx, 644f, 165f, 704f, 138f);
		AddText(ctx, 674f, 118f, 76f, 22f, "部署推理", 8f, "#555555");
	}

	private static void BuildDiagnosisEvaluationPanel(PresetContext ctx)
	{
		AddTitle(ctx, "诊断评估与临床报告面板");
		AddNode(ctx, 22f, 98f, 94f, 58f, "模型预测\n概率 / 风险", "#fff1f2", "#b4233c");
		AddArrow(ctx, 116f, 127f, 164f, 127f);
		AddFrame(ctx, 164f, 54f, 380f, 150f, "评估输出");
		AddNode(ctx, 190f, 78f, 88f, 36f, "ROC / PR\nAUC", "#eef8ff", "#195a9a");
		AddNode(ctx, 304f, 78f, 88f, 36f, "校准曲线\nBrier", "#fff7df", "#8b6f1d");
		AddNode(ctx, 418f, 78f, 88f, 36f, "决策曲线\n临床获益", "#f0fdf4", "#2f855a");
		AddNode(ctx, 190f, 140f, 88f, 36f, "混淆矩阵\n敏感/特异", "#f8fafc", "#334155");
		AddNode(ctx, 304f, 140f, 88f, 36f, "亚组分析\n稳健性", "#f8fafc", "#334155");
		AddNode(ctx, 418f, 140f, 88f, 36f, "失败案例\n可解释性", "#f8fafc", "#334155");
		AddArrow(ctx, 544f, 127f, 594f, 102f);
		AddArrow(ctx, 544f, 127f, 594f, 152f);
		AddNode(ctx, 594f, 72f, 106f, 44f, "论文结果图\n表格摘要", "#eef8ff", "#195a9a");
		AddNode(ctx, 594f, 138f, 106f, 44f, "临床结论\n局限提示", "#fff8e8", "#8b6f1d");
	}

	private static void BuildTransformerDecoderBlock(PresetContext ctx)
	{
		AddTitle(ctx, "Transformer 解码器块");
		AddNode(ctx, 22f, 82f, 86f, 48f, "目标序列\nShifted Tokens", "#fff8e8", "#8b6f1d");
		AddArrow(ctx, 108f, 106f, 148f, 106f);
		AddFrame(ctx, 148f, 50f, 334f, 142f, "N 层解码器堆叠");
		AddNode(ctx, 170f, 76f, 82f, 34f, "掩码\n自注意力", "#fff7df", "#8b6f1d");
		AddNode(ctx, 170f, 130f, 82f, 34f, "残差\n归一化", "#f8f8f8", "#555555");
		AddNode(ctx, 282f, 76f, 82f, 34f, "交叉\n注意力", "#e9f2ff", "#2b5f9c");
		AddNode(ctx, 282f, 130f, 82f, 34f, "前馈\n网络", "#f1f8e9", "#3c7d31");
		AddNode(ctx, 394f, 100f, 64f, 40f, "输出\n归一化", "#f8fafc", "#334155");
		AddArrow(ctx, 252f, 93f, 282f, 93f);
		AddArrow(ctx, 364f, 93f, 394f, 116f);
		AddArrow(ctx, 252f, 147f, 282f, 147f, "#555555", arrow: false);
		AddArrow(ctx, 482f, 121f, 532f, 121f);
		AddNode(ctx, 532f, 84f, 92f, 34f, "词表投影", "#fff1f2", "#b4233c");
		AddNode(ctx, 532f, 140f, 92f, 34f, "生成输出", "#f0fdf4", "#2f855a");
		AddArrow(ctx, 624f, 101f, 676f, 112f);
		AddArrow(ctx, 624f, 157f, 676f, 132f);
		AddText(ctx, 286f, 36f, 140f, 20f, "来自编码器记忆", 8f, "#2b5f9c");
	}

	private static void BuildBlip2QformerBridge(PresetContext ctx)
	{
		AddTitle(ctx, "Q-Former VLM 桥接结构");
		AddNode(ctx, 18f, 74f, 82f, 54f, "医学图像\n多视图", "#eef8ff", "#195a9a");
		AddPatchGrid(ctx, 122f, 66f, 4, 4, 15f, "#ffffff", "#dbeafe");
		AddText(ctx, 112f, 132f, 90f, 18f, "视觉特征", 8f, "#195a9a");
		AddArrow(ctx, 100f, 101f, 122f, 96f);
		AddFrame(ctx, 232f, 52f, 170f, 132f, "Query Transformer");
		AddNode(ctx, 254f, 78f, 54f, 36f, "Query", "#f4f4ff", "#4f46e5", MsoAutoShapeType.msoShapeOval);
		AddNode(ctx, 322f, 78f, 54f, 36f, "交叉\n注意力", "#fff7df", "#8b6f1d");
		AddNode(ctx, 286f, 132f, 80f, 34f, "压缩语义\nToken", "#f8fafc", "#334155");
		AddArrow(ctx, 182f, 96f, 254f, 96f);
		AddArrow(ctx, 308f, 96f, 322f, 96f);
		AddArrow(ctx, 349f, 114f, 326f, 132f, "#555555", arrow: false);
		AddArrow(ctx, 402f, 116f, 458f, 116f);
		AddNode(ctx, 458f, 78f, 104f, 76f, "冻结 LLM\n报告推理", "#fff8e8", "#8b6f1d");
		AddArrow(ctx, 562f, 116f, 610f, 94f);
		AddArrow(ctx, 562f, 116f, 610f, 146f);
		AddNode(ctx, 610f, 70f, 96f, 44f, "结构化报告", "#f0fdf4", "#2f855a");
		AddNode(ctx, 610f, 132f, 96f, 44f, "诊断解释", "#fff1f2", "#b4233c");
	}

	private static void BuildMedicalInstructionVlm(PresetContext ctx)
	{
		AddTitle(ctx, "医学指令 VLM 流程");
		AddNode(ctx, 18f, 62f, 78f, 42f, "医学图像", "#eef8ff", "#195a9a");
		AddNode(ctx, 18f, 130f, 78f, 42f, "临床指令\n问题", "#fff8e8", "#8b6f1d");
		AddArrow(ctx, 96f, 83f, 142f, 106f);
		AddArrow(ctx, 96f, 151f, 142f, 128f);
		AddNode(ctx, 142f, 82f, 94f, 64f, "视觉编码器\n+ 投影层", "#dbeafe", "#2563eb");
		AddArrow(ctx, 236f, 114f, 284f, 114f);
		AddFrame(ctx, 284f, 54f, 154f, 126f, "多模态指令对齐");
		AddNode(ctx, 306f, 84f, 104f, 34f, "图文 Token 拼接", "#f4f4ff", "#4f46e5");
		AddNode(ctx, 306f, 134f, 104f, 34f, "监督微调\n偏好对齐", "#f8fafc", "#334155");
		AddArrow(ctx, 438f, 116f, 488f, 116f);
		AddNode(ctx, 488f, 74f, 110f, 84f, "医学 VLM\n推理生成", "#fff7df", "#8b6f1d");
		AddArrow(ctx, 598f, 116f, 646f, 92f);
		AddArrow(ctx, 598f, 116f, 646f, 150f);
		AddNode(ctx, 646f, 70f, 78f, 42f, "回答", "#f0fdf4", "#2f855a");
		AddNode(ctx, 646f, 132f, 78f, 42f, "诊断建议", "#fff1f2", "#b4233c");
	}

	private static void BuildMedclipSemanticMatching(PresetContext ctx)
	{
		AddTitle(ctx, "MedCLIP 图文语义匹配");
		AddFrame(ctx, 22f, 52f, 206f, 66f, "图像分支");
		AddNode(ctx, 42f, 76f, 68f, 28f, "影像", "#eef8ff", "#195a9a");
		AddArrow(ctx, 110f, 90f, 144f, 90f);
		AddNode(ctx, 144f, 72f, 66f, 34f, "图像\n编码器", "#dbeafe", "#2563eb");
		AddFrame(ctx, 22f, 144f, 206f, 66f, "文本分支");
		AddNode(ctx, 42f, 168f, 68f, 28f, "报告\n标签词", "#fff8e8", "#8b6f1d");
		AddArrow(ctx, 110f, 182f, 144f, 182f);
		AddNode(ctx, 144f, 164f, 66f, 34f, "文本\n编码器", "#fff7df", "#8b6f1d");
		AddArrow(ctx, 228f, 90f, 300f, 112f);
		AddArrow(ctx, 228f, 182f, 300f, 156f);
		AddNode(ctx, 300f, 92f, 88f, 36f, "归一化\n嵌入", "#f8fafc", "#334155");
		AddNode(ctx, 300f, 144f, 88f, 36f, "归一化\n嵌入", "#f8fafc", "#334155");
		AddArrow(ctx, 388f, 110f, 448f, 130f);
		AddArrow(ctx, 388f, 162f, 448f, 146f);
		AddPatchGrid(ctx, 448f, 100f, 4, 4, 16f, "#ffffff", "#e9d5ff");
		AddText(ctx, 436f, 168f, 100f, 18f, "语义相似度", 8f, "#555555");
		AddArrow(ctx, 516f, 132f, 572f, 132f);
		AddNode(ctx, 572f, 94f, 110f, 72f, "零样本分类\n检索 / 诊断", "#fff1f2", "#b4233c");
	}

	private static void BuildSelfSupervisedMaePretrain(PresetContext ctx)
	{
		AddTitle(ctx, "自监督预训练 / MAE 流程");
		AddNode(ctx, 18f, 88f, 78f, 50f, "未标注\n医学图像", "#eef8ff", "#195a9a");
		AddArrow(ctx, 96f, 113f, 136f, 113f);
		AddPatchGrid(ctx, 136f, 74f, 5, 4, 15f, "#ffffff", "#dbeafe");
		AddText(ctx, 126f, 142f, 104f, 18f, "随机遮挡 Patch", 8f, "#555555");
		AddArrow(ctx, 216f, 112f, 264f, 112f);
		AddStack(ctx, 264f, 70f, 98f, 84f, "编码器\n可见 Patch", "#dbeafe", "#2563eb");
		AddArrow(ctx, 362f, 112f, 410f, 112f);
		AddStack(ctx, 410f, 70f, 98f, 84f, "轻量解码器\n重建图像", "#fff7df", "#8b6f1d");
		AddArrow(ctx, 508f, 112f, 558f, 92f);
		AddArrow(ctx, 508f, 112f, 558f, 150f);
		AddNode(ctx, 558f, 70f, 104f, 42f, "重建损失", "#f8fafc", "#334155");
		AddNode(ctx, 558f, 132f, 104f, 42f, "下游微调\n分类 / 分割", "#fff1f2", "#b4233c");
		AddText(ctx, 294f, 158f, 176f, 20f, "预训练权重迁移", 8f, "#666666");
	}

	private static void BuildMultimodalRagReportTable(PresetContext ctx)
	{
		AddTitle(ctx, "报告与表格多模态 RAG");
		AddNode(ctx, 18f, 58f, 82f, 34f, "医学图像", "#eef8ff", "#195a9a");
		AddNode(ctx, 18f, 112f, 82f, 34f, "报告文本", "#fff8e8", "#8b6f1d");
		AddNode(ctx, 18f, 166f, 82f, 34f, "表格指标", "#f0fdf4", "#2f855a");
		AddArrow(ctx, 100f, 75f, 150f, 100f);
		AddArrow(ctx, 100f, 129f, 150f, 129f);
		AddArrow(ctx, 100f, 183f, 150f, 156f);
		AddFrame(ctx, 150f, 68f, 124f, 116f, "统一检索键");
		AddNode(ctx, 172f, 92f, 80f, 30f, "病例索引", "#f8fafc", "#334155");
		AddNode(ctx, 172f, 138f, 80f, 30f, "知识库", "#f8fafc", "#334155");
		AddArrow(ctx, 274f, 126f, 326f, 126f);
		AddNode(ctx, 326f, 78f, 112f, 94f, "检索增强\n多模态大模型", "#f4f4ff", "#4f46e5");
		AddArrow(ctx, 438f, 126f, 494f, 92f);
		AddArrow(ctx, 438f, 126f, 494f, 126f);
		AddArrow(ctx, 438f, 126f, 494f, 160f);
		AddNode(ctx, 494f, 70f, 104f, 34f, "诊断答案", "#fff1f2", "#b4233c");
		AddNode(ctx, 494f, 112f, 104f, 34f, "证据引用", "#fff7df", "#8b6f1d");
		AddNode(ctx, 494f, 154f, 104f, 34f, "结构化表格", "#f0fdf4", "#2f855a");
		AddArrow(ctx, 598f, 130f, 650f, 130f);
		AddNode(ctx, 650f, 96f, 72f, 66f, "医生\n复核", "#f8fafc", "#334155");
	}

	private static void BuildSwinUnetr3DSegmentation(PresetContext ctx)
	{
		AddTitle(ctx, "3D Swin UNETR 分割结构");
		AddNode(ctx, 18f, 92f, 72f, 52f, "3D 影像\nVolume", "#eef8ff", "#195a9a");
		AddArrow(ctx, 90f, 118f, 124f, 118f);
		AddStack(ctx, 124f, 62f, 92f, 112f, "Swin\nTransformer\n编码器", "#dbeafe", "#2563eb");
		AddArrow(ctx, 216f, 118f, 268f, 118f);
		AddNode(ctx, 268f, 90f, 82f, 54f, "多尺度\n特征", "#f4f4ff", "#4f46e5");
		AddFrame(ctx, 386f, 54f, 178f, 132f, "UNETR 解码器");
		AddNode(ctx, 408f, 78f, 58f, 34f, "上采样", "#dcfce7", "#2f855a");
		AddNode(ctx, 486f, 78f, 58f, 34f, "跳连", "#fff7df", "#8b6f1d");
		AddNode(ctx, 448f, 132f, 70f, 34f, "卷积块", "#dcfce7", "#2f855a");
		AddArrow(ctx, 350f, 118f, 408f, 95f);
		AddArrow(ctx, 350f, 118f, 448f, 149f);
		AddArrow(ctx, 564f, 120f, 612f, 120f);
		AddNode(ctx, 612f, 84f, 92f, 72f, "器官 / 病灶\n3D 掩膜", "#fff1f2", "#b4233c");
		AddArrow(ctx, 170f, 62f, 514f, 62f, "#666666", arrow: false, dashed: true);
		AddText(ctx, 282f, 42f, 116f, 18f, "层级跳跃连接", 8f, "#666666");
	}

	private static void BuildTabTransformerRisk(PresetContext ctx)
	{
		AddTitle(ctx, "表格 Transformer 风险预测");
		AddFrame(ctx, 22f, 50f, 150f, 142f, "结构化变量");
		AddNode(ctx, 42f, 76f, 88f, 28f, "类别变量", "#f0fdf4", "#2f855a");
		AddNode(ctx, 42f, 114f, 88f, 28f, "连续变量", "#f0fdf4", "#2f855a");
		AddNode(ctx, 42f, 152f, 88f, 28f, "缺失掩码", "#fff7df", "#8b6f1d");
		AddArrow(ctx, 172f, 121f, 226f, 121f);
		AddNode(ctx, 226f, 86f, 98f, 70f, "变量嵌入\n+ 列编码", "#dcfce7", "#2f855a");
		AddArrow(ctx, 324f, 121f, 374f, 121f);
		AddStack(ctx, 374f, 74f, 116f, 92f, "TabTransformer\n上下文编码", "#f4f4ff", "#4f46e5");
		AddArrow(ctx, 490f, 121f, 544f, 96f);
		AddArrow(ctx, 490f, 121f, 544f, 148f);
		AddNode(ctx, 544f, 72f, 98f, 42f, "风险评分", "#fff1f2", "#b4233c");
		AddNode(ctx, 544f, 132f, 98f, 42f, "校准概率", "#fff7df", "#8b6f1d");
		AddArrow(ctx, 642f, 111f, 672f, 124f);
		AddNode(ctx, 672f, 100f, 56f, 48f, "临床\n分层", "#f8fafc", "#334155");
	}

	private static void BuildClinicalDeploymentMonitoring(PresetContext ctx)
	{
		AddTitle(ctx, "临床部署与漂移监测");
		AddFrame(ctx, 18f, 52f, 150f, 126f, "上线输入");
		AddNode(ctx, 40f, 76f, 88f, 28f, "新病例流", "#eef8ff", "#195a9a");
		AddNode(ctx, 40f, 118f, 88f, 28f, "EHR / 报告", "#fff8e8", "#8b6f1d");
		AddArrow(ctx, 168f, 115f, 224f, 115f);
		AddNode(ctx, 224f, 74f, 108f, 82f, "部署模型\n版本锁定", "#f4f4ff", "#4f46e5");
		AddArrow(ctx, 332f, 115f, 382f, 78f);
		AddArrow(ctx, 332f, 115f, 382f, 132f);
		AddNode(ctx, 382f, 58f, 108f, 38f, "数据漂移\n分布变化", "#fff7df", "#8b6f1d");
		AddNode(ctx, 382f, 122f, 108f, 38f, "性能监测\n反馈标签", "#f0fdf4", "#2f855a");
		AddArrow(ctx, 490f, 78f, 546f, 102f);
		AddArrow(ctx, 490f, 141f, 546f, 126f);
		AddNode(ctx, 546f, 86f, 104f, 58f, "告警 / 人审\n再训练队列", "#fff1f2", "#b4233c");
		AddArrow(ctx, 650f, 115f, 704f, 115f);
		AddText(ctx, 660f, 128f, 70f, 20f, "闭环改进", 8f, "#555555");
	}

	private static void BuildFederatedLearningMedical(PresetContext ctx)
	{
		AddTitle(ctx, "多中心联邦学习");
		AddFrame(ctx, 18f, 50f, 148f, 142f, "多中心数据");
		AddNode(ctx, 40f, 72f, 84f, 26f, "医院 A", "#eef8ff", "#195a9a");
		AddNode(ctx, 40f, 112f, 84f, 26f, "医院 B", "#eef8ff", "#195a9a");
		AddNode(ctx, 40f, 152f, 84f, 26f, "医院 C", "#eef8ff", "#195a9a");
		AddArrow(ctx, 166f, 121f, 220f, 121f);
		AddNode(ctx, 220f, 78f, 108f, 86f, "本地训练\n梯度/权重", "#f0fdf4", "#2f855a");
		AddArrow(ctx, 328f, 121f, 382f, 121f);
		AddNode(ctx, 382f, 82f, 116f, 78f, "安全聚合\n隐私保护", "#fff7df", "#8b6f1d");
		AddArrow(ctx, 498f, 121f, 552f, 92f);
		AddArrow(ctx, 498f, 121f, 552f, 150f);
		AddNode(ctx, 552f, 68f, 116f, 44f, "全局模型", "#f4f4ff", "#4f46e5");
		AddNode(ctx, 552f, 134f, 116f, 44f, "外部验证", "#fff1f2", "#b4233c");
		AddArrow(ctx, 610f, 134f, 300f, 164f, "#555555", arrow: false, dashed: true);
		AddText(ctx, 330f, 166f, 170f, 20f, "模型回传，不交换原始数据", 8f, "#555555");
	}

	private static void BuildDiffusionAugmentation(PresetContext ctx)
	{
		AddTitle(ctx, "医学扩散数据增强");
		AddFrame(ctx, 18f, 54f, 142f, 128f, "真实数据");
		AddNode(ctx, 38f, 76f, 88f, 28f, "影像", "#eef8ff", "#195a9a");
		AddNode(ctx, 38f, 118f, 88f, 28f, "掩膜/标签", "#f0fdf4", "#2f855a");
		AddArrow(ctx, 160f, 116f, 216f, 116f);
		AddNode(ctx, 216f, 72f, 108f, 82f, "噪声调度\n条件编码", "#fff7df", "#8b6f1d");
		AddArrow(ctx, 324f, 116f, 378f, 116f);
		AddStack(ctx, 378f, 72f, 112f, 82f, "扩散生成\n采样去噪", "#f4f4ff", "#4f46e5");
		AddArrow(ctx, 490f, 116f, 544f, 92f);
		AddArrow(ctx, 490f, 116f, 544f, 148f);
		AddNode(ctx, 544f, 68f, 108f, 44f, "合成样本", "#fdf2f8", "#be123c");
		AddNode(ctx, 544f, 132f, 108f, 44f, "质控筛选", "#fff8e8", "#8b6f1d");
		AddArrow(ctx, 652f, 116f, 704f, 116f);
		AddText(ctx, 660f, 126f, 64f, 20f, "下游训练", 8f, "#555555");
	}

	private static void BuildSurvivalOutcomePrediction(PresetContext ctx)
	{
		AddTitle(ctx, "生存预后预测");
		AddFrame(ctx, 18f, 52f, 150f, 142f, "多源输入");
		AddNode(ctx, 40f, 72f, 88f, 26f, "影像特征", "#eef8ff", "#195a9a");
		AddNode(ctx, 40f, 110f, 88f, 26f, "报告文本", "#fff8e8", "#8b6f1d");
		AddNode(ctx, 40f, 148f, 88f, 26f, "表格随访", "#f0fdf4", "#2f855a");
		AddArrow(ctx, 168f, 122f, 224f, 122f);
		AddNode(ctx, 224f, 78f, 112f, 86f, "时间编码\n多模态融合", "#f4f4ff", "#4f46e5");
		AddArrow(ctx, 336f, 122f, 388f, 92f);
		AddArrow(ctx, 336f, 122f, 388f, 150f);
		AddNode(ctx, 388f, 68f, 112f, 44f, "风险函数\nHazard", "#fff1f2", "#b4233c");
		AddNode(ctx, 388f, 132f, 112f, 44f, "生存曲线\nKM / Cox", "#fff7df", "#8b6f1d");
		AddArrow(ctx, 500f, 92f, 560f, 112f);
		AddArrow(ctx, 500f, 150f, 560f, 128f);
		AddNode(ctx, 560f, 86f, 108f, 60f, "预后分层\nC-index / 校准", "#f8fafc", "#334155");
	}

	private static void BuildActiveLearningAnnotation(PresetContext ctx)
	{
		AddTitle(ctx, "主动学习标注闭环");
		AddFrame(ctx, 18f, 54f, 138f, 122f, "未标注池");
		AddNode(ctx, 38f, 78f, 84f, 28f, "影像/报告", "#eef8ff", "#195a9a");
		AddNode(ctx, 38f, 120f, 84f, 28f, "候选样本", "#f8fafc", "#334155");
		AddArrow(ctx, 156f, 116f, 212f, 116f);
		AddNode(ctx, 212f, 76f, 108f, 78f, "当前模型\n不确定性评分", "#f4f4ff", "#4f46e5");
		AddArrow(ctx, 320f, 116f, 376f, 92f);
		AddArrow(ctx, 320f, 116f, 376f, 150f);
		AddNode(ctx, 376f, 68f, 108f, 44f, "优先样本", "#fff7df", "#8b6f1d");
		AddNode(ctx, 376f, 132f, 108f, 44f, "医生标注", "#fff1f2", "#b4233c");
		AddArrow(ctx, 484f, 150f, 544f, 126f);
		AddNode(ctx, 544f, 96f, 110f, 56f, "增量训练\n验证更新", "#f0fdf4", "#2f855a");
		AddArrow(ctx, 596f, 96f, 266f, 76f, "#555555", arrow: false, dashed: true);
		AddText(ctx, 340f, 48f, 150f, 18f, "闭环提升标注效率", 8f, "#555555");
	}

	private static void BuildMoeExpertRouting(PresetContext ctx)
	{
		AddTitle(ctx, "MoE 专家路由");
		AddNode(ctx, 28f, 100f, 104f, 50f, "多模态 token\n图像/文本/表格", "#eef8ff", "#195a9a");
		AddArrow(ctx, 132f, 125f, 214f, 125f);
		AddNode(ctx, 214f, 88f, 96f, 74f, "Router\n门控权重", "#fff7df", "#8b6f1d", MsoAutoShapeType.msoShapeDiamond);
		AddArrow(ctx, 310f, 125f, 384f, 74f);
		AddArrow(ctx, 310f, 125f, 384f, 125f);
		AddArrow(ctx, 310f, 125f, 384f, 176f);
		AddNode(ctx, 384f, 52f, 110f, 44f, "影像专家", "#eef8ff", "#195a9a");
		AddNode(ctx, 384f, 104f, 110f, 44f, "报告专家", "#fff8e8", "#8b6f1d");
		AddNode(ctx, 384f, 156f, 110f, 44f, "表格专家", "#f0fdf4", "#2f855a");
		AddArrow(ctx, 494f, 74f, 566f, 116f);
		AddArrow(ctx, 494f, 126f, 566f, 126f);
		AddArrow(ctx, 494f, 178f, 566f, 136f);
		AddNode(ctx, 566f, 96f, 108f, 58f, "加权融合\n任务输出", "#f4f4ff", "#4f46e5");
		AddText(ctx, 224f, 166f, 128f, 18f, "Top-k 专家激活", 8f, "#555555");
	}

	private static void BuildLongitudinalFollowupDiagnosis(PresetContext ctx)
	{
		AddTitle(ctx, "纵向随访诊断");
		AddFrame(ctx, 18f, 52f, 162f, 138f, "多时间点病例");
		AddNode(ctx, 38f, 72f, 92f, 28f, "T0 基线影像", "#eef8ff", "#195a9a");
		AddNode(ctx, 38f, 112f, 92f, 28f, "T1 随访报告", "#fff8e8", "#8b6f1d");
		AddNode(ctx, 38f, 152f, 92f, 28f, "T2 检验表格", "#f0fdf4", "#2f855a");
		AddArrow(ctx, 180f, 122f, 232f, 122f);
		AddNode(ctx, 232f, 78f, 112f, 86f, "时序编码\n变化量特征", "#f4f4ff", "#4f46e5");
		AddArrow(ctx, 344f, 122f, 396f, 92f);
		AddArrow(ctx, 344f, 122f, 396f, 150f);
		AddNode(ctx, 396f, 68f, 112f, 44f, "疾病进展\n趋势估计", "#fff7df", "#8b6f1d");
		AddNode(ctx, 396f, 132f, 112f, 44f, "治疗响应\n疗效评估", "#f0fdf4", "#2f855a");
		AddArrow(ctx, 508f, 92f, 566f, 112f);
		AddArrow(ctx, 508f, 150f, 566f, 128f);
		AddNode(ctx, 566f, 86f, 112f, 60f, "诊断更新\n风险预警", "#fff1f2", "#b4233c");
	}

	private static void BuildWeaklySupervisedMil(PresetContext ctx)
	{
		AddTitle(ctx, "弱监督 MIL 病灶定位");
		AddFrame(ctx, 18f, 50f, 158f, 142f, "切片 / Patch 包");
		AddPatchGrid(ctx, 42f, 78f, 4, 3, 18f, "#eef8ff", "#dbeafe");
		AddText(ctx, 42f, 144f, 92f, 18f, "弱标签样本包", 8f, "#555555");
		AddArrow(ctx, 176f, 121f, 232f, 121f);
		AddStack(ctx, 232f, 76f, 106f, 84f, "Patch 编码器\n实例特征", "#f4f4ff", "#4f46e5");
		AddArrow(ctx, 338f, 121f, 390f, 94f);
		AddArrow(ctx, 338f, 121f, 390f, 148f);
		AddNode(ctx, 390f, 68f, 108f, 44f, "注意力池化\nMIL 聚合", "#fff7df", "#8b6f1d");
		AddNode(ctx, 390f, 132f, 108f, 44f, "高权重 Patch\n候选病灶", "#fff1f2", "#b4233c");
		AddArrow(ctx, 498f, 94f, 558f, 112f);
		AddArrow(ctx, 498f, 148f, 558f, 128f);
		AddNode(ctx, 558f, 84f, 112f, 64f, "切片级诊断\n热力图解释", "#f0fdf4", "#2f855a");
	}

	private static void BuildMedicalKnowledgeGraphReasoning(PresetContext ctx)
	{
		AddTitle(ctx, "医学知识图谱推理");
		AddFrame(ctx, 18f, 54f, 142f, 126f, "病例文本");
		AddNode(ctx, 38f, 78f, 86f, 28f, "报告实体", "#fff8e8", "#8b6f1d");
		AddNode(ctx, 38f, 120f, 86f, 28f, "检验指标", "#f0fdf4", "#2f855a");
		AddArrow(ctx, 160f, 116f, 216f, 116f);
		AddNode(ctx, 216f, 78f, 104f, 76f, "实体链接\n关系抽取", "#eef8ff", "#195a9a");
		AddArrow(ctx, 320f, 116f, 376f, 116f);
		AddNode(ctx, 376f, 72f, 112f, 88f, "医学知识图谱\n疾病-症状-药物", "#f4f4ff", "#4f46e5", MsoAutoShapeType.msoShapeHexagon);
		AddArrow(ctx, 488f, 116f, 544f, 92f);
		AddArrow(ctx, 488f, 116f, 544f, 150f);
		AddNode(ctx, 544f, 68f, 112f, 44f, "路径推理\n证据链", "#fff7df", "#8b6f1d");
		AddNode(ctx, 544f, 132f, 112f, 44f, "诊断解释\n可追溯结论", "#fff1f2", "#b4233c");
	}

	private static void BuildTeacherStudentDistillation(PresetContext ctx)
	{
		AddTitle(ctx, "教师学生蒸馏");
		AddNode(ctx, 28f, 104f, 104f, 44f, "训练数据\n图像/文本/表格", "#eef8ff", "#195a9a");
		AddArrow(ctx, 132f, 126f, 210f, 86f);
		AddArrow(ctx, 132f, 126f, 210f, 164f);
		AddStack(ctx, 210f, 54f, 112f, 62f, "教师模型\n大模型/集成", "#f4f4ff", "#4f46e5");
		AddNode(ctx, 210f, 142f, 112f, 50f, "学生模型\n轻量部署", "#f0fdf4", "#2f855a");
		AddArrow(ctx, 322f, 86f, 398f, 116f);
		AddArrow(ctx, 322f, 164f, 398f, 134f);
		AddNode(ctx, 398f, 88f, 112f, 64f, "蒸馏损失\nlogits / feature", "#fff7df", "#8b6f1d");
		AddArrow(ctx, 510f, 120f, 568f, 94f);
		AddArrow(ctx, 510f, 120f, 568f, 150f);
		AddNode(ctx, 568f, 70f, 110f, 44f, "性能保持", "#fff1f2", "#b4233c");
		AddNode(ctx, 568f, 132f, 110f, 44f, "临床部署\n低延迟推理", "#f8fafc", "#334155");
	}

	private static void BuildFoundationPromptTuning(PresetContext ctx)
	{
		AddTitle(ctx, "医学基础模型提示调优");
		AddFrame(ctx, 18f, 54f, 144f, 126f, "医学任务输入");
		AddNode(ctx, 38f, 76f, 88f, 28f, "影像 / 报告", "#eef8ff", "#195a9a");
		AddNode(ctx, 38f, 118f, 88f, 28f, "临床指令", "#fff8e8", "#8b6f1d");
		AddArrow(ctx, 162f, 116f, 218f, 116f);
		AddNode(ctx, 218f, 72f, 106f, 84f, "可学习 Prompt\nPrefix / Token", "#fff7df", "#8b6f1d");
		AddArrow(ctx, 324f, 116f, 382f, 116f);
		AddStack(ctx, 382f, 70f, 118f, 88f, "冻结基础模型\nVLM / LLM", "#f4f4ff", "#4f46e5");
		AddArrow(ctx, 500f, 116f, 558f, 92f);
		AddArrow(ctx, 500f, 116f, 558f, 150f);
		AddNode(ctx, 558f, 68f, 112f, 44f, "诊断分类头", "#fff1f2", "#b4233c");
		AddNode(ctx, 558f, 132f, 112f, 44f, "报告 / 解释\n结构化输出", "#f0fdf4", "#2f855a");
		AddText(ctx, 232f, 164f, 258f, 20f, "主干冻结，只训练提示参数和任务头", 8f, "#555555");
	}

	private static void AddTitle(PresetContext ctx, string title)
	{
		AddText(ctx, 0f, 6f, ctx.Width, 28f, title, 14f, "#111111", bold: true);
	}

	private static void AddFooter(PresetContext ctx, string text)
	{
		AddText(ctx, 0f, ctx.Height - 24f, ctx.Width, 18f, text, 7.5f, "#666666", bold: false);
	}

	private static Microsoft.Office.Interop.PowerPoint.Shape AddNode(PresetContext ctx, float x, float y, float width, float height, string text, string fill, string stroke)
	{
		return AddNode(ctx, x, y, width, height, text, fill, stroke, MsoAutoShapeType.msoShapeRoundedRectangle);
	}

	private static Microsoft.Office.Interop.PowerPoint.Shape AddNode(PresetContext ctx, float x, float y, float width, float height, string text, string fill, string stroke, MsoAutoShapeType type)
	{
		Microsoft.Office.Interop.PowerPoint.Shape shape = ctx.Slide.Shapes.AddShape(type, ctx.Left + x, ctx.Top + y, width, height);
		shape.Name = UniqueName("Rough_PaperNode");
		StyleShape(shape, fill, stroke, 1.25f, MsoLineDashStyle.msoLineSolid);
		TrySetRoundness(shape, 0.18f);
		SetText(shape, text, 8.5f, "#111111", bold: true, MsoParagraphAlignment.msoAlignCenter);
		ctx.Shapes.Add(shape);
		return shape;
	}

	private static void AddStack(PresetContext ctx, float x, float y, float width, float height, string text, string fill, string stroke)
	{
		Microsoft.Office.Interop.PowerPoint.Shape back = ctx.Slide.Shapes.AddShape(MsoAutoShapeType.msoShapeRoundedRectangle, ctx.Left + x + 8f, ctx.Top + y + 8f, width, height);
		back.Name = UniqueName("Rough_PaperStackBack");
		StyleShape(back, "#ffffff", stroke, 0.9f, MsoLineDashStyle.msoLineSolid);
		TrySetRoundness(back, 0.18f);
		ctx.Shapes.Add(back);
		AddNode(ctx, x, y, width, height, text, fill, stroke);
	}

	private static void AddFrame(PresetContext ctx, float x, float y, float width, float height, string title)
	{
		Microsoft.Office.Interop.PowerPoint.Shape frame = ctx.Slide.Shapes.AddShape(MsoAutoShapeType.msoShapeRectangle, ctx.Left + x, ctx.Top + y, width, height);
		frame.Name = UniqueName("Rough_PaperFrame");
		frame.Fill.Visible = MsoTriState.msoFalse;
		frame.Line.Visible = MsoTriState.msoTrue;
		frame.Line.ForeColor.RGB = ParseRgb("#666666");
		frame.Line.Weight = 1.1f;
		frame.Line.DashStyle = MsoLineDashStyle.msoLineDash;
		ctx.Shapes.Add(frame);
		AddText(ctx, x + 8f, y - 4f, width - 16f, 18f, title, 8f, "#555555", bold: true);
	}

	private static Microsoft.Office.Interop.PowerPoint.Shape AddText(PresetContext ctx, float x, float y, float width, float height, string text, float size, string color)
	{
		return AddText(ctx, x, y, width, height, text, size, color, bold: false);
	}

	private static Microsoft.Office.Interop.PowerPoint.Shape AddText(PresetContext ctx, float x, float y, float width, float height, string text, float size, string color, bool bold)
	{
		Microsoft.Office.Interop.PowerPoint.Shape box = ctx.Slide.Shapes.AddTextbox(MsoTextOrientation.msoTextOrientationHorizontal, ctx.Left + x, ctx.Top + y, width, height);
		box.Name = UniqueName("Rough_PaperText");
		box.Fill.Visible = MsoTriState.msoFalse;
		box.Line.Visible = MsoTriState.msoFalse;
		SetText(box, text, size, color, bold, MsoParagraphAlignment.msoAlignCenter);
		ctx.Shapes.Add(box);
		return box;
	}

	private static void AddArrow(PresetContext ctx, float x1, float y1, float x2, float y2)
	{
		AddArrow(ctx, x1, y1, x2, y2, "#111111", arrow: true, dashed: false);
	}

	private static void AddArrow(PresetContext ctx, float x1, float y1, float x2, float y2, string color, bool arrow)
	{
		AddArrow(ctx, x1, y1, x2, y2, color, arrow, dashed: false);
	}

	private static void AddArrow(PresetContext ctx, float x1, float y1, float x2, float y2, string color, bool arrow, bool dashed)
	{
		Microsoft.Office.Interop.PowerPoint.Shape line = ctx.Slide.Shapes.AddConnector(MsoConnectorType.msoConnectorStraight, ctx.Left + x1, ctx.Top + y1, ctx.Left + x2, ctx.Top + y2);
		line.Name = UniqueName("Rough_PaperArrow");
		line.Line.Visible = MsoTriState.msoTrue;
		line.Line.ForeColor.RGB = ParseRgb(color);
		line.Line.Weight = 1.25f;
		line.Line.DashStyle = ((!dashed) ? MsoLineDashStyle.msoLineSolid : MsoLineDashStyle.msoLineDash);
		line.Line.EndArrowheadStyle = ((!arrow) ? MsoArrowheadStyle.msoArrowheadNone : MsoArrowheadStyle.msoArrowheadTriangle);
		ctx.Shapes.Add(line);
	}

	private static void AddPatchGrid(PresetContext ctx, float x, float y, int columns, int rows, float cellSize, string startFill, string endFill)
	{
		for (int row = 0; row < rows; row++)
		{
			for (int column = 0; column < columns; column++)
			{
				float t = (float)(column + row) / Math.Max(1f, (float)(columns + rows) - 2f);
				Microsoft.Office.Interop.PowerPoint.Shape shape = ctx.Slide.Shapes.AddShape(MsoAutoShapeType.msoShapeRectangle, ctx.Left + x + (float)column * cellSize, ctx.Top + y + (float)row * cellSize, cellSize, cellSize);
				shape.Name = UniqueName("Rough_PaperGrid");
				StyleShape(shape, MixColor(startFill, endFill, t), "#111111", 0.55f, MsoLineDashStyle.msoLineSolid);
				ctx.Shapes.Add(shape);
			}
		}
	}

	private static void StyleShape(Microsoft.Office.Interop.PowerPoint.Shape shape, string fill, string stroke, float weight, MsoLineDashStyle dash)
	{
		if (string.IsNullOrWhiteSpace(fill))
		{
			shape.Fill.Visible = MsoTriState.msoFalse;
		}
		else
		{
			shape.Fill.Visible = MsoTriState.msoTrue;
			shape.Fill.ForeColor.RGB = ParseRgb(fill);
			shape.Fill.Transparency = 0f;
		}
		shape.Line.Visible = MsoTriState.msoTrue;
		shape.Line.ForeColor.RGB = ParseRgb(stroke);
		shape.Line.Weight = weight;
		shape.Line.DashStyle = dash;
	}

	private static void SetText(Microsoft.Office.Interop.PowerPoint.Shape shape, string text, float size, string color, bool bold, MsoParagraphAlignment alignment)
	{
		try
		{
			shape.TextFrame2.TextRange.Text = text ?? string.Empty;
			shape.TextFrame2.MarginLeft = 3f;
			shape.TextFrame2.MarginRight = 3f;
			shape.TextFrame2.MarginTop = 2f;
			shape.TextFrame2.MarginBottom = 2f;
			shape.TextFrame2.VerticalAnchor = MsoVerticalAnchor.msoAnchorMiddle;
			shape.TextFrame2.TextRange.Font.Size = size;
			shape.TextFrame2.TextRange.Font.Name = "Microsoft YaHei UI";
			shape.TextFrame2.TextRange.Font.NameFarEast = "Microsoft YaHei UI";
			shape.TextFrame2.TextRange.Font.Fill.ForeColor.RGB = ParseRgb(color);
			shape.TextFrame2.TextRange.Font.Bold = (bold ? MsoTriState.msoTrue : MsoTriState.msoFalse);
			shape.TextFrame2.TextRange.ParagraphFormat.Alignment = alignment;
		}
		catch
		{
			try
			{
				shape.TextFrame.TextRange.Text = text ?? string.Empty;
				shape.TextFrame.TextRange.Font.Size = size;
				shape.TextFrame.TextRange.Font.Color.RGB = ParseRgb(color);
				shape.TextFrame.TextRange.ParagraphFormat.Alignment = PpParagraphAlignment.ppAlignCenter;
			}
			catch
			{
			}
		}
	}

	private static Microsoft.Office.Interop.PowerPoint.Shape Group(PresetContext ctx, string title)
	{
		if (ctx.Shapes.Count == 0)
		{
			throw new InvalidOperationException("论文结构预设没有生成任何 PPT 原生对象。");
		}
		string[] names = ctx.Shapes.Select((Microsoft.Office.Interop.PowerPoint.Shape shape2) => shape2.Name).ToArray();
		Microsoft.Office.Interop.PowerPoint.Shape shape = ctx.Slide.Shapes.Range(names).Group();
		shape.Name = UniqueName("Rough_PaperPreset");
		shape.Tags.Add("ROUGH_PAPER_STRUCTURE_PRESET", ctx.PresetId);
		shape.Tags.Add("ROUGH_PAPER_STRUCTURE_TITLE", title ?? string.Empty);
		shape.Select();
		return shape;
	}

	private static PresetContext CreateContext(Slide slide, string presetId, float width, float height)
	{
		PageSetup page = ((Presentation)slide.Parent).PageSetup;
		return new PresetContext
		{
			Slide = slide,
			PresetId = presetId,
			Width = width,
			Height = height,
			Left = page.SlideWidth / 2f - width / 2f,
			Top = page.SlideHeight / 2f - height / 2f
		};
	}

	private static SizeF PresetSize(string presetId)
	{
		switch (NormalizePresetId(presetId))
		{
		case "moeExpertRouting":
		case "multimodalFusion":
		case "diagnosisEvaluationPanel":
		case "federatedLearningMedical":
		case "activeLearningAnnotation":
		case "medicalTriModalDiagnosis":
		case "multimodalRagReportTable":
		case "crossModalAttentionFusion":
		case "survivalOutcomePrediction":
		case "medicalVlmReportDiagnosis":
		case "selfSupervisedMaePretrain":
		case "diffusionAugmentation":
		case "medicalInstructionVlm":
		case "tabularClinicalBranch":
		case "blip2QformerBridge":
		case "llmAdapterFineTune":
		case "tabTransformerRisk":
		case "medclipSemanticMatching":
		case "swinUnetr3DSegmentation":
		case "transformerDecoderBlock":
		case "largeModelRag":
		case "clinicalDeploymentMonitoring":
		case "longitudinalFollowupDiagnosis":
		case "weaklySupervisedMil":
		case "medicalKnowledgeGraphReasoning":
		case "teacherStudentDistillation":
		case "foundationPromptTuning":
			return new SizeF(730f, 245f);
		case "unetSegmentation":
		case "contrastiveDualTower":
			return new SizeF(690f, 235f);
		default:
			return new SizeF(690f, 220f);
		}
	}

	private static void TrySetRoundness(Microsoft.Office.Interop.PowerPoint.Shape shape, float value)
	{
		try
		{
			if (shape.Adjustments.Count > 0)
			{
				shape.Adjustments[1] = Math.Max(0f, Math.Min(0.5f, value));
			}
		}
		catch
		{
		}
	}

	private static string MixColor(string start, string end, float t)
	{
		t = Math.Max(0f, Math.Min(1f, t));
		ColorParts a = RgbParts(ParseRgb(start));
		ColorParts b = RgbParts(ParseRgb(end));
		return string.Format(CultureInfo.InvariantCulture, "#{0:X2}{1:X2}{2:X2}", (int)Math.Round((float)a.R + (float)(b.R - a.R) * t), (int)Math.Round((float)a.G + (float)(b.G - a.G) * t), (int)Math.Round((float)a.B + (float)(b.B - a.B) * t));
	}

	private static int ParseRgb(string hex)
	{
		string value = (hex ?? "#111111").TrimStart('#');
		if (value.Length != 6)
		{
			return 1118481;
		}
		if (!int.TryParse(value.Substring(0, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var r))
		{
			r = 17;
		}
		if (!int.TryParse(value.Substring(2, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var g))
		{
			g = 17;
		}
		if (!int.TryParse(value.Substring(4, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var b))
		{
			b = 17;
		}
		return r + (g << 8) + (b << 16);
	}

	private static ColorParts RgbParts(int rgb)
	{
		return new ColorParts(rgb & 0xFF, (rgb >> 8) & 0xFF, (rgb >> 16) & 0xFF);
	}

	private static string UniqueName(string prefix)
	{
		return prefix + "_" + Guid.NewGuid().ToString("N").Substring(0, 10);
	}
}
